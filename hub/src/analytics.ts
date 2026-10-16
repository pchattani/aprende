/**
 * Per-course summary for the hub: `courseSummary(data)` from the shared analytics engine
 * (src/engine/analytics, pure, no content loaders) merged field by field over the hub's own
 * minimal summary, so a shape change or a runtime error in the engine never breaks the hub.
 */
import { courseSummary } from '@/engine/analytics/summary'
import type { CourseData } from './progress'
import { localSummary, mergeSummary, type CourseSummary } from './summary'

export function courseSummaryFor(data: CourseData, now = new Date()): CourseSummary {
  const local = localSummary(data, now)
  try {
    return mergeSummary(local, courseSummary(data, undefined, now.getTime()))
  } catch {
    return local
  }
}

/** The quant figures the hub's portfolio table shows (Knowledge NAV, recall), or null when the engine can't compute them. */
export type Quant = Pick<ReturnType<typeof courseSummary>, 'nav' | 'nav30dChange' | 'recall30' | 'levelEstimate' | 'navSeries30'>
export function quantFor(data: CourseData, now = new Date()): Quant | null {
  try {
    const q = courseSummary(data, undefined, now.getTime())
    return Number.isFinite(q.nav) ? q : null
  } catch {
    return null
  }
}
