/**
 * Language-agnostic contract that every language pack implements.
 * The engine and the UI only talk to a LanguagePack; Spanish is the first implementation.
 */
export interface Token {
  text: string
  start: number
  end: number
  kind: 'word' | 'punct' | 'space' | 'number'
}

export interface AnswerMatch {
  /** 'correct' = exact (modulo case/punct), 'almost' = accent-only or single typo, 'wrong' otherwise. */
  verdict: 'correct' | 'almost' | 'wrong'
  /** Which expected answer matched best. */
  matched?: string
  /** Human-readable reasons for an 'almost' verdict. */
  notes: string[]
}

export interface CheckerFinding {
  /** Stable code: 'spelling' | 'accent' | 'agreement' | 'verb-form' | 'punctuation' | 'learner-error' ... */
  code: string
  message: string
  /** Offending span in the original text. */
  start: number
  end: number
  suggestion?: string
  /** Grammar note id for "learn more". */
  grammar?: string
}

export interface VerbForms {
  lemma: string
  /** tense -> 6 persons (yo, tú, él/ella/usted, nosotros, vosotros, ellos/ustedes). */
  [tense: string]: string | string[]
}

export interface LanguagePack {
  id: string
  locale: string
  /** Lowercase, trim, strip punctuation; optionally strip diacritics. */
  normalize(text: string, opts?: { accentInsensitive?: boolean }): string
  tokenize(text: string): Token[]
  /** Compare a learner answer against accepted answers. */
  match(given: string, expected: string[]): AnswerMatch
  /** Words of a sentence that can be used as tiles. */
  words(text: string): string[]
}
