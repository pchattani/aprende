import { createContext } from 'react'
import type { GradeResult } from '../../engine/types'
import type { DogId } from '../art/dogRegistry'

/** The three dogs take turns: one companion per exercise. */
export const DOG_TURNS: readonly DogId[] = ['leo', 'bonchita', 'luna']

/** Which dog speaks the current exercise, and how the answer went (absent until checked). */
export interface DogReaction {
  dog: DogId
  verdict?: GradeResult['verdict']
}

export const DogReactionContext = createContext<DogReaction | undefined>(undefined)

/** 0 idle, 1 breeze (2+), 2 gale (5+), 3 jet stream (10+). */
export function comboTier(streak: number): 0 | 1 | 2 | 3 {
  return streak >= 10 ? 3 : streak >= 5 ? 2 : streak >= 2 ? 1 : 0
}

/** Streak counts that earn a banner. */
export function isComboMilestone(n: number): boolean {
  return n === 3 || n === 5 || n === 10 || (n > 10 && n % 5 === 0)
}
