/** Insights: quantitative metrics on the learner's memory, effort and progress, with suggestions. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { levels, vocab, grammar, units, loadLesson } from '../engine/loader'
import { sentenceId, exchangeId, textId, spicyId } from '../engine/generate'
import { TL } from '../engine/course'
import {
  computeInsights, EXERCISE_LABEL, MIN_ANSWERS, MATURE_DAYS, LEECH_LAPSES, SPACED_MIN_DAYS, FATIGUE_Z, pct, pp, ci, num, signed, days as fmtDays, shortDate, pval,
  type CourseMeta, type Insights as InsightsData, type Suggestion, type Breakdown,
} from '../engine/analytics'
import { LineArea, Bars, Histogram, CalibrationPlot, ForgettingCurve, Heatmap, ForestPlot, Sparkline, Ladder, type ForestRow } from '../components/charts'

const C = { blue: 'var(--blue)', ink: 'var(--ink)', ink2: 'var(--ink-2)', red: 'var(--red)', ok: 'var(--ok)', bad: 'var(--bad)' }

function useCourseMeta(lessonIds: string[] | undefined): CourseMeta {
  const [nextLessonId, setNext] = useState<string>()
  // Sentence, exchange and mini-text labels for the lessons practised, so leeches read as real sentences.
  const [texts, setTexts] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    if (!lessonIds?.length) return
    let alive = true
    ;(async () => {
      const m = new Map<string, string>()
      for (const id of lessonIds) {
        try {
          const { lesson } = await loadLesson(id)
          lesson.sentences.forEach((st, i) => m.set(sentenceId(id, i, st), st.es))
          lesson.exchanges.forEach((x, i) => m.set(exchangeId(id, i), `${x.q.es} — ${x.a.es}`))
          lesson.texts.forEach((t, i) => m.set(textId(id, i), t.title ?? t.es[0] ?? ''))
          lesson.spicy.forEach((st, i) => m.set(spicyId(id, i), st.es))
        } catch {
          /* lesson not available */
        }
      }
      if (alive) setTexts(m)
    })()
    return () => {
      alive = false
    }
  }, [lessonIds])
  // Next lesson: the one after the latest completed lesson in course order (verified by loading it).
  useEffect(() => {
    if (!lessonIds) return
    let alive = true
    const order = [...units.keys()]
    const unitOf = (id: string) => order.indexOf(id.split('.').slice(0, 2).join('.'))
    const latest = [...lessonIds].sort((a, b) => unitOf(a) - unitOf(b) || a.localeCompare(b)).pop()
    const candidates: string[] = []
    if (latest) {
      const [lv, u, l] = latest.split('.')
      candidates.push(`${lv}.${u}.l${Number(l?.slice(1)) + 1}`)
      const next = order[order.indexOf(`${lv}.${u}`) + 1]
      if (next) candidates.push(`${next}.l1`)
    } else if (order[0]) candidates.push(`${order[0]}.l1`)
    ;(async () => {
      for (const id of candidates) {
        try {
          await loadLesson(id)
          if (alive) setNext(id)
          return
        } catch {
          /* not authored: try the next candidate */
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [lessonIds])
  return useMemo(() => {
    const words = new Map<string, number>()
    for (const v of vocab.values()) words.set(v.level, (words.get(v.level) ?? 0) + 1)
    const titles: Record<string, string> = {}
    const gByLevel = new Map<string, string[]>()
    for (const g of grammar.values()) {
      titles[g.id] = g.title
      gByLevel.set(g.level, [...(gByLevel.get(g.level) ?? []), g.id])
    }
    return {
      levels: levels.map((l) => ({ id: l.id, items: (words.get(l.id) ?? 0) + (gByLevel.get(l.id)?.length ?? 0), grammar: gByLevel.get(l.id) ?? [] })),
      grammarTitles: titles,
      labelOf: (id: string) => vocab.get(id)?.lemma ?? grammar.get(id)?.title ?? texts.get(id),
      nextLessonId,
    }
  }, [nextLessonId, texts])
}

export default function Insights() {
  const cards = useLiveQuery(() => db.cards.toArray(), [])
  const reviews = useLiveQuery(() => db.reviews.toArray(), [])
  const days = useLiveQuery(() => db.days.toArray(), [])
  const lessons = useLiveQuery(() => db.lessons.toArray(), [])
  const doneIds = useMemo(() => lessons?.filter((l) => l.completions > 0).map((l) => l.id), [lessons])
  const meta = useCourseMeta(doneIds)
  // The clock ticks once a minute; data changes recompute immediately against it.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const ins = useMemo(() => (cards && reviews && days && lessons ? computeInsights({ cards, reviews, days, lessons }, meta, now) : undefined), [cards, reviews, days, lessons, meta, now])

  return (
    <div className="relative left-1/2 w-[min(68rem,calc(100vw-2rem))] -translate-x-1/2 pb-10">
      {!ins ? (
        <p className="p-8 text-center text-muted">Crunching your field notes…</p>
      ) : !ins.enough ? (
        <EmptyState answers={ins.answers} next={meta.nextLessonId} asOf={ins.asOf} />
      ) : (
        <Report ins={ins} meta={meta} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout pieces

function Header({ ins, at }: { ins?: InsightsData; at?: number }) {
  const asOf = new Date(ins?.asOf ?? at ?? 0)
  return (
    <header className="mb-5 border-b border-line pb-4">
      <p className="eyebrow">Field notes · quantitative</p>
      <h1 className="font-display text-4xl">Insights</h1>
      <p className="mt-1 font-mono text-[12px] text-muted">
        As of {asOf.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {asOf.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        {ins ? ` · ${ins.answers.toLocaleString('en-GB')} answers · ${ins.reviews.toLocaleString('en-GB')} card reviews` : ''}
      </p>
    </header>
  )
}

function Section({ id, n, title, lede, children, method, wide }: { id: string; n: number; title: string; lede?: ReactNode; children: ReactNode; method: ReactNode; wide?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`card min-w-0 scroll-mt-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <p className="eyebrow">§{n}</p>
      <h2 id={`${id}-h`} className="font-display text-2xl">{title}</h2>
      {lede && <p className="mt-1 text-[14px] leading-snug text-muted">{lede}</p>}
      <div className="mt-3 space-y-5">{children}</div>
      <details className="mt-4 border-t border-line pt-3 text-[13px] leading-relaxed">
        <summary className="cursor-pointer font-bold text-muted select-none">Methodology</summary>
        <div className="mt-2 space-y-2 text-muted [&_b]:text-ink [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px]">{method}</div>
      </details>
    </section>
  )
}

function Figure({ title, how, children }: { title: string; how: ReactNode; children: ReactNode }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5">
        <span className="block text-[13px] font-bold">{title}</span>
        <span className="block text-[12px] leading-snug text-muted">
          <span className="font-semibold">How to read:</span> {how}
        </span>
      </figcaption>
      {children}
    </figure>
  )
}

function Stats({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-3 sm:grid-cols-3">{children}</dl>
}

function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-mono text-[17px] font-semibold" style={{ color: tone === 'good' ? C.ok : tone === 'bad' ? C.bad : undefined }}>
        {value}
      </dd>
      {sub && <dd className="font-mono text-[11px] leading-snug text-muted">{sub}</dd>}
    </div>
  )
}

function Kpi({ label, value, sub, spark, tone, href }: { label: string; value: string; sub: ReactNode; spark?: number[]; tone?: 'good' | 'bad'; href: string }) {
  return (
    <a href={href} onClick={(e) => jump(e, href)} className="card block min-w-0 !p-3 no-underline">
      <p className="text-[10.5px] font-extrabold tracking-[0.12em] text-muted uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-[22px] leading-tight font-semibold">{value}</p>
      <p className="font-mono text-[11px] leading-snug" style={{ color: tone === 'good' ? C.ok : tone === 'bad' ? C.bad : 'var(--ink-2)' }}>
        {sub}
      </p>
      {spark && (
        <div className="mt-1.5">
          <Sparkline values={spark} />
        </div>
      )}
    </a>
  )
}

/** In-page jump that does not disturb the hash router. */
function jump(e: React.MouseEvent, href: string) {
  e.preventDefault()
  document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function EmptyState({ answers, next, asOf }: { answers: number; next?: string; asOf: number }) {
  return (
    <>
      <Header at={asOf} />
      <div className="card mx-auto max-w-xl text-center">
        <p className="eyebrow">Not enough data yet</p>
        <h2 className="mt-1 font-display text-2xl">Your notebook needs a few more pages</h2>
        <p className="mt-2 text-[14px] text-muted">
          Insights estimates recall, memory decay and trends from your answers. Below {MIN_ANSWERS} answers the confidence intervals are too wide to say anything useful, so nothing is shown rather than noise.
        </p>
        <div className="mx-auto mt-4 max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={answers} aria-valuemin={0} aria-valuemax={MIN_ANSWERS}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (answers / MIN_ANSWERS) * 100)}%`, background: C.blue }} />
          </div>
          <p className="mt-1 font-mono text-[12px] text-muted">
            {answers} / {MIN_ANSWERS} answers
          </p>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to={next ? `/lesson/${next}` : '/'} className="btn btn-primary">Take a lesson</Link>
          <Link to="/review" className="btn btn-ghost">Review</Link>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// The report

function Report({ ins, meta }: { ins: InsightsData; meta: CourseMeta }) {
  const { nav, recall, calibration, forgetting, memory, workload, effort, consistency, fatigue, suggestions } = ins
  const high = suggestions.filter((s) => s.severity === 'high').length
  const words30 = nav.series.slice(-30).map((p) => p.words)
  const title = (g: string) => meta.grammarTitles?.[g] ?? g
  const labelOf = (id: string) => meta.labelOf?.(id) ?? sentenceLabel(id)
  return (
    <>
      <Header ins={ins} />
      {suggestions.length > 0 && (
        <a href="#suggestions" onClick={(e) => jump(e, '#suggestions')} className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-bold">
          <span className="font-mono">{suggestions.length}</span> suggestions{high ? <span style={{ color: C.bad }}>· {high} high priority</span> : null} <span aria-hidden>↓</span>
        </a>
      )}

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Knowledge NAV" value={num(nav.current, 0)} sub={<>{signed(nav.change30.abs, 1)} · 30 d{Number.isFinite(nav.change30.pct) ? ` (${signed(nav.change30.pct * 100, 1)}%)` : ''}</>} spark={words30} tone={nav.change30.abs >= 0 ? 'good' : 'bad'} href="#nav" />
        <Kpi label="Recall · 30 d" value={pct(recall.d30.p)} sub={<>CI {ci(recall.d30.lo, recall.d30.hi)} · n {recall.d30.n}</>} href="#recall" />
        <Kpi label="Sharpe-style" value={num(nav.sharpe, 1)} sub={<>NAV Δ mean/sd ×√365</>} href="#nav" />
        <Kpi label="Max drawdown" value={nav.drawdown.pct < 0 ? pct(nav.drawdown.pct, 1) : '0%'} sub={nav.drawdown.peakDate ? <>{shortDate(nav.drawdown.peakDate)} → {shortDate(nav.drawdown.troughDate)}</> : 'none in 90 d'} tone={nav.drawdown.pct < -0.03 ? 'bad' : undefined} href="#nav" />
        <Kpi label="Days on the road" value={String(consistency.current)} sub={<>longest {consistency.longest} · {pct(consistency.active30.p)} of 30 d</>} href="#effort" />
        <Kpi label="Cost per postcard" value={`${num(effort.costPerPostcard, 1)} min`} sub={<>{num(effort.totalMinutes, 0)} min ÷ {num(nav.current + nav.currentOther, 0)} postcards</>} href="#effort" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* §1 NAV */}
        <Section
          id="nav"
          n={1}
          wide
          title="Knowledge NAV"
          lede={<>The number of postcards you could recall right now: every item counts by its probability of recall. Like a fund's net asset value, it grows with new learning and decays when you stop.</>}
          method={
            <>
              <p><b>Definition.</b> <code>NAV(t) = Σᵢ Rᵢ(t)</code> over word cards (blue) and, separately, over sentence and grammar cards (grey). <code>Rᵢ(t) = (1 + F·Δt/Sᵢ)^(−d)</code> is the scheduler's (FSRS-6) forgetting curve with <code>d = 0.1542</code>, <code>F = 0.9^(−1/d) − 1</code>, Δt the days since the card's last review (fractional) and Sᵢ its stability.</p>
              <p><b>History</b> is reconstructed by replaying every review in time order through the same scheduler from a fresh card, so each past day is valued with the state the card had then (sampled at 23:59; today at the current time).</p>
              <p><b>Drawdown</b> = <code>NAV / running peak − 1</code> (start-up noise ignored: peaks below 5 postcards or 15% of the 90-day high); recovery is the first day back at the peak. <b>Hit rate</b> = share of days with a positive change. <b>Sharpe-style ratio</b> = <code>mean(ΔNAV) / sd(ΔNAV) × √365</code> over daily changes: an analogy for how steady your growth is, not a financial return.</p>
            </>
          }
        >
          <Figure title="Retention-weighted vocabulary, up to 90 days" how={<>the line is your expected recallable items; red wash is the gap to the previous peak (a drawdown). Flat or falling stretches mark breaks.</>}>
            <NavChart series={nav.series} />
          </Figure>
          <Stats>
            <Stat label="7-day change" value={signed(nav.change7.abs, 1)} sub={Number.isFinite(nav.change7.pct) ? `${signed(nav.change7.pct * 100, 1)}%` : '–'} tone={nav.change7.abs >= 0 ? 'good' : 'bad'} />
            <Stat label="30-day change" value={signed(nav.change30.abs, 1)} sub={Number.isFinite(nav.change30.pct) ? `${signed(nav.change30.pct * 100, 1)}%` : '–'} tone={nav.change30.abs >= 0 ? 'good' : 'bad'} />
            <Stat label="Max drawdown" value={nav.drawdown.pct < 0 ? `${pct(nav.drawdown.pct, 1)}` : '0%'} sub={nav.drawdown.peakDate ? `${num(nav.drawdown.abs, 1)} · ${shortDate(nav.drawdown.peakDate)}→${shortDate(nav.drawdown.troughDate)}` : 'no drawdown'} tone={nav.drawdown.pct < -0.03 ? 'bad' : undefined} />
            <Stat label="Recovery" value={nav.drawdown.recoveryDate ? shortDate(nav.drawdown.recoveryDate) : nav.drawdown.peakDate ? 'not yet' : '–'} sub={nav.drawdown.peakDate ? `${nav.drawdown.durationDays} d under water` : undefined} />
            <Stat label="Hit rate" value={pct(nav.hitRate.p)} sub={`${nav.hitRate.k} of ${nav.hitRate.n} days up`} />
            <Stat label="Sharpe-style" value={num(nav.sharpe, 2)} sub={`Δ ${signed(nav.meanDaily, 2)} ± ${num(nav.sdDaily, 2)}/day`} />
          </Stats>
        </Section>

        {/* §2 Memory book */}
        <Section
          id="memory"
          n={2}
          title="Memory book"
          lede={<>How durable your postcards are. Stability is the number of days until recall falls to 90%.</>}
          method={
            <>
              <p><b>Stability S</b> is the scheduler's current estimate per card (cards with at least one review). The histogram uses log-spaced bins (two per decade). <b>Mature</b> = <code>S ≥ {MATURE_DAYS} d</code>; the share has a Wilson 95% interval.</p>
              <p><b>Half-life</b> per card = days until R = 50% on the FSRS curve, <code>t½ = S·(0.5^(−1/d) − 1)/F ≈ 90·S</code>: the power-law curve has a long tail, so half-lives are far longer than stabilities.</p>
              <p><b>Lapse rate</b> = failed answers ÷ answers on cards that were in the long-term review state. <b>Leeches</b> = cards with ≥ {LEECH_LAPSES} lapses.</p>
            </>
          }
        >
          <Figure title="Stability distribution (log scale)" how={<>each bar counts cards by how many days they stay above 90% recall; mass to the right of the dashed line is mature.</>}>
            <Histogram ariaLabel="Stability histogram" bins={memory.stabilityHist} refX={{ value: MATURE_DAYS, label: 'mature' }} />
          </Figure>
          <Stats>
            <Stat label="Cards reviewed" value={memory.reviewed.toLocaleString('en-GB')} />
            <Stat label="Median S" value={fmtDays(memory.medianStability)} sub="to 90% recall" />
            <Stat label="Median half-life" value={fmtDays(memory.medianHalfLife)} sub="to 50% recall" />
            <Stat label="Mature" value={pct(memory.mature.p)} sub={`CI ${ci(memory.mature.lo, memory.mature.hi)}`} />
            <Stat label="Lapse rate" value={pct(memory.lapseRate.p, 1)} sub={`CI ${ci(memory.lapseRate.lo, memory.lapseRate.hi)} · n ${memory.lapseRate.n}`} />
            <Stat label="Leeches" value={String(memory.leeches.length)} sub={`≥ ${LEECH_LAPSES} lapses`} tone={memory.leeches.length ? 'bad' : undefined} />
          </Stats>
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] text-muted uppercase">
                <th className="py-1 font-bold">Kind</th>
                <th className="py-1 text-right font-bold">Cards</th>
                <th className="py-1 text-right font-bold">Median S</th>
                <th className="py-1 text-right font-bold">Mature</th>
              </tr>
            </thead>
            <tbody>
              {memory.byKind.filter((k) => k.n).map((k) => (
                <tr key={k.kind} className="border-t border-line">
                  <td className="py-1 font-sans font-semibold">{k.kind === 'word' ? 'Words' : k.kind === 'sentence' ? 'Sentences' : 'Grammar points'}</td>
                  <td className="py-1 text-right">{k.n}</td>
                  <td className="py-1 text-right">{fmtDays(k.medianStability)}</td>
                  <td className="py-1 text-right">{pct(k.mature)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* §3 Recall & calibration */}
        <Section
          id="recall"
          n={3}
          title="Recall & calibration"
          lede={<>How often you get it right, and whether the scheduler's predictions match what actually happens.</>}
          method={
            <>
              <p><b>Answers.</b> One exercise credits several cards (the item and its grammar points) at the same instant; those rows are one observation. Recall = correct answers ÷ answers ("almost" counts as correct). Intervals are Wilson 95%. The trend is a weighted least-squares fit of weekly recall on week number (weights = answers).</p>
              <p><b>Calibration</b> uses spaced reviews only (≥ {SPACED_MIN_DAYS * 24} h since the card's previous review; first exposures have no prediction). The predicted probability is the scheduler's R at the moment of the answer, reconstructed by replay. Bins are equal-count deciles. <code>Brier = mean (p − y)²</code>; <code>log loss = −mean[y ln p + (1−y) ln(1−p)]</code>; <code>ECE = Σ (n_b/N)·|obs_b − pred_b|</code>; skill = <code>1 − Brier / p̄(1−p̄)</code>. Over/under-confidence is tested with <code>z = (Σy − Σp)/√Σp(1−p)</code>.</p>
              <p><b>Forgetting curve.</b> Recall of answers grouped by days since the card's previous review (doubling bins, ≥ 10 answers each). Exponential <code>a·e^(−t/τ)</code> and power <code>a·(1+t)^(−b)</code> curves are fitted by weighted least squares on log recall; the one with the lower weighted squared error is drawn. Long gaps are only given to strong cards, so this pooled curve is flatter than any single memory's.</p>
            </>
          }
        >
          <Stats>
            <Stat label="Last 7 days" value={pct(recall.d7.p)} sub={`${ci(recall.d7.lo, recall.d7.hi)} · n ${recall.d7.n}`} />
            <Stat label="Last 30 days" value={pct(recall.d30.p)} sub={`${ci(recall.d30.lo, recall.d30.hi)} · n ${recall.d30.n}`} />
            <Stat label="All time" value={pct(recall.all.p)} sub={`${ci(recall.all.lo, recall.all.hi)} · n ${recall.all.n}`} />
          </Stats>
          <Figure title="Weekly recall with 95% intervals" how={<>bars are each week's recall, whiskers its interval; the dashed line is your average. Trend {pp(recall.trend.slopePerWeek)} per week (SE {num(recall.trend.se * 100, 1)} pp).</>}>
            <Bars
              ariaLabel="Weekly recall"
              data={recall.weekly.map((w) => ({ label: w.start, value: w.p, lo: w.lo, hi: w.hi, title: `Week of ${shortDate(w.start)}: ${pct(w.p)} (${ci(w.lo, w.hi)}), n = ${w.n}` }))}
              yMin={floorTenth(recall.weekly.map((w) => w.lo))}
              yMax={1}
              formatY={(v) => `${Math.round(v * 100)}%`}
              refLine={{ value: recall.all.p, label: `avg ${pct(recall.all.p)}` }}
            />
          </Figure>
          <Figure title="Calibration: predicted versus observed" how={<>each dot is a tenth of your spaced reviews; on the dashed diagonal the scheduler is right. Dots below it mean you forget faster than predicted.</>}>
            <CalibrationPlot ariaLabel="Calibration plot" bins={calibration.bins} />
          </Figure>
          <Stats>
            <Stat label="Predicted" value={pct(calibration.meanPredicted, 1)} sub={`n ${calibration.n}`} />
            <Stat label="Observed" value={pct(calibration.meanObserved, 1)} sub={`${pp(calibration.meanObserved - calibration.meanPredicted)} · ${pval(calibration.pValue)}`} tone={calibration.verdict === 'over' ? 'bad' : calibration.verdict === 'under' ? 'good' : undefined} />
            <Stat label="ECE" value={`${num(calibration.ece * 100, 1)} pp`} />
            <Stat label="Brier" value={num(calibration.brier, 3)} sub={`base rate ${num(calibration.brierRef, 3)}`} />
            <Stat label="Log loss" value={num(calibration.logLoss, 3)} />
            <Stat label="Skill" value={num(calibration.skill, 2)} sub="vs base rate" />
          </Stats>
          <p className="text-[13px] leading-snug">{calibrationText(ins)}</p>
          <Figure title="Forgetting curve" how={<>dots are observed recall after a given gap (size = answers, whiskers = 95% interval); the line is the fitted curve and the red mark where it crosses 50%.</>}>
            {forgetting.bins.length >= 2 ? (
              <ForgettingCurve ariaLabel="Forgetting curve" bins={forgetting.bins} fit={forgetting.fit?.predict} halfLife={forgetting.extrapolated ? undefined : forgetting.halfLife} />
            ) : (
              <p className="text-[13px] text-muted">Needs answers after at least two different gaps.</p>
            )}
          </Figure>
          {forgetting.fit && (
            <p className="font-mono text-[12px] text-muted">
              {forgetting.fit.model === 'power' ? `R = ${num(forgetting.fit.a, 2)}·(1+t)^−${num(forgetting.fit.k, 3)}` : `R = ${num(forgetting.fit.a, 2)}·e^(−t/${num(forgetting.fit.k, 1)})`} · half-life {forgetting.extrapolated ? `> ${fmtDays(2 * forgetting.maxObserved)} (beyond the data)` : fmtDays(forgetting.halfLife)} · n {forgetting.n}
            </p>
          )}
        </Section>

        {/* §4 Where you slip */}
        <Section
          id="slips"
          n={4}
          title="Where you slip"
          lede={<>Skills, grammar points and moments where your recall is measurably below your own baseline of {pct(recall.baseline.p)} (last {recall.windowDays} days, n {recall.baseline.n}).</>}
          method={
            <>
              <p>Each group (skill, exercise format, grammar point) is compared with all other answers in the last {recall.windowDays} days by a two-proportion z-test with pooled standard error. Because many groups are tested at once, p-values are adjusted with Benjamini–Hochberg; a group is inked red (below) or green (above) when <code>q &lt; 0.10</code> and it has ≥ 20 answers. Groups with fewer than 12 answers are hidden.</p>
              <p><b>Time of day.</b> Hours are pooled into 3-hour blocks with ≥ 40 answers; the best and worst blocks are compared with a z-test against a Bonferroni-corrected threshold (picking the extremes inflates false positives).</p>
              <p><b>Fatigue.</b> Sessions are split where two answers are more than 30 minutes apart. Recall is computed by minutes since the session's first answer. A breakpoint scan compares answers before and after each even minute from 4 to 24 (≥ 40 each side) and keeps the largest drop; it counts only if <code>z ≥ {FATIGUE_Z}</code> (≈ 5% after Bonferroni over 11 candidates). Caveat: later minutes may contain harder material.</p>
            </>
          }
        >
          <Figure title="By skill" how={<>dot = recall, line = 95% interval, dashed line = your baseline. Red means significantly below.</>}>
            <ForestPlot ariaLabel="Recall by skill" rows={recall.byModality.map((b) => forestRow(b, b.id.charAt(0).toUpperCase() + b.id.slice(1)))} baseline={recall.baseline.p} />
          </Figure>
          <Figure title="By exercise format" how={<>the same comparison for each kind of exercise.</>}>
            <ForestPlot ariaLabel="Recall by exercise format" rows={recall.byExercise.map((b) => forestRow(b, EXERCISE_LABEL[b.id] ?? b.id))} baseline={recall.baseline.p} />
          </Figure>
          <GrammarForest rows={recall.byGrammar} baseline={recall.baseline.p} title={title} />
          <HourFigure ins={ins} />
          <Figure title="Fatigue: recall by minute of session" how={<>bars are recall in 2-minute slices of a session (whiskers = 95% interval){fatigue.recommendedMinutes ? '; red bars come after the breakpoint' : ''}.</>}>
            <Bars
              ariaLabel="Recall by minute of session"
              data={fatigue.buckets.map((b) => ({ label: Number.isFinite(b.to) ? `${b.from}` : `${b.from}+`, value: b.p, lo: b.lo, hi: b.hi, color: fatigue.recommendedMinutes !== undefined && b.from >= fatigue.recommendedMinutes ? C.red : C.blue, title: `${b.from}–${Number.isFinite(b.to) ? b.to : '∞'} min: ${pct(b.p)} (${ci(b.lo, b.hi)}), n = ${b.n}` }))}
              yMin={floorTenth(fatigue.buckets.map((b) => b.lo))}
              yMax={1}
              formatY={(v) => `${Math.round(v * 100)}%`}
              labelEvery={2}
            />
            <p className="mt-1 text-center font-mono text-[10.5px] text-muted">minutes since the session started</p>
          </Figure>
          <p className="text-[13px] leading-snug">
            {fatigue.breakpoint && fatigue.recommendedMinutes ? (
              <>
                Recall drops from <b className="font-mono">{pct(fatigue.breakpoint.before.p)}</b> to <b className="font-mono">{pct(fatigue.breakpoint.after.p)}</b> after minute {fatigue.breakpoint.minute} (z = {num(fatigue.breakpoint.z, 1)}, n = {fatigue.breakpoint.before.n} / {fatigue.breakpoint.after.n}). Median session: {num(fatigue.medianMinutes, 0)} min over {fatigue.sessions} sessions. Recommended: sessions of about <b>{fatigue.recommendedMinutes} minutes</b>.
              </>
            ) : (
              <>No significant fatigue: recall holds across the session (median {num(fatigue.medianMinutes, 0)} min over {fatigue.sessions} sessions).</>
            )}
          </p>
        </Section>

        {/* §5 Workload */}
        <Section
          id="workload"
          n={5}
          title="Workload"
          lede={<>What is due, what is coming, and whether you are keeping up.</>}
          method={
            <>
              <p><b>Forecast</b>: cards whose due date falls on each of the next 30 days, split by stability (young <code>S &lt; {MATURE_DAYS} d</code>, mature otherwise); "now" is the overdue backlog. <b>Throughput</b> = mean distinct already-seen cards reviewed per calendar day over the last {workload.throughputDays} days (today excluded). <b>Inflow</b> = mean cards falling due per day over the next 7 days. <b>Net drain</b> = throughput − inflow; <b>days to clear</b> = backlog ÷ net drain (∞ when the drain is not positive).</p>
              <p>The backlog history is reconstructed from replayed due dates at the end of each day.</p>
            </>
          }
        >
          <Figure title="Due ladder, next 30 days" how={<>each bar is the cards falling due that day; the red bar is what is overdue now; the dashed line is how many you usually clear in a day.</>}>
            <Ladder ariaLabel="Due forecast" days={workload.forecast} backlog={workload.backlog} throughput={workload.throughput} />
          </Figure>
          <Stats>
            <Stat label="Backlog" value={String(workload.backlog)} sub={`${signed(workload.backlogChange7)} in 7 d`} tone={workload.backlogChange7 > 0 && workload.backlog > 20 ? 'bad' : undefined} />
            <Stat label="Throughput" value={`${num(workload.throughput, 0)}/d`} sub={`trailing ${workload.throughputDays} d`} />
            <Stat label="Inflow" value={`${num(workload.inflow7, 0)}/d`} sub="next 7 d" />
            <Stat label="Net drain" value={`${signed(workload.netDrain, 1)}/d`} tone={workload.netDrain < 0 ? 'bad' : 'good'} />
            <Stat label="Days to clear" value={Number.isFinite(workload.daysToClear) ? num(workload.daysToClear, 0) : '∞'} />
            <Stat label="Peak" value={String(workload.peak.total)} sub={shortDate(workload.peak.date)} />
          </Stats>
          <Figure title="Backlog, last 30 days" how={<>cards overdue at the end of each day; a rising line means reviews are not keeping pace.</>}>
            <LineArea ariaLabel="Backlog history" xLabels={workload.backlogSeries.map((b) => b.date)} series={[{ id: 'b', label: 'Backlog', values: workload.backlogSeries.map((b) => b.backlog), color: C.red, endLabel: true }]} height={130} />
          </Figure>
        </Section>

        {/* §6 Effort & consistency */}
        <Section
          id="effort"
          n={6}
          title="Effort & consistency"
          lede={<>What your minutes buy. A postcard is an item you can recall; its cost is the time it took to get there.</>}
          method={
            <>
              <p><b>Minutes</b> are the minutes logged per day (lessons and review sessions); days without a log use the span of that day's answer sessions. <b>New items</b> are cards answered for the first time that day (from the review log); <b>answers</b> are exercises answered (one exercise can credit several cards). <b>Cost per postcard</b> = total minutes ÷ current total NAV (words + sentences + grammar). <b>Marginal NAV per minute</b> = NAV change over the last {effort.windowDays} days ÷ minutes in them.</p>
              <p><b>Regression</b>: daily total-NAV change on daily minutes (OLS over the last {effort.windowDays} complete days): the slope is postcards gained per extra minute; the intercept is the change on a day with no practice (decay).</p>
              <p><b>Days on the road</b>: consecutive active days ending today (or yesterday, as the run survives until midnight). Active share is over the days since you started, capped at the window.</p>
            </>
          }
        >
          <Figure title="Minutes per day, last 30 days" how={<>bars are minutes practised; the dashed line is your daily average.</>}>
            <Bars ariaLabel="Minutes per day" data={effort.daily.map((d) => ({ label: d.date, value: d.minutes, title: `${shortDate(d.date)}: ${num(d.minutes, 0)} min, ${d.newItems} new, ${d.reviews} reviews` }))} refLine={{ value: effort.minutesPerDay, label: `avg ${num(effort.minutesPerDay, 1)} min` }} />
          </Figure>
          <Stats>
            <Stat label="Minutes / active day" value={num(effort.minutesPerActiveDay, 1)} sub={`${effort.activeDays} active of ${effort.windowDays}`} />
            <Stat label="New / minute" value={num(effort.newPerMinute, 2)} />
            <Stat label="Answers / minute" value={num(effort.reviewsPerMinute, 2)} />
            <Stat label="Marginal NAV / min" value={num(effort.marginalPerMinute, 2)} sub={`last ${effort.windowDays} d`} />
            <Stat label="Slope (regression)" value={`${signed(effort.regression.slope, 2)}/min`} sub={`SE ${num(effort.regression.seSlope, 2)} · R² ${num(effort.regression.r2, 2)}`} />
            <Stat label="Idle-day change" value={signed(effort.regression.intercept, 1)} sub={`SE ${num(effort.regression.seIntercept, 1)} · n ${effort.regression.n}`} tone={effort.regression.intercept < 0 ? 'bad' : undefined} />
            <Stat label="Days on the road" value={String(consistency.current)} sub={`longest ${consistency.longest}`} />
            <Stat label="Active · 30 d" value={pct(consistency.active30.p)} sub={`${consistency.active30.k} of ${consistency.active30.n}`} />
            <Stat label="Active · 90 d" value={pct(consistency.active90.p)} sub={`${consistency.active90.k} of ${consistency.active90.n}`} />
          </Stats>
          {consistency.breaks.length > 0 && (
            <p className="text-[13px] text-muted">
              Breaks of 3+ days: {consistency.breaks.slice(0, 4).map((b) => `${b.days} d after ${shortDate(b.from)}`).join(' · ')}.
            </p>
          )}
        </Section>

        {/* §7 Level ETA */}
        <EtaSection ins={ins} />

        {/* §8 Leeches */}
        <Section
          id="leeches"
          n={8}
          title="Leeches"
          lede={<>Items that keep slipping away. Each lapse resets their stability, so they cost far more reviews than they should.</>}
          method={<p>Word and sentence cards with ≥ {LEECH_LAPSES} lapses (an answer marked wrong while the card was in the long-term review state, counted by the scheduler). R now is today's recall probability on the scheduler's curve. Sorted by lapses, then by lowest R. Grammar-point cards are left out: every sentence that uses a point also reviews it, so their lapse counts measure the topic, which the grammar breakdown in §4 tests properly.</p>}
        >
          {memory.leeches.length === 0 ? (
            <p className="text-[14px] text-muted">No leeches. Nothing has lapsed {LEECH_LAPSES} times.</p>
          ) : (
            <>
              <table className="w-full table-fixed text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] text-muted uppercase">
                    <th className="py-1 font-bold">Item</th>
                    <th className="w-16 py-1 text-right font-bold">Lapses</th>
                    <th className="w-16 py-1 text-right font-bold">Reviews</th>
                    <th className="w-14 py-1 text-right font-bold">R now</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {memory.leeches.slice(0, 12).map((l) => (
                    <tr key={l.id} className="border-t border-line">
                      <td className="truncate py-1.5 pr-2" title={l.id}>
                        <span className="font-sans font-semibold" lang={TL}>{labelOf(l.id)}</span>
                      </td>
                      <td className="py-1.5 text-right" style={{ color: C.bad }}>{l.lapses}</td>
                      <td className="py-1.5 text-right">{l.reps}</td>
                      <td className="py-1.5 text-right">{pct(l.r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {memory.leeches.length > 12 && <p className="font-mono text-[12px] text-muted">+ {memory.leeches.length - 12} more</p>}
              <Link to="/review?tab=pinned" className="btn btn-ghost w-full py-2.5 text-[14px]">Drill them in pinned practice</Link>
            </>
          )}
        </Section>

        {/* §9 Suggestions */}
        <section id="suggestions" aria-labelledby="suggestions-h" className="card min-w-0 scroll-mt-4 lg:col-span-2">
          <p className="eyebrow">§9</p>
          <h2 id="suggestions-h" className="font-display text-2xl">Suggestions</h2>
          <p className="mt-1 text-[14px] leading-snug text-muted">Ranked by expected impact. Each rule fires only with enough answers and a significant or large effect, so an empty list is good news.</p>
          {suggestions.length === 0 ? (
            <p className="mt-3 text-[14px]">Nothing stands out. Keep your current rhythm.</p>
          ) : (
            <ol className="mt-3 grid gap-3 lg:grid-cols-2">
              {suggestions.map((s, i) => (
                <SuggestionCard key={s.id} s={s} rank={i + 1} />
              ))}
            </ol>
          )}
          <details className="mt-4 border-t border-line pt-3 text-[13px] leading-relaxed">
            <summary className="cursor-pointer font-bold text-muted select-none">Methodology</summary>
            <div className="mt-2 space-y-2 text-muted">
              <p>Rules and gates: weak grammar point or skill (BH q &lt; 0.10, n ≥ 20); backlog compounding (backlog ≥ 20, growing over 7 days, net drain ≤ 0); load peak (≥ 25 cards and ≥ 1.6× usual); time-of-day gap (Bonferroni-significant, ≥ 5 pp); fatigue (z ≥ {FATIGUE_Z} and median session longer than the breakpoint); drawdown ≥ 3% or a paused run; active share &lt; 60% over ≥ 14 days; calibration gap ≥ 3 pp, p &lt; 0.05, n ≥ 150; new-to-review ratio &gt; 0.3 with lapses &gt; 15% or a negative drain; leeches; level ETA with ≥ 7 days of data.</p>
              <p>Severity is high, medium or low by effect size; within a severity, larger effects rank first.</p>
            </div>
          </details>
        </section>
      </div>
    </>
  )
}

/** "Sentence 4 · a1.u03.l2" for s./x./t./p. ids without a loaded label. */
function sentenceLabel(id: string): string {
  const m = /^([sxtp])\.([a-c][12]\.u\d{2}\.l\d)\.(\d+)$/.exec(id)
  if (!m) return id
  const kind = m[1] === 'x' ? 'Exchange' : m[1] === 't' ? 'Mini-text' : 'Sentence'
  return `${kind} ${m[3]} · ${m[2]}`
}

/** NAV lines from the day before the first postcard (leading empty days are trimmed). */
function NavChart({ series }: { series: InsightsData['nav']['series'] }) {
  const first = series.findIndex((p) => p.words + p.other > 0)
  const shown = series.slice(Math.max(0, Math.min(first - 1, series.length - 14)))
  return (
    <LineArea
      ariaLabel="Knowledge NAV over 90 days"
      xLabels={shown.map((p) => p.date)}
      series={[
        { id: 'w', label: 'Words', values: shown.map((p) => p.words), color: C.blue, area: true, endLabel: true },
        { id: 'o', label: 'Sentences & grammar', values: shown.map((p) => p.other), color: C.ink2, width: 1.5, endLabel: true },
      ]}
      peak={runningMax(shown.map((p) => p.words))}
      height={210}
    />
  )
}

function runningMax(xs: number[]): number[] {
  let m = -Infinity
  return xs.map((x) => (m = Math.max(m, x)))
}

/** Lower axis bound: a tenth below the lowest interval end, floored to tenths. */
function floorTenth(los: number[]): number {
  const finite = los.filter(Number.isFinite)
  return finite.length ? Math.max(0, Math.floor(Math.min(...finite) * 10) / 10 - 0.1) : 0
}

function forestRow(b: Breakdown, label: string, href?: string): ForestRow {
  return { id: b.id, label, p: b.p, lo: b.lo, hi: b.hi, n: b.n, flag: b.flag, href }
}

function GrammarForest({ rows, baseline, title }: { rows: Breakdown[]; baseline: number; title: (g: string) => string }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 10)
  return (
    <Figure title="By grammar point" how={<>weakest first; tap a topic to read its note. Red topics are significantly below your baseline after correcting for the number of topics tested.</>}>
      {rows.length ? (
        <>
          <ForestPlot ariaLabel="Recall by grammar point" rows={shown.map((b) => forestRow(b, title(b.id), `/grammar/${encodeURIComponent(b.id)}`))} baseline={baseline} />
          {rows.length > 10 && (
            <button type="button" className="mt-2 text-[12px] font-bold text-muted underline" onClick={() => setAll(!all)}>
              {all ? 'Show the 10 weakest' : `Show all ${rows.length} topics`}
            </button>
          )}
        </>
      ) : (
        <p className="text-[13px] text-muted">No grammar point has 12 answers yet.</p>
      )}
    </Figure>
  )
}

function HourFigure({ ins }: { ins: InsightsData }) {
  const [mode, setMode] = useState<'count' | 'accuracy'>('accuracy')
  const c = ins.consistency
  const blocks = c.blocks.filter((b) => b.n > 0)
  return (
    <Figure title="Hour × weekday" how={mode === 'count' ? <>darker cells are when you practise most.</> : <>darker cells are hours where you recall more (blank cells have fewer than 8 answers).</>}>
      <div className="mb-2 inline-flex rounded-lg border border-line p-0.5 text-[12px] font-bold" role="group" aria-label="Heatmap measure">
        {(['accuracy', 'count'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-md px-2.5 py-0.5 ${mode === m ? 'bg-surface-2 text-ink' : 'text-muted'}`}>
            {m === 'accuracy' ? 'Recall' : 'Answers'}
          </button>
        ))}
      </div>
      <Heatmap ariaLabel={`Weekday by hour heatmap of ${mode}`} matrix={c.matrix} mode={mode} />
      <p className="mt-3 text-[12px] text-muted">Recall by 3-hour block (start hour), 95% intervals{c.significant ? '; green best, red worst' : ''}:</p>
      <Bars
        ariaLabel="Recall by 3-hour block"
        data={blocks.map((b) => ({ label: `${b.label.slice(0, 2)}h`, value: b.p, lo: b.lo, hi: b.hi, color: c.significant && b === c.best ? C.ok : c.significant && b === c.worst ? C.bad : C.blue, title: `${b.label}: ${pct(b.p)} (${ci(b.lo, b.hi)}), n = ${b.n}` }))}
        yMin={floorTenth(blocks.map((b) => b.lo))}
        yMax={1}
        formatY={(v) => `${Math.round(v * 100)}%`}
        height={120}
        labelEvery={1}
      />
      {c.best && c.worst && c.test && (
        <p className="mt-1 text-[13px] leading-snug">
          Best block <b className="font-mono">{c.best.label}</b> {pct(c.best.p)} (n {c.best.n}) versus worst <b className="font-mono">{c.worst.label}</b> {pct(c.worst.p)} (n {c.worst.n}): {pp(c.test.diff)}, {pval(c.test.pValue)}
          {c.significant ? ', significant after correction.' : ', not significant after correction.'}
        </p>
      )}
    </Figure>
  )
}

function EtaSection({ ins }: { ins: InsightsData }) {
  const { eta } = ins
  const next = eta.next
  const hist = eta.series.map((s) => s.mastered)
  const labels = [...eta.series.map((s) => s.date), ...eta.cone.map((c) => c.date)]
  const pad = (n: number) => Array<number | null>(n).fill(null)
  const lastI = hist.length - 1
  const fitLine = eta.series.map((_, i) => (i >= eta.ols.x0 && i < lastI && Number.isFinite(eta.ols.slope) ? eta.ols.intercept + eta.ols.slope * i : null))
  return (
    <Section
      id="eta"
      n={7}
      wide
      title="Level ETA"
      lede={next ? <>Mastered words and grammar points (production stage) and when, at your current pace, you complete {next.level.toUpperCase()} ({pct(eta.threshold)} of its items mastered).</> : <>You have mastered every level's threshold.</>}
      method={
        <>
          <p><b>Mastered</b> = word and grammar cards at ladder stage ≥ 2 (you can produce them), counted at the end of each day by replay; limited to levels up to the target. A level is <b>reached</b> when {pct(eta.threshold)} of the words and grammar points of that level and all earlier ones are mastered.</p>
          <p><b>Pace</b> is the drift of the daily increments over the last {eta.fitDays} complete days, <code>μ = mean(Δ)</code> with <code>SE = sd(Δ)/√n</code> (a cumulative count is a random walk with drift, so OLS on levels would understate uncertainty). ETA = remaining ÷ μ; the range uses μ ± 1.96·SE. The shaded cone is <code>±1.96·√(h·σ² + h²·SE²)</code> for h days ahead. The thin line is the OLS trend over the same window for reference (slope {num(eta.ols.slope, 2)}/day, SE {num(eta.ols.seSlope, 2)}, R² {num(eta.ols.r2, 2)}).</p>
          <p><b>Grammar coverage</b>: points met (reviewed at least once) and mastered (stage ≥ 2) out of those taught at each level.</p>
        </>
      }
    >
      <Figure title="Mastered items and projection" how={<>blue is your history, the dashed line and wash the projection with its 95% cone; the horizontal line is the next level's target.</>}>
        <LineArea
          ariaLabel="Mastered items with projection"
          xLabels={labels}
          series={[
            { id: 'h', label: 'Mastered', values: [...hist, ...pad(eta.cone.length)], color: C.blue, area: true },
            { id: 'p', label: 'Projection', values: [...pad(lastI), hist[lastI] ?? 0, ...eta.cone.map((c) => c.mid)], color: C.blue, dashed: true, width: 1.5, endLabel: true },
            { id: 'f', label: 'OLS trend', values: [...fitLine, ...pad(eta.cone.length)], color: C.ink, width: 1 },
          ]}
          band={{ lo: [...pad(lastI), hist[lastI] ?? 0, ...eta.cone.map((c) => c.lo)], hi: [...pad(lastI), hist[lastI] ?? 0, ...eta.cone.map((c) => c.hi)] }}
          refY={next ? { value: next.target, label: `${next.level.toUpperCase()} target ${next.target}` } : undefined}
          markX={{ index: lastI, label: 'today' }}
          height={220}
        />
      </Figure>
      <Stats>
        <Stat label="Pace" value={`${num(eta.drift, 1)}/day`} sub={`SE ${num(eta.driftSe, 2)} · ${eta.fitDays} d`} />
        <Stat label="Working through" value={(next?.level ?? eta.reached ?? 'a1').toUpperCase()} sub={`completed: ${eta.reached ? eta.reached.toUpperCase() : 'none yet'}`} />
        {next && <Stat label={`To ${next.level.toUpperCase()}`} value={String(next.remaining)} sub={`${next.mastered} of ${next.target}`} />}
        {next && <Stat label="ETA" value={next.date ? shortDate(next.date) : '–'} sub={Number.isFinite(next.days) ? `${Math.ceil(next.days)} days` : 'no pace yet'} />}
        {next && <Stat label="Range (95%)" value={next.dateLo ? shortDate(next.dateLo) : '–'} sub={`to ${next.dateHi ? shortDate(next.dateHi) : 'open-ended'}`} />}
      </Stats>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[19rem] table-fixed font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] text-muted uppercase">
              <th className="w-10 py-1 font-bold">Level</th>
              <th className="py-1 font-bold">Items mastered</th>
              <th className="w-[5.5rem] py-1 text-right font-bold" title="Grammar points met · mastered / taught">Grammar</th>
            </tr>
          </thead>
          <tbody>
            {eta.levels.map((l) => (
              <tr key={l.id} className={`border-t border-line lvl-${l.id}`}>
                <td className="py-1.5 font-bold">{l.id.toUpperCase()}</td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (l.share || 0) * 100)}%`, background: 'var(--lvl)' }} />
                    </div>
                    <span className="w-[7.5rem] shrink-0 text-right">
                      {l.mastered}/{l.items} <span className="text-muted">{pct(l.share)}</span>
                    </span>
                  </div>
                </td>
                <td className="py-1.5 text-right">
                  {l.grammarMet}·{l.grammarMastered}
                  <span className="text-muted">/{l.grammarTotal}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function SuggestionCard({ s, rank }: { s: Suggestion; rank: number }) {
  const tone = s.severity === 'high' ? C.bad : s.severity === 'medium' ? 'var(--sun)' : C.ink2
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-line bg-[var(--paper)] p-3.5" style={{ borderLeft: `3px solid ${tone}` }}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[12px] text-muted">{String(rank).padStart(2, '0')}</span>
        <span className="text-[10.5px] font-extrabold tracking-[0.12em] uppercase" style={{ color: s.severity === 'low' ? 'var(--ink-2)' : s.severity === 'medium' ? 'var(--ink)' : tone }}>
          {s.severity} priority
        </span>
      </div>
      <h3 className="mt-0.5 font-display text-[18px] leading-tight">{s.title}</h3>
      <p className="mt-1 flex-1 font-mono text-[11.5px] leading-relaxed text-muted">{s.evidence}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={s.action.to} className="btn btn-primary px-4 py-2 text-[14px]">{s.action.label}</Link>
        {s.secondary && (
          <Link to={s.secondary.to} className="btn btn-ghost px-4 py-2 text-[14px]">{s.secondary.label}</Link>
        )}
      </div>
    </li>
  )
}

function calibrationText(ins: InsightsData): string {
  const c = ins.calibration
  const gap = c.meanObserved - c.meanPredicted
  if (c.verdict === 'insufficient') return `Only ${c.n} spaced reviews so far; calibration needs at least 50.`
  if (c.verdict === 'over')
    return `The scheduler is over-confident: on spaced reviews you recall ${pct(c.meanObserved, 1)} where it predicts ${pct(c.meanPredicted, 1)} (${pp(gap)}). Your real retention is below the 90% target, so due cards should not be postponed; reviewing on time (or a little early) brings retention back to target.`
  if (c.verdict === 'under')
    return `The scheduler is under-confident: you recall ${pct(c.meanObserved, 1)} against ${pct(c.meanPredicted, 1)} predicted (${pp(gap)}). You could review slightly later than scheduled, or spend the slack on new material.`
  return `Well calibrated: ${pct(c.meanObserved, 1)} observed versus ${pct(c.meanPredicted, 1)} predicted (${pp(gap)}, ${pval(c.pValue)}). The schedule is delivering the retention it promises.`
}
