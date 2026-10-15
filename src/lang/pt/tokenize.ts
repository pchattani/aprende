import type { Token } from '../types'

/**
 * A word: letters, optionally joined by internal hyphens or apostrophes, so that
 * clitic forms (levantei-me, dá-lo-ei, falar-lhe), compounds (guarda-chuva) and
 * elisions (d'água) are one token.
 */
const WORD = /\p{L}+(?:[-’']\p{L}+)*/uy
const NUM = /\d+(?:[.,]\d+)*/y
const SPACE = /\s+/y

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    WORD.lastIndex = i
    let m = WORD.exec(text)
    if (m && m.index === i) {
      tokens.push({ text: m[0], start: i, end: i + m[0].length, kind: 'word' })
      i += m[0].length
      continue
    }
    NUM.lastIndex = i
    m = NUM.exec(text)
    if (m && m.index === i) {
      tokens.push({ text: m[0], start: i, end: i + m[0].length, kind: 'number' })
      i += m[0].length
      continue
    }
    SPACE.lastIndex = i
    m = SPACE.exec(text)
    if (m && m.index === i) {
      tokens.push({ text: m[0], start: i, end: i + m[0].length, kind: 'space' })
      i += m[0].length
      continue
    }
    tokens.push({ text: text[i]!, start: i, end: i + 1, kind: 'punct' })
    i += 1
  }
  return tokens
}
