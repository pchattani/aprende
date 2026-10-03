import irregularRaw from '../../../content/es/verbs/irregular.yaml'
import { VerbsFileSchema, type IrregularVerb } from '../../engine/schema'
import { conjugate as conjugateWith, type Conjugation } from './conjugator'

export { withReflexive, PERSONS, TENSES, TENSE_LABELS, REFLEXIVE } from './conjugator'
export type { Tense, Conjugation } from './conjugator'

const parsed = VerbsFileSchema.parse(irregularRaw)
export const IRREGULAR: ReadonlyMap<string, IrregularVerb> = new Map(parsed.verbs.map((v) => [v.lemma, v]))

const cache = new Map<string, Conjugation>()

/** Conjugate a Spanish verb using the bundled irregular table. */
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
  const c = conjugate(lemma)
  const out = new Set<string>([c.infinitive, c.participle, c.gerund])
  for (const forms of Object.values(c.forms)) {
    for (const f of forms) {
      if (!f) continue
      const bare = f.replace(/^no /, '')
      const last = bare.split(' ').pop()!
      out.add(last)
    }
  }
  // participle agreement forms
  if (c.participle.endsWith('o')) {
    const p = c.participle.slice(0, -1)
    out.add(p + 'a').add(p + 'os').add(p + 'as')
  }
  return out
}
