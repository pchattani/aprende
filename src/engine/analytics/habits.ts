/** Consistency (days on the road, active share, time-of-day) and fatigue within a session. */
import type { Ctx } from './context'
import { streakFrom } from '../mastery'
import { twoProportionZ, wilson, type Proportion } from './stats'
import { dayRange, daysBetween, sessions, weekdayHourMatrix, type Cell } from './time'

export interface HourBlock extends Proportion {
  /** First hour of the 3-hour block (0, 3, … 21). */
  from: number
  label: string
}

export interface ConsistencyMetric {
  current: number
  longest: number
  /** Active days in the last 30 / 90 days, over the days the learner has been on the road (≤ window). */
  active30: { k: number; n: number; p: number }
  active90: { k: number; n: number; p: number }
  matrix: Cell[][]
  hours: Proportion[]
  blocks: HourBlock[]
  best?: HourBlock
  worst?: HourBlock
  /** Best block versus worst block. */
  test?: { z: number; pValue: number; diff: number }
  significant: boolean
  /** Breaks of 3+ days in the history, newest first. */
  breaks: { from: string; to: string; days: number }[]
}

const BLOCK_LABELS = ['00–03', '03–06', '06–09', '09–12', '12–15', '15–18', '18–21', '21–24']

export function consistencyMetric(ctx: Ctx, minBlock = 40): ConsistencyMetric {
  const active = [...ctx.activeDays].sort()
  const { current, longest } = streakFrom(active, ctx.today)
  const first = active[0]
  const share = (w: number) => {
    const n = first ? Math.min(w, daysBetween(first, ctx.today) + 1) : 0
    const k = dayRange(ctx.today, n).filter((d) => ctx.activeDays.has(d)).length
    return { k, n, p: n ? k / n : NaN }
  }
  const matrix = weekdayHourMatrix(ctx.answers)
  const hours = Array.from({ length: 24 }, (_, h) => {
    let k = 0
    let n = 0
    for (const row of matrix) {
      k += row[h]!.k
      n += row[h]!.n
    }
    return wilson(k, n)
  })
  const blocks: HourBlock[] = BLOCK_LABELS.map((label, b) => {
    let k = 0
    let n = 0
    for (let h = b * 3; h < b * 3 + 3; h++) {
      k += hours[h]!.k
      n += hours[h]!.n
    }
    return { from: b * 3, label, ...wilson(k, n) }
  })
  const eligible = blocks.filter((b) => b.n >= minBlock).sort((a, b) => b.p - a.p)
  const best = eligible[0]
  const worst = eligible.length > 1 ? eligible[eligible.length - 1] : undefined
  const t = best && worst ? twoProportionZ(best.k, best.n, worst.k, worst.n) : undefined
  // Breaks: gaps of 3+ inactive days between active days.
  const breaks: ConsistencyMetric['breaks'] = []
  for (let i = 1; i < active.length; i++) {
    const gap = daysBetween(active[i - 1]!, active[i]!) - 1
    if (gap >= 3) breaks.push({ from: active[i - 1]!, to: active[i]!, days: gap })
  }
  breaks.reverse()
  return {
    current, longest, active30: share(30), active90: share(90), matrix, hours, blocks, best, worst,
    test: t ? { z: t.z, pValue: t.pValue, diff: t.diff } : undefined,
    // Two-sided 5% with a Bonferroni factor for the comparisons implied by picking the extremes.
    significant: Boolean(t && t.pValue < 0.05 / Math.max(1, (eligible.length * (eligible.length - 1)) / 2)),
    breaks,
  }
}

export interface FatigueBucket extends Proportion {
  from: number
  to: number
}

export interface FatigueMetric {
  sessions: number
  medianMinutes: number
  buckets: FatigueBucket[]
  breakpoint?: { minute: number; before: Proportion; after: Proportion; z: number; pValue: number }
  /** Recommended session length in minutes when a significant drop exists. */
  recommendedMinutes?: number
}

/** Critical z for the breakpoint scan (≈ two-sided 5% after Bonferroni over ~11 candidate minutes). */
export const FATIGUE_Z = 2.8

export function fatigueMetric(ctx: Ctx, bucketMin = 2, maxMin = 30, minSide = 40): FatigueMetric {
  const ss = sessions(ctx.answers)
  const pos: { m: number; correct: boolean }[] = []
  for (const s of ss) for (const a of s.items) pos.push({ m: (a.ts - s.start) / 60_000, correct: a.correct })
  const buckets: FatigueBucket[] = []
  for (let from = 0; from < maxMin; from += bucketMin) {
    const to = from + bucketMin >= maxMin ? Infinity : from + bucketMin
    const g = pos.filter((p) => p.m >= from && p.m < to)
    if (g.length) buckets.push({ from, to, ...wilson(g.filter((p) => p.correct).length, g.length) })
  }
  let breakpoint: FatigueMetric['breakpoint']
  for (let m = 4; m <= 24; m += 2) {
    const b = pos.filter((p) => p.m < m)
    const a = pos.filter((p) => p.m >= m)
    if (b.length < minSide || a.length < minSide) continue
    const kb = b.filter((p) => p.correct).length
    const ka = a.filter((p) => p.correct).length
    const t = twoProportionZ(kb, b.length, ka, a.length)
    if (!breakpoint || t.z > breakpoint.z) breakpoint = { minute: m, before: wilson(kb, b.length), after: wilson(ka, a.length), z: t.z, pValue: t.pValue }
  }
  const lens = ss.map((s) => (s.end - s.start) / 60_000).sort((a, b) => a - b)
  return {
    sessions: ss.length,
    medianMinutes: lens.length ? lens[Math.floor((lens.length - 1) / 2)]! : NaN,
    buckets,
    breakpoint,
    recommendedMinutes: breakpoint && breakpoint.z >= FATIGUE_Z ? breakpoint.minute : undefined,
  }
}

