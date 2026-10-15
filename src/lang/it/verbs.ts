import irregularRaw from '../../../content/it/verbs/irregular.yaml'
import { ItVerbsFileSchema, buildVerbTable, type ItVerb } from './schema'
import { conjugate as conjugateWith, parseLemma, formsOf, type Conjugation } from './conjugator'

export { withReflexive, agreementVariants, attachClitic, formsOf, PERSONS, TENSES, TENSE_LABELS, REFLEXIVE, ISC_VERBS } from './conjugator'
export type { Tense, Conjugation, Aux } from './conjugator'
export type { ItVerb } from './schema'

const parsed = ItVerbsFileSchema.parse(irregularRaw)
/** Irregular verbs and auxiliary choices (lemma → row). */
export const IRREGULAR: ReadonlyMap<string, ItVerb> = buildVerbTable(parsed)

/** Irregular-verb table type passed around by the engine. */
export type VerbTable = ReadonlyMap<string, ItVerb>
export { conjugateWith }

/** Text and defaults for the verb trainer page. */
export const VERB_TRAINER = {
  defaultVerb: 'essere',
  placeholder: 'Type a verb (parlare, avere, alzarsi…)',
  isInfinitive: (w: string) => /(are|ere|ire|rre|rsi|rsene)$/.test(w.trim().toLowerCase()),
  notAVerb: 'That does not look like an Italian infinitive (it should end in -are, -ere, -ire or -rre; reflexives in -rsi).',
  /** alzarsi → alzare, porsi → porre, andarsene → andare. */
  baseLemma: (lemma: string) => parseLemma(lemma).inf,
  /** Imperatives (and their attached pronouns) are drilled in the verb trainer, not in fill-in exercises. */
  skipInExercises: ['impAff', 'impNeg'] as readonly string[],
}

const cache = new Map<string, Conjugation>()

/** Conjugate an Italian verb using the bundled irregular table. */
export function conjugate(lemma: string): Conjugation {
  const key = lemma.trim().toLowerCase()
  let c = cache.get(key)
  if (!c) {
    c = conjugateWith(key, IRREGULAR)
    cache.set(key, c)
  }
  return c
}

/** Set of every finite / non-finite form of a verb (for the checker and dictionary). */
export function allForms(lemma: string): Set<string> {
  return formsOf(conjugate(lemma))
}
