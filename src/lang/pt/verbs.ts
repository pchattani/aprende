import irregularRaw from '../../../content/pt/verbs/irregular.yaml'
import { PtVerbsFileSchema, type PtIrregularVerb } from './schema'
import { conjugate as conjugateWith, formsOf, type Conjugation } from './conjugator'

export { withReflexive, PERSONS, TENSES, TENSE_LABELS, REFLEXIVE, formsOf, participleForms } from './conjugator'
export type { Tense, Conjugation } from './conjugator'

const parsed = PtVerbsFileSchema.parse(irregularRaw)
export const IRREGULAR: ReadonlyMap<string, PtIrregularVerb> = new Map(parsed.verbs.map((v) => [v.lemma, v]))

/** Irregular-verb table type passed around by the engine. */
export type VerbTable = ReadonlyMap<string, PtIrregularVerb>
export { conjugateWith }

/** Text and defaults for the verb trainer page. */
export const VERB_TRAINER = {
  defaultVerb: 'ser',
  placeholder: 'Type a verb (falar, ter, levantar-se…)',
  isInfinitive: (w: string) => /^\p{L}+(ar|er|ir|ôr|por)(-se)?$/u.test(w.trim().toLowerCase()) || /^(ir|pôr)(-se)?$/.test(w.trim().toLowerCase()),
  notAVerb: 'That does not look like a Portuguese infinitive (it should end in -ar, -er, -ir or be pôr / -por).',
  baseLemma: (lemma: string) => lemma.trim().toLowerCase().replace(/-se$/, ''),
  /** Imperatives (clitics attach to them) and the personal infinitive (same forms as the future subjunctive). */
  skipInExercises: ['impAff', 'impNeg', 'persInf'] as readonly string[],
}

const cache = new Map<string, Conjugation>()

/** Conjugate a Portuguese verb using the bundled irregular table. */
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
