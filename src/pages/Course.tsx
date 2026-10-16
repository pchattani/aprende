import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { levels, loadUnit, units as unitIndex } from '../engine/loader'
import { lessonMastery, ringFor, shiftDay, todayKey } from '../engine/mastery'
import { lessonIdsFor, levelComplete, DEFAULT_START_LEVEL, levelIndex } from '../engine/unlock'
import { getKv, claimQuest } from '../db/progress'
import { db } from '../db'
import { useLessonRows, useAllCards, useDays, useDueCount, useExams, useKvValue, useQuests, useKvPrefix } from '../hooks/useProgress'
import { useOutfits } from '../hooks/useOutfits'
import type { QuizRecord } from './RegionQuiz'
import { useSettings, SESSION_COUNT } from '../store/settings'
import { xpFor } from '../engine/xp'
import { IconCheck, IconTrophy, IconRepeat, IconStar } from '../components/ui/icons'
import { Chip } from '../components/ui/basics'
import { DogButton } from '../components/ui/Dogs'
import { REGIONS, stopFor, souvenirById, isStamped } from '../engine/journey'
import { QUIZ_PASS } from '../engine/quiz'
import { takeReturn } from '../engine/returnTo'
import { questsForDate, progressFor, pickReward } from '../engine/quests'
import type { LevelMeta, LevelId, Lesson } from '../engine/schema'
import type { DayRow, LessonRow } from '../engine/types'
import { ui } from '../engine/loader'
import { COURSES } from '../courses'
import { COURSE_ID, LANGUAGE } from '../engine/course'

const STATUS_LABEL: Record<string, string> = { new: 'new', started: 'in progress', learned: 'learned', mastered: 'solid' }

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
      const m = new Map<string, Lesson[]>()
      for (const u of unitIndex.values()) {
        if (!u.authored) continue
        try {
          const unit = await loadUnit(u.id)
          m.set(u.id, unit.lessons)
        } catch {
          /* skip */
        }
      }
      if (alive) setLessonMeta(m)
    })()
    return () => {
      alive = false
    }
  }, [])

  const lessonCounts = useMemo(() => new Map([...lessonMeta.entries()].map(([k, v]) => [k, v.length])), [lessonMeta])
  const ready = checked && Boolean(lessonRows && cards && days && exams && startLevel !== undefined) && lessonMeta.size > 0

  // Coming back from a lesson or a quiz: scroll to the spot the learner left from.
  useEffect(() => {
    if (!ready) return
    const target = (loc.state as { from?: string } | null)?.from ?? takeReturn()
    if (!target) return
    const elId = /^(unit|region)-/.test(target) ? target : `lesson-${target}`
    let tries = 0
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const el = document.getElementById(elId)
      if (el) {
        el.scrollIntoView({ block: 'center' })
        setHighlight(elId)
        setTimeout(() => setHighlight(undefined), 2200)
      } else if (tries++ < 30) requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelled = true
    }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const cardsByLesson = useMemo(() => {
    const m = new Map<string, typeof cards>()
    for (const c of cards ?? []) {
      const arr = m.get(c.lessonId) ?? []
      arr.push(c)
      m.set(c.lessonId, arr)
    }
    return m
  }, [cards])

  if (!checked || !lessonRows || !cards || !days || !exams || startLevel === undefined) return <div className="p-8 text-center text-muted">Loading…</div>

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

  // Up next: the first unfinished lesson from the stop the learner is at (else from the recommended level).
  const next = nextLesson(lessonRows, lessonMeta, lessonCounts, current?.unitId)
  const nextInfo = next ? stopFor(next.unitId) : currentInfo
  const xpToday = byDate.get(today)?.xp ?? 0
  const practisedToday = active(byDate.get(today))
  const stampsTotal = levels.reduce((n, l) => n + l.units.filter((u) => u.authored && isStamped(u.id, lessonRows, lessonCounts.get(u.id) ?? 4)).length, 0)

  return (
    <div className="animate-rise">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-2 border-b-2 border-line bg-[var(--bg)] px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-xl" style={{ marginTop: 'calc(-0.75rem - env(safe-area-inset-top))' }}>
        <Link to="/settings" className="flex items-center gap-1.5 rounded-xl px-1.5 py-1 font-display text-lg" aria-label={`${LANGUAGE}, level ${(nextInfo?.region.level ?? startLevel).toUpperCase()}`}>
          <span className="text-2xl leading-none" aria-hidden="true">{FLAG}</span>
          <span className={`rounded-lg px-1.5 text-sm font-bold text-white lvl-${nextInfo?.region.level ?? startLevel}`} style={{ background: 'var(--lvl)' }}>{(nextInfo?.region.level ?? startLevel).toUpperCase()}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link to="/profile" className={`flex items-center gap-1 rounded-xl px-2 py-1 font-display text-lg ${practisedToday ? 'text-tangerine-500' : 'text-muted'}`} aria-label={`${inARow} day streak`}>
            <span className={`text-xl leading-none ${practisedToday ? 'animate-flame' : 'grayscale'}`} aria-hidden="true">🔥</span>{inARow}
          </Link>
          <Link to="/profile" className="flex items-center gap-1 rounded-xl px-2 py-1 font-display text-lg text-gold-600" aria-label={`${xpToday} XP today`}>
            <span className="text-xl leading-none" aria-hidden="true">⚡</span>{xpToday}
          </Link>
          <Link to="/review" className={`flex items-center gap-1 rounded-xl px-2 py-1 font-display text-lg ${(due ?? 0) > 0 ? 'text-sky-500' : 'text-muted'}`} aria-label={`${due ?? 0} cards due`}>
            <span className="text-xl leading-none" aria-hidden="true">💎</span>{due ?? 0}
          </Link>
        </div>
      </div>

      <header className="mb-4 flex items-center gap-2">
        <div className="flex shrink-0 -space-x-4">
          <DogButton dog="leo" size={50} outfit={outfits.leo} className="animate-float" />
          <DogButton dog="bonchita" size={50} outfit={outfits.bonchita} className="animate-float [animation-delay:0.3s]" />
          <DogButton dog="luna" size={50} outfit={outfits.luna} className="animate-float [animation-delay:0.6s]" />
        </div>
        <div className="bubble bubble-left ml-2 min-w-0 flex-1 py-2">
          <h1 className="font-display text-xl leading-tight">{greeting} 👋</h1>
          <p className="text-[13px] font-bold leading-snug text-muted">
            {nextInfo ? `We're in ${nextInfo.stop.name} ${nextInfo.stop.emoji}` : 'Packing our bags…'}
          </p>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Link to="/passport" className="card flex items-center gap-2.5 p-3" aria-label="Passport">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-xl dark:bg-brand-500/20" aria-hidden="true">🛂</span>
          <span className="min-w-0 leading-tight"><span className="block font-extrabold">Passport</span><span className="block text-xs font-bold text-muted">{stampsTotal} {stampsTotal === 1 ? 'stamp' : 'stamps'}</span></span>
        </Link>
        <Link to="/perros" className="card flex items-center gap-2.5 p-3" aria-label="Dress the dogs">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-xl dark:bg-gold-500/15" aria-hidden="true">🐾</span>
          <span className="min-w-0 leading-tight"><span className="block font-extrabold">Dogs</span><span className="block text-xs font-bold text-muted">Dress them up</span></span>
        </Link>
      </div>

      {next && nextInfo && (
        <Link to={`/lesson/${next.id}`} aria-label={`Continue the journey: lesson ${next.n} of ${next.count}`} className={`lvl-${nextInfo.region.level} relative mb-4 block overflow-hidden rounded-3xl p-5 text-white transition active:translate-y-1`} style={{ background: 'var(--lvl)', boxShadow: '0 6px 0 0 var(--lvl-lip)' }}>
          <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/15" aria-hidden="true" />
          <span className="pointer-events-none absolute right-4 top-4 rotate-6 text-6xl drop-shadow-sm" aria-hidden="true">{nextInfo.stop.emoji}</span>
          <span className="relative block max-w-[72%] text-xs font-extrabold uppercase tracking-widest opacity-90">Up next · Stop {nextInfo.index + 1} · {nextInfo.stop.name}</span>
          <span className="relative mt-1 block max-w-[72%] font-display text-[1.75rem] leading-tight">{next.title}</span>
          <span className="relative mt-1 block text-sm font-bold opacity-90">Lesson {next.n} of {next.count} · about 5 min · up to +{xpFor({ correct: SESSION_COUNT[sessionLength], almost: 0, wrong: 0, completed: true })} XP</span>
          <span className="btn btn-white shine relative mt-4 w-full" style={{ color: 'var(--lvl-lip)' }}>{lessonRows.get(next.id) ? 'Continue' : 'Start'} ▶</span>
        </Link>
      )}

      <section className="card mb-4 flex items-center gap-4" aria-label="Today and this week">
        <MinutesRing minutes={minutesToday} goal={goal} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight">{goalDone ? 'Daily goal reached! 🎉' : `${Math.max(0, goal - minutesToday)} min to your daily goal`}</p>
          <div className="mt-2 flex justify-between gap-1" aria-label={`${weekCount} of 7 days practised this week`}>
            {week.map((w, i) => {
              const label = new Date(w.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })
              const isToday = i === 6
              return (
                <span key={w.date} className="flex flex-col items-center gap-0.5">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${w.on ? 'bg-sunset-gradient text-white shadow-[0_2px_0_0_#d97f00]' : isToday ? 'border-2 border-dashed border-tangerine-500' : 'bg-surface-2'}`}>{w.on ? '🔥' : ''}</span>
                  <span className={`text-[10px] font-extrabold ${isToday ? 'text-tangerine-500' : 'text-muted'}`}>{label}</span>
                </span>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs font-bold text-muted">
            {goalDone ? `${ui.feedback.goalDone} · ` : ''}{weekCount} of 7 days this week{inARow > 1 ? ` · ${inARow} in a row` : ''}
          </p>
        </div>
      </section>

      {(due ?? 0) > 0 && (
        <Link to="/review" className="card mb-4 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-[0_3px_0_0_var(--lip-sky)]"><IconRepeat /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight">{due} to review</p>
            <p className="text-xs font-bold text-muted">Review first: this is where words and grammar stick.</p>
          </div>
          <span className="btn btn-sky px-4 py-2 text-sm">Go</span>
        </Link>
      )}

      {quests && <QuestsCard date={today} day={quests.day} rows={quests.rows} owned={quests.owned} level={currentInfo?.region.level ?? startLevel} />}

      <p className="mb-6 text-center text-xs">
        <Link to="/welcome" className="font-bold text-muted underline decoration-dotted underline-offset-4">Change where the journey starts or retake the placement test</Link>
      </p>

      {levels.map((level) => {
        const region = REGIONS.find((r) => r.level === level.id)
        const complete = levelComplete(level, lessonRows, lessonCounts)
        const ids = lessonIdsFor(level, lessonCounts)
        const doneCount = ids.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
        const passed = exams.get(level.id)?.passed
        const recommended = level.id === startLevel
        const stampedCount = level.units.filter((u) => isStamped(u.id, lessonRows, lessonCounts.get(u.id) ?? 4)).length
        const quizOpen = stampedCount >= Math.ceil(level.units.length / 2)
        const quiz = quizRecords?.get(`regionQuiz:${level.id}`)
        return (
          <section key={level.id} id={`region-${level.id}`} className={`lvl-${level.id} mb-10 rounded-[1.75rem] transition ${highlight === `region-${level.id}` ? 'ring-4 ring-brand-400/60' : ''}`}>
            <div className="level-banner mb-2">
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-widest opacity-90">{level.title} · {level.name}</p>
                  <h2 className="text-[2rem] text-white">{region?.name ?? level.title}</h2>
                  {region && <p className="text-sm font-bold opacity-90">{region.es}</p>}
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl">{passed ? <IconTrophy /> : region?.stops[0]?.emoji}</span>
              </div>
              <p className="relative mt-2 text-sm font-semibold leading-snug opacity-95">{level.description}</p>
              <div className="relative mt-3 flex items-center gap-3 text-xs font-extrabold">
                {ids.length > 0 && (
                  <>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/15">
                      <div className="bar-fill h-full rounded-full bg-white" style={{ width: `${ids.length ? Math.max(4, (doneCount / ids.length) * 100) : 0}%` }} />
                    </div>
                    <span className="opacity-95">{doneCount} / {ids.length}</span>
                  </>
                )}
                {recommended && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--lvl-lip)' }}>Recommended start</span>}
              </div>
              {ids.length > 0 && (
                <div className="relative mt-3 flex flex-wrap items-center gap-2 text-xs font-extrabold">
                  {quizOpen ? (
                    <Link to={`/quiz/${level.id}`} className="btn btn-white px-3 py-1.5 text-xs" style={{ color: 'var(--lvl-lip)' }}>🏅 Region quiz</Link>
                  ) : (
                    <span className="rounded-xl bg-black/10 px-3 py-1.5 opacity-95">🏅 Quiz opens at {Math.ceil(level.units.length / 2)} stamps · {stampedCount} so far</span>
                  )}
                  {quiz && <span className="opacity-95">Best {Math.round(quiz.best * 100)}%{quiz.best >= QUIZ_PASS ? ' · badge earned' : ''}</span>}
                </div>
              )}
            </div>
            <ol>
              {level.units.map((u, unitIdx) => {
                const stop = region?.stops[unitIdx]
                const lessons = lessonMeta.get(u.id)
                const list = lessons ?? Array.from({ length: lessonCounts.get(u.id) ?? 4 }, (_, i) => ({ id: `${u.id}.l${i + 1}`, title: `Lesson ${i + 1}` }))
                const unitDone = u.authored && isStamped(u.id, lessonRows, list.length)
                return (
                  <li key={u.id} id={`unit-${u.id}`} className={`rounded-3xl pt-6 transition ${highlight === `unit-${u.id}` ? 'ring-4 ring-brand-400/60' : ''}`}>
                    <div className="mb-1 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-widest text-muted">
                      <span className="h-0.5 flex-1 rounded bg-[var(--line)]" />
                      <span>Stop {unitIdx + 1} · {stop?.name ?? `Unit ${unitIdx + 1}`} {stop?.emoji}</span>
                      <span className="h-0.5 flex-1 rounded bg-[var(--line)]" />
                    </div>
                    <h3 className="text-center font-display text-xl leading-tight">{u.title}</h3>
                    <p className="text-center text-xs font-bold text-muted">{u.subtitle}{stop ? ` · ${stop.es}` : ''}</p>
                    {!u.authored && <p className="mt-2 text-center"><Chip>Coming soon</Chip></p>}
                    {u.authored && (
                      <div className="relative mt-8 flex flex-col items-center gap-6 overflow-x-clip pb-2 pt-1">
                        {list.map((l, i) => {
                          const row = lessonRows.get(l.id)
                          const mastery = lessonMastery(cardsByLesson.get(l.id) ?? [])
                          const ring = ringFor(row, mastery)
                          const offset = OFFSETS[(unitIdx * 2 + i) % OFFSETS.length]!
                          const isNext = next?.id === l.id
                          return <PathNode key={l.id} id={l.id} n={i + 1} title={l.title} status={ring} mastery={mastery} offset={offset} current={isNext} highlight={highlight === `lesson-${l.id}`} outfits={isNext ? outfits : undefined} decor={i === 1 && !isNext && next?.id !== list[0]?.id ? stop?.emoji : undefined} />
                        })}
                        <StampNode offset={OFFSETS[(unitIdx * 2 + list.length) % OFFSETS.length]!} stamped={Boolean(unitDone)} name={stop?.name ?? u.title} emoji={stop?.emoji ?? '📍'} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            {ids.length > 0 && <ExamCard level={level} complete={complete} passed={Boolean(passed)} score={exams.get(level.id)?.score} />}
          </section>
        )
      })}
    </div>
  )
}

/** Horizontal offsets (px) that make the lesson nodes wind like a road. */
const OFFSETS = [0, 52, 78, 52, 0, -52, -78, -52]
const FLAG = COURSES.find((c) => c.id === COURSE_ID)?.flag ?? '🌍'

interface NextLesson { id: string; title: string; unitId: string; n: number; count: number }
/** The first unfinished lesson at or after the given unit, else the first unfinished lesson anywhere. */
function nextLesson(rows: Map<string, LessonRow>, meta: Map<string, Lesson[]>, counts: Map<string, number>, fromUnit: string | undefined): NextLesson | undefined {
  const all: NextLesson[] = []
  for (const level of levels)
    for (const u of level.units) {
      if (!u.authored) continue
      const lessons = meta.get(u.id) ?? Array.from({ length: counts.get(u.id) ?? 0 }, (_, i) => ({ id: `${u.id}.l${i + 1}`, title: `Lesson ${i + 1}` }))
      lessons.forEach((l, i) => all.push({ id: l.id, title: l.title, unitId: u.id, n: i + 1, count: lessons.length }))
    }
  const start = Math.max(0, all.findIndex((l) => l.unitId === fromUnit))
  const open = (l: NextLesson) => (rows.get(l.id)?.completions ?? 0) === 0
  return all.slice(start).find(open) ?? all.find(open) ?? all[start]
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

function QuestsCard({ date, day, rows, owned, level }: { date: string; day: DayRow | undefined; rows: Map<string, { claimedAt?: number; rewardId?: string }>; owned: Set<string>; level: LevelId }) {
  const quests = questsForDate(date)
  const [justClaimed, setJustClaimed] = useState<string | undefined>()
  const claim = async (questId: string, seed: number) => {
    const reward = pickReward(level, owned, seed)
    await claimQuest(date, questId, reward?.id)
    setJustClaimed(reward ? `${reward.emoji} ${reward.es}` : 'a stamp')
  }
  const doneCount = [...rows.values()].filter((r) => r.claimedAt).length
  return (
    <section className="card mb-4" aria-label="Today's quests">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg">Daily quests</p>
        <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-extrabold text-gold-600 dark:bg-gold-500/15">{doneCount} / {quests.length} done</span>
      </div>
      <ul className="mt-2 space-y-3">
        {quests.map((q, i) => {
          const p = Math.min(q.target, progressFor(q, day))
          const row = rows.get(q.id)
          const done = p >= q.target
          const seed = date.split('-').reduce((a, b) => a * 31 + Number(b), 7) + i
          return (
            <li key={q.id} className="flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${row?.claimedAt ? 'bg-mint-gradient text-white' : 'bg-surface-2'}`} aria-hidden="true">{row?.claimedAt ? '✓' : q.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold leading-tight">{q.es} <span className="text-xs font-bold text-muted">· {q.en}</span></span>
                <span className="relative mt-1.5 block h-5 overflow-hidden rounded-full bg-surface-2">
                  <span className="bar-fill block h-full rounded-full bg-gold-500" style={{ width: `${Math.max(p ? 8 : 0, (p / q.target) * 100)}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-[var(--text)]/70">{p} / {q.target}</span>
                </span>
              </span>
              {row?.claimedAt ? (
                <span className="text-2xl" aria-label="Claimed">{row.rewardId ? souvenirById(row.rewardId)?.emoji ?? '🎁' : '🛂'}</span>
              ) : done ? (
                <button type="button" className="btn btn-gold px-3 py-1.5 text-xs" onClick={() => void claim(q.id, seed)}>Claim</button>
              ) : (
                <span className="text-2xl opacity-40 grayscale" aria-hidden="true">🎁</span>
              )}
            </li>
          )
        })}
      </ul>
      {justClaimed && <p className="animate-pop mt-3 rounded-2xl bg-gold-100 px-3 py-2 text-sm font-bold dark:bg-gold-500/15">🎁 Luna sniffed out {justClaimed}! It's in your passport.</p>}
    </section>
  )
}

function MinutesRing({ minutes, goal }: { minutes: number; goal: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const pct = Math.min(1, minutes / Math.max(1, goal))
  return (
    <div className="relative h-[72px] w-[72px] shrink-0" role="img" aria-label={`${minutes} of ${goal} minutes practised today`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={pct >= 1 ? '#22c771' : 'url(#ringGrad)'} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb81f" />
            <stop offset="1" stopColor="#ff8a1f" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display text-xl">{minutes}</span>
        <span className="text-[9px] font-bold text-muted">/ {goal} min</span>
      </div>
    </div>
  )
}

function PathNode({ id, n, title, status, mastery, offset, current, highlight = false, outfits, decor }: { id: string; n: number; title: string; status: string; mastery: number; offset: number; current: boolean; highlight?: boolean; outfits?: ReturnType<typeof useOutfits>; decor?: string }) {
  const label = STATUS_LABEL[status] ?? status
  const done = status === 'learned' || status === 'mastered'
  const tone = status === 'mastered' ? 'node-gold' : done || status === 'started' || current ? '' : 'node-todo'
  const r = current ? 50 : 44
  const c = 2 * Math.PI * r
  return (
    <div id={`lesson-${id}`} className={`relative flex w-full flex-col items-center ${current ? 'mt-8' : ''}`} style={{ transform: `translateX(${offset}px)` }}>
      <div className={`relative rounded-full ${highlight ? 'ring-4 ring-brand-400 ring-offset-4 ring-offset-[var(--bg)]' : ''}`}>
        {current && <span className="tooltip-start">{status === 'new' ? 'START' : 'CONTINUE'}</span>}
        {(status === 'started' || current) && mastery > 0 && (
          <svg className="node-ring -rotate-90" viewBox={`0 0 ${2 * r + 12} ${2 * r + 12}`} aria-hidden="true">
            <circle cx={r + 6} cy={r + 6} r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
            <circle cx={r + 6} cy={r + 6} r={r} fill="none" stroke="var(--lvl)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * mastery} ${c}`} />
          </svg>
        )}
        {current && <span className="node-pulse" aria-hidden="true" />}
        <Link to={`/lesson/${id}`} className={`node ${tone} ${current ? 'node-current' : ''}`} aria-label={`${title}: ${label}`}>
          {status === 'mastered' ? (
            <span className="text-3xl" aria-hidden="true">👑</span>
          ) : done ? (
            <IconCheck width={34} height={34} strokeWidth={3.5} />
          ) : (
            <IconStar width={current ? 36 : 30} height={current ? 36 : 30} fill="currentColor" strokeWidth={1.5} />
          )}
        </Link>
      </div>
      <span className={`mt-3 max-w-[11rem] truncate text-center text-[13px] font-extrabold ${current ? '' : 'text-muted'}`} aria-hidden="true">{n}. {title}</span>
      {decor && !outfits && (
        <span className={`pointer-events-none absolute -top-2 flex h-24 w-24 items-center justify-center rounded-full text-5xl ${offset > 0 ? 'right-[calc(50%+4.2rem)]' : 'left-[calc(50%+4.2rem)]'}`} style={{ background: 'var(--lvl-soft)' }} aria-hidden="true">{decor}</span>
      )}
      {outfits && (
        <div className={`pointer-events-auto absolute top-0 flex -space-x-3 ${offset > 0 ? 'right-[calc(50%+3.6rem)]' : 'left-[calc(50%+3.6rem)]'}`} aria-label="Leo, Bonchita and Luna are here">
          <DogButton dog="leo" size={44} mood="curious" outfit={outfits.leo} className="animate-float" />
          <DogButton dog="bonchita" size={44} outfit={outfits.bonchita} className="animate-float [animation-delay:0.3s]" />
          <DogButton dog="luna" size={44} outfit={outfits.luna} className="animate-float [animation-delay:0.6s]" />
        </div>
      )}
    </div>
  )
}

function StampNode({ offset, stamped, name, emoji }: { offset: number; stamped: boolean; name: string; emoji: string }) {
  return (
    <div className="flex w-full flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
      <Link to="/passport" className={`node ${stamped ? 'node-gold' : 'node-todo'}`} aria-label={`Stamp for ${name}${stamped ? ': earned' : ''}`}>
        <span className={`text-3xl ${stamped ? '' : 'opacity-60 grayscale'}`} aria-hidden="true">{stamped ? emoji : '🛂'}</span>
      </Link>
      <span className="mt-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-muted" aria-hidden="true">{stamped ? 'Stamped' : 'Stamp'}</span>
    </div>
  )
}

function ExamCard({ level, complete, passed, score }: { level: LevelMeta; complete: boolean; passed: boolean; score?: number }) {
  return (
    <div className="mt-8 flex flex-col items-center text-center">
      <Link to={`/exam/${level.id}`} className="node node-gold node-current" aria-label={`Level check ${level.title}`}>
        <IconTrophy width={38} height={38} />
      </Link>
      <p className="mt-3 font-display text-lg">Level check · {level.title}</p>
      <p className="max-w-xs text-xs font-bold text-muted">{passed ? `Passed · ${Math.round((score ?? 0) * 100)}%` : complete ? 'Reading, listening, grammar, writing and speaking. Show what you learnt in this region.' : 'Take it whenever you feel ready; it is open now.'}</p>
    </div>
  )
}
