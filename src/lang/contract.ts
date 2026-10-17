/**
 * The module surface every language pack under src/lang/<code>/ provides. The app
 * imports a pack through the `@lang` alias (set per build from VITE_LANG), so each
 * pack must export these names from these files:
 *
 *   index.ts      languagePack: LanguagePackFull
 *   normalize.ts  normalize, stripAccents, match, words, editDistance
 *   tokenize.ts   tokenize
 *   verbs.ts      IRREGULAR, conjugate, conjugateWith, allForms, PERSONS, TENSES, TENSE_LABELS,
 *                 withReflexive, VERB_TRAINER, types Tense, Conjugation, VerbTable
 *   inflect.ts    inflections, buildDictionary, lookup, type Dictionary
 *   numbers.ts    numberWordsToDigits, hasNumberWord
 *   checker.ts    check
 *   explain.ts    explainConfig: ExplainConfig
 *
 * Each pack has a `_contract.ts` that assigns its modules to these types, and
 * `npm run typecheck` builds the app against every pack.
 */
import type { Token, AnswerMatch, CheckerFinding, LanguagePack } from './types'
import type { VocabEntry, ErrorRule } from '../engine/schema'

/** Each pack has its own irregular-verb row type; the contract only needs a map. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyVerbTable = ReadonlyMap<string, any>

export interface NormalizeModule {
  normalize(text: string, opts?: { accentInsensitive?: boolean }): string
  /** Remove marks that learners commonly omit (accents; tones for Cantonese). */
  stripAccents(s: string): string
  match(given: string, expected: string[]): AnswerMatch
  /** Words of a sentence suitable for tiles (keeps marks, drops punctuation). */
  words(text: string): string[]
  editDistance(a: string, b: string): number
}

export interface TokenizeModule {
  tokenize(text: string): Token[]
}

export interface ConjugationLike {
  lemma: string
  reflexive: boolean
  infinitive: string
  participle: string
  gerund: string
  forms: Partial<Record<string, (string | null)[]>>
}

export interface VerbsModule {
  IRREGULAR: AnyVerbTable
  conjugate(lemma: string): ConjugationLike
  conjugateWith(lemma: string, verbs: AnyVerbTable): ConjugationLike
  allForms(lemma: string): Set<string>
  PERSONS: readonly string[]
  TENSES: readonly string[]
  TENSE_LABELS: Record<string, { es: string; en: string; level: string }>
  withReflexive(form: string | null | undefined, person: number, tense: never): string | null
  VERB_TRAINER: VerbTrainerConfig
}

/** Text and defaults for the verb trainer page. */
export interface VerbTrainerConfig {
  /** Verb shown first in the table view. */
  defaultVerb: string
  placeholder: string
  /** True when a typed word can be conjugated. */
  isInfinitive(w: string): boolean
  notAVerb: string
  /** Lemma to conjugate for a vocabulary verb (drops a reflexive ending: irse → ir). */
  baseLemma(lemma: string): string
  /** Tenses not used for fill-in-the-verb exercises (imperatives with clitics, etc.). */
  skipInExercises: readonly string[]
}

export interface InflectModule {
  inflections(entry: VocabEntry, verbs: AnyVerbTable): string[]
  buildDictionary(entries: Iterable<VocabEntry>, verbs: AnyVerbTable): Map<string, VocabEntry[]>
  lookup(dict: Map<string, VocabEntry[]>, form: string): VocabEntry[] | undefined
}

export interface NumbersModule {
  /** Replace number words with digits, leaving the rest of the text untouched. */
  numberWordsToDigits(text: string): string
  hasNumberWord(text: string): boolean
}

export interface CheckerModule {
  check(text: string, opts: { dict: Map<string, VocabEntry[]>; rules: ErrorRule[]; verbs: AnyVerbTable }): CheckerFinding[]
}

/** A pair of easily confused words or forms (ser/estar, essere/avere, 係/喺) with a hint for each direction. */
export interface ConfusablePair {
  a: ReadonlySet<string>
  b: ReadonlySet<string>
  /** Hint when the answer needed a member of `a` (receives the expected word). */
  useA: (e: string) => string
  useB: (e: string) => string
}

/**
 * Language data for personalised feedback (engine/explain.ts) and the
 * equivalence layer (optional subject pronouns).
 */
export interface ExplainConfig {
  /** Name of the language in English ("Spanish"). */
  languageName: string
  /** What learners drop when typing: 'accents' (Spanish, Portuguese, Italian) or 'tones' (Cantonese). */
  marks: string
  articles: ReadonlySet<string>
  preps: ReadonlySet<string>
  /** Subject pronouns that are optional before a verb (dropped when comparing answers). */
  subjects: ReadonlySet<string>
  /** Unaccented spellings learners type for a subject pronoun ("el" for "él", "tu" for "tú"): dropped only before a verb. */
  ambiguousSubjects?: ReadonlySet<string>
  /** Words after which a leading subject pronoun is not dropped (y, también…). */
  notAfterSubject: ReadonlySet<string>
  /** Emphatic forms equivalent to a clitic ("a mí" → "me"). */
  emphatic: ReadonlyMap<string, string>
  objectPronouns: ReadonlySet<string>
  negation: string
  pairs: ConfusablePair[]
  /** Missing-word hints for special words (personal a, negation…): return undefined to fall through. */
  missingHint?: (e: string, next: string | undefined) => string | undefined
  /** Hint when only the marks differ (accent or tone). */
  accentHint: (g: string, e: string) => string
  /** Agreement bits ("feminine", "plural") when two forms of the same lemma differ. */
  agreement: (g: string, e: string) => string[]
  articleHint: (e: string, noun: VocabEntry | undefined, next: string, g: string) => string
  missingArticle: (e: string) => string
  wordOrder: string
  /** Tokens compared by the feedback diff (default: words of the text). */
  tokens?: (text: string) => string[]
  /** Equality key for the diff (default: lowercase without marks). */
  key?: (w: string) => string
}

export interface ExplainModule {
  explainConfig: ExplainConfig
}

export interface LanguagePackFull extends LanguagePack {
  /** Remove accents (or tones) for lenient comparison. */
  stripMarks(s: string): string
  /**
   * Form used when comparing answers with the equivalence layer. Identity for
   * alphabetic languages; Cantonese turns characters into Jyutping syllables.
   */
  comparable(text: string): string
  /** Called once with the course vocabulary (Cantonese uses it for segmentation). */
  useVocabulary?(entries: Iterable<VocabEntry>): void
  /** Authored whole-sentence readings (Cantonese `jp` on a sentence) that override the automatic ones. */
  useSentenceReadings?(items: Iterable<{ es: string; jp?: string }>): void
  /** Romanisation of a text as [segment, reading] pairs, for ruby display (Cantonese). */
  romanize?(text: string): { text: string; reading?: string }[]
}
