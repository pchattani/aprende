import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import type { Lesson, Unit } from '../engine/schema'
import type { Exercise, LessonResult, Stage } from '../engine/types'
import { loadLesson, vocab, vocabUpTo, levelOf, grammar, units } from '../engine/loader'
import { generateLesson, sentenceId, exchangeId, textId } from '../engine/generate'
import { ensureCards, getCards, recordLesson, type ItemSpec } from '../db/progress'
import { IRREGULAR } from '../lang/es/verbs'
import { sttSupported } from '../engine/speech'
import { useSettings } from '../store/settings'
import { LessonRunner } from '../components/LessonRunner'
import { GrammarNoteView } from '../components/GrammarNote'
import { Button, SpeakerButton, Chip } from '../components/ui/basics'
import { IconArrowLeft, IconTrophy } from '../components/ui/icons'
import { Confetti } from '../components/ui/Confetti'
import { CHEERS } from '../engine/stickers'
import { surpriseFind, pickReward } from '../engine/quests'
import { ownedSouvenirs, awardSouvenir } from '../db/progress'
import { todayKey } from '../engine/mastery'
import { hashString } from '../engine/random'
import { Leo, Bonchita, Luna } from '../components/ui/Dogs'
import type { Souvenir } from '../engine/journey'
import { playSound } from '../engine/sounds'

type Phase = { kind: 'loading' } | { kind: 'teach'; unit: Unit; lesson: Lesson; exercises: Exercise[] } | { kind: 'run'; unit: Unit; lesson: Lesson; exercises: Exercise[] } | { kind: 'done'; lesson: Lesson; result: LessonResult; found?: Souvenir } | { kind: 'error'; message: string }

export default function LessonPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const speechOn = useSettings((s) => s.speech)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { unit, lesson } = await loadLesson(id)
        const level = levelOf(id)
        const items: ItemSpec[] = [
          ...lesson.vocab.map((v) => ({ id: v, kind: 'word' as const, level, lessonId: id, grammar: [] as string[] })),
          ...lesson.sentences.map((s, i) => ({ id: sentenceId(id, i, s), kind: 'sentence' as const, level, lessonId: id, grammar: s.grammar })),
          ...lesson.exchanges.map((x, i) => ({ id: exchangeId(id, i), kind: 'sentence' as const, level, lessonId: id, grammar: x.grammar })),
          ...lesson.texts.map((t, i) => ({ id: textId(id, i), kind: 'sentence' as const, level, lessonId: id, grammar: t.grammar })),
          ...lesson.teach.map((g) => ({ id: g, kind: 'grammar' as const, level, lessonId: id, grammar: [g] })),
        ]
        await ensureCards(items)
        const cards = await getCards(items.map((i) => i.id))
        const stageOf = (itemId: string): Stage | undefined => cards.get(itemId)?.stage
        const seen = [...cards.values()].some((c) => c.reps > 0)
        const exercises = generateLesson(lesson, { vocab, pool: vocabUpTo(level), verbs: IRREGULAR, stageOf, speech: speechOn && sttSupported() }, { count: 14 })
        if (!alive) return
        setPhase(lesson.teach.length && !seen ? { kind: 'teach', unit, lesson, exercises } : { kind: 'run', unit, lesson, exercises })
      } catch (e) {
        if (alive) setPhase({ kind: 'error', message: (e as Error).message })
      }
    })()
    return () => {
      alive = false
    }
  }, [id, speechOn])

  const unitRef = units.get(id.split('.').slice(0, 2).join('.'))

  if (phase.kind === 'loading') return <div className="p-6 text-center text-muted">Preparing your lesson…</div>
  if (phase.kind === 'error')
    return (
      <div className="p-6">
        <p className="font-bold">This lesson is not available yet.</p>
        <p className="text-sm text-muted">{phase.message}</p>
        <Link to="/" className="btn btn-ghost mt-4">Back to the course</Link>
      </div>
    )
  if (phase.kind === 'teach') return <TeachScreen lesson={phase.lesson} onStart={() => setPhase({ ...phase, kind: 'run' })} onBack={() => nav('/')} />
  if (phase.kind === 'run')
    return (
      <LessonRunner
        exercises={phase.exercises}
        mode="lesson"
        lessonId={id}
        title={`${unitRef?.title ?? ''} · ${phase.lesson.title}`}
        onQuit={() => nav('/')}
        onFinish={async (result) => {
          await recordLesson(result, phase.unit.id, levelOf(id))
          if (result.completed) playSound('finish')
          let found: Souvenir | undefined
          const accuracy = result.total ? result.correct / result.total : 0
          if (result.completed && surpriseFind(id, todayKey(), accuracy)) {
            const owned = await ownedSouvenirs()
            const reward = pickReward(levelOf(id), owned, hashString(id + todayKey()))
            if (reward && (await awardSouvenir(reward.id, 'find', id))) found = reward
          }
          setPhase({ kind: 'done', lesson: phase.lesson, result, found })
        }}
      />
    )
  return <DoneScreen result={phase.result} found={phase.found} onHome={() => nav('/')} onRetry={() => setPhase({ kind: 'loading' })} />
}

function TeachScreen({ lesson, onStart, onBack }: { lesson: Lesson; onStart: () => void; onBack: () => void }) {
  const notes = lesson.teach.map((g) => grammar.get(g)).filter(Boolean)
  const words = lesson.vocab.map((v) => vocab.get(v)).filter(Boolean)
  const [tab, setTab] = useState(0)
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-sm font-bold text-muted">
        <IconArrowLeft width={18} height={18} /> Course
      </button>
      <Chip tone="brand">New in this lesson</Chip>
      <h1 className="mt-2 text-3xl">{lesson.title}</h1>
      {lesson.tip && <p className="mt-3 rounded-2xl bg-gold-100/80 p-3 text-sm font-semibold dark:bg-gold-500/15">💡 {lesson.tip}</p>}
      <div className="mt-4 flex gap-2">
        {notes.map((n, i) => (
          <button key={n!.id} type="button" onClick={() => setTab(i)} className={`rounded-full px-3.5 py-1.5 text-sm font-extrabold transition ${tab === i ? 'bg-brand-gradient text-white shadow-md' : 'bg-surface-2 text-muted'}`}>
            {n!.title}
          </button>
        ))}
        {words.length > 0 && (
          <button type="button" onClick={() => setTab(notes.length)} className={`rounded-full px-3.5 py-1.5 text-sm font-extrabold transition ${tab === notes.length ? 'bg-brand-gradient text-white shadow-md' : 'bg-surface-2 text-muted'}`}>
            Words ({words.length})
          </button>
        )}
      </div>
      <div className="card mt-3">
        {tab < notes.length ? (
          <GrammarNoteView note={notes[tab]!} />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {words.map((w) => (
              <li key={w!.id} className="flex items-center gap-3 py-2">
                <SpeakerButton text={w!.lemma} size="sm" />
                <div className="flex-1">
                  <p className="font-bold" lang="es">
                    {w!.pos === 'noun' && w!.gender ? `${w!.gender === 'f' ? 'la' : 'el'} ` : ''}
                    {w!.lemma}
                  </p>
                  <p className="text-sm text-muted">{w!.en.join(', ')}</p>
                </div>
                <Chip>{w!.pos}</Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-[var(--bg)]/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-xl">
          <Button className="w-full" onClick={onStart}>
            Start the exercises
          </Button>
        </div>
      </div>
    </div>
  )
}

function DoneScreen({ result, found, onHome, onRetry }: { result: LessonResult; found?: Souvenir; onHome: () => void; onRetry: () => void }) {
  const acc = result.total ? Math.round((result.correct / result.total) * 100) : 0
  const minutes = Math.max(1, Math.round(result.durationMs / 60000))
  const cheer = CHEERS[result.correct % CHEERS.length]!
  return (
    <div className="animate-rise mx-auto flex min-h-full max-w-xl flex-col items-center justify-center px-6 text-center">
      {result.completed && <Confetti />}
      <div className={`animate-pop flex h-32 w-32 items-center justify-center rounded-[2.5rem] text-white ${result.completed ? 'bg-sunset-gradient shadow-float' : 'bg-bad-100 text-bad-600'}`}>
        {result.completed ? <span className="text-6xl" aria-hidden="true">{result.wrong === 0 ? '🏆' : '🎉'}</span> : <IconTrophy width={56} height={56} />}
      </div>
      <h1 className="text-gradient mt-6 text-4xl">{result.completed ? cheer.es : 'Session ended'}</h1>
      <p className="mt-1 font-semibold text-muted">{result.completed ? `${cheer.en} ${result.wrong === 0 ? 'A clean sweep: nothing to revisit.' : `${result.wrong} ${result.wrong === 1 ? 'item' : 'items'} will come back in your reviews.`}` : 'Everything you practised is saved.'}</p>
      {found && (
        <div className="animate-pop mt-5 flex w-full items-center gap-3 rounded-2xl bg-gold-100 p-3 text-left dark:bg-gold-500/15">
          <div className="flex -space-x-2"><Leo size={36} mood="curious" /><Bonchita size={36} /><Luna size={36} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">Lucky find! {found.emoji} {found.es}</p>
            <p className="text-xs text-muted">{found.blurb} Added to your passport.</p>
          </div>
        </div>
      )}
      <div className="mt-6 grid w-full grid-cols-3 gap-2">
        <Stat label="Answers" value={`${result.correct + result.almost} / ${result.total}`} tone="gold" />
        <Stat label="Accuracy" value={`${acc}%`} tone="ok" />
        <Stat label="Time" value={`${minutes} min`} tone="sky" />
      </div>
      <div className="mt-8 grid w-full gap-2">
        {!result.completed && (
          <Button onClick={onRetry}>Try again</Button>
        )}
        <Button variant={result.completed ? 'primary' : 'ghost'} onClick={onHome}>
          Continue
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'ok' | 'sky' }) {
  const c = tone === 'gold' ? 'border-gold-500 text-gold-600' : tone === 'ok' ? 'border-ok-500 text-ok-600' : 'border-sky-500 text-sky-600'
  return (
    <div className={`rounded-2xl border-2 ${c} overflow-hidden shadow-card`}>
      <p className={`py-1 text-xs font-extrabold uppercase tracking-wide text-white ${tone === 'gold' ? 'bg-gold-500' : tone === 'ok' ? 'bg-ok-500' : 'bg-sky-500'}`}>{label}</p>
      <p className="bg-surface py-2 text-xl font-extrabold">{value}</p>
    </div>
  )
}
