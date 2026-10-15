import type { LanguagePack } from '../types'
import type { LanguagePackFull } from '../contract'
import { normalize, match, words, stripAccents } from './normalize'
import { tokenize } from './tokenize'

export const spanish: LanguagePack = {
  id: 'es',
  locale: 'es-ES',
  normalize,
  tokenize,
  match,
  words,
}

/** The pack the app uses through the `@lang` alias. */
export const languagePack: LanguagePackFull = {
  ...spanish,
  stripMarks: stripAccents,
  comparable: (t) => t,
}

export * from './normalize'
export * from './tokenize'
export * from './syllabify'
export * from './accents'
