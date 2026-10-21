/** Shared engine types for learner state and exercises. */
import type { ExerciseKind, LevelId } from './schema'

/** `char`: a character the learner writes (id `c.<char>`, from a lesson's `write` list). */
export type ItemKind = 'word' | 'sentence' | 'grammar' | 'char'

/**
 * Ladder stage of an item: how deeply the learner can produce it.
 * 0 new/recognition · 1 recall (assemble) · 2 production (type) · 3 fluent production
 */
export type Stage = 0 | 1 | 2 | 3

export interface CardRow {
  /** Item id: vocab id (w.*), grammar id (g.*), sentence id (s.<unit>.<n>) or character to write (c.<char>). */
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

/** A wrong answer the learner (or auto-pin) kept for a focused re-test. */
export interface PinRow {
  /** Item id (w.*, s.*, x.*, t.*) or `x:<hash>` for item-less sentences. */
  id: string
  ts: number
  lessonId: string
  exerciseKind: ExerciseKind
  /** What the learner wrote or chose, and the accepted answer. */
  given: string
  expected: string
  /** The most specific hint shown at the time ("Article: la, because ciudad is feminine"). */
  hint?: string
  /** The practised sentence or word in both languages. */
  es: string
  en: string
  /** The single word that was wrong, when the diff found exactly one replacement. */
  missed?: { given: string; expected: string }
  /** Consecutive correct answers in pinned practice; two in a row unpins. */
  streak: number
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
  /** What was practised, in both languages, shown after every answer. */
  review?: { es: string; en: string }
  /** The prompt is an English question answered in the target language (taught-words gate: its wording is not taught yet). */
  askEn?: boolean
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
  /**
   * A reading passage shown in full above the question (checkpoint reading). Lines are in the
   * target language; their English stays hidden until the answer is checked. `focus` highlights a line.
   */
  passage?: { title?: string; lines: { speaker?: string; text: string; en?: string }[]; focus?: number }
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
  /** For speak: 'reply' = hear a question and answer aloud; 'repeat' = listen and repeat a word. Default: read the prompt aloud. */
  variant?: 'reply' | 'repeat'
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
/** Pick a written character: from the picture it grew from (pictogram) or from its sound (hearChar). */
export interface CharChoiceExercise extends ExerciseBase {
  kind: 'pictogram' | 'hearChar'
  prompt: string
  /** pictogram: the character whose picture is shown (the answer). */
  char?: string
  /** hearChar: the word to speak. */
  audio?: string
  options: string[]
  answer: number
  translation?: string
}
/** Write a character with hanzi-writer: over its outline after a stroke-order demo (trace), or from memory (writeChar). */
export interface WriteExercise extends ExerciseBase {
  kind: 'trace' | 'writeChar'
  /** One Han character. */
  char: string
  /** Its Jyutping (or other reading) and English meaning. */
  jp?: string
  meaning: string
  prompt: string
  /** What the speaker button says (the character, or the word it is). */
  audio: string
}
export type Exercise = ChoiceExercise | WordBankExercise | TypeExercise | MatchExercise | FindErrorExercise | CharChoiceExercise | WriteExercise

export interface GradeResult {
  verdict: 'correct' | 'almost' | 'wrong'
  /** The correct answer to display. */
  correct: string
  notes: string[]
  /** Set when a 'correct' verdict forgave missing accents or a small typo. */
  lenient?: 'accents' | 'typo'
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
