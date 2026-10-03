/**
 * Recognition -> recall -> production ladder: which exercise kinds suit an
 * item at a given stage. The generator picks from these sets.
 */
import type { ExerciseKind } from './schema'
import type { ItemKind, Stage } from './types'

const WORD: Record<Stage, ExerciseKind[]> = {
  0: ['choiceEs', 'choiceEn', 'match', 'listen'],
  1: ['choiceEn', 'match', 'fillBlank', 'listen'],
  2: ['typeEs', 'dictation', 'fillBlank'],
  3: ['typeEs', 'speak', 'dictation'],
}
const SENTENCE: Record<Stage, ExerciseKind[]> = {
  0: ['choiceEs', 'listen', 'wordBank'],
  1: ['wordBank', 'order', 'fillBlank', 'typeEn'],
  2: ['typeEs', 'dictation', 'order'],
  3: ['typeEs', 'speak', 'transform', 'findError'],
}
const GRAMMAR: Record<Stage, ExerciseKind[]> = {
  0: ['fillBlank', 'wordBank', 'choiceEn'],
  1: ['fillBlank', 'conjugate', 'order'],
  2: ['conjugate', 'typeEs', 'transform'],
  3: ['transform', 'findError', 'typeEs'],
}

export function kindsFor(item: ItemKind, stage: Stage): ExerciseKind[] {
  return item === 'word' ? WORD[stage] : item === 'sentence' ? SENTENCE[stage] : GRAMMAR[stage]
}

