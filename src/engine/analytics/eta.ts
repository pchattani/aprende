/** Level ETA: mastered words and grammar over time, trend, and the projected date of the next level. */
import type { LevelId } from '../schema'
import type { Ctx } from './context'
import { pointAt } from './replay'
import { diff, mean, ols, sd, Z95 } from './stats'
import { dayRange, endOfDay, shiftDay } from './time'
import type { CourseMeta } from './types'

export interface LevelProgress {
  id: LevelId
  items: number
  mastered: number
  share: number
  grammarTotal: number
  /** Grammar points met (reviewed at least once). */
  grammarMet: number
  /** Grammar points at production stage (stage ≥ 2). */
  grammarMastered: number
}

export interface EtaMetric {
  threshold: number
  /** Highest level reached (undefined before the first). */
  reached?: LevelId
  next?: {
    level: LevelId
    /** Items (cumulative, levels ≤ next) that must be mastered. */
    target: number
    mastered: number
    remaining: number
    /** Days to target at the drift, and the range from drift ± 1.96 SE (upper Infinity when the slow end is ≤ 0). */
    days: number
    daysLo: number
    daysHi: number
    date?: string
    dateLo?: string
    dateHi?: string
  }
  /** Mastered items (levels ≤ next) at the end of each day, oldest first. */
  series: { date: string; mastered: number }[]
  /** Mean daily increase over the fit window (complete days) and its standard error sd/√n. */
  drift: number
  driftSe: number
  /** OLS trend over the fit window (for the chart). */
  ols: { slope: number; seSlope: number; intercept: number; r2: number; x0: number }
  fitDays: number
  /** Forecast cone (horizon adapts to the ETA, 30–120 days): mid ± 1.96·√(h·σ² + h²·SE²). */
  cone: { date: string; mid: number; lo: number; hi: number }[]
  levels: LevelProgress[]
}

const LEVEL_ORDER: readonly LevelId[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']
const isCounted = (kind: string) => kind === 'word' || kind === 'grammar'

export function etaMetric(ctx: Ctx, meta: CourseMeta, fitDays = 30, horizon?: number): EtaMetric {
  const threshold = meta.levelThreshold ?? 0.8
  const ord = (l: LevelId) => LEVEL_ORDER.indexOf(l)
  const counted = ctx.data.cards.filter((c) => isCounted(c.kind))
  const g = new Map(ctx.data.cards.filter((c) => c.kind === 'grammar').map((c) => [c.id, c]))
  const levels: LevelProgress[] = meta.levels.map((lv) => {
    const mine = counted.filter((c) => c.level === lv.id)
    return {
      id: lv.id,
      items: lv.items,
      mastered: mine.filter((c) => c.stage >= 2).length,
      share: lv.items ? mine.filter((c) => c.stage >= 2).length / lv.items : NaN,
      grammarTotal: lv.grammar.length,
      grammarMet: lv.grammar.filter((id) => (g.get(id)?.reps ?? 0) > 0).length,
      grammarMastered: lv.grammar.filter((id) => (g.get(id)?.stage ?? 0) >= 2).length,
    }
  })
  let cumItems = 0
  let cumMastered = 0
  let reached: LevelId | undefined
  let next: { level: LevelId; target: number; mastered: number } | undefined
  for (const lv of levels) {
    cumItems += lv.items
    cumMastered += lv.mastered
    const target = Math.ceil(threshold * cumItems)
    if (cumMastered >= target) reached = lv.id
    else {
      next = { level: lv.id, target, mastered: cumMastered }
      break
    }
  }
  const capOrd = next ? ord(next.level) : LEVEL_ORDER.length
  const tls = [...ctx.replay.timelines.values()].filter((t) => isCounted(t.kind) && t.points.length && ord(t.level) <= capOrd)
  const first = tls.reduce((m, t) => Math.min(m, t.points[0]!.ts), ctx.now)
  // One day of zero before the first answer, so the first day's gains count as an increment.
  const span = Math.max(2, Math.round((ctx.now - first) / 86_400_000) + 2)
  const series = dayRange(ctx.today, Math.min(span, 365)).map((date, i, a) => {
    const T = i === a.length - 1 ? ctx.now : endOfDay(date)
    let n = 0
    for (const tl of tls) if ((pointAt(tl, T)?.stage ?? 0) >= 2) n++
    return { date, mastered: n }
  })
  // Today is still in progress: fit on complete days only.
  const done = series.slice(0, -1)
  const win = done.slice(-Math.min(fitDays + 1, done.length))
  const inc = diff(win.map((s) => s.mastered))
  const drift = inc.length ? mean(inc) : NaN
  const sigma = inc.length > 1 ? sd(inc) : NaN
  const driftSe = sigma / Math.sqrt(inc.length)
  const x0 = done.length - win.length
  const fit = win.length >= 3 ? ols(win.map((_, i) => x0 + i), win.map((s) => s.mastered)) : undefined
  const last = series[series.length - 1]?.mastered ?? 0
  let nextOut: EtaMetric['next']
  if (next) {
    const remaining = Math.max(0, next.target - next.mastered)
    const fast = drift + Z95 * driftSe
    const slow = drift - Z95 * driftSe
    const days = drift > 0 ? remaining / drift : Infinity
    const daysLo = fast > 0 ? remaining / fast : Infinity
    const daysHi = slow > 0 ? remaining / slow : Infinity
    const at = (d: number) => (Number.isFinite(d) && d < 3650 ? shiftDay(ctx.today, Math.ceil(d)) : undefined)
    nextOut = { ...next, remaining, days, daysLo, daysHi, date: at(days), dateLo: at(daysLo), dateHi: at(daysHi) }
  }
  // Project far enough to show the ETA (30–120 days).
  const h = horizon ?? (nextOut && Number.isFinite(nextOut.days) ? Math.min(120, Math.max(30, Math.ceil(nextOut.days * 1.15))) : 60)
  const cone = Array.from({ length: h }, (_, j) => {
    const k = j + 1
    const mid = last + drift * k
    const half = Z95 * Math.sqrt(k * (sigma || 0) ** 2 + k * k * (driftSe || 0) ** 2)
    return { date: shiftDay(ctx.today, k), mid, lo: Math.max(last, mid - half), hi: mid + half }
  })
  return {
    threshold, reached, next: nextOut, series, drift, driftSe,
    ols: { slope: fit?.slope ?? NaN, seSlope: fit?.seSlope ?? NaN, intercept: fit?.intercept ?? NaN, r2: fit?.r2 ?? NaN, x0 },
    fitDays: inc.length, cone, levels,
  }
}
