import { useMemo } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAllCards, useDays, useExams, useLessonRows } from '../hooks/useProgress'
import { streakFrom, todayKey, shiftDay, wordCounts, weakSkills, estimateLevel } from '../engine/mastery'
import { grammar, levels, vocab } from '../engine/loader'
import { PageHeader, Chip, Button } from '../components/ui/basics'
import { IconFlame, IconGear, IconStar, IconTrophy } from '../components/ui/icons'

export default function Profile() {
  const cards = useAllCards() ?? []
  const days = useDays() ?? []
  const exams = useExams()
  const lessons = useLessonRows()
  const reviews = useLiveQuery(() => db.reviews.orderBy('ts').reverse().limit(600).toArray(), []) ?? []
  const today = todayKey()
  const streak = streakFrom(days.filter((d) => d.xp > 0 || d.lessons > 0 || d.reviews > 0).map((d) => d.date), today)
  const xp = days.reduce((s, d) => s + d.xp, 0)
  const wc = wordCounts(cards)
  const grammarMastered = cards.filter((c) => c.kind === 'grammar' && c.stage >= 2).length
  const grammarMet = new Set(cards.flatMap((c) => c.grammar)).size
  const weak = useMemo(() => weakSkills(reviews).slice(0, 5), [reviews])
  const level = estimateLevel(wc.productive, grammarMastered)
  const lessonsDone = [...(lessons?.values() ?? [])].filter((l) => l.completions > 0).length
  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0)

  return (
    <div className="pb-6">
      <PageHeader title="Your progress" right={<Link to="/settings" className="rounded-full p-2 text-muted" aria-label="Settings"><IconGear /></Link>} />
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<IconFlame className="text-brand-600" fill="currentColor" />} label="Day streak" value={String(streak.current)} sub={`Longest ${streak.longest}`} />
        <Stat icon={<IconStar className="text-gold-500" fill="currentColor" />} label="Total XP" value={xp.toLocaleString()} sub={`${totalMinutes} min studied`} />
        <Stat icon={<IconTrophy className="text-sky-600" />} label="Estimated level" value={level} sub={`${lessonsDone} lessons completed`} />
        <Stat icon={<span className="text-xl">📚</span>} label="Words you can use" value={String(wc.productive)} sub={`${wc.recognised} recognised · ${wc.seen} met · ${vocab.size} in course`} />
      </div>
      <section className="card mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Last 12 weeks</p>
        <Heatmap days={days} today={today} />
      </section>
      <section className="card mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Grammar</p>
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
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Checkpoints</p>
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

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">{icon}{label}</div>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  )
}

function Heatmap({ days, today }: { days: { date: string; xp: number }[]; today: string }) {
  const map = new Map(days.map((d) => [d.date, d.xp]))
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
        const bg = c.xp === 0 ? 'bg-surface-2' : t < 0.34 ? 'bg-ok-100' : t < 0.67 ? 'bg-ok-500/60' : 'bg-ok-600'
        return <div key={c.date} title={`${c.date}: ${c.xp} XP`} className={`h-3.5 w-3.5 rounded-sm ${bg}`} />
      })}
    </div>
  )
}
