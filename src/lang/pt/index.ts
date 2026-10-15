import type { LanguagePack } from '../types'
import type { LanguagePackFull } from '../contract'
import { normalize, match, words, stripAccents } from './normalize'
import { tokenize } from './tokenize'

export const portuguese: LanguagePack = {
  id: 'pt',
  locale: 'pt-BR',
  normalize,
  tokenize,
  match,
  words,
}

/** The pack the app uses through the `@lang` alias. */
export const languagePack: LanguagePackFull = {
  ...portuguese,
  stripMarks: stripAccents,
  comparable: (t) => t,
}

export * from './normalize'
export * from './tokenize'
