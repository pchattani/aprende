import { useMemo } from 'react'
import { vocab, errorRules, spanishSynonymGroups, englishSynonymGroups } from '../engine/loader'
import { buildEquivalence, compareEquivalent } from '../lang/equivalence'
import { IRREGULAR } from '../lang/es/verbs'
import { buildDictionary, lookup, type Dictionary } from '../lang/es/inflect'
import { check } from '../lang/es/checker'
import { spanish } from '../lang/es'
import type { GradeDeps } from '../engine/grade'

let dictCache: Dictionary | undefined
/** Full-course dictionary (built once; a few thousand entries). */
export function getDictionary(): Dictionary {
  if (!dictCache) dictCache = buildDictionary(vocab.values(), IRREGULAR)
  return dictCache
}

export function checkText(text: string) {
  return check(text, { dict: getDictionary(), rules: errorRules, verbs: IRREGULAR })
}

let eqEs: ReturnType<typeof buildEquivalence> | undefined
let eqEn: ReturnType<typeof buildEquivalence> | undefined
export function equivEs(given: string, expected: string) {
  if (!eqEs) eqEs = buildEquivalence(spanishSynonymGroups())
  return compareEquivalent(given, expected, eqEs, 'es')
}
export function equivEn(given: string, expected: string) {
  if (!eqEn) eqEn = buildEquivalence(englishSynonymGroups)
  return compareEquivalent(given, expected, eqEn, 'en')
}
export function isWord(w: string): boolean {
  return Boolean(lookup(getDictionary(), w.toLowerCase()))
}

export function useGradeDeps(): GradeDeps {
  return useMemo(() => ({ pack: spanish, check: checkText, equivEs, equivEn, isWord }), [])
}
