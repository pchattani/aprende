/**
 * Spaced repetition via FSRS (ts-fsrs). Pure functions over CardRow.
 */
import { fsrs, createEmptyCard, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs'
import type { CardRow, ItemKind, Stage } from './types'
import type { LevelId } from './schema'

const scheduler = fsrs(generatorParameters({ enable_fuzz: true, enable_short_term: true, maximum_interval: 365 }))

export { Rating }

export function newCard(id: string, kind: ItemKind, level: LevelId, lessonId: string, grammar: string[], now = new Date()): CardRow {
  const c = createEmptyCard(now)
  return {
    id, kind, level, lessonId, grammar, stage: 0, streak: 0,
    due: c.due.getTime(), stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days, learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses, state: c.state,
  }
}

function toCard(row: CardRow): Card {
  return {
    due: new Date(row.due), stability: row.stability, difficulty: row.difficulty, elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days, learning_steps: row.learning_steps, reps: row.reps, lapses: row.lapses,
    state: row.state, last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

/** Map an answer verdict to an FSRS grade. */
export function gradeFor(verdict: 'correct' | 'almost' | 'wrong', fast = false): Grade {
  if (verdict === 'wrong') return Rating.Again
  if (verdict === 'almost') return Rating.Hard
  return fast ? Rating.Easy : Rating.Good
}

/** Apply a review. Returns the updated row (new object). */
export function review(row: CardRow, grade: Grade, now = new Date()): CardRow {
  const { card } = scheduler.next(toCard(row), now, grade)
  const correct = grade !== Rating.Again
  let stage: Stage = row.stage
  let streak = correct ? row.streak + 1 : 0
  if (correct && streak >= 2 && stage < 3) {
    stage = (stage + 1) as Stage
    streak = 0
  } else if (!correct && stage > 0) {
    stage = (stage - 1) as Stage
  }
  return {
    ...row, stage, streak,
    due: card.due.getTime(), stability: card.stability, difficulty: card.difficulty, elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days, learning_steps: card.learning_steps, reps: card.reps, lapses: card.lapses,
    state: card.state, last_review: card.last_review?.getTime(),
  }
}

export function isDue(row: CardRow, now = Date.now()): boolean {
  return row.due <= now
}

/** Retrievability (probability of recall) now, 0..1. */
export function retrievability(row: CardRow, now = new Date()): number {
  const r = scheduler.get_retrievability(toCard(row), now, false)
  return typeof r === 'number' ? r : 0
}

/** Days until due (negative if overdue). */
export function daysUntilDue(row: CardRow, now = Date.now()): number {
  return (row.due - now) / 86_400_000
}
