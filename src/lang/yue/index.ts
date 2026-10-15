import type { LanguagePackFull } from '../contract'
import type { VocabEntry } from '../../engine/schema'
import { normalize, match, words, stripAccents } from './normalize'
import { tokenize } from './tokenize'
import { toSyllables, useVocabulary, useSentenceReadings, romanize, validateText, validateReading } from './lexicon'

/** The Cantonese pack: characters or Jyutping in, Jyutping comparison, ruby readings out. */
export const languagePack: LanguagePackFull & {
  validateText: (t: string) => string[]
  validateReading: (lemma: string, jp: string) => string[]
} = {
  id: 'yue',
  locale: 'yue-Hant-HK',
  normalize,
  tokenize,
  match,
  words,
  stripMarks: stripAccents,
  comparable: (text) => toSyllables(text).map((x) => x.replace(/^ni(?=[1-6]?$)/, 'nei')).join(' '),
  useVocabulary: (entries: Iterable<VocabEntry>) => useVocabulary(entries),
  useSentenceReadings,
  romanize,
  validateText,
  validateReading,
}

export * from './normalize'
export * from './tokenize'
