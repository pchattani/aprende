import type { AnswerMatch } from '../types'
import { editDistance } from '../distance'

export { editDistance }

/** Punctuation removed by normalize (apostrophes and hyphens are handled separately: l'ami, aujourd'hui, peut-être). */
const PUNCT = /[.,;:!?¿¡"“”„«»‹›()[\]{}…‐‑–—/\\]+/g
/** Spaces French typography puts before ; : ! ? and inside « » (no-break, narrow no-break, thin). */
const FRENCH_SPACES = /[    ⁠]/g
/** Typographic apostrophes and the marks learners type for one. */
const APOSTROPHES = /[’‘ʼ`´′]/g

/**
 * Words that end in an elided vowel before a vowel: l'ami, j'ai, qu'il, c'est,
 * jusqu'à, lorsqu'il, puisqu'on, quoiqu'il, quelqu'un, presqu'île, aujourd'hui.
 */
export const ELISION_PREFIXES: readonly string[] = ['jusqu', 'lorsqu', 'puisqu', 'quoiqu', 'quelqu', 'presqu', 'aujourd', 'qu', 'l', 'j', 'c', 'ç', 'd', 'n', 's', 'm', 't']
const ELISION_RE = new RegExp(`(^|[^\\p{L}])(${ELISION_PREFIXES.join('|')})'\\s+(?=\\p{L})`, 'giu')

/** Unify apostrophes and French spacing; NFC. */
export function cleanText(text: string): string {
  return text.normalize('NFC').replace(APOSTROPHES, "'").replace(FRENCH_SPACES, ' ')
}

/** œ → oe, æ → ae (cœur and coeur are the same word). */
export function unligature(s: string): string {
  return s.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe').replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
}

/**
 * Remove the marks learners commonly omit: acute, grave, circumflex, diaeresis
 * and the cedilla (é è ê à ç ô î û ë ï ü ÿ), and spell out the ligatures (œ → oe).
 */
export function stripAccents(s: string): string {
  return unligature(s).normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
}

/**
 * Lowercase, apostrophes unified, elisions kept as one word ("l'ami", also when
 * typed "l' ami"), quote marks, hyphens and punctuation dropped (French spaces
 * before ; : ! ? and inside « » too), ligatures spelled out (cœur = coeur),
 * spaces collapsed.
 */
export function normalize(text: string, opts: { accentInsensitive?: boolean } = {}): string {
  let s = unligature(baseNormalize(text).replace(/-/g, ' '))
  s = s.replace(/\s+/g, ' ').trim()
  if (opts.accentInsensitive) s = stripAccents(s)
  return s
}

/** Shared by normalize and words: everything except hyphens and ligatures. */
function baseNormalize(text: string): string {
  let s = cleanText(text).toLowerCase()
  // l' ami → l'ami, qu' il → qu'il
  s = s.replace(ELISION_RE, "$1$2'")
  // apostrophes that are quote marks: not after a letter, or not followed by one
  s = s.replace(/(^|[^\p{L}])'+/gu, '$1 ').replace(/'+(?!\p{L})/gu, ' ')
  // hyphens that are not between two letters are dashes
  s = s.replace(/(?<!\p{L})-+|-+(?!\p{L})/gu, ' ')
  return s.replace(PUNCT, ' ')
}

/**
 * Compare a learner answer with the accepted answers.
 * - exact after normalization -> correct
 * - equal ignoring accents and the cedilla -> almost (reason 'accents')
 * - one typo in a word of 5+ letters, no ending-only change -> almost (reason 'typo')
 */
export function match(given: string, expected: string[]): AnswerMatch {
  const g = normalize(given)
  if (!g) return { verdict: 'wrong', notes: [] }
  for (const e of expected) {
    if (normalize(e) === g) return { verdict: 'correct', matched: e, notes: [] }
  }
  const gNoAcc = stripAccents(g)
  for (const e of expected) {
    const en = normalize(e)
    if (stripAccents(en) === gNoAcc) {
      const diffs = accentDiffs(g, en)
      return { verdict: 'almost', matched: e, reason: 'accents', notes: diffs.map((d) => accentNote(d.given, d.expected)) }
    }
  }
  // Single typo tolerance: compare word by word.
  for (const e of expected) {
    const en = normalize(e)
    const gw = gNoAcc.split(' ')
    const ew = stripAccents(en).split(' ')
    if (gw.length !== ew.length) continue
    let typos = 0
    const notes: string[] = []
    let ok = true
    for (let i = 0; i < gw.length; i++) {
      const a = gw[i]!
      const b = ew[i]!
      if (a === b) continue
      const dist = editDistance(a, b)
      // a different ending is grammar (petit/petite, parle/parles, ami/amis), not a typo
      const finalOnly = a.slice(0, -1) === b.slice(0, -1) || a === b.slice(0, -1) || b === a.slice(0, -1)
      if (dist === 1 && b.length >= 5 && !finalOnly) {
        typos++
        notes.push(`Small typo: “${g.split(' ')[i]}” → “${en.split(' ')[i]}”.`)
      } else {
        ok = false
        break
      }
    }
    if (ok && typos === 1) return { verdict: 'almost', matched: e, reason: 'typo', notes }
  }
  return { verdict: 'wrong', notes: [] }
}

/** Accent note for one word; the homophones that only an accent tells apart get their meaning. */
function accentNote(given: string, expected: string): string {
  const pairs: Record<string, string> = {
    à: '“à” (to, at) takes an accent; “a” means “has”.',
    a: '“a” (has) has no accent; “à” means “to, at”.',
    où: '“où” (where) takes an accent; “ou” means “or”.',
    ou: '“ou” (or) has no accent; “où” means “where”.',
    là: '“là” (there) takes an accent; “la” means “the / her”.',
    sûr: '“sûr” (sure) takes a circumflex; “sur” means “on”.',
    dû: '“dû” (owed, had to) takes a circumflex; “du” means “some / of the”.',
  }
  return pairs[expected] ?? `Watch the accent: “${given}” should be “${expected}”.`
}

export function accentDiffs(given: string, expected: string): { given: string; expected: string }[] {
  const gw = given.split(' ')
  const ew = expected.split(' ')
  const out: { given: string; expected: string }[] = []
  for (let i = 0; i < Math.min(gw.length, ew.length); i++) {
    if (gw[i] !== ew[i]) out.push({ given: gw[i]!, expected: ew[i]! })
  }
  return out
}

/**
 * Words of a sentence suitable for tiles: keeps accents, ligatures, elisions
 * ("l'ami" is one tile) and hyphenated words ("est-ce", "peut-être").
 */
export function words(text: string): string[] {
  return baseNormalize(text).split(/\s+/).filter(Boolean)
}

/**
 * Words with an aspirated h: no elision or liaison before them (le héros, la
 * honte, je hais, ne hurle pas). Matched as word starts.
 */
const H_ASPIRE = [
  'hach', 'haie', 'haill', 'hain', 'haï', 'hair', 'hais', 'hait', 'hall', 'halte', 'hamac', 'hameau', 'hamburger', 'hamster', 'hanche',
  'handball', 'handicap', 'hangar', 'hant', 'happ', 'harangu', 'harcel', 'harcèl', 'hardi', 'hareng', 'haricot', 'harnach', 'harpe',
  'hasard', 'hât', 'hauss', 'haut', 'havre', 'hennir', 'hérisson', 'hériss', 'hernie', 'héron', 'héros', 'hêtre', 'heurt', 'hibou',
  'hiérarchi', 'hippie', 'hiss', 'hobby', 'hoch', 'hockey', 'hollandais', 'hollande', 'homard', 'hongr', 'honnir', 'honte', 'hoquet',
  'hors', 'hot-dog', 'hotte', 'houblon', 'houle', 'houppe', 'housse', 'houx', 'hublot', 'hue', 'hué', 'huer', 'huai', 'huit', 'hurl', 'hutte',
]
/** Words that begin with a vowel letter but take no elision (le onze, la ouate, le oui, le yaourt). */
const NO_ELISION = /^(onze|onzième|oui|ouistiti|ouate|yaourt|yoga|yacht|yack|yak|yéyé|yo-yo|yen|yeti|yéti|yod|yougoslav|yukon|yucca|whisky|week-end|watt|web)/

/** True when a word begins with a vowel sound that causes elision (ami, école, habite, hôtel; not héros, onze, yaourt). */
export function elides(word: string): boolean {
  const w = word.toLowerCase()
  if (NO_ELISION.test(w)) return false
  if (/^[aeiouyàâäéèêëîïôöùûüœæ]/.test(w)) return true
  if (w.startsWith('h')) return !H_ASPIRE.some((p) => w.startsWith(p))
  return false
}
