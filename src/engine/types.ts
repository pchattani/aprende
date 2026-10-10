/** Shared engine types for learner state and exercises. */
import type { ExerciseKind, LevelId } from './schema'

export type ItemKind = 'word' | 'sentence' | 'grammar'

/**
 * Ladder stage of an item: how deeply the learner can produce it.
 * 0 new/recognition · 1 recall (assemble) · 2 production (type) · 3 fluent production
 */
export type Stage = 0 | 1 | 2 | 3

export interface CardRow {
  /** Item id: vocab id (w.*), grammar id (g.*) or sentence id (s.<unit>.<n>). */
  id: string
  kind: ItemKind
  level: LevelId
  lessonId: string
  /** Grammar ids this item exercises (for weak-skill detection). */
  grammar: string[]
  stage: Stage
  /** Consecutive correct answers at the current stage. */
  streak: number
  // FSRS state (flattened ts-fsrs Card)
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: number
}

export interface ReviewRow {
  id?: number
  cardId: string
  ts: number
  rating: 1 | 2 | 3 | 4
  correct: boolean
  exercise: ExerciseKind
  grammar: string[]
}

export interface LessonRow {
  id: string
  unitId: string
  level: LevelId
  attempts: number
  completions: number
  bestAccuracy: number
  lastAccuracy: number
  firstCompleted?: number
  lastCompleted?: number
  xp: number
}

export interface DayRow {
  /** YYYY-MM-DD in local time. */
  date: string
  xp: number
  reviews: number
  lessons: number
  newItems: number
  minutes: number
  /** Lessons finished with no mistakes. */
  perfect?: number
}

export interface QuestRow {
  /** `${date}:${questId}` */
  id: string
  date: string
  questId: string
  claimedAt?: number
  rewardId?: string
}

export interface SouvenirRow {
  id: string
  ts: number
  /** Where it came from: 'quest' | 'find' | 'stamp'. */
  source: string
  lessonId?: string
}

export interface ReadingRow {
  id: string
  title: string
  level?: LevelId
  /** Imported text (undefined for bundled readers). */
  text?: string
  words: number
  progress: number
  finished: boolean
  updatedAt: number
}

export interface ExamRow {
  level: LevelId
  score: number
  passed: boolean
  ts: number
}

export interface KvRow {
  key: string
  value: unknown
}

// ---------------------------------------------------------------------------
// Exercises produced by the generator and consumed by the UI + grader

export interface ExerciseBase {
  kind: ExerciseKind
  /** Items credited when this exercise is answered. */
  items: string[]
  grammar: string[]
  /** Explanation shown after answering (grammar note id). */
  teach?: string
}
export interface ChoiceExercise extends ExerciseBase {
  kind: 'choiceEs' | 'choiceEn' | 'listen' | 'fillBlank' | 'reply'
  prompt: string
  /** For fillBlank the sentence with ___ ; for listen the text to speak. */
  audio?: string
  options: string[]
  answer: number
  /** Translation shown in feedback. */
  translation?: string
}
export interface WordBankExercise extends ExerciseBase {
  kind: 'wordBank' | 'order' | 'orderText'
  prompt: string
  tiles: string[]
  answers: string[]
  translation?: string
}
export interface TypeExercise extends ExerciseBase {
  kind: 'typeEs' | 'typeEn' | 'dictation' | 'conjugate' | 'transform' | 'speak'
  prompt: string
  audio?: string
  answers: string[]
  /** Hint shown under the prompt (e.g. tense/person for conjugate). */
  hint?: string
  translation?: string
}
export interface MatchExercise extends ExerciseBase {
  kind: 'match'
  pairs: { left: string; right: string }[]
}
export interface FindErrorExercise extends ExerciseBase {
  kind: 'findError'
  prompt: string
  /** Sentence with the error. */
  wrong: string
  answers: string[]
  explain: string
}
export type Exercise = ChoiceExercise | WordBankExercise | TypeExercise | MatchExercise | FindErrorExercise

export interface GradeResult {
  verdict: 'correct' | 'almost' | 'wrong'
  /** The correct answer to display. */
  correct: string
  notes: string[]
}

export interface LessonResult {
  lessonId: string
  total: number
  correct: number
  almost: number
  wrong: number
  completed: boolean
  durationMs: number
}
