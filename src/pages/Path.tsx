import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { levels, loadUnit, units as unitIndex } from '../engine/loader'
import { lessonMastery, ringFor } from '../engine/mastery'
import { lessonIdsFor, levelUnlocked, levelComplete, lessonUnlocked, DEFAULT_START_LEVEL } from '../engine/unlock'
import { setKv, getKv } from '../db/progress'
import { db } from '../db'
import { useLessonRows, useAllCards, useDays, useDueCount, useExams, useKvValue } from '../hooks/useProgress'
import { streakFrom, todayKey } from '../engine/mastery'
import { useSettings } from '../store/settings'
import { IconFlame, IconLock, IconStar, IconCheck, IconTrophy, IconRepeat, IconSparkle } from '../components/ui/icons'
import { Mark } from '../components/ui/Mark'
import { unitSticker } from '../engine/stickers'
import { ProgressBar, Chip } from '../components/ui/basics'
import type { LevelMeta, LevelId } from '../engine/schema'
import type { Lesson } from '../engine/schema'

export default function Path() {
  const lessonRows = useLessonRows()
  const cards = useAllCards()
  const days = useDays()
  const due = useDueCount()
  const exams = useExams()
  const goal = useSettings((s) => s.dailyGoal)
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
  const todayRow = days.find((d) => d.date === today)
  const streak = streakFrom(days.filter((d) => d.xp > 0 || d.lessons > 0 || d.reviews > 0).map((d) => d.date), today)
  const xpToday = todayRow?.xp ?? 0
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const goalDone = xpToday >= goal

  return (
    <div className="animate-rise">
      <header className="mb-4 flex items-center gap-3">
        <Mark size={48} className="animate-float" />
        <div className="min-w-0 flex-1">
          <h1 className="text-gradient text-[1.8rem]">{greeting} 👋</h1>
          <p className="text-sm font-semibold text-muted">{goalDone ? 'Goal reached for today. ¡Olé!' : streak.current ? `Day ${streak.current} of your streak. Keep it alight.` : 'A few minutes a day is all it takes.'}</p>
        </div>
      </header>
      <section className="card mb-4 flex items-center gap-4">
        <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${streak.current ? 'bg-sunset-gradient text-white' : 'bg-surface-2 text-muted'}`} title="Day streak">
          <IconFlame width={22} height={22} fill={streak.current ? 'currentColor' : 'none'} />
          <span className="text-sm font-extrabold leading-none">{streak.current}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-xs font-extrabold text-muted">
            <span>Today's goal</span>
            <span>{xpToday} / {goal} XP</span>
          </div>
          <ProgressBar value={Math.min(xpToday, goal)} max={goal} tone={goalDone ? 'ok' : 'brand'} className="mt-1.5" />
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
            {level.units.map((u) => {
              const lessons = lessonMeta.get(u.id)
              return (
                <div key={u.id} className="card mb-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl" aria-hidden="true">{unitSticker(u.id)}</span>
                    <div className="min-w-0 flex-1">
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
                    <div className="mt-3 flex flex-wrap gap-3">
                      {(lessons ?? Array.from({ length: lessonCounts.get(u.id) ?? 4 }, (_, i) => ({ id: `${u.id}.l${i + 1}`, title: `Lesson ${i + 1}` }))).map((l) => {
                        const row = lessonRows.get(l.id)
                        const open = lessonUnlocked(l.id, level, lessonRows, exams, lessonCounts, startLevel)
                        const mastery = lessonMastery(cardsByLesson.get(l.id) ?? [])
                        const ring = open ? ringFor(row, mastery) : 'locked'
                        return <LessonBubble key={l.id} id={l.id} title={l.title} ring={ring} mastery={mastery} />
                      })}
                    </div>
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

function LessonBubble({ id, title, ring, mastery }: { id: string; title: string; ring: string; mastery: number }) {
  const locked = ring === 'locked'
  const r = 26
  const c = 2 * Math.PI * r
  const colors: Record<string, string> = { locked: 'text-[var(--line)]', new: 'text-brand-500', started: 'text-brand-500', learned: 'text-ok-500', mastered: 'text-gold-500' }
  const fills: Record<string, string> = { locked: 'bg-surface-2 text-muted', new: 'bg-brand-gradient text-white shadow-md', started: 'bg-brand-gradient text-white shadow-md', learned: 'bg-mint-gradient text-white shadow-md', mastered: 'bg-sunset-gradient text-white shadow-md' }
  const inner = (
    <div className="flex w-20 flex-col items-center text-center">
      <div className={`relative h-16 w-16 ${colors[ring]}`}>
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity={locked ? 1 : 0.22} strokeWidth="5" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * (locked ? 0 : mastery)} ${c}`} />
        </svg>
        <div className={`absolute inset-[7px] flex items-center justify-center rounded-full ${fills[ring]}`}>
          {locked ? <IconLock width={20} height={20} /> : ring === 'mastered' ? <IconTrophy width={22} height={22} /> : ring === 'learned' ? <IconCheck width={24} height={24} /> : <IconStar width={22} height={22} fill={ring === 'started' ? 'currentColor' : 'none'} />}
        </div>
      </div>
      <span className={`mt-1.5 line-clamp-2 text-[11px] font-extrabold leading-tight ${locked ? 'text-muted' : ''}`}>{title}</span>
    </div>
  )
  if (locked) return <div aria-disabled="true">{inner}</div>
  return (
    <Link to={`/lesson/${id}`} className="rounded-2xl transition hover:-translate-y-0.5 active:scale-95" aria-label={`${title}: ${ring}`}>
      {inner}
    </Link>
  )
}

function ExamCard({ level, enabled, complete, passed, score }: { level: LevelMeta; enabled: boolean; complete: boolean; passed: boolean; score?: number }) {
  const body = (
    <div className={`card flex items-center gap-3 ${enabled ? 'bg-gold-100/70 dark:bg-gold-500/10' : 'opacity-60'}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${passed ? 'bg-sunset-gradient text-white' : enabled ? 'bg-gold-500 text-white' : 'bg-surface-2 text-muted'}`}>{enabled ? <IconTrophy /> : <IconLock />}</div>
      <div className="flex-1">
        <p className="font-extrabold">Checkpoint {level.title}</p>
        <p className="text-xs text-muted">{passed ? `Passed · ${Math.round((score ?? 0) * 100)}%` : !enabled ? 'Unlocks with this level.' : complete ? 'Reading, listening, grammar, writing and speaking. Pass to unlock the next level.' : 'Already know this level? Take the checkpoint now to test out and unlock the next level.'}</p>
      </div>
    </div>
  )
  return enabled ? <Link to={`/exam/${level.id}`}>{body}</Link> : body
}
