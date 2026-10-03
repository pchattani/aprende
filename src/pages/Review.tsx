import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { Exercise, CardRow, LessonResult } from '../engine/types'
import type { Lesson, LevelId } from '../engine/schema'
import { db } from '../db'
import { dueCards, bumpDay } from '../db/progress'
import { generateReview } from '../engine/generate'
import { vocab, vocabUpTo, loadLesson, grammar, LEVEL_ORDER_LIST } from '../engine/loader'
import { IRREGULAR } from '../lang/es/verbs'
import { sttSupported } from '../engine/speech'
import { useSettings } from '../store/settings'
import { useDueCount, useAllCards } from '../hooks/useProgress'
import { LessonRunner } from '../components/LessonRunner'
import { Button, PageHeader, Empty } from '../components/ui/basics'
import { todayKey } from '../engine/mastery'
import { playSound } from '../engine/sounds'

const SESSION = 20

export default function Review() {
  const [params] = useSearchParams()
  const grammarFilter = params.get('grammar') ?? undefined
  const due = useDueCount()
  const all = useAllCards()
  const speechOn = useSettings((s) => s.speech)
  const nav = useNavigate()
  const [exercises, setExercises] = useState<Exercise[] | undefined>()
  const [summary, setSummary] = useState<LessonResult | undefined>()
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    setExercises(undefined)
    setSummary(undefined)
  }, [grammarFilter])

  const start = async (mode: 'due' | 'practice') => {
    setBuilding(true)
    let cards: CardRow[]
    if (grammarFilter) {
      cards = (await db.cards.where('grammar').equals(grammarFilter).toArray()).sort((a, b) => a.due - b.due).slice(0, SESSION)
    } else if (mode === 'due') {
      cards = await dueCards(SESSION)
    } else {
      cards = (await db.cards.orderBy('due').toArray()).slice(0, SESSION)
    }
    const lessonIds = new Set(cards.filter((c) => c.kind === 'sentence').map((c) => c.lessonId))
    const lessons = new Map<string, Lesson>()
    for (const id of lessonIds) {
      try {
        lessons.set(id, (await loadLesson(id)).lesson)
      } catch {
        /* unit missing */
      }
    }
    const maxLevel = cards.reduce<LevelId>((m, c) => (LEVEL_ORDER_LIST.indexOf(c.level) > LEVEL_ORDER_LIST.indexOf(m) ? c.level : m), 'a1')
    const ex = generateReview(
      cards.filter((c) => c.kind !== 'grammar').map((c) => ({ id: c.id, kind: c.kind, stage: c.stage })),
      {
        word: (id) => vocab.get(id),
        sentence: (id) => {
          const parts = id.split('.') // s.a1.u01.l1.3
          const lessonId = parts.slice(1, 4).join('.')
          const n = Number(parts[4])
          const lesson = lessons.get(lessonId)
          const s = lesson?.sentences[n - 1]
          return lesson && s ? { s, lesson } : undefined
        },
      },
      { vocab, pool: vocabUpTo(maxLevel), verbs: IRREGULAR, stageOf: (id) => cards.find((c) => c.id === id)?.stage, speech: speechOn && sttSupported() },
    )
    setBuilding(false)
    setExercises(ex)
  }

  if (exercises && exercises.length > 0 && !summary) {
    return (
      <div className="-mx-4 -mt-[calc(0.75rem+env(safe-area-inset-top))] min-h-screen">
        <LessonRunner
          exercises={exercises}
          mode="review"
          lessonId="review"
          title={grammarFilter ? `Practice: ${grammar.get(grammarFilter)?.title ?? grammarFilter}` : 'Review'}
          onQuit={() => setExercises(undefined)}
          onFinish={async (r) => {
            await bumpDay(todayKey(), { xp: r.xp })
            playSound('finish')
            setSummary(r)
          }}
        />
      </div>
    )
  }

  const note = grammarFilter ? grammar.get(grammarFilter) : undefined
  return (
    <div>
      <PageHeader title={note ? 'Targeted practice' : 'Review'} subtitle={note ? note.title : 'Spaced repetition keeps what you learned.'} />
      {summary && (
        <div className="card mb-4 border-ok-500">
          <p className="font-extrabold">Session complete · +{summary.xp} XP</p>
          <p className="text-sm text-muted">
            {summary.correct} correct, {summary.almost} almost, {summary.wrong} to repeat. Items you missed come back sooner.
          </p>
          <Button className="mt-3 w-full" onClick={() => { setSummary(undefined); setExercises(undefined) }}>
            Done
          </Button>
        </div>
      )}
      {!summary && (
        <>
          <div className="card mb-4 text-center">
            <p className="text-5xl font-extrabold text-sky-600">{grammarFilter ? (all?.filter((c) => c.grammar.includes(grammarFilter)).length ?? 0) : due ?? 0}</p>
            <p className="text-sm text-muted">{grammarFilter ? 'items on this grammar point' : 'due now'}</p>
            <Button className="mt-4 w-full" disabled={building || (grammarFilter ? false : (due ?? 0) === 0)} onClick={() => void start('due')}>
              {building ? 'Building session…' : grammarFilter ? 'Practise this point' : 'Start review'}
            </Button>
            {!grammarFilter && (due ?? 0) === 0 && (all?.length ?? 0) > 0 && (
              <Button variant="ghost" className="mt-2 w-full" disabled={building} onClick={() => void start('practice')}>
                Nothing due — practise anyway
              </Button>
            )}
          </div>
          {(all?.length ?? 0) === 0 && (
            <Empty title="No items yet">
              Complete your first lesson and the words, sentences and grammar you meet will start appearing here on a schedule.
              <div className="mt-3">
                <Button variant="ghost" onClick={() => nav('/')}>Go to the path</Button>
              </div>
            </Empty>
          )}
          {(all?.length ?? 0) > 0 && <Forecast cards={all!} />}
        </>
      )}
    </div>
  )
}

function Forecast({ cards }: { cards: CardRow[] }) {
  const now = Date.now()
  const buckets = [
    { label: 'Now', n: cards.filter((c) => c.due <= now).length },
    { label: 'Tomorrow', n: cards.filter((c) => c.due > now && c.due <= now + 86_400_000).length },
    { label: 'This week', n: cards.filter((c) => c.due > now + 86_400_000 && c.due <= now + 7 * 86_400_000).length },
    { label: 'Later', n: cards.filter((c) => c.due > now + 7 * 86_400_000).length },
  ]
  const words = cards.filter((c) => c.kind === 'word')
  return (
    <div className="card">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Schedule</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {buckets.map((b) => (
          <div key={b.label} className="rounded-xl bg-surface-2 p-2">
            <p className="text-xl font-extrabold">{b.n}</p>
            <p className="text-[11px] text-muted">{b.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        {words.length} words in rotation · {words.filter((w) => w.stage >= 2).length} you can produce from memory
      </p>
    </div>
  )
}
