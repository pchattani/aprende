/** Schema of content/pt/verbs/irregular.yaml (the Portuguese irregular-verb table). */
import { z } from 'zod'

const Six = z.array(z.string()).length(6)

export const PtIrregularVerb = z.object({
  lemma: z.string(),
  /** Full present indicative override. */
  pres: Six.optional(),
  /** Irregular first-person present only (faço, peço, durmo); drives the present subjunctive. */
  eu: z.string().optional(),
  /** Vowel change in the stressed 2sg/3sg/3pl present of -ir verbs: subir → sobes, fugir → foge. */
  strongVowel: z.enum(['u>o']).optional(),
  /** Stressed diphthong in 1-3sg and 3pl present / subjunctive (odiar → odeio, odeie; odiamos). */
  diphthong: z.enum(['i>ei']).optional(),
  /** Turn off the automatic e>i of -ir verbs in the 1sg present (sentir → sinto). */
  regularStem: z.boolean().optional(),
  /** Full preterite override (a strong preterite: tive, fiz, pus). */
  pret: Six.optional(),
  impf: Six.optional(),
  /** Future / conditional stem (far, dir, trar, por). */
  futStem: z.string().optional(),
  subjPres: Six.optional(),
  /** Personal infinitive override (pôr, pores, pôr…). */
  persInf: Six.optional(),
  /** Full affirmative imperative override; index 0 (eu) unused, write "". */
  impAff: Six.optional(),
  /** Verb without imperative (poder). */
  noImperative: z.boolean().optional(),
  /** Participle used in compound tenses with ter (feito, pago, aceitado). */
  participle: z.string().optional(),
  /** Other accepted participles (abundant verbs: aceito/aceite, entregue, morto, impresso). */
  altParticiples: z.array(z.string()).optional(),
  gerund: z.string().optional(),
  /** Verbs conjugated like this one with a different beginning (ter → manter, obter; escrever → descrever, inscrever). */
  derived: z.array(z.string()).optional(),
  /** Every verb ending in this lemma conjugates like it (pôr → compor, propor; fazer → satisfazer). */
  prefixable: z.boolean().optional(),
  /** Extra accepted forms, such as European variants (oiço, oiça). */
  alt: z.array(z.string()).optional(),
  note: z.string().optional(),
})
export type PtIrregularVerb = z.infer<typeof PtIrregularVerb>

export const PtVerbsFileSchema = z.object({ verbs: z.array(PtIrregularVerb) })
