import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { levels, loadExam, vocab, examExists } from '../engine/loader'
import { buildStage, stagePassed, placementLevel, STAGE_SIZE, type PlacementStage, type PlacementItem } from '../engine/placement'
import { chooseStartLevel } from '../db/progress'
import { Button, ProgressBar, SpeakerButton } from '../components/ui/basics'
import { IconX, IconTrophy } from '../components/ui/icons'
import { playSound } from '../engine/sounds'
import type { LevelId } from '../engine/schema'

interface Hook {
  placement: { index: number; total: number; answer: number; stage: LevelId }
}

/** Levels that have both lessons and a checkpoint exam, in order. */
const STAGE_LEVELS: LevelId[] = levels.filter((l) => l.units.some((u) => u.authored) && examExists(l.id)).map((l) => l.id)

export default function Placement() {
  const nav = useNavigate()
  const [seed] = useState(() => Date.now() % 100_000)
  const [stageIdx, setStageIdx] = useState(0)
  const [stage, setStage] = useState<PlacementStage | undefined>()
  const [itemIdx, setItemIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [passed, setPassed] = useState<boolean[]>([])
  const [finished, setFinished] = useState(false)
  const [selected, setSelected] = useState<number | undefined>()

  // Build the current stage lazily (the exam file is loaded on demand).
  useEffect(() => {
    const level = STAGE_LEVELS[stageIdx]
    if (!level) return
    let alive = true
    ;(async () => {
      const exam = await loadExam(level)
      const levelVocab = [...vocab.values()].filter((v) => v.level === level)
      const s = buildStage(level, exam, levelVocab, seed + stageIdx * 7919)
      if (alive) {
        setStage(s)
        setItemIdx(0)
        setCorrect(0)
        setSelected(undefined)
      }
    })()
    return () => {
      alive = false
    }
  }, [stageIdx, seed])

  const item: PlacementItem | undefined = stage?.items[itemIdx]
  const totalItems = STAGE_LEVELS.length * STAGE_SIZE
  const progress = stageIdx * STAGE_SIZE + itemIdx

  useEffect(() => {
    if (!item || !stage) return
    try {
      if (window.sessionStorage.getItem('e2e')) {
        ;(window as unknown as Hook).placement = { index: progress, total: totalItems, answer: item.answer, stage: stage.level }
      }
    } catch {
      /* ignore */
    }
  }, [item, stage, progress, totalItems])

  if (STAGE_LEVELS.length === 0) {
    return <div className="p-6"><p className="font-bold">No placement test is available yet.</p><Button className="mt-4" onClick={() => nav('/welcome')}>Back</Button></div>
  }

  const result = finished ? placementLevel(STAGE_LEVELS, passed) : undefined

  const answer = (i: number) => {
    if (!stage || !item || selected !== undefined) return
    setSelected(i)
    const ok = i === item.answer
    const nCorrect = correct + (ok ? 1 : 0)
    const nextItem = itemIdx + 1
    window.setTimeout(() => {
      setSelected(undefined)
      if (nextItem < stage.items.length) {
        setCorrect(nCorrect)
        setItemIdx(nextItem)
        return
      }
      const ok = stagePassed(nCorrect, stage.items.length)
      const nextPassed = [...passed, ok]
      setPassed(nextPassed)
      if (ok && stageIdx + 1 < STAGE_LEVELS.length) {
        setStageIdx(stageIdx + 1)
        setStage(undefined)
      } else {
        setFinished(true)
        playSound('finish')
      }
    }, 250)
  }

  const finish = async (level: LevelId) => {
    await chooseStartLevel(level)
    nav('/')
  }

  if (result) {
    const meta = levels.find((l) => l.id === result)
    const beyond = !STAGE_LEVELS.includes(result)
    const highestPassed = passed.filter(Boolean).length
    return (
      <div className="mx-auto min-h-full max-w-xl px-4 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top))] text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gold-300 text-gold-600"><IconTrophy width={48} height={48} /></div>
        <h1 className="mt-4 text-3xl font-extrabold">Your level: {meta?.title ?? result.toUpperCase()}</h1>
        <p className="mt-1 text-muted">{meta?.name}</p>
        <p className="mt-4 text-left">
          {passed.length === STAGE_LEVELS.length && passed.every(Boolean)
            ? `You passed every stage, all the way to ${STAGE_LEVELS[STAGE_LEVELS.length - 1]!.toUpperCase()}. Leo, Bonchita and Luna will meet you at the end of the world: Ushuaia awaits. Earlier regions stay open whenever you want to revisit them.`
            : beyond
            ? `You passed every placement stage we have (${STAGE_LEVELS.map((l) => l.toUpperCase()).join(', ')}). Lessons for ${result.toUpperCase()} are still being written, so everything up to B1 is open: use the Reader, the verb trainer and the B1 review lessons while new levels arrive.`
            : highestPassed === 0
              ? 'Starting from the beginning is the right call: A1 builds the foundations everything else rests on.'
              : `You passed ${STAGE_LEVELS.slice(0, highestPassed).map((l) => l.toUpperCase()).join(' and ')}, so we'll start you at ${result.toUpperCase()}. Earlier levels stay open if you ever want to go back and practise.`}
        </p>
        <ul className="card mt-4 divide-y divide-[var(--line)] text-left text-sm">
          {STAGE_LEVELS.map((l, i) => (
            <li key={l} className="flex items-center justify-between py-2">
              <span>{l.toUpperCase()} stage</span>
              <span className="font-bold">{i < passed.length ? (passed[i] ? 'Passed' : 'Not yet') : 'Not taken'}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-6 w-full" onClick={() => void finish(result)}>Start at {result.toUpperCase()}</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => nav('/welcome')}>Choose a different level</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-full max-w-xl px-4 pb-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => nav('/welcome')} className="rounded-full p-2 text-muted" aria-label="Quit"><IconX /></button>
        <ProgressBar value={progress} max={totalItems} tone="gold" className="flex-1" />
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">Placement test · {stage?.level.toUpperCase() ?? '…'} · {itemIdx + 1} / {stage?.items.length ?? STAGE_SIZE}</p>
      {!item ? (
        <p className="p-6 text-center text-muted">Loading…</p>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-bold text-muted">{item.kind === 'vocab' ? 'What does this word mean?' : 'Choose the correct option'}</p>
          <div className="mt-2 flex items-center gap-3">
            {item.kind === 'vocab' && <SpeakerButton text={item.prompt} size="sm" />}
            <p className="text-2xl font-extrabold" lang={item.lang}>{item.prompt}</p>
          </div>
          <div className="mt-5 grid gap-2" role="radiogroup" aria-label="Options">
            {item.options.map((o, i) => (
              <button key={i} type="button" role="radio" aria-checked={selected === i} onClick={() => answer(i)} disabled={selected !== undefined} className={`tile py-3 text-left ${selected === i ? 'selected' : ''}`} lang={item.kind === 'vocab' ? 'en' : 'es'}>
                {o}
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted">Don't guess: if you don't know, pick anything and move on. The test stops when a level is too hard.</p>
        </div>
      )}
    </div>
  )
}
