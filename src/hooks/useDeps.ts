import { useMemo } from 'react'
import { vocab, errorRules, spanishSynonymGroups, englishSynonymGroups } from '../engine/loader'
import { buildEquivalence, canonicalize } from '../lang/equivalence'
import { IRREGULAR } from '../lang/es/verbs'
import { buildDictionary, type Dictionary } from '../lang/es/inflect'
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
export function canonEs(text: string): string {
  if (!eqEs) eqEs = buildEquivalence(spanishSynonymGroups())
  return canonicalize(text, eqEs, 'es')
}
export function canonEn(text: string): string {
  if (!eqEn) eqEn = buildEquivalence(englishSynonymGroups)
  return canonicalize(text, eqEn, 'en')
}

export function useGradeDeps(): GradeDeps {
  return useMemo(() => ({ pack: spanish, check: checkText, canonEs, canonEn }), [])
}
