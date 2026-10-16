import { describe, it, expect } from 'vitest'
import {
  wilson, twoProportionZ, ols, maxDrawdown, sharpe, brier, logLoss, calibrationBins, ece, fitExponential, fitPower,
  logEdges, logHistogram, histogram, rolling, mean, sd, median, quantile, benjaminiHochberg, normCdf, sessions, weekdayHourMatrix,
} from '@/engine/analytics'

describe('descriptive statistics', () => {
  it('mean, sample sd, median, quantile', () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5)
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 5) // √(32/7)
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2)
    expect(Number.isNaN(mean([]))).toBe(true)
  })
  it('normal CDF', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 7)
    expect(normCdf(1.959964)).toBeCloseTo(0.975, 5)
    expect(normCdf(-1)).toBeCloseTo(0.158655, 5)
  })
  it('rolling mean', () => {
    expect(rolling([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5])
  })
})

describe('proportions', () => {
  it('Wilson score interval matches the hand computation for 8/10', () => {
    const w = wilson(8, 10)
    expect(w.p).toBe(0.8)
    expect(w.lo).toBeCloseTo(0.49016, 4)
    expect(w.hi).toBeCloseTo(0.94331, 4)
  })
  it('Wilson stays inside [0, 1] at the edges and is NaN for n = 0', () => {
    expect(wilson(0, 10).lo).toBe(0)
    expect(wilson(0, 10).hi).toBeCloseTo(0.27753, 4)
    expect(wilson(10, 10).hi).toBe(1)
    expect(Number.isNaN(wilson(0, 0).p)).toBe(true)
  })
  it('two-proportion z-test uses the pooled SE', () => {
    // p1 = .9, p2 = .6, pooled .75: se = √(.75·.25·(1/50+1/50)) = .086603
    const t = twoProportionZ(45, 50, 30, 50)
    expect(t.diff).toBeCloseTo(0.3, 10)
    expect(t.z).toBeCloseTo(3.4641, 4)
    expect(t.pValue).toBeCloseTo(0.000532, 5)
  })
  it('Benjamini–Hochberg q-values', () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.5])
    expect(q[0]).toBeCloseTo(0.04, 10)
    expect(q[1]).toBeCloseTo(0.053333, 5)
    expect(q[2]).toBeCloseTo(0.053333, 5)
    expect(q[3]).toBeCloseTo(0.5, 10)
  })
})

describe('regression', () => {
  it('OLS slope, intercept, standard errors and R²', () => {
    const f = ols([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])
    expect(f.slope).toBeCloseTo(0.6, 10)
    expect(f.intercept).toBeCloseTo(2.2, 10)
    expect(f.sigma).toBeCloseTo(Math.sqrt(0.8), 10)
    expect(f.seSlope).toBeCloseTo(0.282843, 5)
    expect(f.seIntercept).toBeCloseTo(0.938083, 5)
    expect(f.r2).toBeCloseTo(0.6, 10)
    expect(f.predict(6)).toBeCloseTo(5.8, 10)
    // Prediction band is wider than the confidence band and widest away from x̄.
    expect(f.predictionHalfWidth(3)).toBeGreaterThan(f.confidenceHalfWidth(3))
    expect(f.predictionHalfWidth(6)).toBeGreaterThan(f.predictionHalfWidth(3))
    expect(f.confidenceHalfWidth(3)).toBeCloseTo(1.959964 * Math.sqrt(0.8) * Math.sqrt(1 / 5), 6)
  })
  it('integer weights equal repeated observations for the point estimates', () => {
    const w = ols([0, 1, 2], [1, 3, 2], [2, 1, 1])
    const r = ols([0, 0, 1, 2], [1, 1, 3, 2])
    expect(w.slope).toBeCloseTo(r.slope, 10)
    expect(w.intercept).toBeCloseTo(r.intercept, 10)
  })
  it('recovers exact exponential and power-law forgetting curves', () => {
    const ts = [1, 2, 4, 8, 16]
    const e = fitExponential(ts.map((t) => ({ t, p: 0.9 * Math.exp(-t / 10), w: 1 })))!
    expect(e.a).toBeCloseTo(0.9, 6)
    expect(e.k).toBeCloseTo(10, 6)
    expect(e.halfLife).toBeCloseTo(10 * Math.log(1.8), 6)
    const p = fitPower(ts.map((t) => ({ t, p: 0.95 * Math.pow(1 + t, -0.3), w: 1 })))!
    expect(p.a).toBeCloseTo(0.95, 6)
    expect(p.k).toBeCloseTo(0.3, 6)
    expect(p.halfLife).toBeCloseTo(Math.pow(1.9, 1 / 0.3) - 1, 5)
  })
})

describe('series', () => {
  it('max drawdown with peak, trough and recovery', () => {
    const d = maxDrawdown([100, 120, 90, 95, 130, 110])
    expect(d.maxDrawdown).toBeCloseTo(-0.25, 10)
    expect(d.maxDrawdownAbs).toBe(-30)
    expect(d.peakIndex).toBe(1)
    expect(d.troughIndex).toBe(2)
    expect(d.recoveryIndex).toBe(4)
    expect(d.series[5]).toBeCloseTo(-20 / 130, 10)
  })
  it('unrecovered drawdown and a monotone series', () => {
    expect(maxDrawdown([10, 8, 9]).recoveryIndex).toBeUndefined()
    expect(maxDrawdown([1, 2, 3]).maxDrawdown).toBe(0)
    // Peaks at or below minPeak are ignored.
    expect(maxDrawdown([2, 1, 30, 29], 5).maxDrawdown).toBeCloseTo(-1 / 30, 10)
  })
  it('Sharpe-style ratio', () => {
    expect(sharpe([1, 2, 3])).toBeCloseTo(2 * Math.sqrt(365), 8)
    expect(Number.isNaN(sharpe([1, 1, 1]))).toBe(true)
  })
})

describe('probabilistic scores', () => {
  it('Brier score and log loss', () => {
    expect(brier([0.9, 0.8, 0.3], [1, 0, 0])).toBeCloseTo(0.74 / 3, 10)
    expect(logLoss([0.9, 0.8, 0.3], [1, 0, 0])).toBeCloseTo((-Math.log(0.9) - Math.log(0.2) - Math.log(0.7)) / 3, 10)
  })
  it('expected calibration error on a toy set', () => {
    const bins = calibrationBins([0.1, 0.2, 0.3, 0.7, 0.8, 0.9], [0, 0, 1, 1, 1, 0], 2, 'uniform')
    expect(bins).toHaveLength(2)
    expect(bins[0]!.predicted).toBeCloseTo(0.2, 10)
    expect(bins[0]!.observed).toBeCloseTo(1 / 3, 10)
    expect(bins[1]!.observed).toBeCloseTo(2 / 3, 10)
    expect(ece(bins)).toBeCloseTo(0.4 / 3, 10)
  })
  it('quantile bins hold equal counts', () => {
    const ps = Array.from({ length: 100 }, (_, i) => 0.5 + i / 200)
    const bins = calibrationBins(ps, ps.map((_, i) => i % 2), 10)
    expect(bins.map((b) => b.n)).toEqual(Array(10).fill(10))
    expect(bins[0]!.lo).toBe(0.5)
  })
})

describe('histograms and calendars', () => {
  it('linear and log bins', () => {
    expect(histogram([0, 1, 2, 3, 4], 2, 0, 4).map((b) => b.count)).toEqual([2, 3])
    const e = logEdges(1, 1000, 1)
    expect(e.map((x) => Math.round(x))).toEqual([1, 10, 100, 1000])
    expect(logHistogram([0.5, 2, 20, 50, 5000], 1, 1000, 1).map((b) => b.count)).toEqual([2, 2, 1])
  })
  it('session segmentation splits on gaps over 30 minutes', () => {
    const m = 60_000
    const s = sessions([{ ts: 0 }, { ts: 10 * m }, { ts: 50 * m }, { ts: 55 * m }, { ts: 85 * m }])
    expect(s.map((x) => x.items.length)).toEqual([2, 3])
    expect(s[1]!.end - s[1]!.start).toBe(35 * m)
  })
  it('weekday × hour matrix is Monday-first in local time', () => {
    const mon9 = new Date(2026, 9, 12, 9, 15).getTime() // Monday 12 Oct 2026
    const sun23 = new Date(2026, 9, 18, 23, 5).getTime()
    const m = weekdayHourMatrix([{ ts: mon9, correct: true }, { ts: mon9 + 1000, correct: false }, { ts: sun23, correct: true }])
    expect(m[0]![9]).toEqual({ n: 2, k: 1 })
    expect(m[6]![23]).toEqual({ n: 1, k: 1 })
  })
})
