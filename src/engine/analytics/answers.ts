import type { ReviewRow } from '../types'
import type { Answer } from './types'

/**
 * Collapse review rows into answers. One exercise credits several cards (the
 * items it practises and their grammar points) with identical timestamps; those
 * rows share one verdict and are one observation, not several.
 */
export function answersOf(reviews: readonly ReviewRow[]): Answer[] {
  const map = new Map<string, Answer>()
  for (const r of reviews) {
    const key = `${r.ts}|${r.exercise}`
    const a = map.get(key)
    if (a) {
      a.cards.push(r.cardId)
      for (const g of r.grammar) if (!a.grammar.includes(g)) a.grammar.push(g)
      if (!r.correct) a.correct = false
    } else {
      map.set(key, { ts: r.ts, correct: r.correct, exercise: r.exercise, grammar: [...r.grammar], cards: [r.cardId] })
    }
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts)
}
