import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router'
import type { Lesson, Unit } from '../engine/schema'
import type { Exercise, LessonResult, Stage } from '../engine/types'
import { loadLesson, vocab, vocabUpTo, levelOf, units, pack } from '../engine/loader'
import { generateLesson, sentenceId, exchangeId, textId, spicyId } from '../engine/generate'
import { ensureCards, getCards, recordLesson, getKv, setKv, lessonRows, type ItemSpec } from '../db/progress'
import { IRREGULAR } from '@lang/verbs'
import { sttSupported } from '../engine/speech'
import { useSettings, SESSION_COUNT } from '../store/settings'
import { LessonRunner } from '../components/LessonRunner'
import { pinIdFor } from '../engine/pins'
import { rememberReturn } from '../engine/returnTo'
import { GuidebookBody, GuidebookSheet } from '../components/Guidebook'
import { hasGuidebook } from '../engine/guidebook'
import { charId } from '../engine/chars'
import { StampCard } from '../components/StampCard'
import { Button } from '../components/ui/basics'
import { IconArrowLeft, IconPaw, IconBook, IconCheck, IconRoute } from '../components/ui/icons'
import { StopArt } from '../components/StopArt'
import { Confetti } from '../components/ui/Confetti'
import { CHEERS } from '../engine/stickers'
import { surpriseFind, pickReward } from '../engine/quests'
import { ownedSouvenirs, awardSouvenir, totalKm, coinBalance, awardCoins, payStreakMilestone, streak } from '../db/progress'
import { todayKey, streakFrom } from '../engine/mastery'
import { xpFor } from '../engine/xp'
import { useDays } from '../hooks/useProgress'
import { hashString } from '../engine/random'
import { lessonCoins, streakMilestoneCoins, levelUpCoins, CURRENCY, type LessonCoins } from '../engine/economy'
import { travellerLevel, levelsCrossed, kmForLevel, titleUnlockedAt } from '../engine/traveller'
import { CoinChip, CoinIcon } from '../components/rewards/Coin'
import { useCoinFlight, useCountTo, prefersReducedMotion } from '../components/rewards/motion'
import { LevelBadge, LevelBar } from '../components/rewards/Level'
import { LevelUp } from '../components/rewards/LevelUp'
import { ChestReveal } from '../components/rewards/ChestReveal'
import { playReward } from '../components/rewards/sfx'
import { DogButton } from '../components/ui/Dogs'
import { useOutfits } from '../hooks/useOutfits'
import { isStamped, stopFor, type Souvenir, type Stop, type Region } from '../engine/journey'
import { lookupForm } from '../hooks/useDeps'
import { playSound } from '../engine/sounds'

/** What the lesson paid out, for the staged tally on the results screen (already saved when it shows). */
interface DoneReward {
  kmBefore: number
  kmAfter: number
  coinsBefore: number
  lesson: LessonCoins
  /** Streak milestone bonus paid today (0 when none) and the days on the road. */
  streak: number
  streakDays: number
  /** Travel fund for the level(s) reached. */
  levelCoins: number
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'teach'; unit: Unit; lesson: Lesson; exercises: Exercise[] }
  | { kind: 'run'; unit: Unit; lesson: Lesson; exercises: Exercise[] }
  | { kind: 'done'; lesson: Lesson; result: LessonResult; found?: Souvenir; stamp?: { stop: Stop; region: Region }; reward: DoneReward }
  | { kind: 'error'; message: string }

export default function LessonPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const speaking = useSettings((s) => s.speaking)
  const sessionLength = useSettings((s) => s.sessionLength)
  const spicyOn = useSettings((s) => s.spicy)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  // ?guide opens the guidebook first even for a lesson already practised (the guidebook link on the journey).
  const [params] = useSearchParams()
  const wantGuide = params.has('guide')
  const [guideOpen, setGuideOpen] = useState(false)
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
          ...(lesson.write ?? []).map((c) => ({ id: charId(c), kind: 'char' as const, level, lessonId: id, grammar: [] as string[] })),
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
        // Beginner courses (features.taughtOnly): only what this lesson and the ones before it taught is shown to understand.
        const taught = pack.features.taughtOnly ? (await import('../engine/taughtData')).taughtGateAt(id) : undefined
        const exercises = generateLesson(
          lesson,
          { vocab, pool: vocabUpTo(level), verbs: IRREGULAR, stageOf, seenOf, speech: speaking !== 'off' && sttSupported(), speaking: speaking === 'lots' ? 'lots' : 'some', lookup: lookupForm, taught },
          { count: SESSION_COUNT[sessionLength], extra, avoid, spicy },
        )
        if (!alive) return
        // First time: the guidebook before boarding when the lesson teaches grammar or characters to write.
        setPhase(((lesson.teach.length || lesson.write?.length) && !seen) || (wantGuide && hasGuidebook(lesson)) ? { kind: 'teach', unit, lesson, exercises } : { kind: 'run', unit, lesson, exercises })
      } catch (e) {
        if (alive) setPhase({ kind: 'error', message: (e as Error).message })
      }
    })()
    return () => {
      alive = false
    }
  }, [id, speaking, sessionLength, spicyOn, wantGuide])

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
  const guide = guideOpen && <GuidebookSheet lesson={phase.lesson} onClose={() => setGuideOpen(false)} />
  if (phase.kind === 'run')
    return (
      <>
      {guide}
      <LessonRunner
        headerExtra={hasGuidebook(phase.lesson) && (
          <button type="button" onClick={() => setGuideOpen(true)} className="shrink-0 rounded-full p-1 text-ink-2 transition hover:bg-card hover:text-ink" aria-label="Open the guidebook" title="Guidebook: grammar and words">
            <IconBook width={22} height={22} />
          </button>
        )}
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
          const kmBefore = await totalKm()
          const coinsBefore = await coinBalance()
          await recordLesson(result, phase.unit.id, levelOf(id))
          if (result.completed) playSound('finish')
          // Coins: the lesson's purse, a streak milestone (once a day) and the travel fund of any level reached.
          const kmAfter = await totalKm()
          const coins = lessonCoins(result)
          if (coins.total) await awardCoins(coins.total, `lesson:${id}`)
          let streakBonus = 0
          let streakDays = 0
          if (result.completed) {
            streakDays = (await streak()).current
            streakBonus = await payStreakMilestone(streakDays, streakMilestoneCoins(streakDays), todayKey())
          }
          const crossed = levelsCrossed(kmBefore, kmAfter)
          const levelCoins = crossed.reduce((n, l) => n + levelUpCoins(l), 0)
          if (levelCoins) await awardCoins(levelCoins, `level:${crossed.at(-1)}`)
          const reward: DoneReward = { kmBefore, kmAfter, coinsBefore, lesson: coins, streak: streakBonus, streakDays, levelCoins }
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
          setGuideOpen(false)
          setPhase({ kind: 'done', lesson: phase.lesson, result, found, stamp, reward })
        }}
      />
      </>
    )
  return (
    <>
      {guide}
      <DoneScreen result={phase.result} found={phase.found} stamp={phase.stamp} reward={phase.reward} where={stopFor(id.split('.').slice(0, 2).join('.'))} onHome={goHome} onRetry={() => setPhase({ kind: 'loading' })} onGuide={hasGuidebook(phase.lesson) ? () => setGuideOpen(true) : undefined} />
    </>
  )
}

function TeachScreen({ lesson, onStart, onBack }: { lesson: Lesson; onStart: () => void; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-ink-2">
        <IconArrowLeft width={18} height={18} /> Journey
      </button>
      <p className="eyebrow">Guidebook · before you board</p>
      <h1 className="mt-1 text-[2.1rem]">{lesson.title}</h1>
      {lesson.tip && <p className="mt-3 -rotate-1 rounded-sm border-l-4 border-sun bg-card px-4 py-2 font-hand text-xl leading-snug shadow-card">{lesson.tip}</p>}
      <div className="mt-5">
        <GuidebookBody lesson={lesson} />
      </div>
      <p className="mt-3 text-center text-xs text-ink-2">The guidebook stays open to you: tap the book during the lesson.</p>
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


/** Stages of the results screen: the tally rows one by one, the coins, the level bar, then the chest. */
const STAGE = { accuracy: 1, time: 2, km: 3, coins: 4, level: 5, chest: 6 } as const
const STAGE_DELAY: Record<number, number> = { 0: 450, 1: 520, 2: 380, 3: 650 }

function DoneScreen({ result, found, stamp, reward, where, onHome, onRetry, onGuide }: { result: LessonResult; found?: Souvenir; stamp?: { stop: Stop; region: Region }; reward: DoneReward; where?: { stop: Stop; region: Region }; onHome: () => void; onRetry: () => void; onGuide?: () => void }) {
  const acc = result.total ? Math.round(((result.correct + result.almost) / result.total) * 100) : 0
  const minutes = Math.floor(result.durationMs / 60000)
  const seconds = Math.round((result.durationMs % 60000) / 1000)
  const cheer = CHEERS[result.correct % CHEERS.length]!
  const days = useDays()
  const outfits = useOutfits()
  const km = xpFor(result)
  const road = days ? streakFrom(days.filter((d) => d.minutes > 0 || d.lessons > 0 || d.reviews > 0).map((d) => d.date), todayKey()).current : 0
  const perfect = result.completed && result.wrong === 0
  const [date] = useState(() => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }))

  const [reduce] = useState(prefersReducedMotion)
  const crossed = levelsCrossed(reward.kmBefore, reward.kmAfter)
  const finalLevel = crossed.at(-1)
  const earned = reward.lesson.total + reward.streak
  const [stage, setStage] = useState<number>(reduce ? STAGE.chest : 0)
  const [chip, setChip] = useState(reduce ? reward.coinsBefore + earned + reward.levelCoins : reward.coinsBefore)
  const [barKm, setBarKm] = useState(reduce ? reward.kmAfter : reward.kmBefore)
  const [levelOpen, setLevelOpen] = useState(reduce && finalLevel !== undefined)
  const [levelShown, setLevelShown] = useState(reduce)
  const barRef = useRef(barKm)
  const chipRef = useRef<HTMLSpanElement>(null)
  const coinRow = useRef<HTMLDivElement>(null)
  const { launch, layer } = useCoinFlight()

  const shownAcc = useCountTo(acc, { from: 0, active: stage >= STAGE.accuracy, duration: 650 })
  const shownKm = useCountTo(km, { from: 0, active: stage >= STAGE.km, duration: 700 })
  const shownCoins = useCountTo(earned, { from: 0, active: stage >= STAGE.coins, duration: 650 })

  // The timed tally rows.
  useEffect(() => {
    const delay = STAGE_DELAY[stage]
    if (delay === undefined) return
    const t = setTimeout(() => setStage((s) => s + 1), delay)
    return () => clearTimeout(t)
  }, [stage])

  // Coins fly from the tally to the purse; the level bar starts once they land.
  useEffect(() => {
    if (stage !== STAGE.coins || reduce) return
    if (earned <= 0) {
      const t = setTimeout(() => setStage(STAGE.level), 250)
      return () => clearTimeout(t)
    }
    let landed = 0
    const n = Math.min(10, Math.max(3, Math.round(earned / 3)))
    const t = setTimeout(() => {
      launch(coinRow.current, chipRef.current, n, (last) => {
        landed++
        playReward('coin')
        setChip(last ? reward.coinsBefore + earned : reward.coinsBefore + Math.round((earned * landed) / n))
        if (last) setTimeout(() => setStage(STAGE.level), 250)
      })
    }, 350)
    return () => clearTimeout(t)
  }, [stage, reduce, earned, launch, reward.coinsBefore])

  // The level bar fills; it pauses at a new level for the celebration, then goes on to the total.
  useEffect(() => {
    if (stage !== STAGE.level || levelOpen || reduce) return
    const stopAt = finalLevel !== undefined && !levelShown ? kmForLevel(finalLevel) : reward.kmAfter
    const start = barRef.current
    const dur = Math.min(1300, Math.max(450, ((stopAt - start) / Math.max(1, travellerLevel(start).span)) * 1400))
    let raf = 0
    let t0 = -1
    const tick = (t: number) => {
      if (t0 < 0) t0 = t
      const k = Math.min(1, (t - t0) / dur)
      const v = start + (stopAt - start) * (1 - (1 - k) ** 2)
      barRef.current = v
      setBarKm(v)
      if (k < 1) raf = requestAnimationFrame(tick)
      else if (finalLevel !== undefined && !levelShown) setLevelOpen(true)
      else setStage(STAGE.chest)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stage, levelOpen, levelShown, finalLevel, reduce, reward.kmAfter])

  const closeLevel = () => {
    setLevelOpen(false)
    setLevelShown(true)
    if (!reduce) setChip((c) => c + reward.levelCoins)
  }
  const t = travellerLevel(barKm)
  const newTitle = crossed.map(titleUnlockedAt).filter(Boolean).at(-1)
  const on = (s: number) => (stage >= s ? 'tally-row is-on' : 'tally-row')

  return (
    <div className="animate-rise mx-auto flex min-h-full max-w-xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      {result.completed && <Confetti />}
      {layer}
      {levelOpen && finalLevel !== undefined && <LevelUp level={finalLevel} newTitle={newTitle} coins={reward.levelCoins} onClose={closeLevel} />}
      <div className="mx-auto flex w-full max-w-sm items-center justify-between">
        <p className="eyebrow">{result.completed ? 'Postcard mailed home' : 'Session saved'}</p>
        <CoinChip ref={chipRef} value={chip} size="sm" />
      </div>
      <div className="relative mx-auto mt-3 w-full max-w-sm rotate-[-1.5deg] rounded-[6px] border-[6px] border-card bg-card shadow-float">
        {where && <StopArt stop={where.stop} level={where.region.level} progress={result.completed ? 1 : 0.4} quality="full" lazy={false} className="animate-develop aspect-[3/2] w-full" />}
        <div className="pointer-events-none absolute -bottom-6 right-3 flex h-24 w-24 rotate-[-12deg] flex-col items-center justify-center rounded-full border-[2.5px] border-double text-center text-red" style={{ mixBlendMode: 'multiply' }} aria-hidden="true">
          <span className="font-mono text-[9px] uppercase tracking-widest">{where?.stop.name.slice(0, 16) ?? 'Pawsport'}</span>
          <span className="font-mono text-[11px] font-semibold">{date}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest">+{km} km</span>
        </div>
      </div>
      <div className="mx-auto mt-7 w-full max-w-sm text-center">
        <h1 className="font-hand text-[3rem] leading-none">{result.completed ? cheer.es : 'Session ended'}</h1>
        <p className="mt-2 text-sm text-ink-2">{result.completed ? `${cheer.en} ${perfect ? 'A clean sweep: nothing to revisit.' : `${result.wrong} ${result.wrong === 1 ? 'postcard' : 'postcards'} will come back in your reviews.`}` : 'Everything you practised is saved.'}</p>
        <div className="mt-2 flex items-end justify-center gap-1">
          <DogButton dog="leo" size={58} act={result.completed ? 'cheer' : 'idle'} outfit={outfits.leo} />
          <DogButton dog="bonchita" size={52} act={result.completed ? 'cheer' : 'idle'} outfit={outfits.bonchita} />
          <DogButton dog="luna" size={58} act={result.completed ? 'cheer' : 'idle'} outfit={outfits.luna} />
        </div>
        <p className="font-hand text-xl text-ink-2">— Leo, Bonchita & Luna</p>
      </div>

      {/* the trip report: staged tally */}
      <section className="airmail-edge mx-auto mt-5 w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-card px-4 pb-3 pt-4 shadow-card" aria-label="Trip report">
        <p className="eyebrow">Trip report</p>
        <dl className="mt-1 divide-y divide-dashed divide-[var(--line)]">
          <TallyRow className={on(STAGE.accuracy)} icon={<IconCheck width={16} height={16} strokeWidth={3} />} tone="var(--ok)" label="Accuracy">
            <span className={stage >= STAGE.accuracy ? 'tally-pop' : ''}>{shownAcc}%</span>
          </TallyRow>
          <TallyRow className={on(STAGE.time)} icon={<ClockGlyph />} tone="var(--blue)" label="Time">
            {minutes}:{String(seconds).padStart(2, '0')}
          </TallyRow>
          <TallyRow className={on(STAGE.km)} icon={<IconRoute width={16} height={16} />} tone="var(--red)" label="Distance">
            +{shownKm}<span className="text-xs text-ink-2"> km</span>
          </TallyRow>
          {result.completed && (
            <div ref={coinRow} className={on(STAGE.coins)}>
              <TallyRow icon={<CoinIcon size={22} />} label={CURRENCY.plural.charAt(0).toUpperCase() + CURRENCY.plural.slice(1)}>
                <span className="text-[#b07a0c] dark:text-sun">+{shownCoins}</span>
              </TallyRow>
              <p className="-mt-1 flex flex-wrap gap-1 pb-2 pl-10 text-[11px] font-bold text-ink-2">
                <span className="rounded-full bg-surface-2 px-2 py-0.5">Finished +{reward.lesson.base}</span>
                {reward.lesson.accuracy > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5">Accuracy +{reward.lesson.accuracy}</span>}
                {reward.lesson.perfect > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5">Clean sweep +{reward.lesson.perfect}</span>}
                {reward.streak > 0 && <span className="rounded-full bg-[color-mix(in_srgb,var(--red)_14%,var(--card))] px-2 py-0.5 text-red">{reward.streakDays}-day road +{reward.streak}</span>}
              </p>
            </div>
          )}
        </dl>
        {/* traveller level */}
        <div className={`${on(STAGE.level)} mt-1 flex items-center gap-3 border-t border-line pt-3`}>
          <LevelBadge key={t.level} level={t.level} size={44} className={stage >= STAGE.level && t.level > travellerLevel(reward.kmBefore).level ? 'badge-flash shrink-0' : 'shrink-0'} />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-display font-bold">Level {t.level} · <span className="text-ink-2">{t.title}</span></span>
              <span className="shrink-0 font-mono text-[11px] text-ink-2">{Math.max(0, Math.ceil(t.nextKm - barKm))} km to Lv {t.level + 1}</span>
            </p>
            <LevelBar progress={t.progress} className="mt-1.5" />
          </div>
        </div>
      </section>

      {result.completed && road > 0 && (
        <div className="mx-auto mt-3 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 rotate-[-8deg] items-center justify-center rounded-full border-2 border-red text-red"><IconPaw width={20} height={20} /></span>
          <p className="text-sm"><span className="font-mono text-base">{road}</span> {road === 1 ? 'day' : 'days'} on the road. <span className="text-ink-2">Come back tomorrow for the next stamp.</span></p>
        </div>
      )}
      {stamp && <div className="mx-auto mt-4 w-full max-w-sm"><StampCard stop={stamp.stop} region={stamp.region} /></div>}
      {found && stage >= STAGE.chest && (
        <ChestReveal className="animate-rise mx-auto mt-4 w-full max-w-sm" reward={{ kind: 'souvenir', souvenir: found }} label="Lucky find" note="Luna sniffed it out on the way. Added to your passport." />
      )}
      <div className="mx-auto mt-auto grid w-full max-w-sm gap-3 pt-8">
        {!result.completed && <Button variant="ghost" onClick={onRetry}>Try again</Button>}
        {onGuide && (
          <Button variant="ghost" onClick={onGuide}>
            <IconBook width={18} height={18} /> Review the guidebook
          </Button>
        )}
        <Button variant="primary" className="py-4" onClick={onHome}>
          Continue
        </Button>
      </div>
    </div>
  )
}

function TallyRow({ icon, tone, label, children, className = '' }: { icon: React.ReactNode; tone?: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-3 py-2 ${className}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={tone ? { color: tone, background: `color-mix(in srgb, ${tone} 14%, var(--card))` } : undefined}>{icon}</span>
      <dt className="text-sm font-semibold">{label}</dt>
      <span className="mx-1 h-px flex-1 border-b-2 border-dotted border-line" aria-hidden="true" />
      <dd className="font-mono text-xl font-semibold">{children}</dd>
    </div>
  )
}

function ClockGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
