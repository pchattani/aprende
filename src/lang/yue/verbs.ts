/**
 * Cantonese verbs do not conjugate: aspect and time are shown with particles
 * (咗, 緊, 過, 嚟) and adverbs. This module satisfies the pack contract with an
 * empty table, so conjugation exercises and the verb trainer never appear.
 */
export type Tense = never
export type VerbTable = ReadonlyMap<string, Record<string, never>>

export interface Conjugation {
  lemma: string
  reflexive: boolean
  infinitive: string
  participle: string
  gerund: string
  forms: Partial<Record<string, (string | null)[]>>
}

export const PERSONS = ['我', '你', '佢', '我哋', '你哋', '佢哋'] as const
export const TENSES: Tense[] = []
export const TENSE_LABELS: Record<string, { es: string; en: string; level: string }> = {}
export const IRREGULAR: VerbTable = new Map<string, Record<string, never>>()

export function conjugateWith(lemma: string, _verbs?: ReadonlyMap<string, unknown>): Conjugation {
  return { lemma, reflexive: false, infinitive: lemma, participle: '', gerund: '', forms: {} }
}
export function conjugate(lemma: string): Conjugation {
  return conjugateWith(lemma)
}
export function allForms(lemma: string): Set<string> {
  return new Set([lemma])
}
export function withReflexive(form: string | null | undefined): string | null {
  return form ?? null
}

export const VERB_TRAINER = {
  defaultVerb: '',
  placeholder: '',
  isInfinitive: () => false,
  notAVerb: 'Cantonese verbs do not change form.',
  baseLemma: (lemma: string) => lemma,
  skipInExercises: [] as readonly string[],
}
