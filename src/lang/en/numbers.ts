/**
 * English number words → digits ("fifteen" → "15", "twenty-one" → "21",
 * "one hundred and five" → "105"). Only number phrases change; "a"/"an" are
 * never converted except directly before hundred/thousand/million.
 */
const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 }

const WORD = /[A-Za-z]+/
const CHUNK = /[A-Za-z]+|[^A-Za-z]+/g

export function hasNumberWordEn(text: string): boolean {
  for (const w of text.match(/[A-Za-z]+/g) ?? []) {
    const k = w.toLowerCase()
    if (k in UNITS || k in TENS || k in SCALES) return true
  }
  return false
}

function parseAt(ws: string[], i: number): { value: number; used: number } | undefined {
  let total = 0
  let group = 0
  let hasTens = false
  let hasUnits = false
  let any = false
  let j = i
  // "a hundred", "a thousand"
  if (ws[j] && ws[j]!.toLowerCase() === 'a' && j + 1 < ws.length && ws[j + 1]!.toLowerCase() in SCALES) {
    group = 1
    any = true
    j++
  }
  while (j < ws.length) {
    const k = ws[j]!.toLowerCase()
    if (k in TENS) {
      if (hasTens || hasUnits) break
      group += TENS[k]!
      hasTens = true
      any = true
      j++
      continue
    }
    if (k in UNITS) {
      if (hasUnits) break
      if (hasTens && (UNITS[k]! === 0 || UNITS[k]! > 9)) break
      if (k === 'zero' && any) break
      group += UNITS[k]!
      hasUnits = true
      any = true
      j++
      if (k === 'zero') break
      continue
    }
    if (k === 'hundred') {
      if (!any || group >= 100) break
      group *= 100
      hasTens = hasUnits = false
      j++
      // optional "and" after hundred when followed by more number words
      if (j + 1 < ws.length && ws[j]!.toLowerCase() === 'and') {
        const n = ws[j + 1]!.toLowerCase()
        if (n in TENS || n in UNITS) j++
      }
      continue
    }
    if (k === 'thousand' || k === 'million') {
      if (!any && group === 0) break
      total += (group || 1) * SCALES[k]!
      group = 0
      hasTens = hasUnits = false
      j++
      if (j + 1 < ws.length && ws[j]!.toLowerCase() === 'and') {
        const n = ws[j + 1]!.toLowerCase()
        if (n in TENS || n in UNITS) j++
      }
      continue
    }
    break
  }
  if (!any) return undefined
  return { value: total + group, used: j - i }
}

/** Replace every English number phrase in `text` with digits; everything else is preserved. */
export function numberWordsToDigitsEn(text: string): string {
  const chunks = text.match(CHUNK) ?? []
  const out: string[] = []
  let i = 0
  while (i < chunks.length) {
    const c = chunks[i]!
    if (!WORD.test(c)) {
      out.push(c)
      i++
      continue
    }
    const run: string[] = []
    const idx: number[] = []
    let j = i
    while (j < chunks.length) {
      if (WORD.test(chunks[j]!)) {
        run.push(chunks[j]!)
        idx.push(j)
        j++
      } else if (/^(\s+|-)$/.test(chunks[j]!) && j + 1 < chunks.length && WORD.test(chunks[j + 1]!)) j++
      else break
    }
    let p = 0
    while (p < run.length) {
      const r = parseAt(run, p)
      if (r && r.used > 0) {
        out.push(String(r.value))
        const last = idx[p + r.used - 1]!
        p += r.used
        if (p < run.length) out.push(chunks[last + 1]!.replace('-', ' '))
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
