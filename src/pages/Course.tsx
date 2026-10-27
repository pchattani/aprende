import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { SouvenirIcon } from '../components/art/SouvenirArt'
import { Link, useNavigate, useLocation } from 'react-router'
import { levels, loadUnit, units as unitIndex } from '../engine/loader'
import { shiftDay, todayKey } from '../engine/mastery'
import { DEFAULT_START_LEVEL, levelIndex, courseAccess, courseLessons, type CourseAccess } from '../engine/unlock'
import { getKv, claimQuest, awardCoins } from '../db/progress'
import { errandCoins } from '../engine/economy'
import { ChestReveal, CoinChip } from '../components/rewards'
import { db } from '../db'
import { useLessonRows, useAllCards, useDays, useDueCount, useExams, useKvValue, useQuests, useKvPrefix } from '../hooks/useProgress'
import { useOutfits } from '../hooks/useOutfits'
import type { QuizRecord } from './RegionQuiz'
import { useSettings, SESSION_COUNT } from '../store/settings'
import { xpFor } from '../engine/xp'
import { IconArrowUp, IconCheck, IconPaw, IconRoute, IconPlane, IconPassport } from '../components/ui/icons'
import { StopArt } from '../components/StopArt'
import { DogButton } from '../components/ui/Dogs'
import { Itinerary } from '../components/map/Itinerary'
import { LegBar } from '../components/map/LegBar'
import { TicketIcon } from '../components/map/MapArt'
import { stopFor, souvenirById, isStamped, type Souvenir } from '../engine/journey'
import { takeReturn } from '../engine/returnTo'
import { questsForDate, progressFor, pickReward } from '../engine/quests'
import type { LevelId, Lesson } from '../engine/schema'
import type { CardRow, DayRow, LessonRow } from '../engine/types'
import { ui } from '../engine/loader'
import { COURSES, HUB_URL } from '../courses'
import { COURSE_ID, LANGUAGE } from '../engine/course'

/** The itinerary scrolls to the current lesson once per page load (later visits keep their scroll position). */
let autoScrolled = false

export default function Course() {
  const lessonRows = useLessonRows()
  const cards = useAllCards()
  const days = useDays()
  const due = useDueCount()
  const exams = useExams()
  const goal = useSettings((s) => s.dailyMinutes)
  const sessionLength = useSettings((s) => s.sessionLength)
  const startLevel = useKvValue<LevelId>('startLevel', DEFAULT_START_LEVEL)
  const nav = useNavigate()
  const loc = useLocation()
  const outfits = useOutfits()
  const quizRecords = useKvPrefix<QuizRecord>('regionQuiz:')
  const [lessonMeta, setLessonMeta] = useState<Map<string, Lesson[]>>(new Map())
  const [checked, setChecked] = useState(false)
  const [highlight, setHighlight] = useState<string | undefined>()
  const [hour] = useState(() => new Date().getHours())
  const today = todayKey()
  const quests = useQuests(today)

  // First launch: nothing done yet and no starting level chosen → welcome screen.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const onboarded = await getKv('onboarded', false)
      const done = onboarded ? 1 : await db.lessons.count()
      if (!alive) return
      if (done === 0) nav('/welcome', { replace: true })
      else setChecked(true)
    })()
    return () => {
      alive = false
    }
  }, [nav])

  // Load lesson titles for authored units (small files, cached).
  useEffect(() => {
    let alive = true
    ;(async () => {
      const authored = [...unitIndex.values()].filter((u) => u.authored)
      const loaded = await Promise.all(authored.map((u) => loadUnit(u.id).then((unit) => unit.lessons, () => undefined)))
      const m = new Map<string, Lesson[]>()
      authored.forEach((u, i) => {
        if (loaded[i]) m.set(u.id, loaded[i])
      })
      if (alive) setLessonMeta(m)
    })()
    return () => {
      alive = false
    }
  }, [])

  const lessonCounts = useMemo(() => new Map([...lessonMeta.entries()].map(([k, v]) => [k, v.length])), [lessonMeta])
  const ready = checked && Boolean(lessonRows && cards && days && exams && startLevel !== undefined) && lessonMeta.size > 0

  // Which lessons are open (unlock.ts): needs every stop's lessons, so it waits for the titles.
  const access = useMemo(
    () => (lessonRows && exams && startLevel !== undefined && lessonMeta.size > 0 ? courseAccess(courseLessons(levels, lessonCounts), { lessonRows, exams, startLevel }) : undefined),
    [lessonRows, exams, startLevel, lessonMeta, lessonCounts],
  )

  const cardsByLesson = useMemo(() => {
    const m = new Map<string, CardRow[]>()
    for (const c of cards ?? []) {
      const arr = m.get(c.lessonId) ?? []
      arr.push(c)
      m.set(c.lessonId, arr)
    }
    return m
  }, [cards])

  // The lesson the dogs are at (up next), known once titles are loaded.
  const nextId = useMemo(() => {
    if (!lessonRows || startLevel === undefined || !access) return undefined
    return access.current(currentStop(lessonRows, startLevel)?.unitId)?.id
  }, [lessonRows, access, startLevel])

  // Coming back from a lesson or a quiz: scroll to the spot the learner left from.
  // Otherwise, on the first visit of this page load, glide to the current lesson in the itinerary.
  useEffect(() => {
    if (!ready) return
    const target = (loc.state as { from?: string } | null)?.from ?? takeReturn()
    let elId: string | undefined
    let auto = false
    if (target) elId = /^(unit|region|checkpoint|writing)-/.test(target) ? target : `lesson-${target}`
    else if (!autoScrolled && nextId && window.scrollY < 10) {
      elId = `lesson-${nextId}`
      auto = true
    }
    autoScrolled = true
    if (!elId) return
    const id = elId
    let tries = 0
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const el = document.getElementById(id)
      if (el && auto) {
        let smooth = true
        try {
          smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        } catch {
          /* default to smooth */
        }
        // the learner may have started scrolling already: leave them be
        if (window.scrollY < 10) el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
      } else if (el) {
        el.scrollIntoView({ block: 'center' })
        setHighlight(id)
        setTimeout(() => setHighlight(undefined), 2200)
      } else if (tries++ < 30) requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelled = true
    }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!checked || !lessonRows || !cards || !days || !exams || startLevel === undefined || !access) return <div className="p-8 text-center text-muted">Loading…</div>

  const byDate = new Map(days.map((d) => [d.date, d]))
  const active = (d?: DayRow) => Boolean(d && (d.minutes > 0 || d.lessons > 0 || d.reviews > 0))
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6)).map((date) => ({ date, on: active(byDate.get(date)) }))
  const weekCount = week.filter((w) => w.on).length
  let inARow = 0
  for (let i = 0; ; i++) {
    const d = shiftDay(today, -i)
    if (active(byDate.get(d))) inARow++
    else if (i === 0) continue
    else break
  }
  const minutesToday = byDate.get(today)?.minutes ?? 0
  const greeting = hour < 12 ? ui.greetings.morning : hour < 20 ? ui.greetings.afternoon : ui.greetings.evening
  const goalDone = minutesToday >= goal

  // Current stop: the last lesson worked on, else the first lesson of the recommended level.
  const current = currentStop(lessonRows, startLevel)
  const currentInfo = current ? stopFor(current.unitId) : undefined

  // Up next: the next open, unfinished lesson from the stop the learner is at (else from their start).
  const next = nextLesson(access, lessonMeta, current?.unitId)
  const nextInfo = next ? stopFor(next.unitId) : currentInfo
  const kmToday = byDate.get(today)?.xp ?? 0
  const practisedToday = active(byDate.get(today))
  const stampsTotal = levels.reduce((n, l) => n + l.units.filter((u) => u.authored && isStamped(u.id, lessonRows, lessonCounts.get(u.id) ?? 4)).length, 0)
  const level = nextInfo?.region.level ?? startLevel
  const kmMax = xpFor({ correct: SESSION_COUNT[sessionLength], almost: 0, wrong: 0, completed: true })

  return (
    <div className="animate-rise">
      <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center justify-between gap-2 border-b border-line bg-paper px-4 pb-2.5 pt-[calc(0.6rem+env(safe-area-inset-top))]" style={{ marginTop: 'calc(-0.75rem - env(safe-area-inset-top))' }}>
        <a href={HUB_URL} className="flex min-w-0 items-center gap-2 rounded-lg py-1 pr-2" aria-label={`All languages · now ${LANGUAGE}`}>
          <span className="text-[1.35rem] leading-none" aria-hidden="true">{FLAG}</span>
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-[1.05rem]">Pawsport</span>
            <span className="block text-[11px] font-semibold text-ink-2">{LANGUAGE} · <span className="font-mono">{level.toUpperCase()}</span> <span aria-hidden="true">▾</span></span>
          </span>
        </a>
        <div className="flex items-center gap-1.5">
          <Link to="/profile" className={`g-pill ${practisedToday ? 'text-ink' : 'text-ink-2'}`} aria-label={`${inARow} days on the road`}>
            <IconPaw width={15} height={15} className={practisedToday ? 'text-red' : ''} />{inARow}
          </Link>
          <Link to="/insights" className="g-pill" aria-label={`${kmToday} km today`}>
            <IconRoute width={15} height={15} className="text-blue" />{kmToday}<span className="text-[10px] text-ink-2">km</span>
          </Link>
          <Link to="/perros" className="rounded-full" aria-label="Purse and outfit shop">
            <CoinChip size="sm" />
          </Link>
        </div>
      </div>

      <section className="mb-5 flex items-end gap-3" aria-label="A note from the dogs">
        <div className="flex shrink-0 -space-x-4">
          <DogButton dog="leo" size={48} outfit={outfits.leo} />
          <DogButton dog="bonchita" size={48} outfit={outfits.bonchita} />
          <DogButton dog="luna" size={48} outfit={outfits.luna} />
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="font-hand text-[1.7rem] leading-none">{greeting}!</h1>
          <p className="mt-1 text-sm text-ink-2">{nextInfo ? <>We're in <b className="font-semibold text-ink">{nextInfo.stop.name}</b>. {goalDone ? "Today's leg is done." : `${Math.max(0, goal - minutesToday)} min left on today's leg.`}</> : 'Packing our bags…'}</p>
        </div>
      </section>

      {next && nextInfo && (
        <BoardingPass next={next} info={nextInfo} started={Boolean(lessonRows.get(next.id))} km={kmMax} />
      )}

      <section className="g-card mb-4" aria-label="Today and this week">
        <div className="flex items-center justify-between px-4 pt-3.5">
          <p className="eyebrow">Travel log</p>
          <p className="text-xs text-ink-2"><span className="font-mono text-ink">{weekCount}</span> of 7 days this week{inARow > 1 ? <> · <span className="font-mono text-ink">{inARow}</span> days on the road</> : ''}</p>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 px-4" aria-label={`${weekCount} of 7 days practised this week`}>
          {week.map((w, i) => {
            const d = new Date(w.date + 'T12:00:00')
            const isToday = i === 6
            return (
              <span key={w.date} className="flex flex-col items-center gap-1">
                <span className={`relative flex aspect-square w-full max-w-[2.6rem] items-center justify-center rounded-full border-[1.5px] ${w.on ? 'border-red text-red' : isToday ? 'border-dashed border-ink-2 text-ink-2' : 'border-line text-line'}`} style={w.on ? { transform: `rotate(${(i * 37) % 24 - 12}deg)` } : undefined}>
                  {w.on ? <IconPaw width={18} height={18} /> : <span className="font-mono text-[11px] text-ink-2">{d.getDate()}</span>}
                </span>
                <span className={`text-[10px] font-semibold ${isToday ? 'text-ink' : 'text-ink-2'}`}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              </span>
            )
          })}
        </div>
        <div className="mt-4 border-t border-dashed border-line px-4 pb-3.5 pt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Today's leg</span>
            <span className="font-mono text-ink-2"><span className="text-ink">{minutesToday}</span> / {goal} min</span>
          </div>
          <LegBar value={minutesToday} max={goal} />
        </div>
      </section>

      {(due ?? 0) > 0 && (
        <Link to="/review" className="g-card mb-4 flex items-center gap-4 p-4">
          <span className="relative h-12 w-14 shrink-0" aria-hidden="true">
            {[0, 1, 2].map((k) => (
              <span key={k} className="absolute inset-0 rounded-[4px] border border-line bg-card shadow-card" style={{ transform: `rotate(${(k - 1) * 8}deg) translateY(${k * -2}px)`, filter: `grayscale(${0.4 + k * 0.25})`, opacity: 1 - k * 0.12 }}>
                <span className="absolute inset-1 rounded-[2px] bg-card-2" />
              </span>
            ))}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight">{due} postcards are fading</p>
            <p className="text-xs text-ink-2">Retouch them before the ink runs out. Reviews are where words stick.</p>
          </div>
          <span className="g-btn px-4 py-2 text-sm" style={{ '--g-face': 'var(--blue)' } as CSSProperties}>Retouch</span>
        </Link>
      )}

      {quests && <QuestsCard date={today} day={quests.day} rows={quests.rows} owned={quests.owned} level={currentInfo?.region.level ?? startLevel} />}

      <div className="mb-8 grid grid-cols-2 gap-3">
        <Link to="/passport" className="g-card flex items-center gap-3 p-3" aria-label="Passport">
          <IconPassport width={26} height={26} className="shrink-0 text-blue" />
          <span className="min-w-0 leading-tight"><span className="block font-semibold">Passport</span><span className="block text-xs text-ink-2"><span className="font-mono">{stampsTotal}</span> {stampsTotal === 1 ? 'stamp' : 'stamps'}</span></span>
        </Link>
        <Link to="/perros" className="g-card flex items-center gap-3 p-3" aria-label="Dress the dogs">
          <IconPaw width={24} height={24} className="shrink-0 text-red" />
          <span className="min-w-0 leading-tight"><span className="block font-semibold">The dogs</span><span className="block text-xs text-ink-2">Souvenirs & outfits</span></span>
        </Link>
      </div>

      <div id="itinerary" className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-2xl">Itinerary</h2>
        <Link to="/welcome" className="text-xs text-ink-2 underline decoration-dotted underline-offset-4">Change start or retake placement</Link>
      </div>

      <Itinerary
        lessonRows={lessonRows}
        lessonMeta={lessonMeta}
        lessonCounts={lessonCounts}
        cardsByLesson={cardsByLesson}
        exams={exams}
        startLevel={startLevel}
        access={access}
        quizRecords={quizRecords}
        currentId={next?.id}
        highlight={highlight}
        outfits={outfits}
        flag={FLAG}
      />
      <BackToTop />
    </div>
  )
}

/** Once the itinerary is on screen, a button back up to the boarding pass and today's errands. */
function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const mark = document.getElementById('itinerary')
    if (!mark) return
    const onScroll = () => setShow(mark.getBoundingClientRect().top < window.innerHeight * 0.5)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // portal: the page's rise animation uses a transform, which would trap a fixed element inside it
  return createPortal(
    <div className={`fixed right-4 z-[9] transition duration-200 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`} aria-hidden={!show}>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
        className="g-btn rounded-full px-3.5 py-2.5 text-sm"
        style={{ '--g-face': 'var(--blue)' } as CSSProperties}
        aria-label="Back to the top: boarding pass and today's errands"
        tabIndex={show ? 0 : -1}
      >
        <IconArrowUp width={18} height={18} strokeWidth={2.6} />
        Top
      </button>
    </div>,
    document.body,
  )
}

const FLAG = COURSES.find((c) => c.id === COURSE_ID)?.flag ?? '🌍'

interface NextLesson { id: string; title: string; unitId: string; n: number; count: number }
/** The current lesson (the next open, unfinished one: see CourseAccess.current) with its title. */
function nextLesson(access: CourseAccess, meta: Map<string, Lesson[]>, fromUnit: string | undefined): NextLesson | undefined {
  const l = access.current(fromUnit)
  return l && { id: l.id, title: meta.get(l.unitId)?.[l.n - 1]?.title ?? `Lesson ${l.n}`, unitId: l.unitId, n: l.n, count: l.count }
}

/** The "Up next" boarding pass: from where the dogs are to the next lesson, with a tear-off stub. */
function BoardingPass({ next, info, started, km }: { next: NextLesson; info: NonNullable<ReturnType<typeof stopFor>>; started: boolean; km: number }) {
  const code = (s: string) => s.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'PAW'
  return (
    <Link to={`/lesson/${next.id}`} aria-label={`Board: lesson ${next.n} of ${next.count}`} className={`lvl-${info.region.level} g-card relative mb-4 block overflow-hidden`}>
      <div className="airmail h-1.5 w-full" aria-hidden="true" />
      <div className="flex">
        <div className="min-w-0 flex-1 p-4 pr-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow" style={{ color: 'var(--lvl)' }}>Boarding pass · up next</p>
            <IconPlane width={16} height={16} className="rotate-45 text-ink-2" />
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[1.65rem] font-semibold leading-none tracking-tight" style={{ color: 'var(--lvl)' }}>{code(info.stop.name)}</p>
              <p className="truncate text-[11px] text-ink-2">{info.stop.name}</p>
            </div>
            <span className="mb-4 h-px flex-1 border-t-2 border-dotted border-line" aria-hidden="true" />
            <div className="min-w-0 text-right">
              <p className="font-mono text-[1.65rem] font-semibold leading-none tracking-tight">L{next.n}</p>
              <p className="text-[11px] text-ink-2">of {next.count}</p>
            </div>
          </div>
          <p className="mt-3 font-display text-[1.45rem] leading-tight">{next.title}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div><dt className="text-ink-2">Region</dt><dd className="font-mono text-sm">{info.region.level.toUpperCase()}</dd></div>
            <div><dt className="text-ink-2">Leg</dt><dd className="font-mono text-sm">~5 min</dd></div>
            <div><dt className="text-ink-2">Up to</dt><dd className="font-mono text-sm">{km} km</dd></div>
          </dl>
          <span className="g-btn mt-4 w-full text-[1.05rem] uppercase tracking-wider" style={{ '--wm-face': 'var(--lvl)' } as CSSProperties}>
            <TicketIcon width={24} height={24} />
            {started ? 'Continue' : 'Board'}
          </span>
        </div>
        <div className="relative w-[5.6rem] shrink-0 border-l-2 border-dashed border-line">
          <span className="absolute -left-[9px] -top-[9px] z-[1] h-4 w-4 rounded-full border-2 border-line bg-paper" aria-hidden="true" />
          <span className="absolute -bottom-[9px] -left-[9px] z-[1] h-4 w-4 rounded-full border-2 border-line bg-paper" aria-hidden="true" />
          <StopArt stop={info.stop} level={info.region.level} quality="full" lazy={false} className="h-full w-full" />
        </div>
      </div>
    </Link>
  )
}

/** Where the dogs are: the most recently worked lesson's unit, else the first lesson of the recommended level. */
function currentStop(rows: Map<string, LessonRow>, startLevel: LevelId): { unitId: string } | undefined {
  let best: LessonRow | undefined
  for (const r of rows.values()) {
    const t = r.lastCompleted ?? r.firstCompleted ?? 0
    if (!best || t > (best.lastCompleted ?? best.firstCompleted ?? 0)) best = r
  }
  if (best) return { unitId: best.unitId }
  const level = levels.find((l) => l.id === startLevel) ?? levels[Math.min(levelIndex(startLevel), levels.length - 1)]
  const first = level?.units.find((u) => u.authored) ?? level?.units[0]
  return first ? { unitId: first.id } : undefined
}

/** The souvenir a claimed errand gave (or a passport stamp when there was none). */
function ClaimedReward({ rewardId }: { rewardId?: string }) {
  const sv = rewardId ? souvenirById(rewardId) : undefined
  return sv ? <SouvenirIcon souvenir={sv} size={32} title={`Claimed: ${sv.en}`} /> : <span className="text-2xl" aria-label="Claimed">🛂</span>
}

function QuestsCard({ date, day, rows, owned, level }: { date: string; day: DayRow | undefined; rows: Map<string, { claimedAt?: number; rewardId?: string }>; owned: Set<string>; level: LevelId }) {
  const quests = questsForDate(date)
  const [justClaimed, setJustClaimed] = useState<{ souvenir?: Souvenir; coins: number } | undefined>()
  const claim = async (questId: string, seed: number) => {
    const reward = pickReward(level, owned, seed)
    await claimQuest(date, questId, reward?.id)
    const coins = errandCoins(questId)
    await awardCoins(coins, `errand:${date}:${questId}`)
    setJustClaimed({ souvenir: reward, coins })
  }
  const doneCount = [...rows.values()].filter((r) => r.claimedAt).length
  return (
    <section className="g-card mb-4 p-4" aria-label="Today's quests">
      <div className="flex items-center justify-between">
        <p className="eyebrow flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--sun)] text-[13px] shadow-[0_2px_0_#b98315]" aria-hidden="true">🧭</span>Errands for today</p>
        <span className="font-mono text-xs text-ink-2"><span className="text-ink">{doneCount}</span>/{quests.length}</span>
      </div>
      <ul className="mt-3 space-y-3">
        {quests.map((q, i) => {
          const p = Math.min(q.target, progressFor(q, day))
          const row = rows.get(q.id)
          const done = p >= q.target
          const seed = date.split('-').reduce((a, b) => a * 31 + Number(b), 7) + i
          return (
            <li key={q.id} className="flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] text-lg ${row?.claimedAt ? 'border-ok-500 text-ok-500' : 'border-line'}`} aria-hidden="true">{row?.claimedAt ? <IconCheck width={18} height={18} /> : q.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold leading-tight">{q.es}</span>
                <span className="block truncate text-xs text-ink-2">{q.en}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="block h-1 flex-1 overflow-hidden rounded-full bg-card-2"><span className="block h-full rounded-full bg-blue" style={{ width: `${(p / q.target) * 100}%` }} /></span>
                  <span className="font-mono text-[11px] text-ink-2">{p}/{q.target}</span>
                </span>
              </span>
              {row?.claimedAt ? (
                <ClaimedReward rewardId={row.rewardId} />
              ) : done ? (
                <button type="button" className="btn btn-primary px-3 py-1.5 text-xs" onClick={() => void claim(q.id, seed)}>Claim</button>
              ) : (
                <span className="h-7 w-7 rounded-[4px] border border-dashed border-line" aria-hidden="true" title="A souvenir waits" />
              )}
            </li>
          )
        })}
      </ul>
      {justClaimed && (
        <div className="mt-3">
          <ChestReveal
            key={`${justClaimed.souvenir?.id ?? 'coins'}-${justClaimed.coins}`}
            label="Errand reward"
            reward={justClaimed.souvenir ? { kind: 'souvenir', souvenir: justClaimed.souvenir } : { kind: 'coins', amount: justClaimed.coins }}
            note={justClaimed.souvenir ? `Luna sniffed it out. It's in your passport, plus ${justClaimed.coins} ${ui.currency.plural ?? ui.currency.name}.` : undefined}
          />
        </div>
      )}
    </section>
  )
}
