import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { Exercise, CardRow, LessonResult, PinRow } from '../engine/types'
import type { Lesson, LevelId } from '../engine/schema'
import { db } from '../db'
import { dueCards, bumpDay, recordPinnedAnswer, unpin } from '../db/progress'
import { generateReview, generatePinned, exchangeAsSentence, textAsSentence } from '../engine/generate'
import { vocab, vocabUpTo, loadLesson, grammar, LEVEL_ORDER_LIST, levelOf } from '../engine/loader'
import { IRREGULAR } from '@lang/verbs'
import { sttSupported } from '../engine/speech'
import { useSettings } from '../store/settings'
import { useDueCount, useAllCards, usePins } from '../hooks/useProgress'
import { LessonRunner } from '../components/LessonRunner'
import { pinIdFor } from '../engine/pins'
import { Button, PageHeader, Empty, Chip } from '../components/ui/basics'
import { todayKey } from '../engine/mastery'
import { playSound } from '../engine/sounds'
import { lookupForm } from '../hooks/useDeps'
import { TL } from '../engine/course'

const SESSION = 20
type Tab = 'due' | 'pinned' | 'practice'

export default function Review() {
  const [params] = useSearchParams()
  const grammarFilter = params.get('grammar') ?? undefined
  const initialTab = (params.get('tab') as Tab | null) ?? 'due'
  // Keyed so that changing the filter resets the session state.
  return <ReviewSession key={`${grammarFilter ?? ''}:${initialTab}`} grammarFilter={grammarFilter} initialTab={initialTab} />
}

/** Resolve a sentence-like card id (s./x./t./p.) to its sentence and lesson. */
function sentenceLookup(lessons: Map<string, Lesson>) {
  return (id: string) => {
    const parts = id.split('.') // s.a1.u01.l1.3
    const lessonId = parts.slice(1, 4).join('.')
    const n = Number(parts[4])
    const lesson = lessons.get(lessonId)
    if (!lesson) return undefined
    const kind = parts[0]
    if (kind === 'x') {
      const x = lesson.exchanges[n - 1]
      return x ? { s: exchangeAsSentence(x), lesson } : undefined
    }
    if (kind === 't') {
      const t = lesson.texts[n - 1]
      return t ? { s: textAsSentence(t), lesson } : undefined
    }
    if (kind === 'p') {
      const p = lesson.spicy[n - 1]
      return p ? { s: p, lesson } : undefined
    }
    const s = lesson.sentences[n - 1]
    return s ? { s, lesson } : undefined
  }
}

async function loadLessons(ids: Iterable<string>): Promise<Map<string, Lesson>> {
  const lessons = new Map<string, Lesson>()
  for (const id of new Set(ids)) {
    try {
      lessons.set(id, (await loadLesson(id)).lesson)
    } catch {
      /* unit missing */
    }
  }
  return lessons
}

function ReviewSession({ grammarFilter, initialTab }: { grammarFilter: string | undefined; initialTab: Tab }) {
  const due = useDueCount()
  const all = useAllCards()
  const pins = usePins()
  const speaking = useSettings((s) => s.speaking)
  const spicy = useSettings((s) => s.spicy)
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [exercises, setExercises] = useState<Exercise[] | undefined>()
  const [sessionMode, setSessionMode] = useState<'review' | 'pinned'>('review')
  const [summary, setSummary] = useState<LessonResult | undefined>()
  const [building, setBuilding] = useState(false)
  const speech = speaking !== 'off' && sttSupported()
  const ctxFor = (maxLevel: LevelId, cards: CardRow[]) => ({ vocab, pool: vocabUpTo(maxLevel), verbs: IRREGULAR, stageOf: (id: string) => cards.find((c) => c.id === id)?.stage, speech, speaking: speaking === 'lots' ? ('lots' as const) : ('some' as const), lookup: lookupForm })
  const notSpicy = (c: CardRow) => spicy || !c.id.startsWith('p.')

  const start = async (mode: 'due' | 'practice') => {
    setBuilding(true)
    let cards: CardRow[]
    if (grammarFilter) {
      cards = (await db.cards.where('grammar').equals(grammarFilter).toArray()).filter(notSpicy).sort((a, b) => a.due - b.due).slice(0, SESSION)
    } else if (mode === 'due') {
      cards = await dueCards(SESSION, Date.now(), notSpicy)
    } else {
      cards = (await db.cards.orderBy('due').toArray()).filter(notSpicy).slice(0, SESSION)
    }
    const lessons = await loadLessons(cards.filter((c) => c.kind === 'sentence').map((c) => c.lessonId))
    const maxLevel = cards.reduce<LevelId>((m, c) => (LEVEL_ORDER_LIST.indexOf(c.level) > LEVEL_ORDER_LIST.indexOf(m) ? c.level : m), 'a1')
    const ex = generateReview(
      cards.filter((c) => c.kind !== 'grammar').map((c) => ({ id: c.id, kind: c.kind, stage: c.stage })),
      { word: (id) => vocab.get(id), sentence: sentenceLookup(lessons) },
      ctxFor(maxLevel, cards),
    )
    setBuilding(false)
    setSessionMode('review')
    setExercises(ex)
  }
  const startPinned = async (rows: PinRow[]) => {
    setBuilding(true)
    const lessons = await loadLessons(rows.map((p) => p.lessonId))
    const maxLevel = rows.reduce<LevelId>((m, p) => {
      const l = levelOf(p.lessonId)
      return LEVEL_ORDER_LIST.indexOf(l) > LEVEL_ORDER_LIST.indexOf(m) ? l : m
    }, 'a1')
    const cards = await db.cards.bulkGet(rows.map((p) => p.id))
    const ex = generatePinned(rows.slice(0, 12), { word: (id) => vocab.get(id), sentence: sentenceLookup(lessons) }, ctxFor(maxLevel, cards.filter((c): c is CardRow => Boolean(c))))
    setBuilding(false)
    setSessionMode('pinned')
    setExercises(ex)
  }

  if (exercises && exercises.length > 0 && !summary) {
    return (
      <div className="-mx-4 -mt-[calc(0.75rem+env(safe-area-inset-top))] min-h-screen">
        <LessonRunner
          exercises={exercises}
          mode={sessionMode}
          lessonId={sessionMode}
          title={sessionMode === 'pinned' ? 'Pinned: your mistakes' : grammarFilter ? `Practice: ${grammar.get(grammarFilter)?.title ?? grammarFilter}` : 'Review'}
          onQuit={() => setExercises(undefined)}
          onAnswer={sessionMode === 'pinned' ? (ex, verdict) => void recordPinnedAnswer(pinIdFor(ex), verdict) : undefined}
          onFinish={async (r) => {
            await bumpDay(todayKey(), { minutes: Math.max(1, Math.round(r.durationMs / 60000)) })
            playSound('finish')
            setSummary(r)
          }}
        />
      </div>
    )
  }

  const note = grammarFilter ? grammar.get(grammarFilter) : undefined
  const pinCount = pins?.length ?? 0
  return (
    <div>
      <PageHeader title={note ? 'Targeted practice' : 'Review'} subtitle={note ? note.title : 'Spaced repetition keeps what you learned.'} />
      {summary && (
        <div className="card mb-4 border-ok-500">
          <p className="font-extrabold">{sessionMode === 'pinned' ? 'Pinned practice complete' : 'Session complete'} · {summary.total} answered</p>
          <p className="text-sm text-muted">
            {summary.correct} correct, {summary.almost} almost, {summary.wrong} to repeat. {sessionMode === 'pinned' ? 'Two correct answers in a row unpin an item.' : 'Items you missed come back sooner.'}
          </p>
          <Button className="mt-3 w-full" onClick={() => { setSummary(undefined); setExercises(undefined) }}>
            Done
          </Button>
        </div>
      )}
      {!summary && !grammarFilter && (
        <div className="mb-4 flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Review sections">
          {(['due', 'pinned', 'practice'] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-full py-1.5 text-sm font-extrabold capitalize transition ${tab === t ? 'bg-brand-gradient text-white shadow-md' : 'text-muted'}`}>
              {t === 'due' ? `Due${due ? ` · ${due}` : ''}` : t === 'pinned' ? `Pinned${pinCount ? ` · ${pinCount}` : ''}` : 'Practice'}
            </button>
          ))}
        </div>
      )}
      {!summary && (grammarFilter || tab === 'due') && (
        <>
          <div className="card mb-4 text-center">
            <p className="text-5xl font-extrabold text-sky-600">{grammarFilter ? (all?.filter((c) => c.grammar.includes(grammarFilter)).length ?? 0) : due ?? 0}</p>
            <p className="text-sm text-muted">{grammarFilter ? 'items on this grammar point' : 'due now'}</p>
            <Button className="mt-4 w-full" disabled={building || (grammarFilter ? false : (due ?? 0) === 0)} onClick={() => void start('due')}>
              {building ? 'Building session…' : grammarFilter ? 'Practise this point' : 'Start review'}
            </Button>
            {!grammarFilter && (due ?? 0) === 0 && (all?.length ?? 0) > 0 && <p className="mt-3 text-sm text-muted">Nothing due. Try the Pinned or Practice tab.</p>}
          </div>
          {(all?.length ?? 0) === 0 && (
            <Empty title="No items yet">
              Complete your first lesson and the words, sentences and grammar you meet will start appearing here on a schedule.
              <div className="mt-3">
                <Button variant="ghost" onClick={() => nav('/')}>Go to the course</Button>
              </div>
            </Empty>
          )}
          {(all?.length ?? 0) > 0 && <Forecast cards={all!} />}
        </>
      )}
      {!summary && !grammarFilter && tab === 'pinned' && <PinnedTab pins={pins ?? []} building={building} onStart={() => void startPinned(pins ?? [])} />}
      {!summary && !grammarFilter && tab === 'practice' && (
        <div className="card text-center">
          <p className="font-extrabold">Practise anyway</p>
          <p className="mt-1 text-sm text-muted">A mixed session of {Math.min(SESSION, all?.length ?? 0)} items, soonest-due first, even if nothing is due yet.</p>
          <Button className="mt-4 w-full" disabled={building || (all?.length ?? 0) === 0} onClick={() => void start('practice')}>
            {building ? 'Building session…' : 'Start practice'}
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => nav('/palabras')}>Play with your words 🎴</Button>
        </div>
      )}
    </div>
  )
}

function PinnedTab({ pins, building, onStart }: { pins: PinRow[]; building: boolean; onStart: () => void }) {
  if (!pins.length) {
    return (
      <Empty title="Nothing pinned">
        When you get something wrong, it is pinned here (automatically, or with the 📌 button) so you can re-test exactly that point. Two correct answers in a row unpin it.
      </Empty>
    )
  }
  return (
    <div>
      <div className="card mb-4 text-center">
        <p className="text-5xl font-extrabold text-brand-600">{pins.length}</p>
        <p className="text-sm text-muted">pinned {pins.length === 1 ? 'mistake' : 'mistakes'} waiting for a focused re-test</p>
        <Button className="mt-4 w-full" disabled={building} onClick={onStart}>
          {building ? 'Building session…' : 'Practise pinned'}
        </Button>
      </div>
      <ul className="space-y-2">
        {pins.map((p) => (
          <li key={p.id} className="card flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-snug" lang={TL}>{p.es}</p>
              <p className="text-xs text-muted" lang="en">{p.en}</p>
              <p className="mt-1 text-xs"><span className="text-bad-600 line-through">{p.given}</span> → <span className="font-bold text-ok-600">{p.expected}</span></p>
              {p.hint && <p className="mt-1 text-xs text-muted">{p.hint}</p>}
              <div className="mt-1 flex gap-1">
                <Chip>{p.exerciseKind}</Chip>
                {p.streak > 0 && <Chip tone="ok">{p.streak} / 2 correct</Chip>}
              </div>
            </div>
            <button type="button" className="shrink-0 text-xs font-bold text-muted underline" onClick={() => void unpin(p.id)} aria-label={`Unpin ${p.es}`}>Unpin</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Forecast({ cards }: { cards: CardRow[] }) {
  const [now] = useState(() => Date.now())
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
