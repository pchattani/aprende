import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import type { Lesson, Unit } from '../engine/schema'
import type { Exercise, LessonResult, Stage } from '../engine/types'
import { loadLesson, vocab, vocabUpTo, levelOf, grammar, units } from '../engine/loader'
import { generateLesson, sentenceId, exchangeId, textId, spicyId } from '../engine/generate'
import { ensureCards, getCards, recordLesson, getKv, setKv, lessonRows, type ItemSpec } from '../db/progress'
import { IRREGULAR } from '@lang/verbs'
import { sttSupported } from '../engine/speech'
import { useSettings, SESSION_COUNT } from '../store/settings'
import { LessonRunner } from '../components/LessonRunner'
import { pinIdFor } from '../engine/pins'
import { rememberReturn } from '../engine/returnTo'
import { GrammarNoteView } from '../components/GrammarNote'
import { StampCard } from '../components/StampCard'
import { Button, SpeakerButton, Chip } from '../components/ui/basics'
import { IconArrowLeft, IconPaw } from '../components/ui/icons'
import { StopArt } from '../components/StopArt'
import { Confetti } from '../components/ui/Confetti'
import { CHEERS } from '../engine/stickers'
import { surpriseFind, pickReward } from '../engine/quests'
import { ownedSouvenirs, awardSouvenir } from '../db/progress'
import { todayKey, streakFrom } from '../engine/mastery'
import { xpFor } from '../engine/xp'
import { useDays } from '../hooks/useProgress'
import { hashString } from '../engine/random'
import { DogButton } from '../components/ui/Dogs'
import { useOutfits } from '../hooks/useOutfits'
import { isStamped, stopFor, type Souvenir, type Stop, type Region } from '../engine/journey'
import { lookupForm } from '../hooks/useDeps'
import { playSound } from '../engine/sounds'
import { TL } from '../engine/course'

type Phase =
  | { kind: 'loading' }
  | { kind: 'teach'; unit: Unit; lesson: Lesson; exercises: Exercise[] }
  | { kind: 'run'; unit: Unit; lesson: Lesson; exercises: Exercise[] }
  | { kind: 'done'; lesson: Lesson; result: LessonResult; found?: Souvenir; stamp?: { stop: Stop; region: Region } }
  | { kind: 'error'; message: string }

export default function LessonPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const speaking = useSettings((s) => s.speaking)
  const sessionLength = useSettings((s) => s.sessionLength)
  const spicyOn = useSettings((s) => s.spicy)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const goHome = () => {
    rememberReturn(id)
    nav('/', { state: { from: id } })
  }
  const saveSession = (exercises: Exercise[]) => void setKv(`lastSession:${id}`, [...new Set(exercises.map(pinIdFor))])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { unit, lesson } = await loadLesson(id)
        const level = levelOf(id)
        const spicy = spicyOn ? lesson.spicy.map((s, i) => ({ s, id: spicyId(id, i) })) : []
        const items: ItemSpec[] = [
          ...lesson.vocab.map((v) => ({ id: v, kind: 'word' as const, level, lessonId: id, grammar: [] as string[] })),
          ...lesson.sentences.map((s, i) => ({ id: sentenceId(id, i, s), kind: 'sentence' as const, level, lessonId: id, grammar: s.grammar })),
          ...lesson.exchanges.map((x, i) => ({ id: exchangeId(id, i), kind: 'sentence' as const, level, lessonId: id, grammar: x.grammar })),
          ...lesson.texts.map((t, i) => ({ id: textId(id, i), kind: 'sentence' as const, level, lessonId: id, grammar: t.grammar })),
          ...spicy.map(({ s, id: sid }) => ({ id: sid, kind: 'sentence' as const, level, lessonId: id, grammar: s.grammar })),
          ...lesson.teach.map((g) => ({ id: g, kind: 'grammar' as const, level, lessonId: id, grammar: [g] })),
        ]
        await ensureCards(items)
        const cards = await getCards(items.map((i) => i.id))
        const stageOf = (itemId: string): Stage | undefined => cards.get(itemId)?.stage
        const seen = [...cards.values()].some((c) => c.reps > 0)
        // Extra material: the unit's dialogue lines and sentences from the lessons before this one.
        const lessonIdx = unit.lessons.findIndex((l) => l.id === lesson.id)
        const extra = [
          ...unit.dialogues.flatMap((d) => d.lines.map((ln, i) => ({ s: { es: ln.es, en: ln.en, altEs: [], altEn: [], grammar: [], vocab: [] }, id: `d.${d.id}.${i + 1}` }))),
          ...unit.lessons.slice(0, Math.max(0, lessonIdx)).flatMap((l) => l.sentences.map((st, i) => ({ s: st, id: sentenceId(l.id, i, st) }))),
        ].filter((x) => x.s.es.split(' ').length <= 16)
        const seenOf = (itemId: string) => cards.get(itemId)?.reps ?? 0
        const avoid = new Set(await getKv<string[]>(`lastSession:${id}`, []))
        const exercises = generateLesson(
          lesson,
          { vocab, pool: vocabUpTo(level), verbs: IRREGULAR, stageOf, seenOf, speech: speaking !== 'off' && sttSupported(), speaking: speaking === 'lots' ? 'lots' : 'some', lookup: lookupForm },
          { count: SESSION_COUNT[sessionLength], extra, avoid, spicy },
        )
        if (!alive) return
        setPhase(lesson.teach.length && !seen ? { kind: 'teach', unit, lesson, exercises } : { kind: 'run', unit, lesson, exercises })
      } catch (e) {
        if (alive) setPhase({ kind: 'error', message: (e as Error).message })
      }
    })()
    return () => {
      alive = false
    }
  }, [id, speaking, sessionLength, spicyOn])

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
  if (phase.kind === 'teach') return <TeachScreen lesson={phase.lesson} onStart={() => setPhase({ ...phase, kind: 'run' })} onBack={goHome} />
  if (phase.kind === 'run')
    return (
      <LessonRunner
        exercises={phase.exercises}
        mode="lesson"
        lessonId={id}
        title={`${unitRef?.title ?? ''} · ${phase.lesson.title}`}
        onQuit={() => {
          saveSession(phase.exercises)
          goHome()
        }}
        onFinish={async (result) => {
          saveSession(phase.exercises)
          await recordLesson(result, phase.unit.id, levelOf(id))
          if (result.completed) playSound('finish')
          let found: Souvenir | undefined
          const accuracy = result.total ? (result.correct + result.almost) / result.total : 0
          if (result.completed && surpriseFind(id, todayKey(), accuracy)) {
            const owned = await ownedSouvenirs()
            const reward = pickReward(levelOf(id), owned, hashString(id + todayKey()))
            if (reward && (await awardSouvenir(reward.id, 'find', id))) found = reward
          }
          // First time the unit's stamp is earned: show the stop's fact.
          let stamp: { stop: Stop; region: Region } | undefined
          if (result.completed) {
            const rows = await lessonRows()
            const key = `stamp:${phase.unit.id}`
            if (isStamped(phase.unit.id, rows, phase.unit.lessons.length) && !(await getKv(key, false))) {
              await setKv(key, true)
              const info = stopFor(phase.unit.id)
              if (info) stamp = { stop: info.stop, region: info.region }
            }
          }
          setPhase({ kind: 'done', lesson: phase.lesson, result, found, stamp })
        }}
      />
    )
  return <DoneScreen result={phase.result} found={phase.found} stamp={phase.stamp} where={stopFor(id.split('.').slice(0, 2).join('.'))} onHome={goHome} onRetry={() => setPhase({ kind: 'loading' })} />
}

function TeachScreen({ lesson, onStart, onBack }: { lesson: Lesson; onStart: () => void; onBack: () => void }) {
  const notes = lesson.teach.map((g) => grammar.get(g)).filter(Boolean)
  const words = lesson.vocab.map((v) => vocab.get(v)).filter(Boolean)
  const [tab, setTab] = useState(0)
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-ink-2">
        <IconArrowLeft width={18} height={18} /> Journey
      </button>
      <p className="eyebrow">Guidebook · before you board</p>
      <h1 className="mt-1 text-[2.1rem]">{lesson.title}</h1>
      {lesson.tip && <p className="mt-3 -rotate-1 rounded-sm border-l-4 border-sun bg-card px-4 py-2 font-hand text-xl leading-snug shadow-card">{lesson.tip}</p>}
      <div className="mt-5 flex gap-5 border-b border-line" role="tablist">
        {notes.map((n, i) => (
          <button key={n!.id} type="button" onClick={() => setTab(i)} role="tab" aria-selected={tab === i} className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition ${tab === i ? 'border-ink text-ink' : 'border-transparent text-ink-2'}`}>
            {n!.title}
          </button>
        ))}
        {words.length > 0 && (
          <button type="button" onClick={() => setTab(notes.length)} role="tab" aria-selected={tab === notes.length} className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition ${tab === notes.length ? 'border-ink text-ink' : 'border-transparent text-ink-2'}`}>
            Words ({words.length})
          </button>
        )}
      </div>
      <div className="card mt-4">
        {tab < notes.length ? (
          <GrammarNoteView note={notes[tab]!} />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {words.map((w) => (
              <li key={w!.id} className="flex items-center gap-3 py-2">
                <SpeakerButton text={w!.lemma} size="sm" />
                <div className="flex-1">
                  <p className="font-bold" lang={TL}>
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
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-xl">
          <Button className="w-full" onClick={onStart}>
            Start the exercises
          </Button>
        </div>
      </div>
    </div>
  )
}

function DoneScreen({ result, found, stamp, where, onHome, onRetry }: { result: LessonResult; found?: Souvenir; stamp?: { stop: Stop; region: Region }; where?: { stop: Stop; region: Region }; onHome: () => void; onRetry: () => void }) {
  const acc = result.total ? Math.round(((result.correct + result.almost) / result.total) * 100) : 0
  const minutes = Math.floor(result.durationMs / 60000)
  const seconds = Math.round((result.durationMs % 60000) / 1000)
  const cheer = CHEERS[result.correct % CHEERS.length]!
  const outfits = useOutfits()
  const days = useDays()
  const km = xpFor(result)
  const shown = useCountUp(km)
  const road = days ? streakFrom(days.filter((d) => d.minutes > 0 || d.lessons > 0 || d.reviews > 0).map((d) => d.date), todayKey()).current : 0
  const perfect = result.completed && result.wrong === 0
  const [date] = useState(() => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }))
  return (
    <div className="animate-rise mx-auto flex min-h-full max-w-xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
      {result.completed && <Confetti />}
      <p className="eyebrow text-center">{result.completed ? 'Postcard mailed home' : 'Session saved'}</p>
      <div className="relative mx-auto mt-3 w-full max-w-sm rotate-[-1.5deg] rounded-[6px] border-[6px] border-card bg-card shadow-float">
        {where && <StopArt stop={where.stop} level={where.region.level} progress={result.completed ? 1 : 0.4} quality="full" lazy={false} className="animate-develop aspect-[3/2] w-full" />}
        <div className="pointer-events-none absolute -bottom-6 right-3 flex h-24 w-24 rotate-[-12deg] flex-col items-center justify-center rounded-full border-[2.5px] border-double text-center text-red" style={{ mixBlendMode: 'multiply' }} aria-hidden="true">
          <span className="font-mono text-[9px] uppercase tracking-widest">{where?.stop.name.slice(0, 16) ?? 'Pawsport'}</span>
          <span className="font-mono text-[11px] font-semibold">{date}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest">+{km} km</span>
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-sm text-center">
        <h1 className="font-hand text-[3rem] leading-none">{result.completed ? cheer.es : 'Session ended'}</h1>
        <p className="mt-2 text-sm text-ink-2">{result.completed ? `${cheer.en} ${perfect ? 'A clean sweep: nothing to revisit.' : `${result.wrong} ${result.wrong === 1 ? 'postcard' : 'postcards'} will come back in your reviews.`}` : 'Everything you practised is saved.'}</p>
        <p className="mt-1 font-hand text-xl text-ink-2">— Leo, Bonchita & Luna</p>
      </div>

      <dl className="mx-auto mt-6 grid w-full max-w-sm grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-card text-center shadow-card">
        <div className="py-3"><dt className="eyebrow">Distance</dt><dd className="mt-1 font-mono text-xl">+{shown}<span className="text-xs text-ink-2"> km</span></dd></div>
        <div className="py-3"><dt className="eyebrow">Accuracy</dt><dd className="mt-1 font-mono text-xl"><span>{acc}%</span></dd></div>
        <div className="py-3"><dt className="eyebrow">Time</dt><dd className="mt-1 font-mono text-xl">{minutes}:{String(seconds).padStart(2, '0')}</dd></div>
      </dl>

      {result.completed && road > 0 && (
        <div className="mx-auto mt-3 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 rotate-[-8deg] items-center justify-center rounded-full border-2 border-red text-red"><IconPaw width={20} height={20} /></span>
          <p className="text-sm"><span className="font-mono text-base">{road}</span> {road === 1 ? 'day' : 'days'} on the road. <span className="text-ink-2">Come back tomorrow for the next stamp.</span></p>
        </div>
      )}
      {stamp && <div className="mx-auto mt-4 w-full max-w-sm"><StampCard stop={stamp.stop} region={stamp.region} /></div>}
      {found && (
        <div className="animate-pop mx-auto mt-4 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-card">
          <span className="stamp text-3xl" aria-hidden="true">{found.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Lucky find: {found.es}</p>
            <p className="text-xs text-ink-2">{found.blurb} Added to your passport.</p>
          </div>
          <div className="flex -space-x-3"><DogButton dog="luna" size={34} outfit={outfits.luna} /></div>
        </div>
      )}
      <div className="mx-auto mt-auto grid w-full max-w-sm gap-3 pt-8">
        {!result.completed && <Button variant="ghost" onClick={onRetry}>Try again</Button>}
        <Button variant="primary" className="py-4" onClick={onHome}>
          Continue
        </Button>
      </div>
    </div>
  )
}

/** Counts up from 0 to the target over about a second (the XP reveal). */
function useCountUp(target: number): number {
  const [reduce] = useState(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  const [n, setN] = useState(reduce ? target : 0)
  useEffect(() => {
    if (reduce) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900)
      setN(Math.round(target * (1 - (1 - k) ** 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduce])
  return n
}
