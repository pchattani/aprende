/**
 * Zod schema for the French irregular-verb table (content/fr/verbs/irregular.yaml).
 * French rows differ from the Spanish and Italian ones (passé simple stems in
 * -i/-u/-in, future stems, the être auxiliary of the DR MRS VANDERTRAMP verbs,
 * impersonal verbs), so the French engine owns its schema.
 */
import { z } from 'zod'

/** Six persons (je, tu, il/elle/on, nous, vous, ils/elles); "-" = no form (impersonal verbs). */
const Six = z.array(z.string()).length(6)

export const FrVerbSchema = z.strictObject({
  /** Infinitive without the pronoun of pronominal verbs (lever for se lever, asseoir for s'asseoir). */
  lemma: z.string().regex(/^[a-zàâçéèêëîïôûùüÿœæ]+(er|ir|ïr|re)$/, 'French infinitive (-er, -ir, -oir, -re)'),
  /** Inherit every form from another row, swapping the differing start (interdire like dire, then override). */
  like: z.string().optional(),
  /** Auxiliary in compound tenses (default avoir). */
  aux: z.enum(['avoir', 'être']).optional(),
  /** Both auxiliaries are correct (sortir, monter, passer: avoir with a direct object): `aux` is the one shown. */
  bothAux: z.boolean().optional(),
  /** Suffix shared by the compounds of this verb when it is not the whole lemma (écrire → crire: décrire, inscrire). */
  family: z.string().optional(),
  /** false: never derive compounds from this row. */
  compounds: z.boolean().optional(),
  /** Conjugate regularly although a listed verb ends the same way (répartir is not like partir). */
  regular: z.boolean().optional(),
  /** Only the il/elle form exists (falloir, pleuvoir). */
  impersonal: z.boolean().optional(),
  pres: Six.optional(),
  /** Imperfect stem when it is not the nous form minus -ons (être → ét). */
  impfStem: z.string().optional(),
  /** Full passé simple override. */
  pret: Six.optional(),
  /** Passé simple stem: pri → pris, pris, prit, prîmes, prîtes, prirent; vin → vins, vînmes. */
  pretStem: z.string().optional(),
  /** Future / conditional stem (ser, aur, ir, fer, pourr, viendr). */
  futStem: z.string().optional(),
  /** Full present subjunctive override (otherwise: ils-stem + e, nous/vous from the imperfect). */
  subjPres: Six.optional(),
  /** Imperative overrides (sois, soyons, soyez). */
  impTu: z.string().optional(),
  impNous: z.string().optional(),
  impVous: z.string().optional(),
  /** Modal or impersonal verbs without an imperative (pouvoir, devoir, falloir). */
  noImperative: z.boolean().optional(),
  /** Masculine singular past participle (pris, mort, né). */
  participle: z.string().optional(),
  /** All four participle forms when they are not p, p+e, p+s, p+es (dû, due, dus, dues). */
  participles: z.array(z.string()).length(4).optional(),
  /** The participle never agrees (été, pu, fallu, plu). */
  invariable: z.boolean().optional(),
  /** Present participle / gerund (étant, ayant, sachant). */
  gerund: z.string().optional(),
  /** Other accepted spellings (je puis, assois, paye) for the dictionary. */
  alt: z.array(z.string()).optional(),
  note: z.string().optional(),
})
export type FrVerb = z.infer<typeof FrVerbSchema>

export const FrVerbsFileSchema = z.strictObject({
  verbs: z.array(FrVerbSchema),
  /** Regular verbs whose compound tenses take être (arriver, tomber, rester). */
  etre: z.array(z.string()).default([]),
  /** Verbs that take avoir although the verb they are built on takes être (prévenir ← venir). */
  avoir: z.array(z.string()).default([]),
  /** Regular verbs that take both auxiliaries; être shown first (monter, descendre, passer). */
  etreOrAvoir: z.array(z.string()).default([]),
  /** Regular verbs that take both auxiliaries; avoir shown first. */
  avoirOrEtre: z.array(z.string()).default([]),
})
export type FrVerbsFile = z.infer<typeof FrVerbsFileSchema>

/** Table lemma → row. Auxiliary-only verbs become rows with just `aux` (and `bothAux`). */
export function buildVerbTable(file: FrVerbsFile): Map<string, FrVerb> {
  const table = new Map<string, FrVerb>()
  for (const l of file.avoir) table.set(l, { lemma: l, aux: 'avoir' })
  for (const l of file.etre) table.set(l, { lemma: l, aux: 'être' })
  for (const l of file.etreOrAvoir) table.set(l, { lemma: l, aux: 'être', bothAux: true })
  for (const l of file.avoirOrEtre) table.set(l, { lemma: l, aux: 'avoir', bothAux: true })
  for (const v of file.verbs) table.set(v.lemma, { ...table.get(v.lemma), ...v })
  return table
}
