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
let maxLen = Math.max(2, ...[...WORDS.keys()].map((w) => w.length))

/** Add course vocabulary: its readings win over the generic word list. */
export function addWords(entries: Iterable<{ lemma: string; jp?: string }>): void {
  for (const e of entries) {
    if (!e.jp || !HAN.test(e.lemma)) continue
    const lemma = e.lemma.replace(/\s+/g, '')
    if ([...lemma].filter((c) => HAN.test(c)).length !== e.jp.split(' ').length) continue
    WORDS.set(lemma, e.jp)
    maxLen = Math.max(maxLen, lemma.length)
  }
}
export function useVocabulary(entries: Iterable<VocabEntry>): void {
  addWords(entries)
}

export interface Segment {
  text: string
  /** Jyutping syllables (toned) for Han segments and parsed Jyutping; undefined for other text. */
  syl?: string[]
  kind: 'han' | 'jp' | 'latin' | 'num' | 'space' | 'punct'
}

/** Forward maximum matching over a run of Han characters. */
function segmentHan(run: string): Segment[] {
  const out: Segment[] = []
  let i = 0
  while (i < run.length) {
    let hit: string | undefined
    for (let len = Math.min(maxLen, run.length - i); len >= 2; len--) {
      const w = run.slice(i, i + len)
      if (WORDS.has(w)) {
        hit = w
        break
      }
    }
    if (hit) {
      out.push({ text: hit, syl: WORDS.get(hit)!.split(' '), kind: 'han' })
      i += hit.length
    } else {
      const c = run[i]!
      const r = charReadings(c)?.[0]
      out.push({ text: c, syl: r ? [r] : undefined, kind: 'han' })
      i++
    }
  }
  return out
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

/** A vocabulary reading must use, for each character, one of its dictionary readings. */
export function validateReading(lemma: string, jp: string): string[] {
  const chars = [...lemma].filter((c) => HAN.test(c))
  const syl = jp.split(' ')
  if (chars.length !== syl.length) return [`jp “${jp}” has ${syl.length} syllables for ${chars.length} characters`]
  const issues: string[] = []
  chars.forEach((c, i) => {
    const r = charReadings(c)
    if (r && !r.includes(syl[i]!)) issues.push(`${c} is read ${r.join('/')}, not ${syl[i]}`)
  })
  return issues
}
