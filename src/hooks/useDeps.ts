import { useMemo } from 'react'
import { vocab, errorRules, targetSynonymGroups, englishSynonymGroups } from '../engine/loader'
import { buildEquivalence, compareEquivalent } from '../lang/equivalence'
import { IRREGULAR } from '@lang/verbs'
import { buildDictionary, lookup, type Dictionary } from '@lang/inflect'
import { check } from '@lang/checker'
import { languagePack } from '@lang'
import { conjugate } from '@lang/verbs'
import type { GradeDeps } from '../engine/grade'
import type { ExplainDeps } from '../engine/explain'

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
  // Cantonese compares in Jyutping, so synonym groups and answers go through `comparable`.
  if (!eqEs) eqEs = buildEquivalence(targetSynonymGroups().map((g) => g.map(languagePack.comparable)))
  return compareEquivalent(languagePack.comparable(given), languagePack.comparable(expected), eqEs, 'es')
}
export function equivEn(given: string, expected: string) {
  if (!eqEn) eqEn = buildEquivalence(englishSynonymGroups)
  return compareEquivalent(given, expected, eqEn, 'en')
}
export function isWord(w: string): boolean {
  return Boolean(lookup(getDictionary(), w.toLowerCase()))
}
export function lookupForm(form: string) {
  return lookup(getDictionary(), form.toLowerCase())
}

/** Dependencies for personalised feedback (dictionary lookups + conjugator). */
export const explainDeps: ExplainDeps = { lookup: lookupForm, conjugate }

export function useGradeDeps(): GradeDeps {
  return useMemo(() => ({ pack: languagePack, check: checkText, equivEs, equivEn, isWord }), [])
}
