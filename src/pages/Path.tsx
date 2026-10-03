import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { levels, loadUnit, units as unitIndex } from '../engine/loader'
import { lessonMastery, ringFor } from '../engine/mastery'
import { lessonIdsFor, levelUnlocked, levelComplete, lessonUnlocked } from '../engine/unlock'
import { useLessonRows, useAllCards, useDays, useDueCount, useExams } from '../hooks/useProgress'
import { streakFrom, todayKey } from '../engine/mastery'
import { useSettings } from '../store/settings'
import { IconFlame, IconLock, IconStar, IconCheck, IconTrophy, IconRepeat } from '../components/ui/icons'
import { ProgressBar, Chip } from '../components/ui/basics'
import type { LevelMeta } from '../engine/schema'
import type { Lesson } from '../engine/schema'

export default function Path() {
  const lessonRows = useLessonRows()
  const cards = useAllCards()
  const days = useDays()
  const due = useDueCount()
  const exams = useExams()
  const goal = useSettings((s) => s.dailyGoal)
  const [lessonMeta, setLessonMeta] = useState<Map<string, Lesson[]>>(new Map())

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

  if (!lessonRows || !cards || !days || !exams) return <div className="p-8 text-center text-muted">Loading…</div>
  const today = todayKey()
  const todayRow = days.find((d) => d.date === today)
  const streak = streakFrom(days.filter((d) => d.xp > 0 || d.lessons > 0 || d.reviews > 0).map((d) => d.date), today)
  const xpToday = todayRow?.xp ?? 0

  return (
    <div>
      <header className="card mb-4 flex items-center gap-4">
        <div className="flex items-center gap-1 text-brand-600" title="Day streak">
          <IconFlame width={28} height={28} fill={streak.current ? 'currentColor' : 'none'} />
          <span className="text-2xl font-extrabold">{streak.current}</span>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-xs font-bold text-muted">
            <span>Today</span>
            <span>
              {xpToday} / {goal} XP
            </span>
          </div>
          <ProgressBar value={Math.min(xpToday, goal)} max={goal} tone="gold" className="mt-1" />
        </div>
      </header>
      {(due ?? 0) > 0 && (
        <Link to="/review" className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-sky-500 bg-sky-500/10 p-3">
          <IconRepeat className="text-sky-600" />
          <div className="flex-1">
            <p className="font-bold">{due} items due for review</p>
            <p className="text-xs text-muted">Review first — this is where words and grammar stick.</p>
          </div>
          <span className="btn btn-primary px-3 py-2 text-xs">Review</span>
        </Link>
      )}
      {levels.map((level) => {
        const unlocked = levelUnlocked(level.id, lessonRows, exams, lessonCounts)
        const complete = levelComplete(level, lessonRows, lessonCounts)
        const ids = lessonIdsFor(level, lessonCounts)
        const doneCount = ids.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
        const passed = exams.get(level.id)?.passed
        return (
          <section key={level.id} className="mb-6">
            <div className={`mb-3 rounded-2xl p-4 text-white ${unlocked ? 'bg-brand-600' : 'bg-stone-400 dark:bg-stone-700'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide opacity-80">{level.name}</p>
                  <h2 className="text-2xl font-extrabold">{level.title}</h2>
                </div>
                {!unlocked ? <IconLock /> : passed ? <IconTrophy /> : null}
              </div>
              <p className="mt-1 text-sm opacity-90">{level.description}</p>
              {ids.length > 0 && (
                <p className="mt-2 text-xs font-bold opacity-90">
                  {doneCount} / {ids.length} lessons · {level.wordTarget.toLocaleString()} words target
                </p>
              )}
            </div>
            {level.units.map((u) => {
              const lessons = lessonMeta.get(u.id)
              return (
                <div key={u.id} className="card mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold">{u.title}</h3>
                      <p className="text-xs text-muted">{u.subtitle}</p>
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
                        const open = lessonUnlocked(l.id, level, lessonRows, exams, lessonCounts)
                        const mastery = lessonMastery(cardsByLesson.get(l.id) ?? [])
                        const ring = open ? ringFor(row, mastery) : 'locked'
                        return <LessonBubble key={l.id} id={l.id} title={l.title} ring={ring} mastery={mastery} />
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {ids.length > 0 && <ExamCard level={level} enabled={complete} passed={Boolean(passed)} score={exams.get(level.id)?.score} />}
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
  const colors: Record<string, string> = { locked: 'text-stone-300 dark:text-stone-600', new: 'text-brand-500', started: 'text-brand-500', learned: 'text-ok-500', mastered: 'text-gold-500' }
  const inner = (
    <div className="flex w-20 flex-col items-center text-center">
      <div className={`relative h-16 w-16 ${colors[ring]}`}>
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * (locked ? 0 : mastery)} ${c}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {locked ? <IconLock width={22} height={22} /> : ring === 'mastered' ? <IconTrophy width={24} height={24} /> : ring === 'learned' ? <IconCheck width={26} height={26} /> : <IconStar width={24} height={24} fill={ring === 'started' ? 'currentColor' : 'none'} />}
        </div>
      </div>
      <span className={`mt-1 line-clamp-2 text-[11px] font-bold leading-tight ${locked ? 'text-muted' : ''}`}>{title}</span>
    </div>
  )
  if (locked) return <div aria-disabled="true">{inner}</div>
  return (
    <Link to={`/lesson/${id}`} className="rounded-2xl active:scale-95" aria-label={`${title}: ${ring}`}>
      {inner}
    </Link>
  )
}

function ExamCard({ level, enabled, passed, score }: { level: LevelMeta; enabled: boolean; passed: boolean; score?: number }) {
  const body = (
    <div className={`card flex items-center gap-3 ${enabled ? 'border-gold-500' : 'opacity-60'}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${passed ? 'bg-gold-300 text-gold-600' : 'bg-surface-2 text-muted'}`}>{enabled ? <IconTrophy /> : <IconLock />}</div>
      <div className="flex-1">
        <p className="font-extrabold">Checkpoint {level.title}</p>
        <p className="text-xs text-muted">{passed ? `Passed · ${Math.round((score ?? 0) * 100)}%` : enabled ? 'Reading, listening, grammar, writing and speaking. Pass to unlock the next level.' : 'Complete every lesson in this level to unlock the checkpoint.'}</p>
      </div>
    </div>
  )
  return enabled ? <Link to={`/exam/${level.id}`}>{body}</Link> : body
}
