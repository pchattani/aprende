/**
 * The taught-words index of the course (engine/taught.ts) built from each lesson's `vocab`,
 * read through the lesson index (engine/lessonIndex.ts: the `?vocab` YAML projection, ids only, no lesson text).
 * Pages import it dynamically and only when the course sets `features.taughtOnly`, so the
 * other courses never load it.
 */
import { levels, vocab, known } from './loader'
import { tokenize } from '@lang/tokenize'
import { taughtIndex, makeTaughtGate, type TaughtGate } from './taught'
import { unitIds } from './lessonIndex'

export const taught = taughtIndex(levels, unitIds)

const gates = new Map<string, TaughtGate>()
/** The gate for a lesson: the words of this lesson and every one before it. */
export function taughtGateAt(lessonId: string): TaughtGate {
  let g = gates.get(lessonId)
  if (!g) {
    g = makeTaughtGate(taught.at(lessonId), vocab, tokenize, known.names)
    gates.set(lessonId, g)
  }
  return g
}
/** The gate at the furthest of these lessons (review, region quiz: what the learner has reached). */
export function taughtGateFor(lessonIds: Iterable<string>): TaughtGate {
  const id = taught.furthest(lessonIds)
  return id ? taughtGateAt(id) : makeTaughtGate([], vocab, tokenize, known.names)
}
