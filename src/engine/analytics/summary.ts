/** A compact per-course summary for the cross-language hub. */
import { estimateLevel } from '../mastery'
import { prepare } from './context'
import { etaMetric } from './eta'
import { recallMetric } from './recall'
import { navSeries } from './nav'
import { sessionMinutesByDay } from './workload'
import { minutesOn } from './context'
import { consistencyMetric } from './habits'
import type { AnalyticsData, CourseMeta } from './types'

export interface CourseSummary {
  /** Σ R over word cards now. */
  nav: number
  nav30dChange: number
  recall30: { p: number; lo: number; hi: number; n: number }
  daysOnRoad: number
  longestRun: number
  totalMinutes: number
  /** Kilometres travelled (stored as days.xp). */
  km: number
  lessonsDone: number
  /** The CEFR level being worked through ("A1", "A2"…), or "Pre-A1" before 50 mastered items. */
  levelEstimate: string
  /** Last day with any practice (YYYY-MM-DD). */
  lastActive?: string
  /** Word NAV at the end of each of the last 30 days, oldest first (today last). */
  navSeries30: number[]
}

export function courseSummary(data: AnalyticsData, meta?: CourseMeta, now = Date.now()): CourseSummary {
  const ctx = prepare(data, now)
  const series = navSeries(ctx, 31).map((p) => p.words)
  const r = recallMetric(ctx).d30
  const c = consistencyMetric(ctx)
  const sm = sessionMinutesByDay(ctx)
  const keys = new Set([...ctx.dayMap.keys(), ...sm.keys()])
  let level: string
  if (meta) {
    const e = etaMetric(ctx, meta)
    const mastered = data.cards.filter((x) => (x.kind === 'word' || x.kind === 'grammar') && x.stage >= 2).length
    const working = e.next?.level ?? e.reached
    level = mastered < 50 || !working ? 'Pre-A1' : working.toUpperCase()
  } else {
    const productive = data.cards.filter((x) => x.kind === 'word' && x.stage >= 2).length
    const grammar = data.cards.filter((x) => x.kind === 'grammar' && x.stage >= 2).length
    level = estimateLevel(productive, grammar)
  }
  return {
    nav: series[series.length - 1] ?? 0,
    nav30dChange: (series[series.length - 1] ?? 0) - (series[0] ?? 0),
    recall30: { p: r.p, lo: r.lo, hi: r.hi, n: r.n },
    daysOnRoad: c.current,
    longestRun: c.longest,
    totalMinutes: [...keys].reduce((s, k) => s + minutesOn(ctx, k, sm), 0),
    km: data.days.reduce((s, d) => s + (d.xp || 0), 0),
    lessonsDone: data.lessons.filter((l) => l.completions > 0).length,
    levelEstimate: level,
    lastActive: [...ctx.activeDays].sort().pop(),
    navSeries30: series.slice(1),
  }
}
