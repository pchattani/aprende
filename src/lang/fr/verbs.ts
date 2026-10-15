import irregularRaw from '../../../content/fr/verbs/irregular.yaml'
import { FrVerbsFileSchema, buildVerbTable, type FrVerb } from './schema'
import { conjugate as conjugateWith, parseLemma, formsOf, agreementVariants as agreementVariantsRaw, type Conjugation } from './conjugator'

export { withReflexive, formsOf, parseLemma, PERSONS, TENSES, TENSE_LABELS, REFLEXIVE } from './conjugator'
export type { Tense, Conjugation, Aux } from './conjugator'
export type { FrVerb } from './schema'

const parsed = FrVerbsFileSchema.parse(irregularRaw)
/** Irregular verbs and auxiliary choices (lemma → row). */
export const IRREGULAR: ReadonlyMap<string, FrVerb> = buildVerbTable(parsed)

/** Irregular-verb table type passed around by the engine. */
export type VerbTable = ReadonlyMap<string, FrVerb>
export { conjugateWith }

/** Common words that end like an infinitive but are not verbs (mère, hiver, plaisir…). */
const NOT_INFINITIVES: ReadonlySet<string> = new Set([
  'mer', 'fer', 'hier', 'cher', 'chère', 'fier', 'hiver', 'super', 'premier', 'dernier', 'léger', 'étranger', 'entier', 'panier', 'papier',
  'cahier', 'quartier', 'métier', 'boucher', 'boulanger', 'policier', 'pompier', 'escalier', 'janvier', 'février', 'clocher', 'rocher',
  'plancher', 'désir', 'loisir', 'plaisir', 'avenir', 'souvenir', 'soupir', 'saphir', 'élixir',
  'soir', 'noir', 'espoir', 'miroir', 'trottoir', 'couloir', 'tiroir', 'mouchoir', 'comptoir', 'rasoir', 'bonsoir', 'manoir', 'peignoir',
  'mère', 'père', 'frère', 'livre', 'autre', 'notre', 'votre', 'quatre', 'centre', 'lettre', 'arbre', 'chambre', 'nombre', 'membre',
  'libre', 'pauvre', 'propre', 'sucre', 'vitre', 'titre', 'litre', 'mètre', 'théâtre', 'fenêtre', 'maître', 'ministre', 'monstre',
  'ordre', 'poivre', 'tigre', 'zèbre', 'fièvre', 'lièvre', 'chèvre', 'lèvre', 'verre', 'terre', 'guerre', 'pierre', 'barre', 'tour',
  'sobre', 'célèbre', 'sombre', 'tendre', 'cadre', 'poudre', 'foudre', 'faire-part', 'ivre', 'cuivre', 'oeuvre', 'œuvre', 'heure',
])

/** Text and defaults for the verb trainer page. */
export const VERB_TRAINER = {
  defaultVerb: 'parler',
  placeholder: 'Type a verb (parler, être, se lever…)',
  isInfinitive: (w: string) => {
    const { inf, reflexive } = parseLemma(w)
    return /(er|ir|ïr|re)$/.test(inf) && inf.length >= 3 && (reflexive || !NOT_INFINITIVES.has(inf)) && /^\p{L}+$/u.test(inf)
  },
  notAVerb: 'That does not look like a French infinitive (it should end in -er, -ir, -oir or -re; pronominal verbs start with se or s’).',
  /** se lever → lever, s'asseoir → asseoir, s'en aller → aller, avoir faim → avoir. */
  baseLemma: (lemma: string) => parseLemma(lemma).inf,
  /** Imperatives and the literary tenses are drilled in the verb trainer, not in fill-in exercises. */
  skipInExercises: ['impAff', 'impNeg', 'subjImpf', 'subjPluperf', 'pretPerf'] as readonly string[],
}

const cache = new Map<string, Conjugation>()

/** Conjugate a French verb using the bundled irregular table. */
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

let warmed = false
/**
 * All accepted spellings of a table form (suis allé / suis allée; nous sommes
 * assis / assises). Participles of the irregular table are known up front.
 */
export function agreementVariants(form: string | null | undefined): string[] {
  if (!warmed) {
    warmed = true
    for (const lemma of IRREGULAR.keys()) {
      try {
        conjugate(lemma)
      } catch {
        /* rows are validated by the content check */
      }
    }
  }
  return agreementVariantsRaw(form)
}
