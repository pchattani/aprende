/**
 * Portuguese number words → digits, so "quinze" and "15" compare equal when an
 * answer is graded. Only number phrases are touched; everything else in the
 * text is left exactly as written ("são três e meia" → "são 3 e meia").
 *
 * Brazilian and European spellings are both read (dezesseis/dezasseis,
 * dezessete/dezassete, dezenove/dezanove, catorze/quatorze), as is the "e"
 * that joins the parts of a number (cento e vinte e três, dois mil e vinte).
 *
 * Deliberately conservative: "um"/"uma" are never converted inside a sentence
 * (they are usually articles), only when they are the whole answer, the tail of
 * a compound ("vinte e um", "cento e uma") or before milhão ("um milhão").
 */
import { stripAccents } from './normalize'

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15,
  dezesseis: 16, dezasseis: 16, dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19,
}
const TENS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 }
const HUNDREDS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800,
  novecentos: 900, novecentas: 900,
}
/** Brazilian short scale (bilhão = 10⁹). */
const LARGE: Record<string, number> = { milhao: 1e6, milhoes: 1e6, bilhao: 1e9, bilhoes: 1e9 }
const ARTICLES = new Set(['um', 'uma'])

const WORD = /\p{L}+/u
const CHUNK = /\p{L}+|[^\p{L}]+/gu

function key(w: string): string {
  return stripAccents(w.toLowerCase())
}

/** True when the text contains a number word (cheap pre-check for graders); um/uma alone do not count. */
export function hasNumberWord(text: string): boolean {
  for (const w of text.match(/\p{L}+/gu) ?? []) {
    const k = key(w)
    if ((k in UNITS && !ARTICLES.has(k)) || k in TENS || k in HUNDREDS || k === 'mil' || k in LARGE) return true
  }
  return false
}

/** Parse a run of word tokens starting at `i`; returns the value and how many tokens were used, or undefined. */
function parseAt(ws: string[], i: number, whole: boolean): { value: number; used: number } | undefined {
  let total = 0
  let group = 0 // value below 1000 being built
  let parts = 0 // components of the current group (cento | vinte | três)
  let hasHundreds = false
  let hasTens = false
  let hasUnits = false
  let closed = false // "cem" takes no remainder
  let sawMil = false
  let any = false
  let afterE = false
  const resetGroup = () => {
    group = 0
    parts = 0
    hasHundreds = hasTens = hasUnits = closed = false
  }
  /** Can number word k follow an "e" here? */
  const canFollow = (k: string): boolean => {
    if (parts === 0) return k in HUNDREDS || k in TENS || k in UNITS // after mil / milhão
    if (closed || hasUnits) return false
    if (hasTens) return k in UNITS && UNITS[k]! >= 1 && UNITS[k]! <= 9
    if (hasHundreds) return k in TENS || (k in UNITS && UNITS[k]! >= 1)
    return false
  }
  let j = i
  while (j < ws.length) {
    const k = key(ws[j]!)
    if (k === 'e') {
      if (!any || afterE || j + 1 >= ws.length || !canFollow(key(ws[j + 1]!))) break
      afterE = true
      j++
      continue
    }
    // inside a group, every part after the first is joined with "e" (cento e vinte, vinte e um)
    const needsE = parts > 0 && !afterE
    if (k in HUNDREDS) {
      if (parts > 0) break
      group += HUNDREDS[k]!
      hasHundreds = true
      closed = k === 'cem'
    } else if (k in TENS) {
      if (hasTens || hasUnits || closed || needsE) break
      group += TENS[k]!
      hasTens = true
    } else if (k in UNITS) {
      const v = UNITS[k]!
      if (hasUnits || closed || needsE || (hasTens && v >= 10)) break
      const next = ws[j + 1] ? key(ws[j + 1]!) : ''
      if (ARTICLES.has(k) && !(afterE || (whole && ws.length === 1) || next in LARGE)) break
      if (k === 'zero' && any) break
      group += v
      hasUnits = true
      if (k === 'zero') {
        any = true
        j++
        break
      }
    } else if (k === 'mil') {
      if (sawMil || afterE) break
      total += (group || 1) * 1000
      resetGroup()
      sawMil = true
      any = true
      j++
      continue
    } else if (k in LARGE) {
      if (afterE || (!any && /oes$/.test(k))) break
      total += (group || 1) * LARGE[k]!
      resetGroup()
      sawMil = false
      any = true
      j++
      continue
    } else break
    parts++
    any = true
    afterE = false
    j++
  }
  if (afterE) j-- // never swallow a trailing "e"
  if (!any) return undefined
  return { value: total + group, used: j - i }
}

/**
 * Replace every Portuguese number phrase in `text` with digits. Non-number text,
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
    // parse greedily from each position in the run
    let p = 0
    while (p < run.length) {
      const r = parseAt(run, p, wordCount === 1)
      if (r && r.used > 0) {
        out.push(String(r.value))
        const last = idx[p + r.used - 1]!
        p += r.used
        if (p < run.length) out.push(chunks[last + 1]!) // separator before next word
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
