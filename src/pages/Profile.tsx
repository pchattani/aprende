import { useMemo } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAllCards, useDays, useExams, useLessonRows } from '../hooks/useProgress'
import { streakFrom, todayKey, shiftDay, wordCounts, weakSkills, estimateLevel } from '../engine/mastery'
import { grammar, levels, vocab } from '../engine/loader'
import { PageHeader, Chip, Button } from '../components/ui/basics'
import { IconGear } from '../components/ui/icons'

const NO_REVIEWS: never[] = []

export default function Profile() {
  const cards = useAllCards() ?? []
  const days = useDays() ?? []
  const exams = useExams()
  const lessons = useLessonRows()
  const reviews = useLiveQuery(() => db.reviews.orderBy('ts').reverse().limit(600).toArray(), [], NO_REVIEWS)
  const today = todayKey()
  const streak = streakFrom(days.filter((d) => d.minutes > 0 || d.lessons > 0 || d.reviews > 0).map((d) => d.date), today)
  const activeDays = days.filter((d) => d.minutes > 0 || d.lessons > 0 || d.reviews > 0).length
  const wc = wordCounts(cards)
  const grammarMastered = cards.filter((c) => c.kind === 'grammar' && c.stage >= 2).length
  const grammarMet = new Set(cards.flatMap((c) => c.grammar)).size
  const weak = useMemo(() => weakSkills(reviews).slice(0, 5), [reviews])
  const level = estimateLevel(wc.productive, grammarMastered)
  const lessonsDone = [...(lessons?.values() ?? [])].filter((l) => l.completions > 0).length
  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0)
  const totalXp = days.reduce((s, d) => s + (d.xp ?? 0), 0)

  return (
    <div className="pb-6">
      <PageHeader title="Your progress" right={<Link to="/settings" className="rounded-full p-2 text-muted" aria-label="Settings"><IconGear /></Link>} />
      <section className="relative overflow-hidden rounded-3xl bg-sunset-gradient p-5 text-white shadow-[0_6px_0_0_#d97f00]" aria-label="Rhythm">
        <span className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <span className={`text-7xl ${streak.current > 0 ? 'animate-flame' : 'opacity-70 grayscale'}`} aria-hidden="true">🔥</span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest opacity-90">Rhythm</p>
            <p className="font-display text-5xl leading-none">{streak.current}</p>
            <p className="font-extrabold">{streak.current === 1 ? 'day' : 'days'} in a row</p>
          </div>
        </div>
        <p className="relative mt-3 rounded-2xl bg-black/10 px-3 py-2 text-sm font-bold">Longest: {streak.longest} {streak.longest === 1 ? 'day' : 'days'} · {activeDays} active {activeDays === 1 ? 'day' : 'days'} in all</p>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon="⚡" tone="bg-gold-100 dark:bg-gold-500/15" label="Total XP" value={String(totalXp)} sub={`${days.find((d) => d.date === today)?.xp ?? 0} today`} />
        <Stat icon="⏱" tone="bg-sky-100 dark:bg-sky-500/15" label="Time practised" value={totalMinutes >= 90 ? `${(totalMinutes / 60).toFixed(1)} h` : `${totalMinutes} min`} sub={`${reviews.length} recent answers`} />
        <Stat icon="🏆" tone="bg-brand-100 dark:bg-brand-500/15" label="Estimated level" value={level} sub={`${lessonsDone} ${lessonsDone === 1 ? 'lesson' : 'lessons'} completed`} />
        <Stat icon="📚" tone="bg-ok-100 dark:bg-ok-500/15" label="Words you can use" value={String(wc.productive)} sub={`${wc.recognised} recognised · ${wc.seen} met · ${vocab.size} in course`} />
      </div>
      <section className="card mt-4">
        <p className="font-display text-lg">Last 12 weeks</p>
        <Heatmap days={days} today={today} />
      </section>
      <section className="card mt-4">
        <p className="font-display text-lg">Grammar</p>
        <p className="mt-1 text-sm">{grammarMastered} points mastered · {grammarMet} met · {grammar.size} in the course</p>
        {weak.length > 0 ? (
          <>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Weak spots — practise these</p>
            <ul className="mt-1 space-y-1">
              {weak.map((w) => (
                <li key={w.grammar} className="flex items-center justify-between gap-2 text-sm">
                  <Link to={`/grammar/${w.grammar}`} className="min-w-0 truncate font-bold">{grammar.get(w.grammar)?.title ?? w.grammar}</Link>
                  <span className="shrink-0 text-xs text-muted">{Math.round(w.errorRate * 100)}% errors</span>
                  <Link to={`/review?grammar=${encodeURIComponent(w.grammar)}`} className="btn btn-ghost shrink-0 px-2 py-1 text-xs">Practise</Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">No weak spots detected yet. They appear after a few sessions.</p>
        )}
      </section>
      <section className="card mt-4">
        <p className="font-display text-lg">Level checks</p>
        <ul className="mt-1 divide-y divide-[var(--line)] text-sm">
          {levels.map((l) => {
            const e = exams?.get(l.id)
            return (
              <li key={l.id} className="flex items-center justify-between py-2">
                <span className="font-bold">{l.title} · {l.name}</span>
                {e ? <Chip tone={e.passed ? 'ok' : 'bad'}>{e.passed ? 'Passed' : 'Attempted'} · {Math.round(e.score * 100)}%</Chip> : <Chip>Not taken</Chip>}
              </li>
            )
          })}
        </ul>
      </section>
      <Link to="/settings" className="mt-4 block"><Button variant="ghost" className="w-full">Settings, backup and voices</Button></Link>
    </div>
  )
}

function Stat({ icon, tone, label, value, sub }: { icon: string; tone: string; label: string; value: string; sub: string }) {
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${tone}`} aria-hidden="true">{icon}</span>
        <p className="font-display text-2xl leading-none">{value}</p>
      </div>
      <p className="mt-2 text-sm font-extrabold leading-tight">{label}</p>
      <p className="text-xs font-semibold text-muted">{sub}</p>
    </div>
  )
}

function Heatmap({ days, today }: { days: { date: string; minutes: number; reviews: number; lessons: number }[]; today: string }) {
  const map = new Map(days.map((d) => [d.date, d.minutes + d.reviews / 5 + d.lessons * 3]))
  const cells: { date: string; xp: number }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = shiftDay(today, -i)
    cells.push({ date: d, xp: map.get(d) ?? 0 })
  }
  const max = Math.max(1, ...cells.map((c) => c.xp))
  return (
    <div className="mt-2 grid grid-flow-col grid-rows-7 gap-1" aria-label="Activity heatmap">
      {cells.map((c) => {
        const t = c.xp / max
        const bg = c.xp === 0 ? 'bg-surface-2' : t < 0.34 ? 'bg-gold-300' : t < 0.67 ? 'bg-gold-500' : 'bg-tangerine-500'
        return <div key={c.date} title={`${c.date}: ${c.xp === 0 ? 'rest day' : 'practised'}`} className={`h-4 w-4 rounded-[5px] ${bg}`} />
      })}
    </div>
  )
}
