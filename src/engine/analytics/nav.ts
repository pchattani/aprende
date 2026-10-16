/**
 * Knowledge NAV: the expected number of items you could recall right now,
 * Σ R_i, treated like the net asset value of a portfolio of memories.
 */
import type { Ctx } from './context'
import { retrievabilityAt } from './replay'
import { diff, maxDrawdown, mean, sd, sharpe } from './stats'
import { dayRange, endOfDay } from './time'

export interface NavPoint {
  date: string
  /** Σ R over word cards. */
  words: number
  /** Σ R over sentence and grammar cards. */
  other: number
}

export interface Change {
  abs: number
  /** Relative change (NaN when the base is ~0). */
  pct: number
}

export interface NavMetric {
  series: NavPoint[]
  current: number
  currentOther: number
  change7: Change
  change30: Change
  drawdown: {
    pct: number
    abs: number
    peakDate?: string
    troughDate?: string
    recoveryDate?: string
    /** Days from peak to recovery (or to today when not recovered). */
    durationDays: number
    /** Drawdown series aligned with `series` (fraction, ≤ 0). */
    series: number[]
  }
  /** Share of days with a positive change in word NAV. */
  hitRate: { k: number; n: number; p: number }
  meanDaily: number
  sdDaily: number
  /** mean/sd of daily changes × √365 (an analogy, not a return). */
  sharpe: number
}

function change(series: number[], back: number): Change {
  const last = series[series.length - 1] ?? 0
  const base = series[series.length - 1 - back] ?? 0
  return { abs: last - base, pct: base > 1 ? (last - base) / base : NaN }
}

/** Daily Σ R series ending today (`days` points; past days sampled at 23:59:59, today at `now`). */
export function navSeries(ctx: Ctx, days = 91): NavPoint[] {
  const keys = dayRange(ctx.today, days)
  const tls = [...ctx.replay.timelines.values()].filter((t) => t.points.length)
  return keys.map((date, i) => {
    const T = i === keys.length - 1 ? ctx.now : endOfDay(date)
    let words = 0
    let other = 0
    for (const tl of tls) {
      if (tl.points[0]!.ts > T) continue
      const r = retrievabilityAt(tl, T)
      if (tl.kind === 'word') words += r
      else other += r
    }
    return { date, words, other }
  })
}

export function knowledgeNav(ctx: Ctx, days = 91): NavMetric {
  const series = navSeries(ctx, days)
  const w = series.map((p) => p.words)
  const changes = diff(w)
  // Only count days once there is something to grow or lose.
  const live = changes.filter((_, i) => w[i]! > 0 || w[i + 1]! > 0)
  // Start-up noise: peaks below 5 postcards or 15% of the window's high do not count.
  const dd = maxDrawdown(w, Math.max(5, 0.15 * Math.max(0, ...w)))
  const hasDd = dd.maxDrawdown < 0
  const endI = dd.recoveryIndex ?? w.length - 1
  const pos = live.filter((c) => c > 1e-9).length
  return {
    series,
    current: w[w.length - 1] ?? 0,
    currentOther: series[series.length - 1]?.other ?? 0,
    change7: change(w, 7),
    change30: change(w, 30),
    drawdown: {
      pct: dd.maxDrawdown,
      abs: dd.maxDrawdownAbs,
      peakDate: hasDd ? series[dd.peakIndex]!.date : undefined,
      troughDate: hasDd ? series[dd.troughIndex]!.date : undefined,
      recoveryDate: hasDd && dd.recoveryIndex !== undefined ? series[dd.recoveryIndex]!.date : undefined,
      durationDays: hasDd ? endI - dd.peakIndex : 0,
      series: dd.series,
    },
    hitRate: { k: pos, n: live.length, p: live.length ? pos / live.length : NaN },
    meanDaily: mean(live),
    sdDaily: sd(live),
    sharpe: sharpe(live),
  }
}
