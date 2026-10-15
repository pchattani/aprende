/**
 * French number words → digits, so "quatre-vingt-dix" and "90" compare equal
 * when an answer is graded. Only number phrases are touched; everything else in
 * the text is left exactly as written ("il est trois heures" → "il est 3 heures").
 *
 * French numbers are phrases of words joined by spaces or hyphens (both the
 * traditional and the 1990 all-hyphen spelling): vingt et un / vingt-et-un,
 * soixante-dix, soixante et onze, quatre-vingts, quatre-vingt-dix-neuf,
 * deux cents, deux cent trois, mille, deux mille vingt-six, un million,
 * trois millions deux cent mille. Belgian and Swiss septante (70), huitante /
 * octante (80) and nonante (90) are understood.
 *
 * Deliberately conservative:
 *  - "un" and "une" are never converted on their own (they are articles) unless
 *    they are the whole answer; inside a number they are fine (vingt et un,
 *    quatre-vingt-une, un million);
 *  - "neuf" is also "new", so a lone "neuf" only counts as nine when it is the
 *    whole answer, follows a word that introduces a number (les neuf, j'ai neuf
 *    ans) or comes before a plural word (neuf heures); "un livre neuf", "quoi de
 *    neuf" stay as they are.
 */
import { stripAccents } from './normalize'

const UNITS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
}
/** 2–9 after a ten (vingt-deux) or before cent (deux cents). */
const DIGIT: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9 }
const TENS: Record<string, number> = { vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, huitante: 80, octante: 80, nonante: 90 }
const MULT: Record<string, number> = { million: 1e6, millions: 1e6, milliard: 1e9, milliards: 1e9 }

/** Words before which "neuf" is a number. */
const NEUF_AFTER: ReadonlySet<string> = new Set([
  'les', 'des', 'ces', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs', 'aux', 'ai', 'as', 'a', 'avons', 'avez', 'ont', 'avait', 'avaient',
  'sont', 'etaient', 'et', 'ou', 'vers', 'environ', 'sur', 'seulement', 'moins', 'plus', 'chapitre', 'page', 'numero', 'dans', 'pres',
])
/** Plural-looking words after "neuf" that do not make it a number. */
const NEUF_NOT_BEFORE: ReadonlySet<string> = new Set(['tous', 'mais', 'puis', 'jamais', 'plus', 'pas', 'vous', 'nous', 'ils', 'elles', 'les', 'des', 'ses', 'mes', 'tes', 'ces', 'dans', 'sous', 'chez', 'apres', 'tres', 'alors', 'toujours', 'parfois', 'depuis', 'pour', 'sur'])

const WORD = /\p{L}+/u
const CHUNK = /\p{L}+|[^\p{L}]+/gu

function key(w: string): string {
  return stripAccents(w.toLowerCase())
}

type Parse = { value: number; used: number }

/** 0–99 starting at ws[i]: dix-sept, vingt et un, soixante-quinze, quatre-vingts, quatre-vingt-dix-neuf, nonante-deux. */
function below100(ws: string[], i: number): Parse | undefined {
  const w = ws[i]
  if (w === undefined) return undefined
  const n1 = ws[i + 1]
  const n2 = ws[i + 2]
  // dix-sept, dix-huit, dix-neuf
  if (w === 'dix' && n1 && (n1 === 'sept' || n1 === 'huit' || n1 === 'neuf')) return { value: 10 + DIGIT[n1]!, used: 2 }
  // 10–19 after soixante / quatre-vingt
  const teen = (j: number): Parse | undefined => {
    const a = ws[j]
    if (a === 'dix' && ws[j + 1] && ['sept', 'huit', 'neuf'].includes(ws[j + 1]!)) return { value: 10 + DIGIT[ws[j + 1]!]!, used: 2 }
    if (a !== undefined && a in UNITS && UNITS[a]! >= 10) return { value: UNITS[a]!, used: 1 }
    return undefined
  }
  // quatre-vingt(s) …
  if (w === 'quatre' && (n1 === 'vingt' || n1 === 'vingts')) {
    if (n1 === 'vingt' && n2 !== undefined) {
      const t = teen(i + 2)
      if (t) return { value: 80 + t.value, used: 2 + t.used }
      if (n2 === 'un' || n2 === 'une') return { value: 81, used: 3 }
      if (n2 in DIGIT) return { value: 80 + DIGIT[n2]!, used: 3 }
    }
    return { value: 80, used: 2 }
  }
  if (w in TENS) {
    const t = TENS[w]!
    if (n1 === 'et' && (n2 === 'un' || n2 === 'une')) return { value: t + 1, used: 3 }
    if (w === 'soixante') {
      if (n1 === 'et' && n2 === 'onze') return { value: 71, used: 3 }
      const tn = teen(i + 1)
      if (tn) return { value: 60 + tn.value, used: 1 + tn.used }
    }
    if (n1 !== undefined && n1 in DIGIT) return { value: t + DIGIT[n1]!, used: 2 }
    return { value: t, used: 1 }
  }
  if (w in UNITS) return { value: UNITS[w]!, used: 1 }
  return undefined
}

/** 0–999 starting at ws[i]: cent, cent un, deux cents, neuf cent quatre-vingt-dix-neuf. */
function below1000(ws: string[], i: number): Parse | undefined {
  const w = ws[i]
  const isCent = (x: string | undefined) => x === 'cent' || x === 'cents'
  let hundreds = 0
  let used = 0
  if (isCent(w)) {
    hundreds = 100
    used = 1
  } else if (w !== undefined && w in DIGIT && isCent(ws[i + 1])) {
    hundreds = DIGIT[w]! * 100
    used = 2
  }
  if (used) {
    const r = ws[i + used] === 'et' ? undefined : below100(ws, i + used)
    // "cent un" is fine; a lone un/une after cent is part of the number too
    if (r) return { value: hundreds + r.value, used: used + r.used }
    return { value: hundreds, used }
  }
  return below100(ws, i)
}

/** A whole number phrase starting at ws[i] (up to 999 999 999 999). */
function parseNumber(ws: string[], i: number): Parse | undefined {
  let total = 0
  let j = i
  let any = false
  for (const [names, mult] of [[['milliard', 'milliards'], 1e9], [['million', 'millions'], 1e6]] as [string[], number][]) {
    const g = below1000(ws, j)
    if (g && names.includes(ws[j + g.used] ?? '')) {
      total += g.value * mult
      j += g.used + 1
      any = true
    }
  }
  // mille, deux mille, cent mille (mil in dates)
  const isMille = (x: string | undefined) => x === 'mille' || x === 'mil'
  if (isMille(ws[j])) {
    total += 1000
    j += 1
    any = true
  } else {
    const g = below1000(ws, j)
    if (g && isMille(ws[j + g.used]) && g.value >= 2) {
      total += g.value * 1000
      j += g.used + 1
      any = true
    }
  }
  // mille et une nuits
  if (any && isMille(ws[j - 1]) && ws[j] === 'et' && (ws[j + 1] === 'un' || ws[j + 1] === 'une')) {
    return { value: total + 1, used: j + 2 - i }
  }
  const rest = below1000(ws, j)
  if (rest) {
    total += rest.value
    j += rest.used
    any = true
  }
  return any ? { value: total, used: j - i } : undefined
}

/** Value of a whole number phrase ("quatre-vingt-dix-sept" → 97), or undefined. */
export function parseNumberWord(text: string): number | undefined {
  const ws = (text.match(/\p{L}+/gu) ?? []).map(key)
  if (!ws.length) return undefined
  const r = parseNumber(ws, 0)
  return r && r.used === ws.length ? r.value : undefined
}

/**
 * Replace every French number phrase in `text` with digits. Non-number text,
 * spacing and punctuation are preserved.
 */
export function numberWordsToDigits(text: string): string {
  const chunks = text.match(CHUNK) ?? []
  const out: string[] = []
  const wordCount = chunks.filter((c) => WORD.test(c)).length
  let i = 0
  while (i < chunks.length) {
    const c = chunks[i]!
    if (!WORD.test(c)) {
      out.push(c)
      i++
      continue
    }
    // the run of words separated only by spaces or hyphens
    const run: string[] = []
    const idx: number[] = []
    let j = i
    while (j < chunks.length) {
      if (WORD.test(chunks[j]!)) {
        run.push(chunks[j]!)
        idx.push(j)
        j++
      } else if (/^[\s‑-]+$/.test(chunks[j]!) && !/[‑-].*[‑-]|[‑-]\s|\s[‑-]/.test(chunks[j]!) && j + 1 < chunks.length && WORD.test(chunks[j + 1]!)) j++
      else break
    }
    const ks = run.map(key)
    let p = 0
    while (p < run.length) {
      const r = accept(ks, p, wordCount === 1)
      if (r) {
        out.push(String(r.value))
        const last = idx[p + r.used - 1]!
        p += r.used
        if (p < run.length) out.push(chunks[last + 1]!)
        continue
      }
      out.push(run[p]!)
      if (p + 1 < run.length) out.push(chunks[idx[p]! + 1]!)
      p++
    }
    i = idx[idx.length - 1]! + 1
  }
  return out.join('')
}

/** A number phrase at p that may be converted (articles and "neuf" = new excluded). */
function accept(ks: string[], p: number, whole: boolean): Parse | undefined {
  const r = parseNumber(ks, p)
  if (!r) return undefined
  if (r.used === 1) {
    const w = ks[p]!
    if ((w === 'un' || w === 'une') && !whole) return undefined
    if (w === 'neuf' && !whole) {
      const prev = ks[p - 1]
      const next = ks[p + 1]
      const plural = next !== undefined && /[sx]$/.test(next) && !NEUF_NOT_BEFORE.has(next)
      if (!(prev !== undefined && NEUF_AFTER.has(prev)) && !plural) return undefined
    }
  }
  return r
}

/** True when the text contains a number word that would be converted (cheap pre-check for graders). */
export function hasNumberWord(text: string): boolean {
  let candidate = false
  for (const w of text.match(/\p{L}+/gu) ?? []) {
    const k = key(w)
    if (k in UNITS || k in TENS || k in MULT || k === 'cent' || k === 'cents' || k === 'mille' || k === 'vingts') {
      candidate = true
      break
    }
  }
  return candidate && numberWordsToDigits(text) !== text
}
