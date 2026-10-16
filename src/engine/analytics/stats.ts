/**
 * Small, dependency-free statistics toolkit for the Insights engine.
 * Every function is pure and deterministic; edge cases return NaN or empty
 * results rather than throwing, so callers can test with `Number.isFinite`.
 */

export const Z95 = 1.959963984540054

export function sum(xs: readonly number[]): number {
  let s = 0
  for (const x of xs) s += x
  return s
}

export function mean(xs: readonly number[]): number {
  return xs.length ? sum(xs) / xs.length : NaN
}

/** Sample standard deviation (n − 1 denominator). */
export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return NaN
  const m = mean(xs)
  let s = 0
  for (const x of xs) s += (x - m) ** 2
  return Math.sqrt(s / (xs.length - 1))
}

/** Median (average of the two middle values for even n). */
export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5)
}

/** Linear-interpolated quantile (type 7, as in R and NumPy). */
export function quantile(xs: readonly number[], q: number): number {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const h = (s.length - 1) * q
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return s[lo]! + (h - lo) * (s[hi]! - s[lo]!)
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2)
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y)
}

/** Two-sided p-value of a z statistic. */
export function pTwoSided(z: number): number {
  return Number.isFinite(z) ? 2 * (1 - normCdf(Math.abs(z))) : NaN
}

export interface Proportion {
  k: number
  n: number
  /** Point estimate k/n (NaN when n = 0). */
  p: number
  /** Wilson score interval bounds. */
  lo: number
  hi: number
}

/**
 * Wilson score interval for a binomial proportion:
 * centre = (p̂ + z²/2n) / (1 + z²/n), half-width = z·√(p̂(1−p̂)/n + z²/4n²) / (1 + z²/n).
 */
export function wilson(k: number, n: number, z = Z95): Proportion {
  if (n <= 0) return { k, n, p: NaN, lo: NaN, hi: NaN }
  const p = k / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return { k, n, p, lo: k <= 0 ? 0 : Math.max(0, centre - half), hi: k >= n ? 1 : Math.min(1, centre + half) }
}

export interface ZTest {
  /** p1 − p2 */
  diff: number
  z: number
  /** Two-sided p-value. */
  pValue: number
}

/** Two-proportion z-test with the pooled standard error. Positive z means group 1 is higher. */
export function twoProportionZ(k1: number, n1: number, k2: number, n2: number): ZTest {
  if (n1 <= 0 || n2 <= 0) return { diff: NaN, z: NaN, pValue: NaN }
  const p1 = k1 / n1
  const p2 = k2 / n2
  const pool = (k1 + k2) / (n1 + n2)
  const se = Math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2))
  const z = se > 0 ? (p1 - p2) / se : 0
  return { diff: p1 - p2, z, pValue: se > 0 ? pTwoSided(z) : 1 }
}

/** Benjamini–Hochberg adjusted p-values (q-values), in the input order. */
export function benjaminiHochberg(ps: readonly number[]): number[] {
  const m = ps.length
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p)
  const q = new Array<number>(m).fill(NaN)
  let running = 1
  for (let r = m - 1; r >= 0; r--) {
    const { p, i } = order[r]!
    running = Math.min(running, (p * m) / (r + 1))
    q[i] = running
  }
  return q
}

// ---------------------------------------------------------------------------
// Regression

export interface OlsFit {
  n: number
  slope: number
  intercept: number
  /** Standard errors of slope and intercept. */
  seSlope: number
  seIntercept: number
  /** Residual standard error σ̂ = √(SSR / (n − 2)). */
  sigma: number
  r2: number
  xMean: number
  sxx: number
  /** Point prediction at x. */
  predict: (x: number) => number
  /** Half-width of the (1−α) prediction band for a new observation at x (z approximation). */
  predictionHalfWidth: (x: number, z?: number) => number
  /** Half-width of the confidence band for the mean response at x. */
  confidenceHalfWidth: (x: number, z?: number) => number
}

/** Ordinary (optionally weighted) least squares y = a + b·x. */
export function ols(xs: readonly number[], ys: readonly number[], ws?: readonly number[]): OlsFit {
  const n = Math.min(xs.length, ys.length)
  const w = (i: number) => (ws ? ws[i]! : 1)
  let sw = 0
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i++) {
    sw += w(i)
    sx += w(i) * xs[i]!
    sy += w(i) * ys[i]!
  }
  const xMean = sx / sw
  const yMean = sy / sw
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - xMean
    const dy = ys[i]! - yMean
    sxx += w(i) * dx * dx
    sxy += w(i) * dx * dy
    syy += w(i) * dy * dy
  }
  const slope = sxx > 0 ? sxy / sxx : NaN
  const intercept = yMean - slope * xMean
  let ssr = 0
  for (let i = 0; i < n; i++) ssr += w(i) * (ys[i]! - intercept - slope * xs[i]!) ** 2
  // For weights, scale to the effective number of observations so σ̂ stays in y units.
  const dof = n - 2
  const sigma = dof > 0 ? Math.sqrt((ssr / dof) * (n / sw)) : NaN
  const sxxU = sxx * (n / sw)
  const seSlope = sigma / Math.sqrt(sxxU)
  const seIntercept = sigma * Math.sqrt(1 / n + (xMean * xMean) / sxxU)
  const r2 = syy > 0 ? 1 - ssr / syy : NaN
  return {
    n, slope, intercept, seSlope, seIntercept, sigma, r2, xMean, sxx: sxxU,
    predict: (x) => intercept + slope * x,
    predictionHalfWidth: (x, z = Z95) => z * sigma * Math.sqrt(1 + 1 / n + (x - xMean) ** 2 / sxxU),
    confidenceHalfWidth: (x, z = Z95) => z * sigma * Math.sqrt(1 / n + (x - xMean) ** 2 / sxxU),
  }
}

export interface CurveFit {
  model: 'exponential' | 'power'
  /** R(t) = a·exp(−t/tau) or R(t) = a·(1+t)^(−b). */
  a: number
  /** tau for exponential, b for power. */
  k: number
  /** Weighted SSE in probability space (for model choice). */
  sse: number
  predict: (t: number) => number
  /** Days until predicted recall reaches 50% (Infinity if it never does, 0 if a ≤ 0.5). */
  halfLife: number
}

interface CurvePoint { t: number; p: number; w: number }

const clipP = (p: number) => Math.min(0.999, Math.max(0.01, p))

/** Exponential forgetting curve by weighted least squares on ln R = ln a − t/τ. */
export function fitExponential(points: readonly CurvePoint[]): CurveFit | undefined {
  if (points.length < 2) return undefined
  const fit = ols(points.map((q) => q.t), points.map((q) => Math.log(clipP(q.p))), points.map((q) => q.w))
  if (!(fit.slope < 0)) return undefined
  const a = Math.exp(fit.intercept)
  const tau = -1 / fit.slope
  const predict = (t: number) => a * Math.exp(-t / tau)
  const halfLife = a <= 0.5 ? 0 : tau * Math.log(2 * a)
  return { model: 'exponential', a, k: tau, sse: sse(points, predict), predict, halfLife }
}

/** Power-law forgetting curve by weighted least squares on ln R = ln a − b·ln(1+t). */
export function fitPower(points: readonly CurvePoint[]): CurveFit | undefined {
  if (points.length < 2) return undefined
  const fit = ols(points.map((q) => Math.log1p(q.t)), points.map((q) => Math.log(clipP(q.p))), points.map((q) => q.w))
  if (!(fit.slope < 0)) return undefined
  const a = Math.exp(fit.intercept)
  const b = -fit.slope
  const predict = (t: number) => a * Math.pow(1 + t, -b)
  const halfLife = a <= 0.5 ? 0 : Math.pow(2 * a, 1 / b) - 1
  return { model: 'power', a, k: b, sse: sse(points, predict), predict, halfLife }
}

function sse(points: readonly CurvePoint[], f: (t: number) => number): number {
  let s = 0
  for (const q of points) s += q.w * (q.p - f(q.t)) ** 2
  return s
}

// ---------------------------------------------------------------------------
// Series

/** Trailing rolling window: out[i] = f(xs[max(0, i−w+1) .. i]). */
export function rolling(xs: readonly number[], w: number, f: (window: number[]) => number = mean): number[] {
  return xs.map((_, i) => f(xs.slice(Math.max(0, i - w + 1), i + 1)))
}

export function diff(xs: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < xs.length; i++) out.push(xs[i]! - xs[i - 1]!)
  return out
}

export interface Drawdown {
  /** Largest peak-to-trough fall, as a fraction of the peak (≤ 0; 0 when none). */
  maxDrawdown: number
  /** The same fall in absolute units (≤ 0). */
  maxDrawdownAbs: number
  peakIndex: number
  troughIndex: number
  /** First index after the trough where the series regains the peak (undefined if not yet). */
  recoveryIndex: number | undefined
  /** Drawdown series (fraction of running peak, ≤ 0). */
  series: number[]
}

/**
 * Maximum drawdown of a level series. Peaks below `minPeak` are ignored so a
 * series that starts near zero does not produce meaningless −100% readings.
 */
export function maxDrawdown(xs: readonly number[], minPeak = 0): Drawdown {
  let peak = -Infinity
  let peakI = 0
  let best = 0
  let bestAbs = 0
  let bp = 0
  let bt = 0
  const series: number[] = []
  xs.forEach((x, i) => {
    if (x > peak) {
      peak = x
      peakI = i
    }
    const dd = peak > minPeak && peak > 0 ? (x - peak) / peak : 0
    series.push(dd)
    if (dd < best) {
      best = dd
      bestAbs = x - peak
      bp = peakI
      bt = i
    }
  })
  let recoveryIndex: number | undefined
  if (best < 0) {
    for (let i = bt + 1; i < xs.length; i++) {
      if (xs[i]! >= xs[bp]!) {
        recoveryIndex = i
        break
      }
    }
  }
  return { maxDrawdown: best, maxDrawdownAbs: bestAbs, peakIndex: bp, troughIndex: bt, recoveryIndex, series }
}

/** Sharpe-style ratio of a series of changes: mean / sd × √periodsPerYear. */
export function sharpe(changes: readonly number[], periodsPerYear = 365): number {
  const s = sd(changes)
  return s > 0 ? (mean(changes) / s) * Math.sqrt(periodsPerYear) : NaN
}

// ---------------------------------------------------------------------------
// Probabilistic forecasts

const clip01 = (p: number) => Math.min(1 - 1e-4, Math.max(1e-4, p))

/** Brier score: mean (p − y)². */
export function brier(ps: readonly number[], ys: readonly (number | boolean)[]): number {
  if (!ps.length) return NaN
  let s = 0
  ps.forEach((p, i) => (s += (p - Number(ys[i])) ** 2))
  return s / ps.length
}

/** Log loss (cross-entropy, natural log), probabilities clipped to [1e-4, 1 − 1e-4]. */
export function logLoss(ps: readonly number[], ys: readonly (number | boolean)[]): number {
  if (!ps.length) return NaN
  let s = 0
  ps.forEach((p, i) => {
    const q = clip01(p)
    s += Number(ys[i]) ? -Math.log(q) : -Math.log(1 - q)
  })
  return s / ps.length
}

export interface CalibrationBin {
  lo: number
  hi: number
  n: number
  /** Mean predicted probability in the bin. */
  predicted: number
  /** Observed share of successes, with Wilson interval. */
  observed: number
  obsLo: number
  obsHi: number
}

/**
 * Reliability bins. `mode: 'quantile'` makes equal-count bins (deciles by
 * default), which is more informative when predictions cluster near 1.
 */
export function calibrationBins(ps: readonly number[], ys: readonly (number | boolean)[], bins = 10, mode: 'quantile' | 'uniform' = 'quantile'): CalibrationBin[] {
  const idx = ps.map((p, i) => ({ p, y: Number(ys[i]) })).sort((a, b) => a.p - b.p)
  const groups: { p: number; y: number }[][] = []
  if (mode === 'uniform') {
    for (let b = 0; b < bins; b++) groups.push([])
    for (const o of idx) groups[Math.min(bins - 1, Math.floor(o.p * bins))]!.push(o)
  } else {
    const n = idx.length
    for (let b = 0; b < bins; b++) {
      const g = idx.slice(Math.floor((b * n) / bins), Math.floor(((b + 1) * n) / bins))
      if (g.length) groups.push(g)
    }
  }
  return groups
    .map((g, b) => {
      if (!g.length) return undefined
      const k = g.reduce((s, o) => s + o.y, 0)
      const w = wilson(k, g.length)
      const lo = mode === 'uniform' ? b / bins : g[0]!.p
      const hi = mode === 'uniform' ? (b + 1) / bins : g[g.length - 1]!.p
      return { lo, hi, n: g.length, predicted: mean(g.map((o) => o.p)), observed: w.p, obsLo: w.lo, obsHi: w.hi }
    })
    .filter((b): b is CalibrationBin => Boolean(b))
}

/** Expected calibration error: Σ (n_b / N) · |observed_b − predicted_b|. */
export function ece(bins: readonly CalibrationBin[]): number {
  const N = sum(bins.map((b) => b.n))
  return N ? sum(bins.map((b) => (b.n / N) * Math.abs(b.observed - b.predicted))) : NaN
}

// ---------------------------------------------------------------------------
// Histograms

export interface HistBin {
  lo: number
  hi: number
  count: number
}

/** Linear histogram with `bins` equal-width bins over [lo, hi]; values outside are clamped into the end bins. */
export function histogram(xs: readonly number[], bins: number, lo?: number, hi?: number): HistBin[] {
  const a = lo ?? Math.min(...xs)
  const b = hi ?? Math.max(...xs)
  const width = (b - a) / bins || 1
  const out: HistBin[] = Array.from({ length: bins }, (_, i) => ({ lo: a + i * width, hi: a + (i + 1) * width, count: 0 }))
  for (const x of xs) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((x - a) / width)))
    out[i]!.count++
  }
  return out
}

/** Log-spaced bin edges from lo to hi (both > 0), `perDecade` bins per factor of 10. */
export function logEdges(lo: number, hi: number, perDecade = 3): number[] {
  const a = Math.log10(lo)
  const b = Math.log10(hi)
  const n = Math.max(1, Math.ceil((b - a) * perDecade - 1e-9))
  return Array.from({ length: n + 1 }, (_, i) => Math.pow(10, a + ((b - a) * i) / n))
}

/** Histogram over explicit edges; values below the first edge go to bin 0, above the last to the final bin. */
export function histogramEdges(xs: readonly number[], edges: readonly number[]): HistBin[] {
  const out: HistBin[] = []
  for (let i = 0; i < edges.length - 1; i++) out.push({ lo: edges[i]!, hi: edges[i + 1]!, count: 0 })
  for (const x of xs) {
    let i = out.findIndex((b) => x < b.hi)
    if (i < 0) i = out.length - 1
    out[i]!.count++
  }
  return out
}

/** Log-binned histogram (values ≤ 0 are clamped to `lo`). */
export function logHistogram(xs: readonly number[], lo: number, hi: number, perDecade = 3): HistBin[] {
  return histogramEdges(xs.map((x) => Math.max(lo, x)), logEdges(lo, hi, perDecade))
}
