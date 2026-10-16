import { useMemo } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAllCards, useDays, useExams, useLessonRows } from '../hooks/useProgress'
import { streakFrom, todayKey, shiftDay, wordCounts, weakSkills, estimateLevel } from '../engine/mastery'
import { grammar, levels, vocab } from '../engine/loader'
import { PageHeader, Chip, Button } from '../components/ui/basics'
import { IconGear, IconPaw, IconChart } from '../components/ui/icons'

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
      <section className="card overflow-hidden p-0" aria-label="Rhythm">
        <div className="airmail h-1.5" aria-hidden="true" />
        <div className="flex items-center gap-4 p-4">
          <span className={`flex h-20 w-20 shrink-0 rotate-[-8deg] items-center justify-center rounded-full border-[3px] border-double ${streak.current > 0 ? 'border-red text-red' : 'border-line text-ink-2'}`} aria-hidden="true"><IconPaw width={34} height={34} /></span>
          <div className="min-w-0">
            <p className="eyebrow">Rhythm · days on the road</p>
            <p className="font-mono text-5xl leading-none">{streak.current}</p>
            <p className="text-sm text-ink-2">{streak.current === 1 ? 'day' : 'days'} in a row · longest <span className="font-mono text-ink">{streak.longest}</span> · <span className="font-mono text-ink">{activeDays}</span> active in all</p>
          </div>
        </div>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Kilometres" value={String(totalXp)} sub={`${days.find((d) => d.date === today)?.xp ?? 0} km today`} />
        <Stat label="Time practised" value={totalMinutes >= 90 ? `${(totalMinutes / 60).toFixed(1)} h` : `${totalMinutes} min`} sub={`${reviews.length} recent answers`} />
        <Stat label="Estimated level" value={level} sub={`${lessonsDone} ${lessonsDone === 1 ? 'lesson' : 'lessons'} completed`} />
        <Stat label="Words you can use" value={String(wc.productive)} sub={`${wc.recognised} recognised · ${wc.seen} met · ${vocab.size} in course`} />
      </div>
      <Link to="/insights" className="card mt-3 flex items-center gap-3">
        <IconChart width={26} height={26} className="shrink-0 text-blue" />
        <span className="min-w-0 flex-1"><span className="block font-semibold">Insights</span><span className="block text-xs text-ink-2">Memory, recall, calibration, workload and what to work on next.</span></span>
        <span className="text-ink-2" aria-hidden="true">›</span>
      </Link>
      <section className="card mt-4">
        <p className="eyebrow">Travel log · last 12 weeks</p>
        <Heatmap days={days} today={today} />
      </section>
      <section className="card mt-4">
        <p className="eyebrow">Grammar</p>
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
        <p className="eyebrow">Border controls · level checks</p>
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

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-3.5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-mono text-2xl leading-tight">{value}</p>
      <p className="mt-0.5 text-xs text-ink-2">{sub}</p>
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
        const bg = c.xp === 0 ? 'bg-card-2' : t < 0.34 ? 'bg-red/30' : t < 0.67 ? 'bg-red/65' : 'bg-red'
        return <div key={c.date} title={`${c.date}: ${c.xp === 0 ? 'rest day' : 'practised'}`} className={`h-4 w-4 rounded-[5px] ${bg}`} />
      })}
    </div>
  )
}
