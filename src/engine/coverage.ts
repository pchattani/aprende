/** How much of a text a learner can read: share of word tokens they know. */
import type { Token } from '../lang/types'
import { lookup, type Dictionary } from '../lang/es/inflect'

export interface Coverage {
  total: number
  known: number
  unknownForms: Map<string, number>
  ratio: number
}

export function coverage(tokens: Token[], dict: Dictionary, knownIds: Set<string>, extraKnown: Set<string> = new Set()): Coverage {
  let total = 0
  let known = 0
  const unknownForms = new Map<string, number>()
  for (const t of tokens) {
    if (t.kind !== 'word') continue
    total++
    const w = t.text.toLowerCase()
    const entries = lookup(dict, w)
    const isKnown = extraKnown.has(w) || (entries ? entries.some((e) => knownIds.has(e.id)) : false) || (/^[A-ZÁÉÍÓÚÑ]/.test(t.text) && !entries)
    if (isKnown) known++
    else unknownForms.set(w, (unknownForms.get(w) ?? 0) + 1)
  }
  return { total, known, unknownForms, ratio: total ? known / total : 1 }
}

/** Readability label from coverage ratio (research: ~98% for comfortable reading, 95% for learning). */
export function readability(ratio: number): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  if (ratio >= 0.98) return { label: 'Comfortable', tone: 'ok' }
  if (ratio >= 0.95) return { label: 'Good for learning', tone: 'ok' }
  if (ratio >= 0.9) return { label: 'Challenging', tone: 'warn' }
  return { label: 'Too hard for now', tone: 'bad' }
}
