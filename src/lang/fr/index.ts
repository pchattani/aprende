import type { LanguagePack } from '../types'
import type { LanguagePackFull } from '../contract'
import { normalize, match, words, stripAccents } from './normalize'
import { tokenize } from './tokenize'

export const french: LanguagePack = {
  id: 'fr',
  locale: 'fr-FR',
  normalize,
  tokenize,
  match,
  words,
}

/** The pack the app uses through the `@lang` alias. */
export const languagePack: LanguagePackFull = {
  ...french,
  stripMarks: stripAccents,
  comparable: (t) => t,
}

export * from './normalize'
export * from './tokenize'
