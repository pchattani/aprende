import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { LevelId, Unit } from '../engine/schema'
import { levels, loadUnit, loadExam, vocab, ui, units as unitIndex, pack } from '../engine/loader'
import { lessonRows, getKv, setKv, awardSouvenir } from '../db/progress'
import { buildRegionQuiz, QUIZ_PASS, type QuizItem } from '../engine/quiz'
import { regionFor, isStamped, souvenirById } from '../engine/journey'
import { hashString } from '../engine/random'
import { todayKey } from '../engine/mastery'
import { MCQ } from '../components/MCQ'
import { Button, ProgressBar } from '../components/ui/basics'
import { IconX } from '../components/ui/icons'
import { Confetti } from '../components/ui/Confetti'
import { DogButton } from '../components/ui/Dogs'
import { useOutfits } from '../hooks/useOutfits'
import { playSound } from '../engine/sounds'
import { rememberReturn } from '../engine/returnTo'

export interface QuizRecord {
  best: number
  last: number
  ts: number
  attempts: number
}

export default function RegionQuiz() {
  const { level = 'a1' } = useParams()
  const nav = useNavigate()
  const lvl = level as LevelId
  const region = regionFor(lvl)
  const meta = levels.find((l) => l.id === lvl)
  const [items, setItems] = useState<QuizItem[] | undefined>()
  const [result, setResult] = useState<{ score: number; correct: number; badge: boolean } | undefined>()
  const outfits = useOutfits()

  useEffect(() => {
    let alive = true
    ;(async () => {
      const unitsOfLevel: Unit[] = []
      for (const u of unitIndex.values()) {
        if (u.level !== lvl || !u.authored) continue
        try {
          unitsOfLevel.push(await loadUnit(u.id))
        } catch {
          /* skip */
        }
      }
      const exam = await loadExam(lvl)
      const rows = await lessonRows()
      const stamped = new Set(unitsOfLevel.filter((u) => isStamped(u.id, rows, u.lessons.length)).map((u) => u.id))
      // Beginner courses (features.taughtOnly): only what the furthest lesson done has taught.
      const taught = pack.features.taughtOnly ? (await import('../engine/taughtData')).taughtGateFor(rows.keys()) : undefined
      const quiz = buildRegionQuiz(lvl, unitsOfLevel, exam, [...vocab.values()], hashString(`quiz:${lvl}:${todayKey()}`), stamped, taught)
      if (alive) setItems(quiz)
    })()
    return () => {
      alive = false
    }
  }, [lvl])

  const back = () => {
    rememberReturn(`region-${lvl}`)
    nav('/', { state: { from: `region-${lvl}` } })
  }

  const finish = async (score: number, correct: number) => {
    const key = `regionQuiz:${lvl}`
    const prev = await getKv<QuizRecord | undefined>(key, undefined)
    await setKv(key, { best: Math.max(prev?.best ?? 0, score), last: score, ts: Date.now(), attempts: (prev?.attempts ?? 0) + 1 } satisfies QuizRecord)
    let badge = false
    if (score >= QUIZ_PASS) {
      badge = await awardSouvenir(`badge-${lvl}`, 'quiz')
      playSound('finish')
    }
    setResult({ score, correct, badge })
  }

  if (!region || !meta) return <div className="p-6">Unknown region.</div>
  return (
    <div className="mx-auto min-h-full max-w-xl px-4 pb-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button type="button" onClick={back} className="rounded-full p-2 text-muted" aria-label="Quit"><IconX /></button>
        <ProgressBar value={result ? 1 : 0} max={1} tone="brand" className="flex-1" />
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">Region quiz · {region.name}</p>
      {!items && <p className="mt-6 text-center text-muted">Preparing the quiz…</p>}
      {items && items.length === 0 && (
        <div className="card mt-4">
          <p className="font-bold">Nothing to quiz yet.</p>
          <p className="text-sm text-muted">This region has no questions available. Finish a few stops and come back.</p>
          <Button className="mt-3 w-full" onClick={back}>Back</Button>
        </div>
      )}
      {items && items.length > 0 && !result && (
        <>
          <h1 className="mt-3 text-2xl">{region.es}</h1>
          <p className="text-sm text-muted">{items.length} questions on what the dogs saw in {region.name}: dialogues, grammar and words. Score {Math.round(QUIZ_PASS * 100)}% or more for the region badge 🏅.</p>
          <MCQ items={items} reveal onDone={(s, c) => void finish(s, c)} label="Finish" />
        </>
      )}
      {result && (
        <div className="mt-6 text-center">
          {result.score >= QUIZ_PASS && <Confetti />}
          <div className="mx-auto flex items-end justify-center -space-x-3">
            <DogButton dog="leo" size={64} mood="curious" outfit={outfits.leo} />
            <DogButton dog="bonchita" size={64} outfit={outfits.bonchita} />
            <DogButton dog="luna" size={64} outfit={outfits.luna} />
          </div>
          <h2 className="mt-4 text-3xl font-semibold">{result.score >= QUIZ_PASS ? ui.quizGreat : 'Not yet'}</h2>
          <p className="mt-1 text-muted">{result.correct} of {items?.length ?? 0} correct · {Math.round(result.score * 100)}%</p>
          {result.score >= QUIZ_PASS ? (
            <p className="mt-3 rounded-2xl bg-gold-100 p-3 text-sm font-bold dark:bg-gold-500/15">
              🏅 {result.badge ? `New badge: ${souvenirById(`badge-${lvl}`)?.es ?? region.name}. It's in your passport.` : `You already hold the ${region.name} badge. Nice revision.`}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">The quiz changes every day. Review the stops you missed and try again tomorrow.</p>
          )}
          <Button className="mt-6 w-full" onClick={back}>Back to the course</Button>
        </div>
      )}
    </div>
  )
}
