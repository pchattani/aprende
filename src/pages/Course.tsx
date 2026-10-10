import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { levels, loadUnit, units as unitIndex } from '../engine/loader'
import { lessonMastery, ringFor, shiftDay, todayKey } from '../engine/mastery'
import { lessonIdsFor, levelComplete, DEFAULT_START_LEVEL, levelIndex } from '../engine/unlock'
import { getKv, claimQuest } from '../db/progress'
import { db } from '../db'
import { useLessonRows, useAllCards, useDays, useDueCount, useExams, useKvValue, useQuests } from '../hooks/useProgress'
import { useSettings } from '../store/settings'
import { IconCheck, IconTrophy, IconRepeat } from '../components/ui/icons'
import { Chip } from '../components/ui/basics'
import { Leo, Bonchita, Luna } from '../components/ui/Dogs'
import { REGIONS, stopFor, souvenirById } from '../engine/journey'
import { questsForDate, progressFor, pickReward } from '../engine/quests'
import type { LevelMeta, LevelId, Lesson } from '../engine/schema'
import type { DayRow, LessonRow } from '../engine/types'

const STATUS_LABEL: Record<string, string> = { new: 'new', started: 'in progress', learned: 'learned', mastered: 'solid' }

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
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const goalDone = minutesToday >= goal

  // Current stop: the last lesson worked on, else the first lesson of the recommended level.
  const current = currentStop(lessonRows, startLevel)
  const currentInfo = current ? stopFor(current.unitId) : undefined

  return (
    <div className="animate-rise">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex -space-x-3">
            <Leo size={52} className="animate-float" />
            <Bonchita size={52} className="animate-float" style={{ animationDelay: '0.3s' }} />
            <Luna size={52} className="animate-float" style={{ animationDelay: '0.6s' }} />
          </div>
          <Link to="/passport" className="btn btn-ghost px-3 py-2 text-xs" aria-label="Passport">🛂 Passport</Link>
        </div>
        <h1 className="text-gradient mt-2 text-[1.7rem]">{greeting} 👋</h1>
        <p className="text-sm font-semibold text-muted">
          {currentInfo ? `Leo, Bonchita and Luna are in ${currentInfo.stop.name} ${currentInfo.stop.emoji}` : 'Leo, Bonchita and Luna are packing their bags.'}
        </p>
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
                <span key={w.date} className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold ${w.on ? 'bg-mint-gradient text-white' : isToday ? 'border-2 border-dashed border-brand-400 text-brand-500' : 'bg-surface-2 text-muted'}`}>{w.on ? '✓' : label}</span>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-muted">
            {goalDone ? 'Practice done for today. ¡Olé! · ' : ''}{weekCount} of 7 days this week{inARow > 1 ? ` · ${inARow} in a row` : ''}
          </p>
        </div>
      </section>

      {quests && <QuestsCard date={today} day={quests.day} rows={quests.rows} owned={quests.owned} level={currentInfo?.region.level ?? startLevel} />}

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

      <p className="mb-5 text-center text-xs">
        <Link to="/welcome" className="font-bold text-muted underline decoration-dotted underline-offset-4">Change where the journey starts or retake the placement test</Link>
      </p>

      {levels.map((level) => {
        const region = REGIONS.find((r) => r.level === level.id)
        const complete = levelComplete(level, lessonRows, lessonCounts)
        const ids = lessonIdsFor(level, lessonCounts)
        const doneCount = ids.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
        const passed = exams.get(level.id)?.passed
        const recommended = level.id === startLevel
        return (
          <section key={level.id} className="mb-8">
            <div className={`level-banner mb-4 level-${level.id}`}>
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest opacity-85">{level.title} · {level.name}</p>
                  <h2 className="text-3xl text-white">{region?.name ?? level.title}</h2>
                  {region && <p className="text-sm font-bold opacity-90">{region.es}</p>}
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl">{passed ? <IconTrophy /> : region?.stops[0]?.emoji}</span>
              </div>
              <p className="relative mt-2 text-sm leading-snug opacity-95">{level.description}</p>
              <div className="relative mt-3 flex items-center gap-3 text-xs font-extrabold">
                {ids.length > 0 && (
                  <>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
                      <div className="h-full rounded-full bg-white/90" style={{ width: `${ids.length ? (doneCount / ids.length) * 100 : 0}%` }} />
                    </div>
                    <span className="opacity-95">{doneCount} / {ids.length} lessons</span>
                  </>
                )}
                {recommended && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] uppercase tracking-wide text-brand-600">Recommended start</span>}
              </div>
            </div>
            <ol className="relative ml-4 border-l-2 border-dashed border-line pl-5">
              {level.units.map((u, unitIdx) => {
                const stop = region?.stops[unitIdx]
                const lessons = lessonMeta.get(u.id)
                const list = lessons ?? Array.from({ length: lessonCounts.get(u.id) ?? 4 }, (_, i) => ({ id: `${u.id}.l${i + 1}`, title: `Lesson ${i + 1}` }))
                const unitDone = u.authored && list.every((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0)
                const isCurrent = current?.unitId === u.id
                return (
                  <li key={u.id} className="relative mb-4">
                    <span className={`absolute -left-[2.1rem] top-4 flex h-8 w-8 items-center justify-center rounded-full text-base shadow-md ${unitDone ? 'bg-mint-gradient' : isCurrent ? 'bg-brand-gradient' : 'bg-surface'}`} aria-hidden="true">
                      {unitDone ? '✓' : stop?.emoji ?? '📍'}
                    </span>
                    <div className={`card ${isCurrent ? 'ring-2 ring-brand-400' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Stop {unitIdx + 1} · {stop?.name ?? `Unit ${unitIdx + 1}`}</p>
                          <h3 className="text-lg font-extrabold leading-tight">{u.title}</h3>
                          <p className="text-xs font-semibold text-muted">{u.subtitle}{stop ? ` · ${stop.es}` : ''}</p>
                        </div>
                        {isCurrent && (
                          <div className="flex shrink-0 -space-x-2" aria-label="Leo, Bonchita and Luna are here">
                            <Leo size={32} mood="curious" />
                            <Bonchita size={32} />
                            <Luna size={32} />
                          </div>
                        )}
                        {!u.authored && <Chip>Coming soon</Chip>}
                        {unitDone && <Chip tone="ok">Stamped</Chip>}
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
                            const mastery = lessonMastery(cardsByLesson.get(l.id) ?? [])
                            const ring = ringFor(row, mastery)
                            return <LessonRow key={l.id} id={l.id} n={i + 1} title={l.title} status={ring} mastery={mastery} />
                          })}
                        </ul>
                      )}
                    </div>
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
  return (
    <section className="card mb-4" aria-label="Today's quests">
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Today's quests</p>
        <span className="text-xs font-semibold text-muted">{[...rows.values()].filter((r) => r.claimedAt).length} / {quests.length} done</span>
      </div>
      <ul className="mt-2 divide-y divide-[var(--line)]">
        {quests.map((q, i) => {
          const p = Math.min(q.target, progressFor(q, day))
          const row = rows.get(q.id)
          const done = p >= q.target
          const seed = date.split('-').reduce((a, b) => a * 31 + Number(b), 7) + i
          return (
            <li key={q.id} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${row?.claimedAt ? 'bg-mint-gradient' : 'bg-surface-2'}`} aria-hidden="true">{row?.claimedAt ? '✓' : q.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{q.es}</span>
                <span className="block text-[11px] font-semibold text-muted">{q.en}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${(p / q.target) * 100}%` }} /></span>
                  <span className="shrink-0 text-[11px] font-extrabold text-muted">{p}/{q.target}</span>
                </span>
              </span>
              {row?.claimedAt ? (
                <span className="text-xs font-bold text-ok-600">{row.rewardId ? souvenirById(row.rewardId)?.emoji ?? '🎁' : '🛂'}</span>
              ) : done ? (
                <button type="button" className="btn btn-primary px-3 py-1.5 text-xs" onClick={() => void claim(q.id, seed)}>Claim</button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {justClaimed && <p className="mt-2 rounded-xl bg-gold-100 px-3 py-2 text-sm font-bold dark:bg-gold-500/15">🎁 Luna sniffed out {justClaimed}! It's in your passport.</p>}
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
  const label = STATUS_LABEL[status] ?? status
  const badge =
    status === 'mastered' ? 'bg-sunset-gradient text-white' : status === 'learned' ? 'bg-mint-gradient text-white' : status === 'started' ? 'bg-brand-gradient text-white' : 'bg-brand-100 text-brand-600 dark:bg-brand-500/25 dark:text-brand-100'
  return (
    <li>
      <Link to={`/lesson/${id}`} className="flex items-center gap-3 rounded-xl py-2.5 transition hover:bg-surface-2/60 active:scale-[0.99]" aria-label={`${title}: ${label}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${badge}`}>
          {status === 'learned' || status === 'mastered' ? <IconCheck width={18} height={18} /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{title}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
              <span className={`block h-full rounded-full ${status === 'mastered' ? 'bg-gold-500' : 'bg-ok-500'}`} style={{ width: `${Math.round(mastery * 100)}%` }} />
            </span>
            <span className="text-[11px] font-semibold capitalize text-muted">{label}</span>
          </span>
        </span>
        <span className="text-muted" aria-hidden="true">›</span>
      </Link>
    </li>
  )
}

function ExamCard({ level, complete, passed, score }: { level: LevelMeta; complete: boolean; passed: boolean; score?: number }) {
  return (
    <Link to={`/exam/${level.id}`} className="card flex items-center gap-3 bg-gold-100/70 dark:bg-gold-500/10">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${passed ? 'bg-sunset-gradient text-white' : 'bg-gold-500 text-white'}`}><IconTrophy /></div>
      <div className="flex-1">
        <p className="font-extrabold">Level check · {level.title}</p>
        <p className="text-xs text-muted">{passed ? `Passed · ${Math.round((score ?? 0) * 100)}%` : complete ? 'Reading, listening, grammar, writing and speaking. Show what you learnt in this region.' : 'Take it whenever you feel ready; it is open now.'}</p>
      </div>
    </Link>
  )
}
