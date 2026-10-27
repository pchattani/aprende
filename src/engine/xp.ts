import type { LessonResult } from './types'

/** XP for a finished session: a base for finishing, points per answer, a bonus for a clean sweep. */
export function xpFor(r: Pick<LessonResult, 'correct' | 'almost' | 'wrong' | 'completed'>): number {
  if (!r.completed) return r.correct * 2 + r.almost
  return 10 + r.correct * 2 + r.almost + (r.wrong === 0 ? 5 : 0)
}

/**
 * XP (km) for checking a writing prompt: a lesson's worth the first time it passes (10 + a tenth of
 * the score), 2 for beating the best score, nothing for re-checking the same level.
 */
export function writingXp(score: number, firstPass: boolean, improved: boolean): number {
  if (firstPass) return 10 + Math.round(score / 10)
  return improved ? 2 : 0
}
