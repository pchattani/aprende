/**
 * The Pawsport hub: every language you can learn and your progress in each.
 * Functional layout on the shared "Airmail" design system (src/index.css); the visual design is to come.
 */
import { useCallback, useEffect, useState } from 'react'
import courses, { type HubCourse } from 'virtual:pawsport-courses'
import { isStarted, readCourse } from './progress'
import { courseSummaryFor, quantFor, type Quant } from './analytics'
import { DeparturesBoard, type BoardRow } from '@/components/hub/DeparturesBoard'
import { PawsportMark } from '@/components/art/Logo'
import { DogsTrio } from '@/components/art/DogsTrio'
import { overallSummary, type CourseSummary, type OverallSummary } from './summary'

interface Started {
  course: HubCourse
  summary: CourseSummary
  quant: Quant | null
}
type Loaded = { started: Started[]; fresh: HubCourse[]; overall: OverallSummary | null }

async function loadAll(): Promise<Loaded> {
  const rows = await Promise.all(
    courses.map(async (course) => {
      const data = await readCourse(course.dbName).catch(() => null)
      return isStarted(data) ? { course, summary: courseSummaryFor(data), quant: quantFor(data) } : course
    }),
  )
  const started = rows.filter((r): r is Started => 'summary' in r)
  // Most recently studied first.
  started.sort((a, b) => (b.summary.lastActive ?? '').localeCompare(a.summary.lastActive ?? ''))
  const fresh = rows.filter((r): r is HubCourse => !('summary' in r))
  return { started, fresh, overall: started.length ? overallSummary(started.map((s) => s.summary)) : null }
}

function useHubData(): Loaded | null {
  const [data, setData] = useState<Loaded | null>(null)
  const refresh = useCallback(() => {
    loadAll().then(setData, () => setData({ started: [], fresh: courses, overall: null }))
  }, [])
  useEffect(() => {
    refresh()
    // Coming back from a course (back button, bfcache, another tab): show the latest progress.
    const onShow = (e: PageTransitionEvent) => e.persisted && refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    window.addEventListener('pageshow', onShow)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pageshow', onShow)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])
  return data
}

export default function App() {
  const data = useHubData()
  const today = todayIso()
  const rows: BoardRow[] = data
    ? [
        ...data.started.map(({ course, summary }) => ({ id: course.id, flag: course.flag, name: course.name, destination: course.country, href: course.href, status: 'started' as const, level: summary.level.toUpperCase(), daysOnRoad: summary.daysOnTheRoad, lastActive: summary.lastActive, lessonsDone: summary.lessonsDone, lessonsTotal: LESSONS_PER_COURSE })),
        ...data.fresh.map((c) => ({ id: c.id, flag: c.flag, name: c.name, destination: c.country, href: c.href, status: 'new' as const })),
      ]
    : []
  return (
    <div className="mx-auto min-h-full max-w-3xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="relative overflow-hidden rounded-[20px] bg-[#1c2541] px-6 pb-6 pt-7 text-[#e9cf8f] shadow-float">
        <span className="pointer-events-none absolute inset-2 rounded-[14px] border border-[#e9cf8f]/30" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <PawsportMark size={64} className="shrink-0 text-[#e9cf8f]" />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-75">Five languages · one passport</p>
            <h1 className="font-display text-[2.6rem] uppercase leading-none tracking-[0.1em] text-[#e9cf8f]">Pawsport</h1>
          </div>
        </div>
        <DogsTrio size={250} pose="wave" className="relative mx-auto -mb-2 mt-3 block" />
        <p className="relative mt-4 max-w-md text-[0.95rem] text-[#f1ead6]/85">Learn a language the long way round: travel with Leo, Bonchita and Luna, one stop and one stamp at a time. Free, private, works offline.</p>
        {data?.overall && (
          <section aria-labelledby="all-languages" className="relative">
          <h2 id="all-languages" className="sr-only">All languages</h2>
          <dl className="relative mt-5 grid grid-cols-4 divide-x divide-[#e9cf8f]/25 border-t border-[#e9cf8f]/25 pt-4 text-center">
            <Fig label="Days on the road" value={data.overall.daysOnTheRoad} />
            <Fig label="Kilometres" value={data.overall.km} />
            <Fig label="Minutes" value={data.overall.totalMinutes} />
            <Fig label="Words" value={data.overall.wordsLearned} />
          </dl>
          </section>
        )}
      </header>

      <main aria-busy={data === null} className="mt-6 grid gap-8 [&>*]:min-w-0">
        {data === null ? (
          <p className="py-10 text-center text-ink-2" role="status">Loading your progress…</p>
        ) : (
          <>
            <DeparturesBoard rows={rows} today={today} title={data.started.length ? 'Your departures' : 'Departures'} />
            <YourLanguages started={data.started} />
            {data.started.length > 0 && <Portfolio started={data.started} />}
            <StartNew fresh={data.fresh} anyStarted={data.started.length > 0} />
          </>
        )}
      </main>
      <footer className="mt-10 border-t border-line pt-4 text-center text-xs text-ink-2">
        Pawsport · open source · no accounts, no tracking. Your progress stays on this device, one journal per language.
      </footer>
    </div>
  )
}

/** Every course has 66 stops of four lessons. */
const LESSONS_PER_COURSE = 264

function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Fig({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-1">
      <dd className="font-mono text-xl text-[#fff6dc]">{value.toLocaleString('en')}</dd>
      <dt className="mt-0.5 text-[9.5px] uppercase tracking-wider opacity-75">{label}</dt>
    </div>
  )
}

function YourLanguages({ started }: { started: Started[] }) {
  if (!started.length) return null
  return (
    <section aria-labelledby="your-languages">
      <h2 id="your-languages" className="mb-3 text-[1.7rem]">Your languages</h2>
      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {started.map((s) => (
          <li key={s.course.id}>
            <StartedCard {...s} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function StartedCard({ course, summary, quant }: Started) {
  const region = course.regions.find((r) => r.level === summary.level)
  const headingId = `course-${course.id}`
  return (
    <article aria-labelledby={headingId} className={`card airmail-edge flex h-full flex-col pt-6 lvl-${summary.level}`} data-course={course.id}>
      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none" aria-hidden="true">{course.flag}</span>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="font-display text-xl leading-tight">{course.name}</h3>
          <p className="text-sm text-ink-2" lang={course.locale}>{course.native}</p>
        </div>
        <span className="inkstamp text-sm" style={{ color: 'var(--lvl)' }}>
          <span className="sr-only">Level </span>{summary.level.toUpperCase()}
        </span>
      </div>
      {region && (
        <p className="mt-3 text-sm">
          <span className="text-ink-2">Now in</span> <span className="font-semibold">{region.name}</span>
          <span className="text-ink-2">, {course.country}</span>
        </p>
      )}
      <dl className="mt-3 grid grid-cols-3 divide-x divide-line rounded-xl border border-line text-center">
        <Stat label="Lessons" value={summary.lessonsDone} />
        <Stat label="Words" value={summary.wordsLearned} />
        <Stat label="Days" value={summary.daysOnTheRoad} />
      </dl>
      <Sparkline values={quant?.navSeries30.length ? quant.navSeries30 : summary.last30} label={quant?.navSeries30.length ? 'Knowledge NAV, last 30 days' : 'Kilometres per day, last 30 days'} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
        <p className="text-sm text-ink-2">Last studied {lastStudied(summary.lastActive)}</p>
        <a className="btn btn-primary px-5 py-2.5" href={course.href} aria-label={`Continue ${course.name}`}>Continue</a>
      </div>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-2">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-mono text-xl">{value.toLocaleString('en')}</dd>
    </div>
  )
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 300
  const h = 40
  const max = Math.max(1e-9, ...values)
  const min = Math.min(0, ...values)
  const step = w / Math.max(1, values.length - 1)
  const y = (v: number) => h - 3 - ((v - min) / (max - min || 1)) * (h - 8)
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values.at(-1) ?? 0
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block h-10 w-full" aria-hidden="true" focusable="false">
        <polygon points={`0,${h} ${points} ${w},${h}`} fill="var(--lvl, var(--blue))" opacity="0.12" />
        <polyline points={points} fill="none" stroke="var(--lvl, var(--blue))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-ink-2"><span>{label}</span><span className="font-mono text-ink">{last.toFixed(last < 10 ? 1 : 0)}</span></figcaption>
    </figure>
  )
}

/** The learner's languages as a portfolio: where time goes and what it buys. */
function Portfolio({ started }: { started: Started[] }) {
  const totalMin = started.reduce((s, x) => s + x.summary.totalMinutes, 0) || 1
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`
  return (
    <section aria-labelledby="portfolio">
      <h2 id="portfolio" className="text-[1.7rem]">Language portfolio</h2>
      <p className="mt-1 text-sm text-ink-2">Where your time goes and what it buys. Knowledge NAV is the expected number of words you would recall right now (the sum of each word's recall probability).</p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full border border-line" role="img" aria-label="Share of practice time by language">
        {started.map((s) => (
          <span key={s.course.id} className={`lvl-${s.summary.level} h-full`} style={{ width: pct(s.summary.totalMinutes / totalMin), background: 'var(--lvl)' }} title={`${s.course.name}: ${pct(s.summary.totalMinutes / totalMin)}`} />
        ))}
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {['Language', 'Time share', 'NAV', '30d Δ', 'Recall 30d', 'Level est.'].map((h) => <th key={h} scope="col" className="eyebrow px-3 py-2 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody className="font-mono">
            {started.map(({ course, summary, quant }) => (
              <tr key={course.id} className="border-b border-line last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-sans font-semibold"><span aria-hidden="true">{course.flag} </span>{course.name}</th>
                <td className="px-3 py-2">{pct(summary.totalMinutes / totalMin)}</td>
                <td className="px-3 py-2">{quant ? quant.nav.toFixed(1) : '—'}</td>
                <td className={`px-3 py-2 ${quant && quant.nav30dChange < 0 ? 'text-bad-500' : 'text-ok-500'}`}>{quant ? `${quant.nav30dChange >= 0 ? '+' : ''}${quant.nav30dChange.toFixed(1)}` : '—'}</td>
                <td className="px-3 py-2">{quant && quant.recall30.n ? <>{pct(quant.recall30.p)} <span className="text-ink-2">±{((quant.recall30.hi - quant.recall30.lo) * 50).toFixed(0)}</span></> : '—'}</td>
                <td className="px-3 py-2">{quant?.levelEstimate ?? summary.levelEstimate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-2">Each language's full analysis (calibration, forgetting curve, workload, suggestions) is in its Insights tab.</p>
    </section>
  )
}

function StartNew({ fresh, anyStarted }: { fresh: HubCourse[]; anyStarted: boolean }) {
  if (!fresh.length) return null
  return (
    <section aria-labelledby="start-new">
      <h2 id="start-new" className="mb-3 text-[1.7rem]">{anyStarted ? 'New routes' : 'Choose your first route'}</h2>
      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {fresh.map((c) => (
          <li key={c.id}>
            <article aria-labelledby={`new-${c.id}`} className="card flex h-full flex-col" data-course={c.id}>
              <div className="flex items-center gap-3">
                <span className="text-4xl leading-none" aria-hidden="true">{c.flag}</span>
                <div className="min-w-0 flex-1">
                  <h3 id={`new-${c.id}`} className="font-display text-xl leading-tight">{c.name}</h3>
                  <p className="text-sm text-ink-2" lang={c.locale}>{c.native}</p>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-ink-2">{c.country}</span>
              </div>
              {c.pitch && <p className="mt-3 text-sm">{c.pitch}</p>}
              <ol className="relative mt-4 grid grid-cols-6 gap-1" aria-label={`${c.country} route, A1 to C2`}>
                <span className="absolute left-[8%] right-[8%] top-[5px] border-t-2 border-dotted border-line" aria-hidden="true" />
                {c.regions.map((r) => (
                  <li key={r.level} className={`lvl-${r.level} relative flex flex-col items-center gap-1 text-center`}>
                    <span className="h-3 w-3 rounded-full border-2 bg-card" style={{ borderColor: 'var(--lvl)' }} aria-hidden="true" />
                    <span className="font-mono text-[10px] text-ink-2">{r.level.toUpperCase()}</span>
                    <span className="line-clamp-2 text-[10.5px] leading-tight">{r.name}</span>
                  </li>
                ))}
              </ol>
              <a className="btn btn-ghost mt-auto w-full" href={c.href} style={{ marginTop: '1rem' }}>Start {c.name}</a>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

function lastStudied(date: string | undefined, now = new Date()): string {
  if (!date) return 'not yet'
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const then = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString('en', { day: 'numeric', month: 'short', year: then.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}
