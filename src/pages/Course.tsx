import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { levels, loadUnit, units as unitIndex } from '../engine/loader'
import { lessonMastery, ringFor, shiftDay, todayKey } from '../engine/mastery'
import { lessonIdsFor, levelUnlocked, levelComplete, lessonUnlocked, DEFAULT_START_LEVEL } from '../engine/unlock'
import { setKv, getKv } from '../db/progress'
import { db } from '../db'
import { useLessonRows, useAllCards, useDays, useDueCount, useExams, useKvValue } from '../hooks/useProgress'
import { useSettings } from '../store/settings'
import { IconLock, IconCheck, IconTrophy, IconRepeat, IconSparkle } from '../components/ui/icons'
import { Chip } from '../components/ui/basics'
import { Mark } from '../components/ui/Mark'
import { unitSticker } from '../engine/stickers'
import type { LevelMeta, LevelId, Lesson } from '../engine/schema'
import type { DayRow } from '../engine/types'

const STATUS_LABEL: Record<string, string> = { locked: 'locked', new: 'new', started: 'in progress', learned: 'learned', mastered: 'solid' }

export default function Course() {
  const lessonRows = useLessonRows()
  const cards = useAllCards()
  const days = useDays()
  const due = useDueCount()
  const exams = useExams()
  const goal = useSettings((s) => s.dailyMinutes)
  const startLevel = useKvValue<LevelId>('startLevel', DEFAULT_START_LEVEL)
  const nav = useNavigate()
  const [lessonMeta, setLessonMeta] = useState<Map<string, Lesson[]>>(new Map())
  const [checked, setChecked] = useState(false)
  const [hour] = useState(() => new Date().getHours())

  // First launch: nothing done yet and no starting level chosen → welcome screen.
  // A direct read (not a live query) so a just-written flag is never seen stale.
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
  const startHere = (level: LevelId) => {
    void setKv('startLevel', level).then(() => setKv('onboarded', true))
  }
  const today = todayKey()
  const byDate = new Map(days.map((d) => [d.date, d]))
  const active = (d?: DayRow) => Boolean(d && (d.minutes > 0 || d.lessons > 0 || d.reviews > 0))
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6)).map((date) => ({ date, on: active(byDate.get(date)) }))
  const weekCount = week.filter((w) => w.on).length
  let inARow = 0
  for (let i = 0; ; i++) {
    const d = shiftDay(today, -i)
    if (active(byDate.get(d))) inARow++
    else if (i === 0) continue // today may not have started yet
    else break
  }
  const minutesToday = byDate.get(today)?.minutes ?? 0
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const goalDone = minutesToday >= goal

  return (
    <div className="animate-rise">
      <header className="mb-4 flex items-center gap-3">
        <Mark size={48} className="animate-float" />
        <div className="min-w-0 flex-1">
          <h1 className="text-gradient text-[1.8rem]">{greeting} 👋</h1>
          <p className="text-sm font-semibold text-muted">{goalDone ? 'Practice done for today. ¡Olé!' : inARow > 1 ? `${inARow} days in a row. Keep the rhythm.` : 'A few minutes a day is all it takes.'}</p>
        </div>
      </header>

      <section className="card mb-4 flex items-center gap-4" aria-label="Today and this week">
        <MinutesRing minutes={minutesToday} goal={goal} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Your rhythm</p>
          <div className="mt-1.5 flex justify-between gap-1" aria-label={`${weekCount} of 7 days practised this week`}>
            {week.map((w, i) => {
              const label = new Date(w.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })
              const isToday = i === 6
              return (
                <div key={w.date} className="flex flex-col items-center gap-1">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold ${w.on ? 'bg-mint-gradient text-white' : isToday ? 'border-2 border-dashed border-brand-400 text-brand-500' : 'bg-surface-2 text-muted'}`}>{w.on ? '✓' : label}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-muted">{weekCount} of 7 days this week{inARow > 1 ? ` · ${inARow} in a row` : ''}</p>
        </div>
      </section>

      <p className="mb-5 text-center text-xs">
        <Link to="/welcome" className="font-bold text-muted underline decoration-dotted underline-offset-4">Change starting level or retake the placement test</Link>
      </p>

      {(due ?? 0) > 0 && (
        <Link to="/review" className="card mb-5 flex items-center gap-3 bg-sky-100/70 dark:bg-sky-500/15">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint-gradient text-white"><IconRepeat /></span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{due} to review</p>
            <p className="text-xs text-muted">Review first: this is where words and grammar stick.</p>
          </div>
          <span className="btn btn-primary px-4 py-2 text-sm">Go</span>
        </Link>
      )}

      {levels.map((level) => {
        const unlocked = levelUnlocked(level.id, lessonRows, exams, lessonCounts, startLevel)
        const complete = levelComplete(level, lessonRows, lessonCounts)
        const ids = lessonIdsFor(level, lessonCounts)
        const doneCount = ids.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
        const passed = exams.get(level.id)?.passed
        return (
          <section key={level.id} className="mb-8">
            <div className={`level-banner mb-4 ${unlocked ? `level-${level.id}` : 'level-locked'}`}>
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest opacity-85">{level.name}</p>
                  <h2 className="text-4xl text-white">{level.title}</h2>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">{!unlocked ? <IconLock /> : passed ? <IconTrophy /> : <IconSparkle />}</span>
              </div>
              <p className="relative mt-2 text-sm leading-snug opacity-95">{level.description}</p>
              {ids.length > 0 && (
                <div className="relative mt-3 flex items-center gap-3 text-xs font-extrabold">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
                    <div className="h-full rounded-full bg-white/90" style={{ width: `${ids.length ? (doneCount / ids.length) * 100 : 0}%` }} />
                  </div>
                  <span className="opacity-95">{doneCount} / {ids.length} lessons</span>
                </div>
              )}
              {!unlocked && (
                <button type="button" onClick={() => startHere(level.id)} className="relative mt-4 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-brand-600 shadow-sm active:scale-95">
                  Start here — I already know the earlier levels
                </button>
              )}
            </div>
            {level.units.map((u, unitIdx) => {
              const lessons = lessonMeta.get(u.id)
              const list = lessons ?? Array.from({ length: lessonCounts.get(u.id) ?? 4 }, (_, i) => ({ id: `${u.id}.l${i + 1}`, title: `Lesson ${i + 1}` }))
              return (
                <div key={u.id} className="card mb-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl" aria-hidden="true">{unitSticker(u.id)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Unit {unitIdx + 1}</p>
                      <h3 className="text-lg font-extrabold leading-tight">{u.title}</h3>
                      <p className="text-xs font-semibold text-muted">{u.subtitle}</p>
                    </div>
                    {!u.authored && <Chip>Coming soon</Chip>}
                  </div>
                  {u.canDo.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted">
                      {u.canDo.map((c, i) => (
                        <li key={i} className="flex gap-1">
                          <IconCheck width={14} height={14} className="mt-0.5 shrink-0" /> {c}
                        </li>
                      ))}
                    </ul>
                  )}
                  {u.authored && (
                    <ul className="mt-3 divide-y divide-[var(--line)]">
                      {list.map((l, i) => {
                        const row = lessonRows.get(l.id)
                        const open = lessonUnlocked(l.id, level, lessonRows, exams, lessonCounts, startLevel)
                        const mastery = lessonMastery(cardsByLesson.get(l.id) ?? [])
                        const ring = open ? ringFor(row, mastery) : 'locked'
                        return <LessonRow key={l.id} id={l.id} n={i + 1} title={l.title} status={ring} mastery={mastery} />
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
            {ids.length > 0 && <ExamCard level={level} enabled={unlocked} complete={complete} passed={Boolean(passed)} score={exams.get(level.id)?.score} />}
          </section>
        )
      })}
    </div>
  )
}

/** Minutes practised today as a ring around the number. */
function MinutesRing({ minutes, goal }: { minutes: number; goal: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const pct = Math.min(1, minutes / Math.max(1, goal))
  return (
    <div className="relative h-[72px] w-[72px] shrink-0" role="img" aria-label={`${minutes} of ${goal} minutes practised today`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={pct >= 1 ? '#22c48a' : 'url(#ringGrad)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7c5cff" />
            <stop offset="1" stopColor="#ff5fa2" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-extrabold">{minutes}</span>
        <span className="text-[9px] font-bold text-muted">/ {goal} min</span>
      </div>
    </div>
  )
}

function LessonRow({ id, n, title, status, mastery }: { id: string; n: number; title: string; status: string; mastery: number }) {
  const locked = status === 'locked'
  const label = STATUS_LABEL[status] ?? status
  const badge =
    status === 'mastered' ? 'bg-sunset-gradient text-white' : status === 'learned' ? 'bg-mint-gradient text-white' : status === 'started' ? 'bg-brand-gradient text-white' : locked ? 'bg-surface-2 text-muted' : 'bg-brand-100 text-brand-600 dark:bg-brand-500/25 dark:text-brand-100'
  const inner = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${badge}`}>
        {locked ? <IconLock width={16} height={16} /> : status === 'learned' || status === 'mastered' ? <IconCheck width={18} height={18} /> : n}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-bold ${locked ? 'text-muted' : ''}`}>{title}</span>
        <span className="mt-1 flex items-center gap-2">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
            <span className={`block h-full rounded-full ${status === 'mastered' ? 'bg-gold-500' : 'bg-ok-500'}`} style={{ width: `${locked ? 0 : Math.round(mastery * 100)}%` }} />
          </span>
          <span className={`text-[11px] font-semibold text-muted ${locked ? '' : 'capitalize'}`}>{locked ? 'Finish the previous lesson' : label}</span>
        </span>
      </span>
      {!locked && <span className="text-muted" aria-hidden="true">›</span>}
    </>
  )
  if (locked) return <li className="flex items-center gap-3 py-2.5" aria-label={`${title}: locked`}>{inner}</li>
  return (
    <li>
      <Link to={`/lesson/${id}`} className="flex items-center gap-3 rounded-xl py-2.5 transition hover:bg-surface-2/60 active:scale-[0.99]" aria-label={`${title}: ${label}`}>
        {inner}
      </Link>
    </li>
  )
}

function ExamCard({ level, enabled, complete, passed, score }: { level: LevelMeta; enabled: boolean; complete: boolean; passed: boolean; score?: number }) {
  const body = (
    <div className={`card flex items-center gap-3 ${enabled ? 'bg-gold-100/70 dark:bg-gold-500/10' : 'opacity-60'}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${passed ? 'bg-sunset-gradient text-white' : enabled ? 'bg-gold-500 text-white' : 'bg-surface-2 text-muted'}`}>{enabled ? <IconTrophy /> : <IconLock />}</div>
      <div className="flex-1">
        <p className="font-extrabold">Level check · {level.title}</p>
        <p className="text-xs text-muted">{passed ? `Passed · ${Math.round((score ?? 0) * 100)}%` : !enabled ? 'Unlocks with this level.' : complete ? 'Reading, listening, grammar, writing and speaking. Pass to open the next level.' : 'Already know this level? Take the level check now to skip ahead.'}</p>
      </div>
    </div>
  )
  return enabled ? <Link to={`/exam/${level.id}`}>{body}</Link> : body
}
