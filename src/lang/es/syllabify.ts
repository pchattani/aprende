/**
 * Spanish syllabification (Castilian conventions).
 *
 * Vowel nuclei: a nucleus holds at most one strong vowel (a, e, o, or any
 * accented vowel) plus unaccented weak vowels (i, u, ü) up to three letters
 * (triphthong). Two strong vowels are a hiatus and split (ca-er, pa-ís).
 * 'h' is transparent for nucleus formation (ahu-mar, a-hí) and attaches to the
 * following syllable as an onset. Word-final 'y' (rey, muy) is a vowel.
 *
 * Consonants between nuclei: 1 -> next; 2 -> both to next if inseparable
 * (pr, br, tr, dr, cr, gr, fr, pl, bl, cl, gl, fl) or a digraph (ch, ll, rr,
 * qu, gu+e/i), else 1|1; 3 -> 1|2 if the last two are inseparable else 2|1;
 * 4 -> 2|2. 'tl' is separable in Spain (at-las).
 */

const VOWELS = new Set('aeiouáéíóúü')
const STRONG = new Set('aeoáéíóú') // accented i/u behave as strong (break diphthongs)
const INSEPARABLE = new Set(['pr', 'br', 'tr', 'dr', 'cr', 'gr', 'fr', 'kr', 'pl', 'bl', 'cl', 'gl', 'fl', 'kl'])

interface Unit {
  text: string
  start: number
  end: number
  vowel: boolean
}

function isVowel(c: string): boolean {
  return VOWELS.has(c)
}

/** Split a lowercase word into letter units (digraphs merged). */
function units(w: string): Unit[] {
  const out: Unit[] = []
  let i = 0
  while (i < w.length) {
    const c = w[i]!
    const n = w[i + 1] ?? ''
    const nn = w[i + 2] ?? ''
    const pair = c + n
    if (pair === 'ch' || pair === 'll' || pair === 'rr') {
      out.push({ text: pair, start: i, end: i + 2, vowel: false })
      i += 2
      continue
    }
    if (pair === 'qu' && 'eiéí'.includes(nn)) {
      out.push({ text: pair, start: i, end: i + 2, vowel: false })
      i += 2
      continue
    }
    if (pair === 'gu' && 'eiéí'.includes(nn)) {
      out.push({ text: pair, start: i, end: i + 2, vowel: false })
      i += 2
      continue
    }
    if (c === 'y') {
      // vowel when final or before a consonant; consonant before a vowel
      const vowel = n === '' || !isVowel(n)
      out.push({ text: c, start: i, end: i + 1, vowel })
      i += 1
      continue
    }
    out.push({ text: c, start: i, end: i + 1, vowel: isVowel(c) })
    i += 1
  }
  return out
}

function isStrong(u: Unit): boolean {
  return STRONG.has(u.text)
}

export function syllabify(word: string): string[] {
  const w = word.normalize('NFC')
  const lower = w.toLowerCase()
  if (!lower) return []
  const us = units(lower)
  // Build nuclei: indices (into us) of vowel groups. 'h' transparent.
  const nuclei: number[][] = []
  let cur: number[] = []
  let strongCount = 0
  const flush = () => {
    if (cur.length) nuclei.push(cur)
    cur = []
    strongCount = 0
  }
  for (let i = 0; i < us.length; i++) {
    const u = us[i]!
    if (!u.vowel) {
      if (u.text === 'h' && cur.length && us[i + 1]?.vowel) continue // transparent h inside a nucleus candidate
      flush()
      continue
    }
    const s = isStrong(u) ? 1 : 0
    const prevIsHSplit = i > 0 && us[i - 1]!.text === 'h' && cur.length > 0
    if (cur.length === 0 || strongCount + s > 1 || cur.length >= 3 || (prevIsHSplit && strongCount + s > 1)) {
      if (cur.length) flush()
    }
    cur.push(i)
    strongCount += s
  }
  flush()
  if (nuclei.length === 0) return [w]
  if (nuclei.length === 1) return [w]

  // Determine boundaries between consecutive nuclei.
  const cuts: number[] = [] // unit indices where a new syllable starts
  for (let k = 0; k < nuclei.length - 1; k++) {
    const endA = nuclei[k]![nuclei[k]!.length - 1]! // last vowel unit of nucleus k
    const startB = nuclei[k + 1]![0]! // first vowel unit of nucleus k+1
    const cons = us.slice(endA + 1, startB) // consonant units between (may include h)
    const n = cons.length
    let cut: number
    if (n === 0) cut = startB
    else if (n === 1) cut = endA + 1
    else if (n === 2) {
      const pair = cons[0]!.text + cons[1]!.text
      cut = INSEPARABLE.has(pair) ? endA + 1 : endA + 2
    } else if (n === 3) {
      const pair = cons[1]!.text + cons[2]!.text
      cut = INSEPARABLE.has(pair) ? endA + 2 : endA + 3
    } else {
      cut = endA + 3 // 2|2 (ins-truir handled since 'tr' inseparable -> n=4 'nstr' -> ins|truir)
      const pair = cons[n - 2]!.text + cons[n - 1]!.text
      if (INSEPARABLE.has(pair)) cut = endA + 1 + (n - 2)
    }
    cuts.push(cut)
  }
  const out: string[] = []
  let prev = 0
  for (const c of cuts) {
    const startChar = us[c]!.start
    out.push(w.slice(prev, startChar))
    prev = startChar
  }
  out.push(w.slice(prev))
  return out.filter((s) => s.length > 0)
}

/** Number of syllables. */
export function syllableCount(word: string): number {
  return syllabify(word).length
}
