import type { LanguagePack } from '../types'
import { normalize, match, words } from './normalize'
import { tokenize } from './tokenize'

export const spanish: LanguagePack = {
  id: 'es',
  locale: 'es-ES',
  normalize,
  tokenize,
  match,
  words,
}

export * from './normalize'
export * from './tokenize'
export * from './syllabify'
export * from './accents'
