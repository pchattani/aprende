/**
 * Italian number words → digits, so "quindici" and "15" compare equal when an
 * answer is graded. Only number phrases are touched; everything else in the
 * text is left exactly as written ("sono le tre e mezza" → "sono le 3 e mezza").
 *
 * Italian writes numbers below a million as one word (ventitré, centoventuno,
 * duemilaventisei); millions are separate words (un milione, due milioni).
 *
 * Deliberately conservative:
 *  - "un", "una" are never converted (they are articles), and a lone "uno" only
 *    when it is the whole answer; "un milione" is fine;
 *  - "sei" is also "you are", so it only counts as six when it is the whole
 *    answer, follows a word that introduces a number (le sei, ho sei anni, alle sei)
 *    or comes before a plural noun in -i (sei libri).
 */
import { stripAccents } from './normalize'

const UNITS: Record<string, number> = {
  zero: 0, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19,
}
const DIGITS: Record<string, number> = { uno: 1, un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9 }
const TENS: Record<string, number> = { venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90 }
const MULT: Record<string, number> = { milione: 1e6, milioni: 1e6, miliardo: 1e9, miliardi: 1e9 }

/** Words before which "sei" is a number. */
const SEI_AFTER: ReadonlySet<string> = new Set([
  'le', 'alle', 'dalle', 'delle', 'nelle', 'sulle', 'verso', 'i', 'gli', 'dei', 'ai', 'coi', 'per', 'tra', 'fra', 'di', 'a', 'da', 'in', 'con', 'su',
  'circa', 'quasi', 'solo', 'soltanto', 'almeno', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'aveva', 'avevo', 'sono', 'erano', 'mancano', 'e', 'o',
])
/** Words in -i after "sei" that do not make it a number (sei qui, sei mai stato, sei lui). */
const SEI_NOT_BEFORE: ReadonlySet<string> = new Set(['qui', 'mai', 'lui', 'lei', 'noi', 'voi', 'poi', 'oggi', 'li', 'gli', 'ci', 'vi', 'mi', 'ti', 'si', 'di', 'dei', 'degli', 'ai', 'agli', 'nei', 'negli', 'sui', 'sugli', 'quei', 'quegli', 'cosi', 'si', 'piu', 'pronti', 'stati', 'stanchi'])

const WORD = /\p{L}+/u
const CHUNK = /\p{L}+|[^\p{L}]+/gu

function key(w: string): string {
  return stripAccents(w.toLowerCase())
}

/** 0–99 from one word: diciassette, ventuno, ventitré, trentotto, novantanove. */
function below100(s: string): number | undefined {
  if (s in UNITS) return UNITS[s]
  for (const [t, v] of Object.entries(TENS)) {
    if (s === t) return v
    if (s.startsWith(t)) {
      const d = DIGITS[s.slice(t.length)]
      if (d !== undefined) return v + d // ventitré, ventiotto (lenient)
    }
    const cut = t.slice(0, -1) // vent-, trent-: vowel dropped before uno / otto
    if (s.startsWith(cut) && !s.startsWith(t)) {
      const rest = s.slice(cut.length)
      if (rest === 'uno' || rest === 'un' || rest === 'una') return v + 1
      if (rest === 'otto') return v + 8
    }
  }
  return undefined
}

/** 0–999 from one word: cento, centouno, centottanta, duecentoquaranta. */
function below1000(s: string): number | undefined {
  for (const [d, v] of [['', 1], ...Object.entries(DIGITS).filter(([k]) => k !== 'uno' && k !== 'un' && k !== 'una')] as [string, number][]) {
    for (const h of ['cento', 'cent']) {
      if (!s.startsWith(d + h)) continue
      const rest = s.slice(d.length + h.length)
      if (h === 'cent' && !rest.startsWith('ott')) continue // centottanta, centotto
      if (rest === '') return v * 100
      const r = below100(rest)
      if (r !== undefined) return v * 100 + r
    }
  }
  return below100(s)
}

/** Value of one number word below a million (duemilaventisei → 2026), or undefined. */
export function parseNumberWord(word: string): number | undefined {
  const s = key(word)
  if (!s) return undefined
  if (s === 'mille') return 1000
  if (s.startsWith('mille')) {
    const r = below1000(s.slice(5))
    return r === undefined ? undefined : 1000 + r
  }
  const i = s.indexOf('mila')
  if (i > 0) {
    const left = below1000(s.slice(0, i))
    if (left === undefined || left < 2) return undefined
    const rest = s.slice(i + 4)
    if (!rest) return left * 1000
    const r = below1000(rest)
    return r === undefined ? undefined : left * 1000 + r
  }
  return below1000(s)
}

/** Parse a run of word tokens starting at `i`; returns the value and how many tokens were used, or undefined. */
function parseAt(ws: string[], i: number, whole: boolean): { value: number; used: number } | undefined {
  let total = 0
  let any = false
  let j = i
  while (j < ws.length) {
    const k = key(ws[j]!)
    const next = j + 1 < ws.length ? key(ws[j + 1]!) : undefined
    if (next !== undefined && next in MULT) {
      const v = k === 'un' || k === 'uno' ? 1 : parseNumberWord(k)
      if (v === undefined || (v > 1 && (next === 'milione' || next === 'miliardo'))) break
      total += v * MULT[next]!
      any = true
      j += 2
      // un milione e duecentomila
      if (j + 1 < ws.length && key(ws[j]!) === 'e' && isPlainNumber(key(ws[j + 1]!))) j++
      continue
    }
    if (k === 'un' || k === 'una') break
    if (k === 'uno' && !(whole && ws.length === 1)) break
    if (k === 'sei' && !any && !(whole && ws.length === 1)) {
      const prev = i > 0 && j === i ? key(ws[j - 1]!) : undefined
      const nounAfter = next !== undefined && /i$/.test(next) && !SEI_NOT_BEFORE.has(next)
      if (!(prev !== undefined && SEI_AFTER.has(prev)) && !nounAfter) break
    }
    const v = parseNumberWord(k)
    if (v === undefined) break
    total += v
    any = true
    j++
    break // a one-word number closes the phrase ("tre tre" is two numbers)
  }
  if (!any) return undefined
  return { value: total, used: j - i }
}

function isPlainNumber(k: string): boolean {
  return k !== 'un' && k !== 'una' && k !== 'uno' && parseNumberWord(k) !== undefined
}

/**
 * Replace every Italian number phrase in `text` with digits. Non-number text,
 * spacing and punctuation are preserved.
 */
export function numberWordsToDigits(text: string): string {
  const chunks = text.match(CHUNK) ?? []
  const out: string[] = []
  let i = 0
  const wordCount = chunks.filter((c) => WORD.test(c)).length
  while (i < chunks.length) {
    const c = chunks[i]!
    if (!WORD.test(c)) {
      out.push(c)
      i++
      continue
    }
    // collect the run of words separated only by whitespace
    const run: string[] = []
    const idx: number[] = []
    let j = i
    while (j < chunks.length) {
      if (WORD.test(chunks[j]!)) {
        run.push(chunks[j]!)
        idx.push(j)
        j++
      } else if (/^\s+$/.test(chunks[j]!) && j + 1 < chunks.length && WORD.test(chunks[j + 1]!)) j++
      else break
    }
    let p = 0
    while (p < run.length) {
      const r = parseAt(run, p, wordCount === 1)
      if (r && r.used > 0) {
        out.push(String(r.value))
        const last = idx[p + r.used - 1]!
        p += r.used
        if (p < run.length) out.push(chunks[last + 1]!)
        continue
      }
      out.push(run[p]!)
      const at = idx[p]!
      if (p + 1 < run.length) out.push(chunks[at + 1]!)
      p++
    }
    i = idx[idx.length - 1]! + 1
  }
  return out.join('')
}

/** True when the text contains a number word that would be converted (cheap pre-check for graders). */
export function hasNumberWord(text: string): boolean {
  let candidate = false
  for (const w of text.match(/\p{L}+/gu) ?? []) {
    const k = key(w)
    if (k in MULT || isPlainNumber(k) || k === 'uno') {
      candidate = true
      break
    }
  }
  return candidate && numberWordsToDigits(text) !== text
}
