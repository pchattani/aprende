import type { Token } from '../types'

/** An elided word: letters + apostrophe directly followed by a letter (l'amico → "l'", dell'acqua → "dell'"). */
const ELIDED = /\p{L}+['’](?=\p{L})/uy
/** A word with a final apostrophe: po', va', or an accent typed as apostrophe (perche'). */
const APOS_FINAL = /\p{L}+['’](?!\p{L})/uy
const WORD = /\p{L}+/uy
const NUM = /\d+(?:[.,]\d+)*/y
const SPACE = /\s+/y

function at(re: RegExp, text: string, i: number): string | undefined {
  re.lastIndex = i
  const m = re.exec(text)
  return m && m.index === i ? m[0] : undefined
}

/**
 * Split a text into word, number, space and punctuation tokens. Elisions become
 * two words so each can be looked up: "l'amico" → "l'" + "amico", "c'è" → "c'" + "è",
 * "dov'è" → "dov'" + "è". Words that end in an apostrophe keep it ("un po'", "va'",
 * "perche'"), unless the apostrophe closes a quotation.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const push = (t: string, kind: Token['kind']) => {
    tokens.push({ text: t, start: i, end: i + t.length, kind })
    i += t.length
  }
  while (i < text.length) {
    const quoted = i > 0 && /['’]/.test(text[i - 1]!) && (i < 2 || !/\p{L}/u.test(text[i - 2]!))
    let m = at(ELIDED, text, i)
    if (m) {
      push(m, 'word')
      continue
    }
    // po' / va' (real apostrophe words), perche' (accent typed as apostrophe), l' amico (elision before a space)
    m = at(APOS_FINAL, text, i)
    if (m && !quoted) {
      push(m, 'word')
      continue
    }
    m = at(WORD, text, i)
    if (m) {
      push(m, 'word')
      continue
    }
    m = at(NUM, text, i)
    if (m) {
      push(m, 'number')
      continue
    }
    m = at(SPACE, text, i)
    if (m) {
      push(m, 'space')
      continue
    }
    push(text[i]!, 'punct')
  }
  return tokens
}
