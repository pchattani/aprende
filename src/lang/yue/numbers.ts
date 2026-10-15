/**
 * Chinese numerals (characters or Jyutping) → digits, so 十五, sap6 ng5 and 15
 * compare equal. A run is converted only when it contains a digit word (一…九, 兩, 零)
 * or 十/廿, so 萬 in 慢慢 (maan6 maan2) or 萬一 stays untouched.
 */
const DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const UNIT: Record<string, number> = { 十: 10, 廿: 20, 卅: 30, 百: 100, 千: 1000, 萬: 10000, 億: 100000000 }
const JP: Record<string, string> = {
  ling4: '零', jat1: '一', ji6: '二', loeng5: '兩', saam1: '三', sei3: '四', ng5: '五', luk6: '六', cat1: '七', baat3: '八', gau2: '九',
  sap6: '十', jaa6: '廿', saa1: '卅', baak3: '百', cin1: '千', maan6: '萬', jik1: '億',
}
const NUM_CHARS = new RegExp(`[${Object.keys(DIGIT).join('')}${Object.keys(UNIT).join('')}]+`, 'gu')

/** Value of a run of numeral characters (handles 二百五 = 250, 萬五 = 15000, 廿一 = 21). */
export function chineseToNumber(run: string): number | undefined {
  let total = 0
  let section = 0
  let num: number | undefined
  let lastUnit = 0
  for (const c of run) {
    if (c in DIGIT) {
      num = (num ?? 0) * 10 + DIGIT[c]!
      continue
    }
    const u = UNIT[c]
    if (u === undefined) return undefined
    if (u === 20 || u === 30) {
      section += u
      num = undefined
      lastUnit = 10
      continue
    }
    if (u >= 10000) {
      total = (total + section + (num ?? (section ? 0 : 1))) * u
      section = 0
      num = undefined
      lastUnit = u
      continue
    }
    section += (num ?? 1) * u
    num = undefined
    lastUnit = u
  }
  // Abbreviated tail: 二百五 → 250, 三千二 → 3200, 萬五 → 15000
  if (num !== undefined) section += lastUnit >= 100 && run.length >= 2 && !/零/.test(run) ? num * (lastUnit / 10) : num
  return total + section
}

const hasDigitWord = (run: string) => /[零〇一二兩三四五六七八九十廿卅]/.test(run)

export function hasNumberWord(text: string): boolean {
  for (const m of text.matchAll(NUM_CHARS)) if (hasDigitWord(m[0])) return true
  return /\b(ling4|jat1|ji6|loeng5|saam1|sei3|ng5|luk6|cat1|baat3|gau2|sap6|jaa6)\b/.test(text)
}

/** Replace numeral runs (characters, or Jyutping numeral syllables) with digits. */
export function numberWordsToDigits(text: string): string {
  // Jyutping numerals → characters first (only whole syllable runs), then characters → digits.
  const jpRun = /\b((?:ling4|jat1|ji6|loeng5|saam1|sei3|ng5|luk6|cat1|baat3|gau2|sap6|jaa6|saa1|baak3|cin1|maan6|jik1)(?:\s+(?:ling4|jat1|ji6|loeng5|saam1|sei3|ng5|luk6|cat1|baat3|gau2|sap6|jaa6|saa1|baak3|cin1|maan6|jik1))*)\b/g
  const viaChars = text.replace(jpRun, (m) => {
    const chars = m.split(/\s+/).map((s) => JP[s]!).join('')
    return hasDigitWord(chars) ? ` ${chars} ` : m
  })
  return viaChars
    .replace(NUM_CHARS, (run) => {
      if (!hasDigitWord(run)) return run
      const v = chineseToNumber(run)
      return v === undefined ? run : String(v)
    })
    .replace(/\s+/g, ' ')
    .trim()
}
