/** Calibration of the scheduler, the empirical forgetting curve, and the memory book (stability, maturity, leeches). */
import type { ItemKind } from '../types'
import type { Ctx } from './context'
import { daysToRecall, forgetting, type ReplayEvent } from './replay'
import { brier, calibrationBins, ece, fitExponential, fitPower, logHistogram, logLoss, median, pTwoSided, wilson, type CalibrationBin, type CurveFit, type HistBin, type Proportion } from './stats'

/** A review counts as "spaced" when at least this many days passed since the card's previous review. */
export const SPACED_MIN_DAYS = 0.5

export interface CalibrationMetric {
  n: number
  bins: CalibrationBin[]
  brier: number
  /** Brier score of always predicting the observed base rate. */
  brierRef: number
  /** 1 − brier / brierRef (higher is better; 0 = no skill over the base rate). */
  skill: number
  logLoss: number
  ece: number
  meanPredicted: number
  meanObserved: number
  /** (Σy − Σp) / √Σp(1−p): negative means recall fell short of the prediction. */
  z: number
  pValue: number
  verdict: 'over' | 'under' | 'calibrated' | 'insufficient'
}

export function spacedEvents(ctx: Ctx): ReplayEvent[] {
  return ctx.replay.events.filter((e) => Number.isFinite(e.predicted) && e.elapsedDays >= SPACED_MIN_DAYS)
}

export function calibrationMetric(ctx: Ctx, minN = 50): CalibrationMetric {
  const ev = spacedEvents(ctx)
  const ps = ev.map((e) => e.predicted)
  const ys = ev.map((e) => e.correct)
  const n = ev.length
  const sumP = ps.reduce((s, p) => s + p, 0)
  const sumY = ys.filter(Boolean).length
  const varY = ps.reduce((s, p) => s + p * (1 - p), 0)
  const base = n ? sumY / n : NaN
  const bins = calibrationBins(ps, ys, n >= 200 ? 10 : 5)
  const b = brier(ps, ys)
  const ref = base * (1 - base)
  const z = varY > 0 ? (sumY - sumP) / Math.sqrt(varY) : NaN
  const pValue = pTwoSided(z)
  const verdict = n < minN ? 'insufficient' : pValue < 0.05 ? (z < 0 ? 'over' : 'under') : 'calibrated'
  return {
    n, bins, brier: b, brierRef: ref, skill: ref > 0 ? 1 - b / ref : NaN, logLoss: logLoss(ps, ys), ece: ece(bins),
    meanPredicted: n ? sumP / n : NaN, meanObserved: base, z, pValue, verdict,
  }
}

export interface CurveBin extends Proportion {
  /** Bin edges in days. */
  from: number
  to: number
  /** Mean elapsed days of the reviews in the bin. */
  t: number
}

export interface ForgettingMetric {
  n: number
  bins: CurveBin[]
  fit?: CurveFit
  alt?: CurveFit
  /** Days until fitted recall reaches 50%. */
  halfLife: number
  /** True when the half-life lies beyond twice the longest observed gap (an extrapolation). */
  extrapolated: boolean
  maxObserved: number
}

/** Doubling edges from one hour to ~1.4 years. */
export const CURVE_EDGES = [1 / 24, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512]

export function forgettingMetric(ctx: Ctx, minBin = 10): ForgettingMetric {
  const ev = ctx.replay.events.filter((e) => Number.isFinite(e.predicted) && e.elapsedDays >= CURVE_EDGES[0]!)
  const bins: CurveBin[] = []
  for (let i = 0; i < CURVE_EDGES.length - 1; i++) {
    const from = CURVE_EDGES[i]!
    const to = CURVE_EDGES[i + 1]!
    const g = ev.filter((e) => e.elapsedDays >= from && e.elapsedDays < to)
    if (g.length < minBin) continue
    const k = g.filter((e) => e.correct).length
    bins.push({ from, to, t: g.reduce((s, e) => s + e.elapsedDays, 0) / g.length, ...wilson(k, g.length) })
  }
  const pts = bins.map((b) => ({ t: b.t, p: (b.k + 0.5) / (b.n + 1), w: b.n }))
  const exp = fitExponential(pts)
  const pow = fitPower(pts)
  const cands = [exp, pow].filter((f): f is CurveFit => Boolean(f)).sort((a, b) => a.sse - b.sse)
  const fit = cands[0]
  const maxObserved = bins.length ? bins[bins.length - 1]!.t : 0
  const halfLife = fit?.halfLife ?? NaN
  return { n: ev.length, bins, fit, alt: cands[1], halfLife, extrapolated: Number.isFinite(halfLife) ? halfLife > 2 * maxObserved : true, maxObserved }
}

export interface Leech {
  id: string
  kind: ItemKind
  lapses: number
  reps: number
  /** Recall probability now. */
  r: number
  grammar: string[]
}

export interface MemoryBook {
  /** Cards with at least one review. */
  reviewed: number
  stabilityHist: HistBin[]
  medianStability: number
  /** Median days until recall falls to 50% on the scheduler's curve. */
  medianHalfLife: number
  mature: Proportion
  /** Failed answers among reviews of cards in the long-term (review) state. */
  lapseRate: Proportion
  /** Word and sentence cards with ≥ 3 lapses (grammar points are judged in the grammar breakdown instead). */
  leeches: Leech[]
  byKind: { kind: ItemKind; n: number; medianStability: number; mature: number }[]
}

export const MATURE_DAYS = 21
export const LEECH_LAPSES = 3

export function memoryBook(ctx: Ctx): MemoryBook {
  const cards = ctx.data.cards.filter((c) => c.state !== 0 && c.reps > 0)
  const S = cards.map((c) => c.stability)
  const mature = cards.filter((c) => c.stability >= MATURE_DAYS).length
  const inReview = ctx.replay.events.filter((e) => e.prevState === 2)
  const lapses = inReview.filter((e) => !e.correct).length
  const rNow = (c: (typeof cards)[number]) => (c.last_review ? forgetting((ctx.now - c.last_review) / 86_400_000, c.stability) : 0)
  const leeches = cards
    .filter((c) => c.lapses >= LEECH_LAPSES && c.kind !== 'grammar')
    .map((c) => ({ id: c.id, kind: c.kind, lapses: c.lapses, reps: c.reps, r: rNow(c), grammar: c.grammar }))
    .sort((a, b) => b.lapses - a.lapses || a.r - b.r)
  const kinds: ItemKind[] = ['word', 'sentence', 'grammar']
  return {
    reviewed: cards.length,
    stabilityHist: logHistogram(S, 0.1, 1000, 2),
    medianStability: median(S),
    medianHalfLife: median(S.map((s) => daysToRecall(s, 0.5))),
    mature: wilson(mature, cards.length),
    lapseRate: wilson(lapses, inReview.length),
    leeches,
    byKind: kinds.map((kind) => {
      const g = cards.filter((c) => c.kind === kind)
      return { kind, n: g.length, medianStability: median(g.map((c) => c.stability)), mature: g.length ? g.filter((c) => c.stability >= MATURE_DAYS).length / g.length : NaN }
    }),
  }
}
