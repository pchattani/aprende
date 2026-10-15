/**
 * Cantonese word segmentation and romanisation. Words come from the course
 * vocabulary (lemma + jp), the rime-cantonese word list subset bundled in
 * data/words.json, and proper names; anything else falls back to the most
 * common reading of each character (data/chars.json).
 */
import wordsData from './data/words.json'
import type { VocabEntry } from '../../engine/schema'
import { charReadings, parseRun } from './jyutping'

const HAN = /\p{Script=Han}/u
const WORDS = new Map<string, string>(Object.entries(wordsData as Record<string, string>))
/** Entries of the generic word list with a wrong reading, or phrases that cut across words. */
for (const w of ['打畀你', '打畀', '好冇', '冇女', '快啲啦', '冇時', '我有', '十九', '喺唔喺度', '畀咗你', '係呢']) WORDS.delete(w)
WORDS.set('會唔會', 'wui5 m4 wui5')
/** Course vocabulary: preferred when segmenting. */
const COURSE = new Set<string>()
let maxLen = Math.max(2, ...[...WORDS.keys()].map((w) => w.length))

/**
 * Colloquial readings of characters standing alone, where the dictionary lists the
 * literary reading first (平 peng4 "cheap", 請 ceng2 "treat", 近 kan5 "near") and the
 * usual tones of sentence particles (呀 aa3, 㗎 gaa3, 咪 mai6). Words keep their own readings.
 */
const COLLOQUIAL: Record<string, string> = {
  平: 'peng4', 請: 'ceng2', 近: 'kan5', 着: 'zoek3', 名: 'meng2', 樣: 'joeng2', 會: 'wui5', 輕: 'heng1', 聽: 'teng1', 生: 'saang1',
  青: 'ceng1', 驚: 'geng1', 病: 'beng6', 命: 'meng6', 返: 'faan1', 成: 'seng4', 呀: 'aa3', 咪: 'mai6', 㗎: 'gaa3', 吓: 'haa5',
  位: 'wai2', 相: 'soeng2', 袋: 'doi2',
}

/** Add course vocabulary: its readings win over the generic word list. */
export function addWords(entries: Iterable<{ lemma: string; jp?: string }>): void {
  for (const e of entries) {
    if (!e.jp || !HAN.test(e.lemma)) continue
    const lemma = e.lemma.replace(/\s+/g, '')
    if ([...lemma].filter((c) => HAN.test(c)).length !== e.jp.split(' ').length) continue
    WORDS.set(lemma, e.jp)
    if (lemma.length > 1) COURSE.add(lemma)
    maxLen = Math.max(maxLen, lemma.length)
  }
}
export function useVocabulary(entries: Iterable<VocabEntry>): void {
  addWords(entries)
}

/** Whole-sentence readings authored in the course (sentence `jp`), keyed by the sentence's characters. */
const SENTENCES = new Map<string, string[]>()
const hanKey = (text: string) => [...text.normalize('NFC')].filter((c) => HAN.test(c)).join('')
export function useSentenceReadings(items: Iterable<{ es: string; jp?: string }>): void {
  for (const it of items) {
    if (!it.jp) continue
    const key = hanKey(it.es)
    const syl = it.jp.trim().split(/\s+/)
    if (key && [...key].length === syl.length) SENTENCES.set(key, syl)
  }
}

export interface Segment {
  text: string
  /** Jyutping syllables (toned) for Han segments and parsed Jyutping; undefined for other text. */
  syl?: string[]
  kind: 'han' | 'jp' | 'latin' | 'num' | 'space' | 'punct'
}

/** One-character words that usually stand alone, so ties split next to them (海邊 + 有, 有 + 時間). */
const STANDALONE = new Set([...'有冇係喺我你佢唔都就好嘅咗緊過去嚟同定又再仲會要想識畀等可'])

/**
 * Segment a run of Han characters into the fewest words; ties go to course vocabulary,
 * then to the longer final word (有時間 → 有 + 時間, not 有時 + 間).
 */
function segmentHan(run: string): Segment[] {
  const chars = [...run]
  const n = chars.length
  // best[j]: cost of chars[0..j): 20 per segment, minus 2 per course word, minus 1 for a common one-character word
  const best: number[] = new Array(n + 1).fill(Infinity)
  const back: number[] = new Array(n + 1).fill(0)
  best[0] = 0
  for (let j = 1; j <= n; j++) {
    for (let len = Math.min(maxLen, j); len >= 1; len--) {
      const w = chars.slice(j - len, j).join('')
      if (len > 1 && !WORDS.has(w)) continue
      const cost = best[j - len]! + 20 - (COURSE.has(w) ? 2 : 0) - (len === 1 && STANDALONE.has(w) ? 1 : 0)
      if (cost < best[j]!) {
        best[j] = cost
        back[j] = len
      }
    }
  }
  const out: Segment[] = []
  for (let j = n; j > 0; j -= back[j]!) {
    const w = chars.slice(j - back[j]!, j).join('')
    if (back[j]! > 1) out.push({ text: w, syl: WORDS.get(w)!.split(' '), kind: 'han' })
    else {
      const r = WORDS.get(w) ?? COLLOQUIAL[w] ?? charReadings(w)?.[0]
      out.push({ text: w, syl: r ? [r] : undefined, kind: 'han' })
    }
  }
  return out.reverse()
}

const CHUNK = /(\p{Script=Han}+)|([A-Za-z]+[1-6]?(?:[A-Za-z]+[1-6]?)*)|(\d+(?:[.,]\d+)*)|(\s+)|([^\p{Script=Han}A-Za-z\d\s])/gu

/** Split text into Han words, Jyutping syllables, other Latin words, numbers, spaces and punctuation. */
export function segment(text: string): Segment[] {
  const out: Segment[] = []
  for (const m of text.normalize('NFC').matchAll(CHUNK)) {
    if (m[1]) out.push(...segmentHan(m[1]))
    else if (m[2]) {
      const syl = parseRun(m[2])
      out.push(syl ? { text: m[2], syl, kind: 'jp' } : { text: m[2], kind: 'latin' })
    } else if (m[3]) out.push({ text: m[3], kind: 'num' })
    else if (m[4]) out.push({ text: m[4], kind: 'space' })
    else out.push({ text: m[5]!, kind: 'punct' })
  }
  // 呢 before another word is the demonstrative nei1 (呢位, 呢把); at the end it is the particle ne1
  out.forEach((s, i) => {
    if (s.kind !== 'han' || s.text !== '呢') return
    const next = out.slice(i + 1).find((x) => x.kind !== 'space')
    if (next?.kind === 'han' && !PARTICLES.has(next.text)) s.syl = ['nei1']
  })
  // 吓 after a verb is the suffix haa5 "a bit" (試吓, 行吓); on its own it is the interjection haa2
  out.forEach((s, i) => {
    if (s.kind === 'han' && s.text === '吓' && out[i - 1]?.kind === 'han') s.syl = ['haa5']
  })
  // an authored sentence reading replaces the automatic one, character by character
  const own = SENTENCES.get(hanKey(text))
  if (own) {
    let k = 0
    for (const s of out) if (s.kind === 'han') s.syl = own.slice(k, (k += [...s.text].length))
  }
  return out
}

/** Comparable tokens of a text: toned Jyutping syllables, numbers and other words (lowercase). */
export function toSyllables(text: string): string[] {
  const out: string[] = []
  for (const s of segment(text)) {
    if (s.syl) out.push(...s.syl.map((x) => x.toLowerCase()))
    else if (s.kind === 'han') out.push(s.text)
    else if (s.kind === 'latin' || s.kind === 'num') out.push(s.text.toLowerCase())
  }
  return out
}

/** Words of a text for tiles: Han words as segmented, Latin and numbers as written. */
export function wordsOf(text: string): string[] {
  return segment(text)
    .filter((s) => s.kind === 'han' || s.kind === 'jp' || s.kind === 'latin' || s.kind === 'num')
    .map((s) => s.text)
}

/** Ruby segments: one per character with its syllable when a word's reading lines up, else per word. */
export function romanize(text: string): { text: string; reading?: string }[] {
  const out: { text: string; reading?: string }[] = []
  for (const s of segment(text)) {
    if (s.kind === 'han' && s.syl && s.syl.length === s.text.length) {
      ;[...s.text].forEach((c, i) => out.push({ text: c, reading: s.syl![i] }))
    } else if (s.kind === 'han' && s.syl) out.push({ text: s.text, reading: s.syl.join(' ') })
    else out.push({ text: s.text })
  }
  return out
}

/** Problems that would stop the app from reading a text aloud in Jyutping (characters with no reading). */
export function validateText(text: string): string[] {
  const missing = [...new Set([...text].filter((c) => HAN.test(c) && !charReadings(c)))]
  return missing.length ? [`no Jyutping reading for ${missing.join('')}`] : []
}

/** Colloquial readings the character table lacks: 吓 haa5 is the verbal suffix "a bit" (睇吓), properly 下. */
const EXTRA_READINGS: Record<string, string[]> = { 吓: ['haa5'] }
const PARTICLES = new Set([...'呀啦喇吖咋喎囉啩嘛咩㗎嗎呢噃啊哦喔咯嘅嚟囖噉添'])

/** A vocabulary reading must use, for each character, one of its dictionary readings (or a changed tone). */
export function validateReading(lemma: string, jp: string): string[] {
  const chars = [...lemma].filter((c) => HAN.test(c))
  const syl = jp.split(' ')
  if (chars.length !== syl.length) return [`jp “${jp}” has ${syl.length} syllables for ${chars.length} characters`]
  const issues: string[] = []
  chars.forEach((c, i) => {
    const r = [...(charReadings(c) ?? []), ...(EXTRA_READINGS[c] ?? [])]
    const sy = syl[i]!
    if (!r.length || r.includes(sy)) return
    const base = sy.replace(/[1-6]$/, '')
    const sameBase = r.some((x) => x.replace(/[1-6]$/, '') === base)
    // Changed tones (變調): a syllable may rise to tone 2 or 1 in compounds (陳太 taai2, 膠袋 doi2).
    if (sameBase && /[12]$/.test(sy)) return
    // Reduplicated kin terms lower the first syllable to tone 4 (爸爸 baa4 baa1, 哥哥 go4 go1).
    if (sameBase && /4$/.test(sy) && chars[i + 1] === c) return
    // Sentence-final particles carry many tones (呀 aa1/aa3/aa4, 啦 laa1/laa3).
    if (sameBase && PARTICLES.has(c)) return
    issues.push(`${c} is read ${r.join('/')}, not ${sy}`)
  })
  return issues
}
