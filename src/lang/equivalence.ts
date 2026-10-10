/**
 * Equivalence layer: canonicalises a sentence so that synonyms, regional variants,
 * spelling variants and optional subject pronouns compare equal. Language-agnostic
 * machinery; the groups come from content (synonyms.yaml) and vocabulary variants.
 */
export interface Equivalence {
  /** multi-word phrase (lowercase, single spaces) → canonical form */
  phrases: Map<string, string>
  /** single word → canonical word */
  words: Map<string, string>
  maxPhraseLen: number
}

const WORD_RE = /[\p{L}\p{N}']+/gu

function keyOf(s: string): string {
  return (s.toLowerCase().match(WORD_RE) ?? []).join(' ')
}

export function buildEquivalence(groups: string[][]): Equivalence {
  const phrases = new Map<string, string>()
  const words = new Map<string, string>()
  let maxPhraseLen = 1
  for (const g of groups) {
    const canon = keyOf(g[0] ?? '')
    if (!canon) continue
    for (const form of g) {
      const k = keyOf(form)
      if (!k || k === canon) continue
      const n = k.split(' ').length
      if (n > 1) {
        phrases.set(k, canon)
        maxPhraseLen = Math.max(maxPhraseLen, n)
      } else words.set(k, canon)
    }
  }
  return { phrases, words, maxPhraseLen }
}

/** Subject pronouns Spanish speakers routinely drop; stripped at the start of a clause on both sides. */
const ES_SUBJECTS = new Set(['yo', 'tú', 'tu', 'vos', 'él', 'el', 'ella', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes'])
/** "a mí me gusta" ↔ "me gusta": the emphatic prepositional phrase before an object pronoun is optional. */
const ES_EMPHATIC = new Map<string, string>([['a mí', 'me'], ['a ti', 'te'], ['a él', 'le'], ['a ella', 'le'], ['a usted', 'le'], ['a nosotros', 'nos'], ['a nosotras', 'nos'], ['a vosotros', 'os'], ['a vosotras', 'os'], ['a ellos', 'les'], ['a ellas', 'les'], ['a ustedes', 'les']])
const ES_OBJECT = new Set(['me', 'te', 'le', 'nos', 'os', 'les'])

/**
 * Canonical form of a text for comparison: lowercase words only, phrases and words
 * mapped to their canonical synonym, and (for Spanish) optional subject pronouns dropped.
 */
export function canonicalize(text: string, eq: Equivalence, lang: 'es' | 'en' = 'es'): string {
  let tokens: string[] = [...(text.toLowerCase().match(WORD_RE) ?? [])]
  // Phrase replacement, longest first.
  const out: string[] = []
  for (let i = 0; i < tokens.length; ) {
    let replaced = false
    for (let n = Math.min(eq.maxPhraseLen, tokens.length - i); n >= 2; n--) {
      const k = tokens.slice(i, i + n).join(' ')
      const canon = eq.phrases.get(k)
      if (canon !== undefined) {
        out.push(...canon.split(' '))
        i += n
        replaced = true
        break
      }
    }
    if (!replaced) {
      out.push(eq.words.get(tokens[i]!) ?? tokens[i]!)
      i++
    }
  }
  tokens = out
  if (lang === 'es') tokens = dropOptionalSpanish(tokens)
  return tokens.join(' ')
}

function dropOptionalSpanish(tokens: string[]): string[] {
  if (tokens.length < 2) return tokens
  const t = [...tokens]
  // "a mí me gusta" → "me gusta" (only when the object pronoun follows)
  if (t.length >= 3) {
    const two = `${t[0]} ${t[1]}`
    const obj = ES_EMPHATIC.get(two)
    if (obj && t[2] === obj) t.splice(0, 2)
  }
  // Leading subject pronoun: "yo tengo" → "tengo"; also after "no"? no — keep simple: only clause-initial.
  if (t.length >= 2 && ES_SUBJECTS.has(t[0]!) && !ES_OBJECT.has(t[1]!) && t[1] !== 'y' && t[1] !== 'o' && t[1] !== 'también' && t[1] !== 'tampoco') {
    // Avoid stripping "él" when it is the article "el" (no accent available after lowercasing with accents kept: "el" is a determiner before a noun).
    if (t[0] !== 'el' && t[0] !== 'tu') t.shift()
  }
  return t
}

/** True when two texts are equivalent under the layer. */
export function equivalent(a: string, b: string, eq: Equivalence, lang: 'es' | 'en' = 'es'): boolean {
  return canonicalize(a, eq, lang) === canonicalize(b, eq, lang)
}
