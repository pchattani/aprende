import type { Token } from '../types'
import { segment } from './lexicon'

/** Tokens for the reader, checker and coverage meter: each Han word is one token. */
export function tokenize(text: string): Token[] {
  const out: Token[] = []
  let i = 0
  for (const s of segment(text)) {
    const kind: Token['kind'] = s.kind === 'han' || s.kind === 'jp' || s.kind === 'latin' ? 'word' : s.kind === 'num' ? 'number' : s.kind === 'space' ? 'space' : 'punct'
    out.push({ text: s.text, start: i, end: i + s.text.length, kind })
    i += s.text.length
  }
  return out
}
