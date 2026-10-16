/** Inputs to the Insights engine. Course metadata is passed in so this module never touches content loaders. */
import type { CardRow, DayRow, LessonRow, ReviewRow } from '../types'
import type { LevelId } from '../schema'

export interface AnalyticsData {
  cards: readonly CardRow[]
  reviews: readonly ReviewRow[]
  days: readonly DayRow[]
  lessons: readonly LessonRow[]
}

export interface LevelInfo {
  id: LevelId
  /** Words plus grammar points taught at this level (the ETA's unit). */
  items: number
  /** Grammar point ids taught at this level. */
  grammar: readonly string[]
}

export interface CourseMeta {
  /** Levels in course order. */
  levels: readonly LevelInfo[]
  /** Display titles for grammar ids (used in suggestion text). */
  grammarTitles?: Readonly<Record<string, string>>
  /** Share of a level's (cumulative) items that must be mastered to count as reaching it. Default 0.8. */
  levelThreshold?: number
  /** Human label for an item id (word lemma, sentence text), used in suggestion text. */
  labelOf?: (id: string) => string | undefined
  /** First lesson not yet completed, for "continue" actions. */
  nextLessonId?: string
}

/** One answered exercise: review rows written at the same instant for the same exercise. */
export interface Answer {
  ts: number
  correct: boolean
  exercise: ReviewRow['exercise']
  grammar: string[]
  cards: string[]
}
