/**
 * Mini listening pieces, built from content the course already has: every unit
 * dialogue (several speakers, with its authored comprehension questions) and the
 * graded reader texts cut into short passages of a few sentences. Pure and
 * deterministic: the same content always gives the same pieces, ids and quizzes.
 */
import type { Dialogue, LevelId, Question, Reader } from './schema'
import { LEVEL_ORDER } from './schema'
import { Rng, hashString } from './random'
import { words as wordsOf } from '@lang/normalize'

export interface ListenLine {
  /** Who says it (dialogues only). */
  speaker?: string
  /** Target-language text. */
  text: string
  /** English translation. */
  en?: string
  /** How many lines (ending at this one) `en` translates; 1 when omitted. */
  enCovers?: number
}

export interface ListenPiece {
  /** Stable id: `d.<dialogue id>` or `<reader id>.p<n>`. */
  id: string
  kind: 'dialogue' | 'passage'
  level: LevelId
  /** Target-language title. */
  title: string
  /** Part n of a reader text cut into passages. */
  part?: { n: number; of: number }
  /** A short English scene-setter (dialogue context, reader intro on part 1). */
  context?: string
  /** Unit id (dialogues) or reader id (passages). */
  source: string
  lines: ListenLine[]
  /** Speakers in order of first appearance (empty for a narrated passage). */
  speakers: string[]
  /** Authored comprehension questions that cover the whole piece. */
  questions: Question[]
  /** Estimated playing time at normal speed, in seconds. */
  seconds: number
}

/** Dialogues of one unit, as the listening data module provides them. */
export interface UnitDialogues {
  id: string
  dialogues: Dialogue[]
}

const MAX_LINES = 8
const MAX_WORDS = 100
/** A passage keeps growing to this many lines even past MAX_WORDS, so questions have lines to choose from. */
const MIN_LINES = 4
const WORDS_PER_SECOND = 2.2
const GAP_SECONDS = 0.8
/** Longest line a question is asked about. */
const MAX_ASK_WORDS = 32

// ---------------------------------------------------------------------------
// Sentences

const TERMINATORS = new Set(['.', '!', '?', '…', '。', '！', '？'])
const FULL_WIDTH = new Set(['。', '！', '？'])
const OPEN = new Set(['「', '『', '“', '«', '('])
const CLOSE = new Set(['」', '』', '”', '»', ')'])
const ABBREVIATION = /(?:^|[\s(])(?:sr|sra|srta|dr|dra|ud|uds|vd|vds|st|mme|mlle|mr|mrs|ms|dott|sig|prof|av|nº|n\.º|p\.\s?ej|[a-z])$/i

/**
 * Split a paragraph into sentences: after . ! ? … (and 。！？ for Cantonese), keeping
 * closing quotes with their sentence. Never inside quotes, between digits (1.400) or
 * after a common abbreviation (Sr., Dr.), or before a lowercase word.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  const chars = [...text]
  const closer = (c: string | undefined) => c !== undefined && (CLOSE.has(c) || c === '"' || c === "'" || c === '’')
  let depth = 0
  let straight = false
  let start = 0
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!
    if (OPEN.has(c)) depth++
    else if (CLOSE.has(c)) depth = Math.max(0, depth - 1)
    else if (c === '"') straight = !straight
    if (depth > 0 || straight) continue
    // The terminator this position ends with: c itself, or the one before a run of closing quotes.
    let k = i
    while (k > start && closer(chars[k])) k--
    const t = chars[k]!
    if (!TERMINATORS.has(t)) continue
    const next = chars[i + 1]
    if (next !== undefined && (TERMINATORS.has(next) || closer(next))) continue
    const fullWidth = FULL_WIDTH.has(t)
    if (next !== undefined && !fullWidth && !/\s/.test(next)) continue
    if (t === '.' && ABBREVIATION.test(chars.slice(start, k).join(''))) continue
    if (!fullWidth && /^\p{Ll}/u.test(chars.slice(i + 1).join('').trimStart())) continue
    out.push(chars.slice(start, i + 1).join('').trim())
    start = i + 1
  }
  const rest = chars.slice(start).join('').trim()
  if (rest) out.push(rest)
  // A fragment with no words ("(…)") stays with the sentence before it (or after it, at the start).
  const wordy = (s: string) => /[\p{L}\p{N}]/u.test(s)
  const merged: string[] = []
  let lead = ''
  for (const s of out) {
    if (!wordy(s) && merged.length) merged[merged.length - 1] += ` ${s}`
    else if (!wordy(s)) lead += `${s} `
    else {
      merged.push(lead + s)
      lead = ''
    }
  }
  return merged
}

/** Lines of one paragraph: one per sentence, each with its own English where the sentences line up. */
function paragraphLines(es: string, en: string | undefined): ListenLine[] {
  const t = splitSentences(es)
  const e = en ? splitSentences(en) : []
  if (!en) return t.map((text) => ({ text }))
  if (t.length === e.length) return t.map((text, i) => ({ text, en: e[i] }))
  return align(t, e) ?? t.map((text, i) => (i === t.length - 1 ? { text, en, enCovers: t.length } : { text }))
}

/** Sentence beads [target, English] and their cost: one-to-one is free, merges cost a little. */
const BEADS: [number, number, number][] = [[1, 1, 0], [1, 2, 0.002], [2, 1, 0.002], [1, 3, 0.005], [3, 1, 0.005], [2, 2, 0.005]]

/**
 * Line up a paragraph's sentences with its translation's when their counts differ (Gale–Church
 * style, on each sentence's share of the paragraph's length). A target sentence translated by
 * two English ones gets both; two target sentences translated by one share it (enCovers).
 */
function align(t: string[], e: string[]): ListenLine[] | undefined {
  const len = (s: string) => s.replace(/\s+/g, '').length
  const T = t.map(len)
  const E = e.map(len)
  const tt = T.reduce((a, b) => a + b, 0) || 1
  const et = E.reduce((a, b) => a + b, 0) || 1
  const cost: number[][] = t.map(() => [])
  const from: [number, number][][] = t.map(() => [])
  const at = (i: number, j: number) => (i === 0 && j === 0 ? 0 : (cost[i - 1]?.[j] ?? Infinity))
  for (let i = 0; i <= t.length; i++) {
    for (let j = 0; j <= e.length; j++) {
      if (i === 0) continue
      let best = Infinity
      let step: [number, number] = [0, 0]
      for (const [a, b, pen] of BEADS) {
        if (a > i || b > j) continue
        const prev = at(i - a, j - b)
        if (prev === Infinity) continue
        const x = T.slice(i - a, i).reduce((s, n) => s + n, 0) / tt
        const y = E.slice(j - b, j).reduce((s, n) => s + n, 0) / et
        const c = prev + (x - y) ** 2 + pen
        if (c < best) {
          best = c
          step = [a, b]
        }
      }
      cost[i - 1]![j] = best
      from[i - 1]![j] = step
    }
  }
  if (at(t.length, e.length) === Infinity) return undefined
  const beads: [number, number][] = []
  for (let i = t.length, j = e.length; i > 0; ) {
    const [a, b] = from[i - 1]![j]!
    beads.unshift([a, b])
    i -= a
    j -= b
  }
  const out: ListenLine[] = []
  let i = 0
  let j = 0
  for (const [a, b] of beads) {
    const text = e.slice(j, j + b).join(' ')
    for (let k = 0; k < a; k++) out.push(k === a - 1 ? (a > 1 ? { text: t[i + k]!, en: text, enCovers: a } : { text: t[i + k]!, en: text }) : { text: t[i + k]! })
    i += a
    j += b
  }
  return out
}

function lineWords(l: ListenLine): number {
  return wordsOf(l.text).length
}

/** Playing time at normal speed, rounded to 5 seconds. */
export function estimateSeconds(lines: ListenLine[]): number {
  const s = lines.reduce((n, l) => n + Math.max(1.2, lineWords(l) / WORDS_PER_SECOND) + GAP_SECONDS, 0)
  return Math.max(5, Math.round(s / 5) * 5)
}

/** "~40 s", "~2 min". */
export function formatDuration(seconds: number): string {
  return seconds < 60 ? `~${seconds} s` : `~${Math.round(seconds / 60)} min`
}

// ---------------------------------------------------------------------------
// Pieces

function speakersOf(lines: ListenLine[]): string[] {
  return [...new Set(lines.map((l) => l.speaker).filter((s): s is string => Boolean(s)))]
}

export function dialoguePiece(d: Dialogue, unitId: string): ListenPiece {
  const lines = d.lines.map((l) => ({ speaker: l.speaker, text: l.es, en: l.en }))
  return {
    id: `d.${d.id}`, kind: 'dialogue', level: unitId.split('.')[0] as LevelId, title: d.title, context: d.context, source: unitId,
    lines, speakers: speakersOf(lines), questions: d.questions, seconds: estimateSeconds(lines),
  }
}

/**
 * Cut a reader text into passages of whole paragraphs (at most 8 sentences and about 80
 * words each; a longer paragraph whose sentences line up is cut too). A short text stays
 * one piece and keeps its authored questions.
 */
export function readerPieces(r: Reader): ListenPiece[] {
  const groups: ListenLine[][] = []
  let cur: ListenLine[] = []
  const words = (ls: ListenLine[]) => ls.reduce((n, l) => n + lineWords(l), 0)
  const flush = () => {
    if (cur.length) groups.push(cur)
    cur = []
  }
  for (const p of r.paragraphs) {
    const lines = paragraphLines(p.es, p.en)
    if (!lines.length) continue
    const chunks: ListenLine[][] = []
    if (lines.length > MAX_LINES && !lines.some((l) => l.enCovers)) {
      const n = Math.ceil(lines.length / MAX_LINES)
      const size = Math.ceil(lines.length / n)
      for (let i = 0; i < lines.length; i += size) chunks.push(lines.slice(i, i + size))
    } else chunks.push(lines)
    for (const c of chunks) {
      if (cur.length && (cur.length + c.length > MAX_LINES + (cur.length < MIN_LINES ? 2 : 0) || (cur.length >= MIN_LINES && words(cur) + words(c) > MAX_WORDS))) flush()
      cur.push(...c)
    }
  }
  flush()
  // A one-line passage (a very long sentence) joins its neighbour, and so does a tiny last passage.
  for (let i = groups.length - 1; i >= 0 && groups.length > 1; i--) {
    const g = groups[i]!
    const last = i === groups.length - 1
    if (g.length >= 2 && !(last && g.length < 3 && groups[i - 1]!.length + g.length <= MAX_LINES + 3)) continue
    if (i > 0) groups[i - 1]!.push(...groups.splice(i, 1)[0]!)
    else groups[1]!.unshift(...groups.splice(0, 1)[0]!)
  }
  return groups.map((lines, i) => ({
    id: `${r.id}.p${i + 1}`, kind: 'passage', level: r.level, title: r.title, part: groups.length > 1 ? { n: i + 1, of: groups.length } : undefined,
    context: i === 0 ? r.intro : undefined, source: r.id, lines, speakers: [], questions: groups.length === 1 ? r.questions : [], seconds: estimateSeconds(lines),
  }))
}

/** Every listening piece of the course: by level, then the stop's dialogue, then the reader texts' passages. */
export function buildListening(readers: Reader[], units: UnitDialogues[]): ListenPiece[] {
  const out: ListenPiece[] = []
  const sortedUnits = [...units].sort((a, b) => a.id.localeCompare(b.id))
  const sortedReaders = [...readers].sort((a, b) => a.id.localeCompare(b.id))
  for (const level of LEVEL_ORDER) {
    for (const u of sortedUnits) {
      if (!u.id.startsWith(`${level}.`)) continue
      for (const d of u.dialogues) if (d.lines.length >= 2 && speakersOf(d.lines.map((l) => ({ speaker: l.speaker, text: l.es }))).length >= 2) out.push(dialoguePiece(d, u.id))
    }
    for (const r of sortedReaders) if (r.level === level) out.push(...readerPieces(r))
  }
  return out
}

// ---------------------------------------------------------------------------
// Questions

export interface ListenQuestion {
  kind: 'authored' | 'who' | 'meaning'
  prompt: string
  options: string[]
  answer: number
  explain?: string
  /** Index of the line the question is about (play it again from the question). */
  line?: number
  /** How many lines from `line` the question covers (1 when omitted). */
  span?: number
}

export interface ListenQuiz {
  questions: ListenQuestion[]
  /** One short line to type from memory of the audio. */
  dictation?: { line: number; text: string }
}

export function quizSeed(id: string, attempt: number): number {
  return hashString(`listen:${id}:${attempt}`)
}

function gist(en: string): Set<string> {
  return new Set(en.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(' ').filter((w) => w.length > 2))
}
/** Two English lines say much the same thing (keeps distractors clearly wrong). */
function tooClose(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true
  const A = gist(a)
  const B = gist(b)
  if (!A.size || !B.size) return false
  const shared = [...A].filter((w) => B.has(w)).length
  return shared / new Set([...A, ...B]).size >= 0.5
}

function authored(q: Question, rng: Rng): ListenQuestion | undefined {
  if (q.answer >= q.options.length || new Set(q.options).size !== q.options.length) return undefined
  const order = rng.shuffle(q.options.map((_, i) => i))
  return { kind: 'authored', prompt: q.q, options: order.map((i) => q.options[i]!), answer: order.indexOf(q.answer), explain: q.explain }
}

/** A stretch of the piece with one English translation: a line, or the lines a paragraph translation covers. */
interface Segment {
  line: number
  span: number
  en: string
}
function segments(p: ListenPiece): Segment[] {
  return p.lines.flatMap((l, i) => (l.en ? [{ line: i - (l.enCovers ?? 1) + 1, span: l.enCovers ?? 1, en: l.en }] : []))
}

/** Segments worth asking about: a sensible length, said once in the piece. */
function askable(p: ListenPiece, maxWords = MAX_ASK_WORDS): Segment[] {
  return segments(p).filter((g) => {
    const ls = p.lines.slice(g.line, g.line + g.span)
    const n = ls.reduce((k, l) => k + lineWords(l), 0)
    return n >= 2 && n <= maxWords && ls.every((l) => p.lines.filter((o) => o.text === l.text).length === 1)
  })
}

function meaning(p: ListenPiece, g: Segment, rng: Rng, backup: string[]): ListenQuestion | undefined {
  const others: string[] = []
  for (const list of [segments(p).filter((x) => x.line !== g.line).map((x) => x.en), backup]) {
    for (const o of rng.shuffle(list)) {
      if (others.length >= 3) break
      if (tooClose(o, g.en) || others.some((x) => tooClose(x, o))) continue
      others.push(o)
    }
  }
  if (others.length < 2) return undefined
  const options = rng.shuffle([g.en, ...others])
  return { kind: 'meaning', prompt: g.span > 1 ? 'What do the lines you heard mean?' : 'What does the line you heard mean?', options, answer: options.indexOf(g.en), line: g.line, span: g.span > 1 ? g.span : undefined }
}

/** `text` mentions the name (as a whole word; anywhere for names written in characters). */
function names(text: string, name: string): boolean {
  if (/\p{Script=Han}/u.test(name)) return text.includes(name)
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{Script=Latin}])${esc}($|[^\\p{Script=Latin}])`, 'iu').test(text)
}

function who(p: ListenPiece, g: Segment, rng: Rng): ListenQuestion | undefined {
  const i = g.line
  const line = p.lines[i]!
  if (g.span !== 1 || !line.speaker || !line.en || p.speakers.length < 2) return undefined
  // A line that names a speaker gives the answer away.
  const said = `${line.text} ${line.en}`
  if (p.speakers.some((s) => names(said, s))) return undefined
  const options = rng.shuffle([line.speaker, ...rng.sample(p.speakers.filter((s) => s !== line.speaker), 2)])
  return { kind: 'who', prompt: `Who said “${line.en}”?`, options, answer: options.indexOf(line.speaker), line: i }
}

/** A short line (2–7 words, ideally 3–6) to write down. */
function pickDictation(p: ListenPiece, rng: Rng): ListenQuiz['dictation'] {
  const idx = p.lines.map((_, i) => i).filter((i) => p.lines.filter((o) => o.text === p.lines[i]!.text).length === 1)
  const n = (i: number) => lineWords(p.lines[i]!)
  const ideal = idx.filter((i) => n(i) >= 3 && n(i) <= 6)
  const ok = idx.filter((i) => n(i) >= 2 && n(i) <= 7)
  const pool = ideal.length ? ideal : ok.length ? ok : [...idx].sort((a, b) => n(a) - n(b)).slice(0, 1)
  if (!pool.length) return undefined
  const line = rng.pick(pool)
  return { line, text: p.lines[line]!.text }
}

/**
 * The quiz after listening: the piece's own questions when it has them, otherwise up to
 * three generated ones (who said…? / what does the line mean?, each on a different line),
 * plus a dictation of one short line. `backup` is extra English for distractors (the other
 * passages of the same text). Deterministic for a piece, attempt and backup.
 */
export function buildQuiz(p: ListenPiece, attempt = 0, backup: string[] = []): ListenQuiz {
  const rng = new Rng(quizSeed(p.id, attempt))
  const questions = p.questions.map((q) => authored(q, rng)).filter((q): q is ListenQuestion => Boolean(q))
  if (!questions.length) {
    // Dialogues alternate who-said and meaning questions (a kind that can't be asked on a line waits for the next one).
    const dialogue = p.speakers.length >= 2
    let want: 'who' | 'meaning' = dialogue && rng.int(2) === 0 ? 'who' : 'meaning'
    const used = new Set<number>()
    // Short lines first; long literary sentences only when the piece has nothing shorter.
    for (const limit of [MAX_ASK_WORDS, Infinity]) {
      for (const g of rng.shuffle(askable(p, limit))) {
        if (questions.length >= 3 || used.has(g.line)) continue
        const q = want === 'who' ? who(p, g, rng) ?? meaning(p, g, rng, backup) : meaning(p, g, rng, backup) ?? (dialogue ? who(p, g, rng) : undefined)
        if (!q) continue
        questions.push(q)
        used.add(g.line)
        if (dialogue && q.kind === want) want = want === 'who' ? 'meaning' : 'who'
      }
      if (questions.length >= 2) break
    }
  }
  return { questions, dictation: pickDictation(p, rng) }
}

/** English of the other pieces from the same source (distractors for a short passage). */
export function siblingEnglish(p: ListenPiece, all: ListenPiece[]): string[] {
  return all.filter((o) => o.source === p.source && o.id !== p.id).flatMap((o) => o.lines.flatMap((l) => (l.en ? [l.en] : [])))
}

// ---------------------------------------------------------------------------
// Results

/** Saved in kv `listen:<id>`. Scores are fractions (0–1). */
export interface ListenRecord {
  best: number
  last: number
  /** Day of the last attempt (YYYY-MM-DD). */
  date: string
  attempts: number
}

export const LISTEN_KV = 'listen:'
export const listenKey = (id: string): string => `${LISTEN_KV}${id}`
/** A piece counts as done at this score. */
export const LISTEN_PASS = 0.6
