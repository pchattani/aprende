/**
 * Zod schema for the Italian irregular-verb table (content/it/verbs/irregular.yaml).
 * The Italian rows differ from the Spanish ones (auxiliary choice, -isc- verbs,
 * strong passato remoto stems, contracted infinitives like fare < facere), so the
 * Italian engine owns its schema.
 */
import { z } from 'zod'

const Six = z.array(z.string()).length(6)

export const ItVerbSchema = z.strictObject({
  /** Infinitive without reflexive pronoun (alzare, porre). */
  lemma: z.string().regex(/^[a-zàèéìòù]+(are|ere|ire|rre)$/, 'Italian infinitive (-are, -ere, -ire, -rre)'),
  /** Inherit every form from another row, swapping the shared prefix (benedire like dire). */
  like: z.string().optional(),
  /** Auxiliary in compound tenses (default avere). */
  aux: z.enum(['avere', 'essere']).optional(),
  /** Both auxiliaries are correct (salire, correre, vivere): `aux` is the one shown in the table. */
  bothAux: z.boolean().optional(),
  /** -ire verb that inserts -isc- (finisco); usually decided by the built-in list. */
  isc: z.boolean().optional(),
  /** -iare verb with a stressed i (invìo → invii, inviino). */
  stressedI: z.boolean().optional(),
  /** Full (Latin-like) infinitive that gives the stem of the regular forms: fare < facere, dire < dicere. */
  base: z.string().optional(),
  /** Suffix shared by the compounds of this verb when it is not the whole lemma (tradurre → durre). */
  family: z.string().optional(),
  /** false: never derive compounds from this row (dare would otherwise match mandare). */
  compounds: z.boolean().optional(),
  pres: Six.optional(),
  impf: Six.optional(),
  /** Full passato remoto override. */
  pret: Six.optional(),
  /** Strong passato remoto stem for io / lui / loro (prendere → pres: presi, prese, presero). */
  pretStem: z.string().optional(),
  /** Future / conditional stem (avr, sar, andr, verr). */
  futStem: z.string().optional(),
  subjPres: Six.optional(),
  subjImpf: Six.optional(),
  /** Affirmative tu imperative (va', fa', di', sii, abbi). */
  impTu: z.string().optional(),
  /** Affirmative voi imperative when it differs from the present (siate, abbiate). */
  impVoi: z.string().optional(),
  /** Modal verbs without an imperative (potere, dovere). */
  noImperative: z.boolean().optional(),
  participle: z.string().optional(),
  gerund: z.string().optional(),
  /** Other accepted spellings (debbo, perduto, sedetti) for the dictionary. */
  alt: z.array(z.string()).optional(),
  note: z.string().optional(),
})
export type ItVerb = z.infer<typeof ItVerbSchema>

export const ItVerbsFileSchema = z.strictObject({
  verbs: z.array(ItVerbSchema),
  /** Regular verbs whose compound tenses take essere. */
  essere: z.array(z.string()).default([]),
  /** Verbs that take avere although the verb they are built on takes essere (aggiungere ← giungere). */
  avere: z.array(z.string()).default([]),
  /** Regular verbs that take both auxiliaries; essere shown first. */
  essereOrAvere: z.array(z.string()).default([]),
  /** Regular verbs that take both auxiliaries; avere shown first. */
  avereOrEssere: z.array(z.string()).default([]),
})
export type ItVerbsFile = z.infer<typeof ItVerbsFileSchema>

/** Table lemma → row. Auxiliary-only verbs become rows with just `aux` (and `bothAux`). */
export function buildVerbTable(file: ItVerbsFile): Map<string, ItVerb> {
  const table = new Map<string, ItVerb>()
  for (const l of file.avere) table.set(l, { lemma: l, aux: 'avere' })
  for (const l of file.essere) table.set(l, { lemma: l, aux: 'essere' })
  for (const l of file.essereOrAvere) table.set(l, { lemma: l, aux: 'essere', bothAux: true })
  for (const l of file.avereOrEssere) table.set(l, { lemma: l, aux: 'avere', bothAux: true })
  for (const v of file.verbs) table.set(v.lemma, v)
  return table
}
