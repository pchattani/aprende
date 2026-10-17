import type { Lesson } from './schema'
import { grammar, vocab } from './loader'

/** Whether a lesson has anything for the guidebook (grammar notes or new words). */
export function hasGuidebook(lesson: Lesson): boolean {
  return lesson.teach.some((g) => grammar.has(g)) || lesson.vocab.some((v) => vocab.has(v))
}
