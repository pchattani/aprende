import type { LessonResult } from './types'

/** XP for a finished session: a base for finishing, points per answer, a bonus for a clean sweep. */
export function xpFor(r: Pick<LessonResult, 'correct' | 'almost' | 'wrong' | 'completed'>): number {
  if (!r.completed) return r.correct * 2 + r.almost
  return 10 + r.correct * 2 + r.almost + (r.wrong === 0 ? 5 : 0)
}
