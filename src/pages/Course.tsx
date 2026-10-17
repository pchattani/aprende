import { useEffect, useMemo, useState } from 'react'
import { SouvenirIcon } from '../components/art/SouvenirArt'
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
import { IconCheck, IconPaw, IconRoute, IconPlane, IconPassport, IconBook } from '../components/ui/icons'
import { CheckpointRow } from '../components/CheckpointRow'
import { StopArt } from '../components/StopArt'
import { Chip } from '../components/ui/basics'
import { DogButton } from '../components/ui/Dogs'
import { REGIONS, stopFor, souvenirById, isStamped, type Souvenir } from '../engine/journey'
import { QUIZ_PASS } from '../engine/quiz'
import { takeReturn } from '../engine/returnTo'
import { questsForDate, progressFor, pickReward } from '../engine/quests'
import type { LevelMeta, LevelId, Lesson } from '../engine/schema'
import type { DayRow, LessonRow } from '../engine/types'
import { ui } from '../engine/loader'
import { COURSES, HUB_URL } from '../courses'
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
          <Link to="/profile" className={`flex items-center gap-1 rounded-full border border-line px-2.5 py-1 font-mono text-sm ${practisedToday ? 'text-ink' : 'text-ink-2'}`} aria-label={`${inARow} days on the road`}>
            <IconPaw width={15} height={15} className={practisedToday ? 'text-red' : ''} />{inARow}
          </Link>
          <Link to="/insights" className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 font-mono text-sm" aria-label={`${kmToday} km today`}>
            <IconRoute width={15} height={15} className="text-blue" />{kmToday}<span className="text-[10px] text-ink-2">km</span>
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

      <section className="card mb-4 p-0" aria-label="Today and this week">
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
        <Link to="/review" className="card mb-4 flex items-center gap-4">
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
          <span className="btn btn-blue px-4 py-2 text-sm">Retouch</span>
        </Link>
      )}

      {quests && <QuestsCard date={today} day={quests.day} rows={quests.rows} owned={quests.owned} level={currentInfo?.region.level ?? startLevel} />}

      <div className="mb-8 grid grid-cols-2 gap-3">
        <Link to="/passport" className="card flex items-center gap-3 p-3" aria-label="Passport">
          <IconPassport width={26} height={26} className="shrink-0 text-blue" />
          <span className="min-w-0 leading-tight"><span className="block font-semibold">Passport</span><span className="block text-xs text-ink-2"><span className="font-mono">{stampsTotal}</span> {stampsTotal === 1 ? 'stamp' : 'stamps'}</span></span>
        </Link>
        <Link to="/perros" className="card flex items-center gap-3 p-3" aria-label="Dress the dogs">
          <IconPaw width={24} height={24} className="shrink-0 text-red" />
          <span className="min-w-0 leading-tight"><span className="block font-semibold">The dogs</span><span className="block text-xs text-ink-2">Souvenirs & outfits</span></span>
        </Link>
      </div>

      <div className="mb-3 flex items-end justify-between">
        <h2 className="font-display text-2xl">Itinerary</h2>
        <Link to="/welcome" className="text-xs text-ink-2 underline decoration-dotted underline-offset-4">Change start or retake placement</Link>
      </div>

      {levels.map((lv) => {
        const region = REGIONS.find((r) => r.level === lv.id)
        const complete = levelComplete(lv, lessonRows, lessonCounts)
        const ids = lessonIdsFor(lv, lessonCounts)
        const doneCount = ids.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
        const passed = exams.get(lv.id)?.passed
        const recommended = lv.id === startLevel
        const stampedCount = lv.units.filter((u) => isStamped(u.id, lessonRows, lessonCounts.get(u.id) ?? 4)).length
        const quizOpen = stampedCount >= Math.ceil(lv.units.length / 2)
        const quiz = quizRecords?.get(`regionQuiz:${lv.id}`)
        const cover = region?.stops[0]
        return (
          <section key={lv.id} id={`region-${lv.id}`} className={`lvl-${lv.id} mb-10 rounded-2xl transition ${highlight === `region-${lv.id}` ? 'ring-2 ring-[var(--lvl)] ring-offset-4 ring-offset-[var(--paper)]' : ''}`}>
            <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
              {cover && <StopArt stop={cover} level={lv.id} progress={ids.length ? Math.max(0.15, doneCount / ids.length) : 0.15} quality="full" className="h-32 w-full" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow" style={{ color: 'var(--lvl)' }}>{lv.title} · {lv.name}</p>
                    <h2 className="mt-0.5 text-[1.9rem]">{region?.name ?? lv.title}</h2>
                    {region && <p className="font-hand text-xl leading-none text-ink-2">{region.es}</p>}
                  </div>
                  {recommended && <span className="inkstamp shrink-0 text-[11px]" style={{ color: 'var(--lvl)' }}>Recommended start</span>}
                </div>
                <p className="mt-2 text-sm leading-snug text-ink-2">{lv.description}</p>
                {ids.length > 0 && (
                  <>
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      <LegBar value={doneCount} max={ids.length} className="flex-1" />
                      <span className="font-mono text-ink-2"><span className="text-ink">{doneCount}</span>/{ids.length}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {quizOpen ? (
                        <Link to={`/quiz/${lv.id}`} className="btn btn-ghost px-3 py-1.5 text-xs">Region quiz</Link>
                      ) : (
                        <span className="rounded-full border border-dashed border-line px-3 py-1 text-ink-2">Region quiz opens at <span className="font-mono">{Math.ceil(lv.units.length / 2)}</span> stamps · <span className="font-mono">{stampedCount}</span> so far</span>
                      )}
                      {quiz && <span className="text-ink-2">Best <span className="font-mono text-ink">{Math.round(quiz.best * 100)}%</span>{quiz.best >= QUIZ_PASS ? ' · badge earned' : ''}</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
            <ol className="relative ml-[1.15rem] mt-1 border-l-[3px] border-dotted pl-6" style={{ borderColor: 'var(--lvl)' }}>
              {lv.units.map((u, unitIdx) => {
                const stop = region?.stops[unitIdx]
                const lessons = lessonMeta.get(u.id)
                const list = lessons ?? Array.from({ length: lessonCounts.get(u.id) ?? 4 }, (_, i) => ({ id: `${u.id}.l${i + 1}`, title: `Lesson ${i + 1}` }))
                const unitDone = u.authored && isStamped(u.id, lessonRows, list.length)
                const doneHere = list.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
                const here = next?.unitId === u.id
                const fade = unitFade(list.map((l) => cardsByLesson.get(l.id) ?? []).flat())
                return (
                  <li key={u.id} id={`unit-${u.id}`} className={`relative pt-7 transition ${highlight === `unit-${u.id}` ? 'rounded-xl ring-2 ring-[var(--lvl)] ring-offset-4 ring-offset-[var(--paper)]' : ''}`}>
                    <span className={`absolute -left-[2.15rem] top-9 flex h-6 w-6 items-center justify-center rounded-full border-[3px] bg-paper ${unitDone ? 'text-white' : ''}`} style={{ borderColor: 'var(--lvl)', background: unitDone ? 'var(--lvl)' : undefined }} aria-hidden="true">
                      {unitDone && <IconCheck width={12} height={12} strokeWidth={3.5} />}
                    </span>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="eyebrow">Stop {unitIdx + 1} · {stop?.name ?? `Unit ${unitIdx + 1}`}</p>
                        <h3 className="font-display text-[1.2rem] leading-tight">{u.title}</h3>
                        <p className="text-xs text-ink-2">{u.subtitle}{stop ? <> · <span className="font-hand text-base">{stop.es}</span></> : ''}</p>
                      </div>
                      {stop && (
                        <Link to="/passport" className="relative w-[5.2rem] shrink-0 rotate-2 rounded-[3px] border-[3px] border-card bg-card shadow-card" aria-label={`Postcard from ${stop.name}${unitDone ? ': stamped' : ''}`}>
                          <StopArt stop={stop} level={lv.id} progress={u.authored ? doneHere / Math.max(1, list.length) : 0} fade={fade} className="aspect-[4/3] w-full rounded-[1px]" />
                          {unitDone && <span className="inkstamp absolute -bottom-2 -left-3 bg-card/0 px-1.5 py-0 text-[10px]" style={{ color: 'var(--lvl)' }}>Stamped</span>}
                        </Link>
                      )}
                    </div>
                    {!u.authored && <p className="mt-2"><Chip>Coming soon</Chip></p>}
                    {u.authored && (
                      <ul className="mt-2 space-y-0.5">
                        {list.map((l, i) => {
                          const row = lessonRows.get(l.id)
                          const mastery = lessonMastery(cardsByLesson.get(l.id) ?? [])
                          const ring = ringFor(row, mastery)
                          return <LegRow key={l.id} id={l.id} n={i + 1} title={l.title} status={ring} mastery={mastery} current={next?.id === l.id} highlight={highlight === `lesson-${l.id}`} />
                        })}
                        <CheckpointRow unitId={u.id} stopName={stop?.name ?? u.title} lessonsDone={doneHere} lessonsTotal={list.length} />
                      </ul>
                    )}
                    {here && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-2" aria-label="Leo, Bonchita and Luna are here">
                        <div className="flex -space-x-3"><DogButton dog="leo" size={30} mood="curious" outfit={outfits.leo} /><DogButton dog="bonchita" size={30} outfit={outfits.bonchita} /><DogButton dog="luna" size={30} outfit={outfits.luna} /></div>
                        <span className="font-hand text-lg">we're here</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            {ids.length > 0 && <BorderControl level={lv} complete={complete} passed={Boolean(passed)} score={exams.get(lv.id)?.score} />}
          </section>
        )
      })}
    </div>
  )
}

const FLAG = COURSES.find((c) => c.id === COURSE_ID)?.flag ?? '🌍'

/** How faded a stop's postcard is: the share of its practised cards that are due now. */
function unitFade(cs: { reps: number; due: number }[]): number {
  const seen = cs.filter((c) => c.reps > 0)
  if (!seen.length) return 0
  const now = Date.now()
  return seen.filter((c) => c.due <= now).length / seen.length
}

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

/** The "Up next" boarding pass: from where the dogs are to the next lesson, with a tear-off stub. */
function BoardingPass({ next, info, started, km }: { next: NextLesson; info: NonNullable<ReturnType<typeof stopFor>>; started: boolean; km: number }) {
  const code = (s: string) => s.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'PAW'
  return (
    <Link to={`/lesson/${next.id}`} aria-label={`Board: lesson ${next.n} of ${next.count}`} className={`lvl-${info.region.level} relative mb-4 block overflow-hidden rounded-2xl border border-line bg-card shadow-card transition active:scale-[0.99]`}>
      <div className="airmail h-1.5 w-full" aria-hidden="true" />
      <div className="flex">
        <div className="min-w-0 flex-1 p-4 pr-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Boarding pass · up next</p>
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
          <span className="btn btn-primary mt-4 w-full">{started ? 'Continue' : 'Board'}</span>
        </div>
        <div className="relative w-[5.6rem] shrink-0 border-l-2 border-dashed border-line">
          <span className="absolute -left-[9px] -top-[9px] h-4 w-4 rounded-full border border-line bg-paper" aria-hidden="true" />
          <span className="absolute -bottom-[9px] -left-[9px] h-4 w-4 rounded-full border border-line bg-paper" aria-hidden="true" />
          <StopArt stop={info.stop} level={info.region.level} quality="full" lazy={false} className="h-full w-full" />
        </div>
      </div>
    </Link>
  )
}

/** A thin route line that fills with ink, with a paw marking how far you've come. */
function LegBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)))
  return (
    <div className={`relative mt-2 h-2.5 ${className}`} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span className="absolute inset-x-0 top-1/2 h-0 -translate-y-1/2 border-t-2 border-dotted border-line" />
      <span className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--lvl,var(--blue))] transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
      <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-[var(--lvl,var(--blue))]" style={{ left: `${pct * 100}%` }} />
    </div>
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
  const [justClaimed, setJustClaimed] = useState<{ souvenir?: Souvenir } | undefined>()
  const claim = async (questId: string, seed: number) => {
    const reward = pickReward(level, owned, seed)
    await claimQuest(date, questId, reward?.id)
    setJustClaimed({ souvenir: reward })
  }
  const doneCount = [...rows.values()].filter((r) => r.claimedAt).length
  return (
    <section className="card mb-4" aria-label="Today's quests">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Errands for today</p>
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
      {justClaimed && <p className="animate-pop mt-3 rounded-xl border border-dashed border-line px-3 py-2 text-sm">{justClaimed.souvenir && <SouvenirIcon souvenir={justClaimed.souvenir} size={28} className="mr-1 inline-block align-middle" />}<span className="font-hand text-lg">Luna sniffed out {justClaimed.souvenir?.es ?? 'a stamp'}!</span> It's in your passport.</p>}
    </section>
  )
}

function LegRow({ id, n, title, status, mastery, current, highlight = false }: { id: string; n: number; title: string; status: string; mastery: number; current: boolean; highlight?: boolean }) {
  const label = STATUS_LABEL[status] ?? status
  const done = status === 'learned' || status === 'mastered'
  return (
    <li id={`lesson-${id}`} className={`relative flex items-center gap-1 rounded-xl transition ${highlight ? 'bg-[var(--lvl-soft)]' : ''}`}>
      <span className={`absolute -left-[1.92rem] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 ${done ? '' : 'bg-paper'}`} style={{ borderColor: 'var(--lvl)', background: done ? 'var(--lvl)' : undefined }} aria-hidden="true" />
      <Link to={`/lesson/${id}`} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-card active:scale-[0.99] ${current ? 'border border-line bg-card shadow-card' : ''}`} aria-label={`${title}: ${label}`}>
        <span className="w-5 shrink-0 font-mono text-xs text-ink-2">{String(n).padStart(2, '0')}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${current ? 'font-semibold' : ''}`}>{title}</span>
          {(mastery > 0 || status !== 'new') && (
            <span className="mt-1 flex items-center gap-2">
              <span className="h-1 w-16 overflow-hidden rounded-full bg-card-2"><span className="block h-full rounded-full" style={{ width: `${Math.round(mastery * 100)}%`, background: status === 'mastered' ? 'var(--sun)' : 'var(--lvl)' }} /></span>
              <span className="text-[11px] capitalize text-ink-2">{label}</span>
            </span>
          )}
        </span>
        {current ? <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: 'var(--lvl)' }}>Next</span> : status === 'mastered' ? <span className="text-[11px] font-semibold text-gold-600">Solid</span> : done ? <IconCheck width={16} height={16} className="text-ok-500" /> : <span className="text-ink-2" aria-hidden="true">›</span>}
      </Link>
      <Link to={`/lesson/${id}?guide`} className="shrink-0 rounded-full p-2 text-ink-2/70 transition hover:bg-card hover:text-ink" aria-label={`Guidebook, lesson ${n}`} title="Guidebook: grammar and words">
        <IconBook width={16} height={16} />
      </Link>
    </li>
  )
}

/** The level check as a border crossing: passport control between regions. */
function BorderControl({ level, complete, passed, score }: { level: LevelMeta; complete: boolean; passed: boolean; score?: number }) {
  return (
    <Link to={`/exam/${level.id}`} className="card mt-5 flex items-center gap-4" aria-label={`Border control, level check ${level.title}`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed" style={{ borderColor: 'var(--lvl)', color: 'var(--lvl)' }}><IconPassport width={24} height={24} /></span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Border control</p>
        <p className="font-display text-lg leading-tight">Level check · {level.title}</p>
        <p className="text-xs text-ink-2">{passed ? <>Passed · <span className="font-mono">{Math.round((score ?? 0) * 100)}%</span></> : complete ? 'Reading, listening, grammar, writing and speaking. Show your papers for this region.' : 'Open now: cross whenever you feel ready.'}</p>
      </div>
      {passed && <span className="inkstamp text-xs text-ok-500">Cleared</span>}
    </Link>
  )
}
