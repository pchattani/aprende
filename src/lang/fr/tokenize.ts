import type { Token } from '../types'

/**
 * Elided function words split off as their own word: l'ami → "l'" + "ami",
 * jusqu'à → "jusqu'" + "à". Not quelqu'un, presqu'île or aujourd'hui (one word each).
 */
const ELIDED = /(?:jusqu|lorsqu|puisqu|quoiqu|qu|l|j|c|ç|d|n|s|m|t)['’](?=\p{L})/iuy
/** The same before a space (a learner's "l' ami"). */
const ELIDED_SPACE = /(?:jusqu|lorsqu|puisqu|quoiqu|qu|l|j|c|ç|d|n|s|m|t)['’](?=\s+\p{L})/iuy
/** A word, with inner apostrophes (aujourd'hui, quelqu'un, prud'homme). */
const WORD = /\p{L}+(?:['’]\p{L}+)*/uy
const NUM = /\d+(?:[.,]\d+)*/y
const SPACE = /\s+/y
const HYPHEN = /[-‑]/
/** Euphonic -t- of inversion: a-t-il, va-t-elle, y a-t-il. */
const EUPHONIC_T = /[-‑]t[-‑](?=(?:il|elle|on|ils|elles)(?!\p{L}))/iuy
/** Elided pronoun after an imperative: va-t'en, donne-m'en, mets-t'y. */
const HYPHEN_ELIDED = /[-‑][mt]['’](?=(?:en|y)(?!\p{L}))/iuy

/** Pronouns written after a verb with a hyphen (inversion and imperatives): they are separate words. */
const HYPHEN_PRONOUNS: ReadonlySet<string> = new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'moi', 'toi', 'lui', 'leur', 'eux', 'le', 'la', 'les', 'y', 'en', 'ce'])
/** Words before -ci / -là that make one word with it (celui-ci, là-bas is joined anyway, jusque-là). */
const CI_LA_HOSTS: ReadonlySet<string> = new Set(['celui', 'celle', 'ceux', 'celles', 'jusque', 'par', 'ici', 'là', 'ci', 'de', 'çà'])
/** Hyphenated words that contain a pronoun-like part but are single words. */
const LEXICAL: readonly string[] = ["c'est-à-dire", 'rendez-vous', 'arc-en-ciel', 'arcs-en-ciel', "m'as-tu-vu", "qu'en-dira-t-on", 'sauve-qui-peut', 'va-et-vient', 'je-ne-sais-quoi', "pomme-de-l'air"]
const LEXICAL_RE = new RegExp(`(?:${LEXICAL.map((w) => w.replace(/'/g, "['’]").replace(/-/g, '[-‑]')).join('|')})(?!\\p{L})`, 'iuy')

function at(re: RegExp, text: string, i: number): string | undefined {
  re.lastIndex = i
  const m = re.exec(text)
  return m && m.index === i ? m[0] : undefined
}

/**
 * Extend a word over the hyphens that join a compound (peut-être, grand-mère,
 * dix-sept, quatre-vingt-dix, celui-ci, là-bas), stopping before a hyphen that
 * introduces a pronoun (est-ce, parlez-vous, donne-le-moi, allez-y), the
 * euphonic -t- (a-t-il) or a demonstrative -ci / -là after a noun (ce livre-là).
 */
function extendCompound(text: string, start: number, word: string): string {
  let w = word
  for (;;) {
    const j = start + w.length
    if (!HYPHEN.test(text[j] ?? '') || !/\p{L}/u.test(text[j + 1] ?? '')) return w
    if (at(EUPHONIC_T, text, j) || at(HYPHEN_ELIDED, text, j)) return w
    WORD.lastIndex = j + 1
    const seg = WORD.exec(text)?.[0]
    if (!seg) return w
    const ls = seg.toLowerCase()
    if (HYPHEN_PRONOUNS.has(ls)) {
      // a pronoun-like part inside a longer compound (arc-en-ciel, Aix-en-Provence, Bar-le-Duc) stays joined
      const after = j + 1 + seg.length
      let joined = false
      if (HYPHEN.test(text[after] ?? '')) {
        WORD.lastIndex = after + 1
        const next = WORD.exec(text)?.[0]
        if (next && WORD.lastIndex - next.length === after + 1 && !HYPHEN_PRONOUNS.has(next.toLowerCase()) && !/^[mt]['’]/i.test(next)) joined = true
      }
      if (!joined) return w
    }
    if ((ls === 'ci' || ls === 'là') && !CI_LA_HOSTS.has(w.toLowerCase())) return w
    w = `${w}${text[j]}${seg}`
  }
}

/**
 * Split a text into word, number, space and punctuation tokens. Elisions become
 * two words so each can be looked up ("l'ami" → "l'" + "ami", "qu'il" → "qu'" +
 * "il", "jusqu'à" → "jusqu'" + "à"); aujourd'hui and quelqu'un stay whole.
 * Hyphenated compounds are one word (peut-être, grand-mère, dix-sept), but
 * pronouns after a hyphen are separate words (est-ce que → "est" "-" "ce" "que";
 * a-t-il → "a" "-t-" "il"; donne-le-moi → "donne" "-" "le" "-" "moi").
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const push = (t: string, kind: Token['kind']) => {
    tokens.push({ text: t, start: i, end: i + t.length, kind })
    i += t.length
  }
  while (i < text.length) {
    const wordStart = i === 0 || !/\p{L}/u.test(text[i - 1]!)
    const quoted = i > 0 && /['’]/.test(text[i - 1]!) && (i < 2 || !/\p{L}/u.test(text[i - 2]!))
    let m = wordStart ? at(LEXICAL_RE, text, i) : undefined
    if (m) {
      push(m, 'word')
      continue
    }
    m = wordStart ? at(ELIDED, text, i) : undefined
    if (m) {
      push(m, 'word')
      continue
    }
    m = wordStart && !quoted ? at(ELIDED_SPACE, text, i) : undefined
    if (m) {
      push(m, 'word')
      continue
    }
    m = at(WORD, text, i)
    if (m) {
      push(extendCompound(text, i, m), 'word')
      continue
    }
    m = at(EUPHONIC_T, text, i)
    if (m) {
      push(m, 'punct')
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
