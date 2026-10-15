/**
 * Spanish number words → digits, so "quince" and "15" compare equal when an
 * answer is graded. Only number phrases are touched; everything else in the
 * text is left exactly as written ("las tres y media" → "las 3 y media").
 *
 * Deliberately conservative: "un"/"una" are never converted (they are usually
 * articles) and a lone "uno" only when it is the whole answer or the tail of a
 * compound ("treinta y uno", "ciento uno").
 */
import { stripAccents } from './normalize'

const UNITS: Record<string, number> = {
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const TENS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
}

const WORD = /\p{L}+/u
const CHUNK = /\p{L}+|[^\p{L}]+/gu

function key(w: string): string {
  return stripAccents(w.toLowerCase())
}

/** True when the text contains a number word (cheap pre-check for graders). */
export function hasNumberWord(text: string): boolean {
  for (const w of text.match(/\p{L}+/gu) ?? []) {
    const k = key(w)
    if (k in UNITS || k in TENS || k in HUNDREDS || k === 'mil' || k === 'millon' || k === 'millones') return true
  }
  return false
}

/** Parse a run of word tokens starting at `i`; returns the value and how many tokens were used, or undefined. */
function parseAt(ws: string[], i: number, whole: boolean): { value: number; used: number } | undefined {
  let total = 0
  let group = 0 // value below 1000 being built
  let hasHundreds = false
  let hasTens = false
  let hasUnits = false
  let sawMil = false
  let any = false
  let j = i
  while (j < ws.length) {
    const k = key(ws[j]!)
    if (k in HUNDREDS) {
      if (hasHundreds || hasTens || hasUnits) break
      group += HUNDREDS[k]!
      hasHundreds = true
      any = true
      j++
      // "cien" is only standalone (cien, cien mil); "ciento" takes a remainder
      if (k === 'cien' && j < ws.length && key(ws[j]!) in UNITS) break
      continue
    }
    if (k in TENS) {
      if (hasTens || hasUnits) break
      group += TENS[k]!
      hasTens = true
      any = true
      j++
      // treinta y cinco
      if (j + 1 < ws.length && key(ws[j]!) === 'y') {
        const u = UNITS[key(ws[j + 1]!)]
        if (u !== undefined && u >= 1 && u <= 9) {
          group += u
          hasUnits = true
          j += 2
        }
      }
      continue
    }
    if (k in UNITS) {
      if (hasTens || hasUnits) break
      if (k === 'uno' && !(any || (whole && ws.length === 1))) break
      if (k === 'cero' && any) break
      group += UNITS[k]!
      hasUnits = true
      any = true
      j++
      if (k === 'cero') break
      continue
    }
    if (k === 'mil') {
      if (sawMil) break
      total += (group || 1) * 1000
      group = 0
      hasHundreds = hasTens = hasUnits = false
      sawMil = true
      any = true
      j++
      continue
    }
    if (k === 'millon' || k === 'millones') {
      if (!any && k === 'millones') break
      total += (group || 1) * 1_000_000
      group = 0
      hasHundreds = hasTens = hasUnits = false
      sawMil = false
      any = true
      j++
      continue
    }
    break
  }
  if (!any) return undefined
  return { value: total + group, used: j - i }
}

/**
 * Replace every Spanish number phrase in `text` with digits. Non-number text,
 * spacing and punctuation are preserved.
 */
export function numberWordsToDigits(text: string): string {
  const chunks = text.match(CHUNK) ?? []
  // Words joined by single spaces form candidate phrases; punctuation breaks them.
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
        // skip the chunks covered by the phrase (words + the spaces between them)
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
