/** One call that computes every Insights metric and the suggestions from the learner's raw tables. */
import { prepare, type Ctx } from './context'
import { consistencyMetric, fatigueMetric, type ConsistencyMetric, type FatigueMetric } from './habits'
import { etaMetric, type EtaMetric } from './eta'
import { calibrationMetric, forgettingMetric, memoryBook, type CalibrationMetric, type ForgettingMetric, type MemoryBook } from './memory'
import { knowledgeNav, type NavMetric } from './nav'
import { recallMetric, type RecallMetric } from './recall'
import { suggestions, type Suggestion } from './suggestions'
import type { AnalyticsData, CourseMeta } from './types'
import { effortMetric, workloadMetric, type EffortMetric, type WorkloadMetric } from './workload'

/** Below this many answers the page shows an empty state instead of statistics. */
export const MIN_ANSWERS = 20

export interface Insights {
  asOf: number
  answers: number
  reviews: number
  enough: boolean
  nav: NavMetric
  recall: RecallMetric
  calibration: CalibrationMetric
  forgetting: ForgettingMetric
  memory: MemoryBook
  workload: WorkloadMetric
  effort: EffortMetric
  consistency: ConsistencyMetric
  fatigue: FatigueMetric
  eta: EtaMetric
  suggestions: Suggestion[]
}

export function computeInsights(data: AnalyticsData, meta: CourseMeta, now = Date.now(), ctx: Ctx = prepare(data, now)): Insights {
  const nav = knowledgeNav(ctx)
  const base = {
    asOf: now,
    answers: ctx.answers.length,
    reviews: data.reviews.length,
    enough: ctx.answers.length >= MIN_ANSWERS,
    nav,
    recall: recallMetric(ctx),
    calibration: calibrationMetric(ctx),
    forgetting: forgettingMetric(ctx),
    memory: memoryBook(ctx),
    workload: workloadMetric(ctx),
    effort: effortMetric(ctx, nav.series),
    consistency: consistencyMetric(ctx),
    fatigue: fatigueMetric(ctx),
    eta: etaMetric(ctx, meta),
  }
  return { ...base, suggestions: base.enough ? suggestions(base, meta) : [] }
}
