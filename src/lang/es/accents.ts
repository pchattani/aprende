/**
 * Spanish stress and written-accent (tilde) rules.
 *
 * 1. If a syllable carries a written accent, it is stressed.
 * 2. Otherwise: words ending in a vowel, -n or -s are stressed on the
 *    penultimate syllable (llanas); all others on the last (agudas).
 * 3. The tilde is written when the stress breaks rule 2:
 *    - agudas ending in vowel/-n/-s (canción, café, jamás)
 *    - llanas ending in a consonant other than -n/-s (árbol, lápiz), or -s
 *      preceded by a consonant (bíceps)
 *    - esdrújulas and sobresdrújulas always (música, dígamelo)
 *    - hiatus: a stressed weak vowel (i/u) next to a strong vowel always
 *      takes a tilde (país, raíz, baúl, oír), whatever the word type.
 *    - monosyllables never, except the diacritic set (sí, más, té, él...).
 */
import { syllabify } from './syllabify'
import { stripAccents } from './normalize'

const ACCENTED = /[áéíóú]/
const WEAK = 'iu'
const STRONG = 'aeo'

export const DIACRITIC_TILDE: Record<string, string> = {
  sí: 'yes / himself (vs si = if)',
  más: 'more (vs mas = but)',
  té: 'tea (vs te = you, object)',
  dé: 'give, subjunctive (vs de = of)',
  sé: 'I know / be! (vs se = pronoun)',
  él: 'he (vs el = the)',
  tú: 'you (vs tu = your)',
  mí: 'me (vs mi = my)',
  qué: 'what? (question/exclamation)',
  quién: 'who? (question)',
  cómo: 'how? (question)',
  cuál: 'which? (question)',
  cuándo: 'when? (question)',
  cuánto: 'how much? (question)',
  dónde: 'where? (question)',
  aún: 'still (= todavía; vs aun = even)',
  ó: 'archaic: o between digits',
}

export type WordType = 'aguda' | 'llana' | 'esdrújula' | 'sobresdrújula'

export interface AccentAnalysis {
  word: string
  syllables: string[]
  /** 0-based index of the stressed syllable. */
  stress: number
  type: WordType
  /** Whether the written form has a tilde. */
  hasTilde: boolean
  /** Whether the stressed syllable must carry a tilde by the rules. */
  needsTilde: boolean
  /** Whether the word as written obeys the rules. */
  valid: boolean
  rule: string
}

function endsVowelNS(w: string): boolean {
  const last = w[w.length - 1]!
  if ('aeiouáéíóúy'.includes(last)) return true
  if (last === 'n') return true
  if (last === 's') {
    const prev = w[w.length - 2] ?? ''
    return 'aeiouáéíóú'.includes(prev) || prev === '' // -s after vowel
  }
  return false
}

function typeFromStress(syllables: string[], stress: number): WordType {
  const fromEnd = syllables.length - 1 - stress
  if (fromEnd === 0) return 'aguda'
  if (fromEnd === 1) return 'llana'
  if (fromEnd === 2) return 'esdrújula'
  return 'sobresdrújula'
}

/** Find stressed syllable of a written word (uses the tilde if present, else default rules). */
export function stressIndex(syllables: string[]): number {
  for (let i = 0; i < syllables.length; i++) if (ACCENTED.test(syllables[i]!)) return i
  if (syllables.length === 1) return 0
  const w = syllables.join('')
  return endsVowelNS(w) ? syllables.length - 2 : syllables.length - 1
}

/** Does the vowel sequence in the stressed syllable form a hiatus needing a tilde (stressed weak vowel next to strong)? */
function hiatusNeedsTilde(word: string, syllables: string[], stress: number): boolean {
  const plain = stripAccents(word)
  // locate the stressed syllable's vowels in plain form
  const stressedSyl = stripAccents(syllables[stress]!)
  const accentedVowelMatch = syllables[stress]!.match(ACCENTED)
  if (!accentedVowelMatch) return false
  const accented = stripAccents(accentedVowelMatch[0])
  if (!WEAK.includes(accented)) return false
  // find position in whole word
  const offset = syllables.slice(0, stress).join('').length
  const idxInSyl = stressedSyl.indexOf(accented)
  const idx = offset + idxInSyl
  const before = plain[idx - 1] ?? ''
  const after = plain[idx + 1] ?? ''
  const nearStrong = STRONG.includes(before) || STRONG.includes(after) || (before === 'h' && STRONG.includes(plain[idx - 2] ?? '')) || (after === 'h' && STRONG.includes(plain[idx + 2] ?? ''))
  return nearStrong
}

export function analyzeAccent(wordIn: string): AccentAnalysis {
  const word = wordIn.normalize('NFC').toLowerCase()
  const syllables = syllabify(word)
  const stress = stressIndex(syllables)
  const type = typeFromStress(syllables, stress)
  const hasTilde = ACCENTED.test(word)
  let needsTilde = false
  let rule = ''

  if (syllables.length === 1) {
    if (hasTilde && DIACRITIC_TILDE[word]) {
      needsTilde = true
      rule = `Monosyllables take no tilde, except to distinguish homonyms: ${word} = ${DIACRITIC_TILDE[word]}.`
    } else {
      needsTilde = false
      rule = 'Monosyllables never take a written accent (except the diacritic set: sí, más, té, él, tú, mí, qué...).'
    }
  } else if (hasTilde && hiatusNeedsTilde(word, syllables, stress)) {
    needsTilde = true
    rule = 'A stressed i or u next to a, e or o is a hiatus and always takes a tilde (pa-ís, ra-íz, ba-úl, o-ír).'
  } else if (type === 'esdrújula' || type === 'sobresdrújula') {
    needsTilde = true
    rule = `Words stressed on the third-from-last syllable or earlier (${type}s) always take a tilde.`
  } else if (type === 'aguda') {
    needsTilde = endsVowelNS(word)
    rule = needsTilde
      ? 'Words stressed on the last syllable (agudas) take a tilde when they end in a vowel, -n or -s.'
      : 'Words stressed on the last syllable (agudas) take no tilde when they end in a consonant other than -n or -s.'
  } else {
    needsTilde = !endsVowelNS(word)
    rule = needsTilde
      ? 'Words stressed on the second-to-last syllable (llanas) take a tilde when they end in a consonant other than -n or -s.'
      : 'Words stressed on the second-to-last syllable (llanas) take no tilde when they end in a vowel, -n or -s.'
  }
  // special: diacritic words are handled above; also question words with tilde (qué, cómo) are in that set.
  if (syllables.length > 1 && hasTilde && DIACRITIC_TILDE[word]) {
    needsTilde = true
    rule = `${word} carries a diacritic tilde: ${DIACRITIC_TILDE[word]}.`
  }
  const valid = hasTilde === needsTilde
  return { word, syllables, stress, type, hasTilde, needsTilde, valid, rule }
}

/**
 * Given the correct written form, explain why it has (or lacks) a tilde.
 */
export function explainAccent(correct: string): string {
  const a = analyzeAccent(correct)
  const syl = a.syllables.map((s, i) => (i === a.stress ? s.toUpperCase() : s)).join('-')
  return `${syl}: ${a.type}. ${a.rule}`
}

/**
 * Given an accent-free word and the character index of its stressed vowel,
 * return the correctly written form (adds a tilde only when the rules require it).
 */
export function placeAccent(plain: string, stressIdx: number): string {
  const map: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }
  const v = plain[stressIdx]
  if (!v || !map[v]) return plain
  const withTilde = plain.slice(0, stressIdx) + map[v] + plain.slice(stressIdx + 1)
  const before = plain[stressIdx - 1] ?? ''
  const after = plain[stressIdx + 1] ?? ''
  // hiatus: stressed weak vowel next to a strong vowel
  if (WEAK.includes(v) && (STRONG.includes(before) || STRONG.includes(after))) return withTilde
  const syls = syllabify(plain)
  if (syls.length === 1) return plain
  let acc = 0
  let k = 0
  for (let i = 0; i < syls.length; i++) {
    acc += syls[i]!.length
    if (stressIdx < acc) {
      k = i
      break
    }
  }
  const fromEnd = syls.length - 1 - k
  const vns = endsVowelNS(plain)
  const needs = fromEnd >= 2 || (fromEnd === 1 && !vns) || (fromEnd === 0 && vns)
  return needs ? withTilde : plain
}

/** Character index of the stressed vowel in a correctly written word. */
export function stressedVowelIndex(word: string): number {
  const syls = syllabify(word.toLowerCase())
  const k = stressIndex(syls)
  const offset = syls.slice(0, k).join('').length
  const syl = syls[k]!
  const acc = syl.search(ACCENTED)
  if (acc >= 0) return offset + acc
  // strong vowel of the syllable, else last vowel
  let strong = -1
  let lastV = -1
  for (let i = 0; i < syl.length; i++) {
    const c = syl[i]!
    if ('aeo'.includes(c) && strong < 0) strong = i
    if ('aeiouy'.includes(c)) lastV = i
  }
  return offset + (strong >= 0 ? strong : lastV)
}
