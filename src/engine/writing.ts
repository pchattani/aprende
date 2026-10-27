/**
 * Scores a learner's free writing for a stop's writing prompt (schema WritingPrompt): spelling,
 * grammar, task accuracy and vocabulary, each 0–100, an overall score and a 1–3 stamp, with
 * issues anchored to spans of the text for highlighting. No AI and no server: the course
 * dictionary (vocabulary + inflections + known.yaml), the language pack's checker
 * (agreement, verb person, learner-error rules) and a few mechanics rules.
 *
 * Built to stay quiet on correct writing: only words that cannot be found in any form are
 * spelling issues; a word with a near neighbour is a typo, any other unknown word only a
 * "check"; checker findings are kept only for codes the packs are precise about, never
 * inside a dictionary word, and every grammar flag is phrased "Check: …".
 *
 * Pure: the language pack comes in through `WritingLang` (src/hooks/useWriting.ts binds
 * @lang for the app; tests and scripts bind any pack), so one engine scores every course.
 */
import type { Token, CheckerFinding } from '../lang/types'
import { LEVEL_ORDER, type LevelId, type VocabEntry, type WritingPrompt } from './schema'
import { contentRegExp } from '../lang/wordBoundary'

// ---------------------------------------------------------------------------
// Inputs

export interface WritingLang {
  /** Pack id: es, pt, it, fr, yue. */
  id: string
  tokenize(text: string): Token[]
  /** Remove accents (tones for Cantonese). */
  stripAccents(s: string): string
  /** Dictionary lookup of a surface form (clitics, elisions, Jyutping…), bound to the course dictionary. */
  lookup(form: string): VocabEntry[] | undefined
  /** The pack's writing checker, bound to the dictionary, the learner-error rules and the verbs. */
  check(text: string): CheckerFinding[]
  /** Every surface form of the dictionary (its keys), for spelling suggestions. */
  forms: Iterable<string>
  /** Cantonese: false for a character the course cannot read (simplified or rare characters). */
  hasReading?(char: string): boolean
}

export interface WritingData {
  vocab: ReadonlyMap<string, VocabEntry>
  /** known.yaml: function words known at every level and proper nouns. */
  known: { always: Iterable<string>; names: Iterable<string> }
  /** More correct words outside the vocabulary: readers' glossaries and allowed words. */
  extra?: Iterable<string>
}

export interface ScoreOptions {
  /** The stop's level: words above it are "ambitious". */
  level: LevelId
  /** Ids of the words the stop's lessons teach. */
  unitWords?: ReadonlySet<string>
  /** The learner has seen the model answer: copying it no longer counts as their own writing. */
  seenModel?: boolean
}

// ---------------------------------------------------------------------------
// Results

export type WritingCategory = 'task' | 'grammar' | 'spelling' | 'vocabulary'
export const WRITING_CATEGORIES: readonly WritingCategory[] = ['task', 'grammar', 'spelling', 'vocabulary']
/** Weights of the overall score. */
export const WRITING_WEIGHTS: Record<WritingCategory, number> = { task: 0.35, grammar: 0.3, spelling: 0.2, vocabulary: 0.15 }
/** A prompt counts as done (coins, the stop's progress) from this overall score. */
export const WRITING_PASS = 60

export interface WritingIssue {
  category: 'spelling' | 'grammar'
  /** typo | unknown | accent | english | script | simplified | agreement | verb-agreement | learner-error | article | auxiliary | elision | capital | end-punct | inverted | question-mark */
  code: string
  severity: 'major' | 'minor'
  start: number
  end: number
  message: string
  suggestion?: string
  /** The suggestion can replace text[start, end) as it is. */
  safe?: boolean
  /** Grammar note id for "learn more". */
  grammar?: string
}

export interface WritingResult {
  overall: number
  /** 0 (not yet) to 3: the stamp. */
  stars: 0 | 1 | 2 | 3
  scores: Record<WritingCategory, number>
  /** Span issues (spelling and grammar), in text order. */
  issues: WritingIssue[]
  /** Short notes per category (what lowered it, what to add). */
  notes: Record<WritingCategory, string[]>
  task: {
    length: number
    unit: 'words' | 'characters'
    min: number
    max: number
    /** `use` ids found in the text, and how many were expected. */
    used: string[]
    missing: string[]
    useNeed: number
    /** Index of each `expect` that matched. */
    expectMet: number[]
    english: boolean
    copied: boolean
  }
  vocabulary: {
    /** Distinct content lemmas / content tokens. */
    variety: number
    /** Share of known content words at or below the stop's level. */
    levelFit: number
    /** Lemmas above the level (fine: noted as ambitious). */
    ambitious: string[]
    /** Lemmas of the stop's words used. */
    unitWords: string[]
  }
  /** "What went well" bullets. */
  wentWell: string[]
}

// ---------------------------------------------------------------------------
// Language profiles

interface Profile {
  script: 'latin' | 'han'
  /** A spelling-by-ear key (Spanish yama = llama, aser = hacer) for suggestions edit distance misses. */
  phonetic?: (w: string) => string
  /** Spanish ¿…? ¡…! */
  inverted: boolean
  /** Checker codes kept as grammar issues (the packs are precise about these). */
  grammarCodes: ReadonlySet<string>
}
const LATIN_CODES = new Set(['agreement', 'verb-agreement', 'learner-error', 'article', 'auxiliary', 'elision'])
const PROFILES: Record<string, Profile> = {
  es: { script: 'latin', inverted: true, grammarCodes: LATIN_CODES, phonetic: spanishSound },
  pt: { script: 'latin', inverted: false, grammarCodes: LATIN_CODES },
  it: { script: 'latin', inverted: false, grammarCodes: LATIN_CODES },
  fr: { script: 'latin', inverted: false, grammarCodes: LATIN_CODES },
  yue: { script: 'han', inverted: false, grammarCodes: new Set(['agreement', 'learner-error']) },
}
const profileOf = (id: string): Profile => PROFILES[id] ?? PROFILES.es!

/** How a Spanish word sounds, roughly: the letters learners mix up because they sound alike (ll/y, b/v, c/z/s, silent h). */
function spanishSound(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/n\u0303/g, 'ñ')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ch/g, 'C')
    .replace(/h/g, '')
    .replace(/ll/g, 'y')
    .replace(/y$/, 'i')
    .replace(/v/g, 'b')
    .replace(/z/g, 's')
    .replace(/c([ei])/g, 's$1')
    .replace(/qu([ei])/g, 'k$1')
    .replace(/g([ei])/g, 'j$1')
    .replace(/gu([ei])/g, 'g$1')
    .replace(/c/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/(.)\1+/g, '$1')
}

/**
 * Common English words that are not words of the course languages: two or more of them, making up a
 * good part of the text, mean the answer was written in English. A word that is also in the course
 * dictionary (Spanish "me", French "a") never counts.
 */
const ENGLISH = new Set(
  ('the a an and or but is are was were be been am i you he she it we they my your his her its our their this that these those ' +
    'there here what where when who why how which with without from for of on in at to into about after before because so very ' +
    'have has had do does did not no yes like love want need go going went come get got make made can could will would should ' +
    'my me him them us name live lives living work works working friend friends family house home city day today tomorrow yesterday ' +
    'morning evening night week weekend year good bad big small new old nice happy sad hello hi thanks thank please sorry ' +
    'eat drink coffee tea water food breakfast lunch dinner school teacher student brother sister mother father mum mom dad ' +
    'every always never sometimes usually often then also too much many some any all one two three four five six seven eight nine ten').split(' '),
)

/** Simplified characters learners type by accident, with their traditional form. */
const TRADITIONAL: Record<string, string> = Object.fromEntries(
  ('这這 们們 吗嗎 说說 个個 么麼 来來 时時 会會 对對 没沒 还還 过過 后後 发發 点點 里裏 车車 东東 话話 钱錢 买買 卖賣 饭飯 学學 书書 ' +
    '见見 门門 问問 间間 机機 电電 视視 爱愛 欢歡 听聽 写寫 读讀 认認 识識 让讓 谁誰 给給 红紅 长長 开開 关關 难難 边邊 远遠 运運 动動 ' +
    '场場 医醫 体體 头頭 脑腦 气氣 热熱 风風 鸡雞 鱼魚 鸟鳥 马馬 猫貓 叶葉 园園 国國 华華 语語 汉漢 广廣 万萬 两兩 几幾 岁歲 号號 ' +
    '节節 现現 实實 样樣 张張 条條 区區 楼樓 层層 厅廳 应應 该該 觉覺 乐樂 饮飲 汤湯 面麵 饺餃 虾蝦 猪豬 记記 银銀 铁鐵 飞飛 线線 ' +
    '网網 页頁 馆館 图圖 游遊 戏戲 双雙 只隻 价價 贵貴 钟鐘 裤褲 袜襪 帮幫 别別 请請 谢謝 错錯 讲講 报報 纸紙 笔筆 课課 题題 ' +
    '试試 词詞 阅閱 习習 练練 杂雜 简簡 单單 业業 务務 员員 经經 办辦 处處 从從 进進 选選 为為 鸭鴨 烧燒 饱飽 饿餓 爷爺 妈媽 ' +
    '儿兒 孙孫 亲親 们們 邻鄰 师師 们們 农農 厂廠 店店 宝寶 灯燈 窗窗 庙廟 桥橋 岛島 湾灣 闹鬧 静靜 脏髒 干乾 净淨 坏壞 满滿 ' +
    '轻輕 重重 紧緊 松鬆 鲜鮮 盐鹽 酱醬 粮糧 鸡雞 蛋蛋 苹蘋 叶葉 兰蘭 晚晚 钟鐘 历曆 周週 礼禮 拜拜 们們').split(' ').filter((p) => [...p].length === 2).map((p) => [...p] as [string, string]),
)

// ---------------------------------------------------------------------------
// The kit: indexes built once per course dictionary

export interface WritingKit {
  lang: WritingLang
  profile: Profile
  vocab: ReadonlyMap<string, VocabEntry>
  always: ReadonlySet<string>
  names: ReadonlySet<string>
  /** Accentless form → dictionary forms. */
  plain: Map<string, string[]>
  /** Accentless forms by length, for bounded edit-distance search. */
  byLength: Map<number, string[]>
  /** How common a form is (lower = better suggestion). */
  formRank: Map<string, number>
  /** English gloss → target lemma, for "that's English" suggestions. */
  gloss: Map<string, string>
  /** Sound key → forms (languages with a `phonetic` profile). */
  sounds: Map<string, string[]>
  /** Stems of dictionary forms (Romance languages): an unknown form of a known stem (luoghi) is not a typo. */
  stems: Set<string>
  /** Words that are correct though not dictionary forms: parts of multi-word and hyphenated lemmas (rés-do-chão, saia justa), glossary words. */
  extra: Set<string>
}

export function makeWritingKit(lang: WritingLang, data: WritingData): WritingKit {
  const plain = new Map<string, string[]>()
  const formRank = new Map<string, number>()
  for (const form of lang.forms) {
    if (!form || /\s/.test(form)) continue
    const p = lang.stripAccents(form.toLowerCase())
    const list = plain.get(p)
    if (list) {
      if (!list.includes(form)) list.push(form)
    } else plain.set(p, [form])
    const entries = lang.lookup(form) ?? []
    formRank.set(form, Math.min(...entries.map((e) => LEVEL_ORDER.indexOf(e.level) * 100000 + (e.rank ?? 50000)), 1e9))
  }
  for (const list of plain.values()) list.sort((a, b) => (formRank.get(a) ?? 1e9) - (formRank.get(b) ?? 1e9))
  const byLength = new Map<number, string[]>()
  for (const p of plain.keys()) {
    const n = [...p].length
    const list = byLength.get(n)
    if (list) list.push(p)
    else byLength.set(n, [p])
  }
  const profile = profileOf(lang.id)
  const sounds = new Map<string, string[]>()
  if (profile.phonetic) {
    for (const list of plain.values()) {
      for (const form of list) {
        const k = profile.phonetic(form)
        const l = sounds.get(k)
        if (l) l.push(form)
        else sounds.set(k, [form])
      }
    }
  }
  const gloss = new Map<string, string>()
  const sorted = [...data.vocab.values()].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || (a.rank ?? 50000) - (b.rank ?? 50000))
  for (const e of sorted) {
    for (const en of e.en) {
      const k = en.toLowerCase().replace(/^to /, '').replace(/\(.*?\)/g, '').trim()
      if (/^[a-z]+$/.test(k) && !gloss.has(k)) gloss.set(k, e.lemma)
    }
  }
  const extra = new Set<string>()
  const addParts = (w: string) => {
    for (const part of w.toLowerCase().split(/[\s\-‑–]+/)) {
      const x = part.replace(/^[¿¡«“"'(]+|[.,;:!?»”"')…]+$/g, '')
      if (x) extra.add(x)
    }
  }
  for (const form of lang.forms) if (/[\s-]/.test(form)) addParts(form)
  for (const e of data.vocab.values()) if (/[\s-]/.test(e.lemma)) addParts(e.lemma)
  for (const w of data.extra ?? []) addParts(w)
  const stems = new Set<string>()
  if (ENDINGS[lang.id]) for (const p of plain.keys()) if ([...p].length >= 4) stems.add(stemOf(lang.id, p))
  return {
    lang, profile, vocab: data.vocab, plain, byLength, formRank, gloss, sounds, extra, stems,
    always: new Set([...data.known.always].map((w) => w.toLowerCase())),
    names: new Set([...data.known.names].map((w) => w.toLowerCase())),
  }
}

// ---------------------------------------------------------------------------
// Helpers

const HAN = /\p{Script=Han}/u
const isHan = (s: string) => HAN.test(s)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const pct = (x: number) => Math.round(clamp01(x) * 100)
/** Jyutping: letters ending in a tone number, possibly several syllables (nei5hou2). */
const JYUTPING = /^(?:[a-z]+[1-6])+$/i
/** Sentence-ending punctuation (Latin and Chinese). */
const SENT_END = /[.!?…。！？]/
const CLOSERS = /[.!?…。！？»"”’')）」』]/

/** Damerau–Levenshtein distance with an early exit once it exceeds `max` (returns max + 1). */
export function boundedDistance(a: string, b: string, max: number): number {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > max) return max + 1
  let prev2: number[] = []
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[n]!
}

/** The closest dictionary form (accent-insensitive), within 1 edit (2 for long words); undefined when none or a tie between lemmas. */
function nearest(kit: WritingKit, word: string): { form: string; distance: number; unique: boolean } | undefined {
  const p = kit.lang.stripAccents(word.toLowerCase())
  const len = [...p].length
  if (len < 4) return undefined // short words have too many neighbours (sur, sus, sal) to tell a typo
  // one edit only: longer distances mostly find another word (tranquillité → tranquille), not the intended one
  const max = 1
  let best: string[] = []
  let bestD = max + 1
  for (let n = len - max; n <= len + max; n++) {
    for (const cand of kit.byLength.get(n) ?? []) {
      // typos rarely touch the first letter of a word; skipping those keeps suggestions sensible and fast
      if (cand[0] !== p[0] && !(cand[1] === p[0] && cand[0] === p[1])) continue
      const d = boundedDistance(p, cand, Math.min(max, bestD))
      if (d < bestD) {
        bestD = d
        best = [cand]
      } else if (d === bestD && d <= max) best.push(cand)
    }
  }
  if (!best.length || bestD > max) {
    // spelled by ear: yama → llama, aser → hacer, bamos → vamos
    const byEar = kit.profile.phonetic ? kit.sounds.get(kit.profile.phonetic(word)) : undefined
    if (!byEar?.length) return undefined
    return { form: byEar[0]!, distance: 2, unique: byEar.length === 1 }
  }
  const forms = best.flatMap((b) => kit.plain.get(b) ?? []).sort((a, b) => (kit.formRank.get(a) ?? 1e9) - (kit.formRank.get(b) ?? 1e9))
  if (!forms.length) return undefined
  // safe to apply when there is a single spelling to put in (homographs share it)
  return { form: forms[0]!, distance: bestD, unique: forms.length === 1 }
}

/** Regular derivational endings: an unknown word with one of them is a word, not a typo. */
const DERIVATIONS: Record<string, RegExp> = {
  es: /.{3}(cion|ciones|mente|dad|dades|ismo|ismos|ista|istas)$/,
  pt: /.{3}(cao|coes|mente|dade|dades|ismo|ismos|ista|istas)$/,
  it: /.{3}(zione|zioni|mente|ta|ismo|ismi|ista|isti)$/,
  fr: /.{3}(tion|tions|ment|ments|isme|ismes|iste|istes)$/,
}

/** Two accentless words one keyboard slip apart: two neighbouring letters swapped, or a letter doubled or undoubled. */
function isSlip(a: string, b: string): boolean {
  if (a.length === b.length) {
    const d = [...a].flatMap((c, i) => (c !== b[i] ? [i] : []))
    return d.length === 2 && d[1] === d[0]! + 1 && a[d[0]!] === b[d[1]!] && a[d[1]!] === b[d[0]!]
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a]
  if (long.length !== short.length + 1) return false
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return long[i] === long[i - 1] || long[i] === long[i + 1]
  }
  return false
}

/** Inflection endings per language: a word and its "typo" neighbour that differ only by these are two forms of one word. */
const ENDINGS: Record<string, string[]> = {
  es: ['es', 's', 'as', 'os', 'a', 'o'],
  pt: ['oes', 'aes', 'es', 's', 'as', 'os', 'a', 'o', 'ns', 'm'],
  it: ['he', 'hi', 'i', 'e', 'a', 'o'],
  fr: ['ees', 'es', 'ee', 'e', 's', 'x'],
}
/** True when two (accentless) words share a stem and differ only in an inflection ending (futures / futurs, arts / art). */
function inflectedVariant(lang: string, a: string, b: string): boolean {
  if (!ENDINGS[lang]) return false
  return stemOf(lang, a) === stemOf(lang, b) || stemOf(lang, a) === b || a === stemOf(lang, b)
}
/** A word without its inflection ending (luoghi, luogo → luog). */
function stemOf(lang: string, w: string): string {
  const e = ENDINGS[lang]?.find((x) => w.length > x.length + 2 && w.endsWith(x))
  return e ? w.slice(0, -e.length) : w
}

/** Keep the learner's capital on a suggestion. */
function matchCase(original: string, suggestion: string): string {
  return /^\p{Lu}/u.test(original) ? suggestion.charAt(0).toUpperCase() + suggestion.slice(1) : suggestion
}

/** Spans of sentences: [start, end) including their closing punctuation. */
export function sentences(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  let start = 0
  let i = 0
  while (i < text.length) {
    // 3.5, 1.000: a point between digits ends nothing
    if (SENT_END.test(text[i]!) && !(text[i] === '.' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? ''))) {
      let j = i + 1
      while (j < text.length && CLOSERS.test(text[j]!)) j++
      // "Aparece lá em casa!, nem…": punctuation going on is not a sentence end
      if (/^[,;:]/.test(text.slice(j))) {
        i = j
        continue
      }
      if (text.slice(start, j).trim()) out.push({ start, end: j })
      start = j
      i = j
      continue
    }
    if (text[i] === '\n') {
      if (text.slice(start, i).trim()) out.push({ start, end: i })
      start = i + 1
    }
    i++
  }
  if (text.slice(start).trim()) out.push({ start, end: text.length })
  return out
}

/** Longest common subsequence length of two lists. */
function lcs(a: string[], b: string[]): number {
  const row = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    let diag = 0
    for (let j = 1; j <= b.length; j++) {
      const up = row[j]!
      row[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(row[j]!, row[j - 1]!)
      diag = up
    }
  }
  return row[b.length]!
}

/** Test a target-language pattern case-insensitively, then accent-insensitively (the learner may drop accents). */
function patternMatches(pattern: string, text: string, strip: (s: string) => string): boolean {
  try {
    if (contentRegExp(pattern, 'iu').test(text)) return true
    return contentRegExp(strip(pattern), 'iu').test(strip(text))
  } catch {
    return false
  }
}

/** True when the pattern compiles (content check). */
export function patternCompiles(pattern: string): boolean {
  try {
    contentRegExp(pattern, 'iu')
    return true
  } catch {
    return false
  }
}

const WORD_KIND = (t: Token) => t.kind === 'word'
const FUNCTION_POS = new Set(['det', 'prep', 'conj', 'pron', 'particle', 'classifier', 'interj'])

interface WordInfo {
  t: Token
  lower: string
  entries?: VocabEntry[]
  known: boolean
}

// ---------------------------------------------------------------------------
// Scoring

/** Length of a text in the prompt's unit: words, or for Cantonese characters (a Jyutping syllable counts as one). */
export function writingLength(text: string, kit: WritingKit): number {
  const tokens = kit.lang.tokenize(text)
  if (kit.profile.script === 'han') {
    let n = 0
    for (const t of tokens) {
      if (t.kind === 'number') n += 1
      else if (t.kind === 'word') n += isHan(t.text) ? [...t.text].filter(isHan).length : Math.max(1, (t.text.match(/[1-6]/g) ?? []).length)
    }
    return n
  }
  return tokens.filter((t) => t.kind === 'word' || t.kind === 'number').length
}

export function scoreWriting(raw: string, prompt: WritingPrompt, kit: WritingKit, opts: ScoreOptions): WritingResult {
  const { lang, profile } = kit
  // inclusive writing (étudiant·es, ami·e·s) reads as the base word: the endings are blanked, offsets stay the same
  const text = raw.replace(/(?<=\p{L})[·•]\p{L}+(?:[·•]\p{L}+)?/gu, (m) => (/s$/.test(m) ? 's' + ' '.repeat(m.length - 1) : ' '.repeat(m.length)))
  const han = profile.script === 'han'
  const tokens = lang.tokenize(text)
  const issues: WritingIssue[] = []
  const notes: Record<WritingCategory, string[]> = { task: [], grammar: [], spelling: [], vocabulary: [] }
  const levelIdx = LEVEL_ORDER.indexOf(opts.level)

  // ---- words and their dictionary entries
  const known = (w: string) => kit.always.has(w) || kit.names.has(w)
  const splitsIntoKnown = (w: string): boolean => {
    const chars = [...w]
    const ok: boolean[] = [true, ...new Array<boolean>(chars.length).fill(false)]
    for (let i = 0; i < chars.length; i++) {
      if (!ok[i]) continue
      for (let j = i + 1; j <= chars.length; j++) {
        const part = chars.slice(i, j).join('')
        if (lang.lookup(part) || known(part)) ok[j] = true
      }
    }
    return ok[chars.length]!
  }
  const words: WordInfo[] = tokens.filter(WORD_KIND).map((t) => {
    const lower = t.text.toLowerCase()
    const entries = lang.lookup(lower) ?? (lower !== t.text ? lang.lookup(t.text) : undefined)
    return { t, lower, entries, known: Boolean(entries) || known(lower) || (han && isHan(t.text) && splitsIntoKnown(t.text)) }
  })
  const length = writingLength(text, kit)
  const size = Math.max(words.length, 1)

  // ---- English answers
  const englishWords = words.filter((w) => !w.known && ENGLISH.has(w.lower) && !(han && JYUTPING.test(w.lower)))
  const english = englishWords.length >= 2 && englishWords.length / size >= 0.4

  // ---- spelling
  const sentenceStarts = new Set(sentences(text).map((s) => {
    const m = /[\p{L}\p{N}]/u.exec(text.slice(s.start, s.end))
    return m ? s.start + m.index : s.start
  }))
  for (const w of english ? [] : words) {
    const { t, lower } = w
    // a name in Latin letters inside Cantonese (Leo, Ana, Peter)
    if (han && /^\p{Lu}/u.test(t.text) && !isHan(t.text)) continue
    // Cantonese in Jyutping is in the dictionary too, but gets a nudge towards characters
    if (w.known && !(han && !isHan(t.text) && w.entries)) continue
    if (han) {
      if (isHan(t.text)) {
        // characters the course cannot read: usually simplified ones
        const odd = [...t.text].filter((c) => lang.hasReading && !lang.hasReading(c))
        if (odd.length) {
          const trad = [...t.text].map((c) => TRADITIONAL[c] ?? c).join('')
          const fixed = trad !== t.text
          issues.push({
            category: 'spelling', code: 'simplified', severity: 'major', start: t.start, end: t.end, safe: fixed,
            message: fixed ? `Check: “${t.text}” looks like simplified Chinese. Hong Kong writes traditional characters: “${trad}”.` : `Check: “${odd.join('')}” is not a character this course uses.`,
            suggestion: fixed ? trad : undefined,
          })
        }
        // a real character or word outside the course is fine: it shows up as "ambitious" vocabulary
        continue
      }
      if (JYUTPING.test(lower) || w.entries) {
        const entries = lang.lookup(lower) ?? []
        // the stop's own words first, then the earliest level
        const rank = (e: VocabEntry) => (opts.unitWords?.has(e.id) ? 0 : 10) + LEVEL_ORDER.indexOf(e.level)
        const lemmas = [...new Set(entries.filter((e) => isHan(e.lemma)).sort((a, b) => rank(a) - rank(b)).map((e) => e.lemma))]
        issues.push({
          category: 'spelling', code: 'script', severity: 'minor', start: t.start, end: t.end, safe: lemmas.length === 1,
          message: lemmas.length ? `Try writing “${t.text}” in characters: ${lemmas.slice(0, 3).join(' / ')}. The helper row below the box has the stop's characters.` : `Try writing “${t.text}” in characters: tap them in from the helper row below the box.`,
          suggestion: lemmas[0],
        })
        continue
      }
      // other Latin letters: Hong Kong Cantonese mixes in English words (present個project), which is fine
      continue
    } else {
      if (/['’]$/.test(t.text)) continue // elided function word (l', dell', j')
      const start = sentenceStarts.has(t.start)
      const capital = /^\p{Lu}/u.test(t.text)
      if (capital && !start) continue // a name: Ana, Rosario, Lisboa
      if (kit.extra.has(lower)) continue
      // saia-justa / saia justa, rés-do-chão: a hyphenated word made of words we know
      if (/[-‑]/.test(lower) && (lang.lookup(lower.replace(/[-‑]/g, ' ')) || lower.split(/[-‑]/).every((x) => !x || lang.lookup(x) || known(x) || kit.extra.has(x)))) continue
      const p = lang.stripAccents(lower)
      const same = (kit.plain.get(p) ?? []).filter((f) => f !== lower)
      // learners drop accents; a word typed with its own accents (matrícula, património) is left alone
      if (same.length && p === lower) {
        const fix = matchCase(t.text, same[0]!)
        issues.push({
          category: 'spelling', code: 'accent', severity: 'minor', start: t.start, end: t.end, safe: same.length === 1, suggestion: fix,
          message: same.length === 1 ? `Write it with its accent: “${fix}”.` : `Check the accent: “${fix}” (or ${same.slice(1, 3).map((f) => `“${f}”`).join(', ')}).`,
        })
        continue
      }
    }
    if (ENGLISH.has(lower)) {
      const g = kit.gloss.get(lower)
      issues.push({ category: 'spelling', code: 'english', severity: 'major', start: t.start, end: t.end, message: g ? `“${t.text}” is English: try “${g}”.` : `“${t.text}” is English.`, suggestion: g, safe: false })
      continue
    }
    // a capitalised unknown word starting a sentence is most likely a name (Marta vive…)
    if (/^\p{Lu}/u.test(t.text)) continue
    if (!han && /[^\p{L}'’-]/u.test(t.text)) continue
    // regular derivations (criação, rapidamente, novidades) are words, even when the course doesn't list them
    if (DERIVATIONS[lang.id]?.test(lang.stripAccents(lower))) continue
    // another form of a word the course knows, by its stem (luoghi: luogo)
    const plainW = lang.stripAccents(lower)
    if ([...plainW].length >= 5 && kit.stems.has(stemOf(lang.id, plainW))) continue
    const near = nearest(kit, lower)
    // no close dictionary form: more likely a correct word outside the course than a typo, so no flag
    if (!near) continue
    const a = lang.stripAccents(lower)
    const b = lang.stripAccents(near.form)
    // another form of a word the course knows (terribles, particuliers)
    if (inflectedVariant(lang.id, a, b)) continue
    // From B1 learners use plenty of words the course doesn't list (vaste is not veste): only clear slips of the
    // keyboard (swapped or doubled letters: graacias, fratelo) and spellings by ear (yama) count there.
    const early = levelIdx <= 1
    if (!early && !isSlip(a, b) && near.distance < 2) continue
    const fix = matchCase(t.text, near.form)
    issues.push({ category: 'spelling', code: 'typo', severity: early ? 'major' : 'minor', start: t.start, end: t.end, suggestion: fix, safe: near.unique, message: early ? `Did you mean “${fix}”?` : `Check the spelling: did you mean “${fix}”?` })
  }

  // ---- grammar: the pack's checker, filtered to what it is precise about
  const wordTokens = tokens.filter((t) => t.kind !== 'space')
  const insideKnownWord = (pos: number) => wordTokens.some((t) => t.start < pos && pos < t.end && t.kind === 'word' && (lang.lookup(t.text.toLowerCase()) || known(t.text.toLowerCase())))
  let findings: CheckerFinding[] = []
  if (!english && text.trim()) {
    try {
      findings = lang.check(text)
    } catch {
      findings = []
    }
  }
  for (const f of findings) {
    const span = text.slice(f.start, f.end)
    if (profile.grammarCodes.has(f.code)) {
      if (f.code === 'agreement' && unsureAgreement(text, f, sentenceStarts, lang.lookup, lang.id)) continue
      // a rule that starts or ends inside a dictionary word (tendría el, 結他) is not about this text
      if (f.code === 'learner-error' && (insideKnownWord(f.start) || insideKnownWord(f.end))) continue
      // …or that flags a single word the dictionary knows (saudades is Portuguese, not Spanish)
      if (f.code === 'learner-error' && !han && words.some((w) => w.t.start === f.start && w.t.end === f.end && w.entries)) continue
      // …or that runs into a name (de El Bolsón): rules see lower case, the capital says it is a place
      if (f.code === 'learner-error' && !han && words.some((w) => w.t.start >= f.start && w.t.end <= f.end && /^\p{Lu}/u.test(w.t.text) && !sentenceStarts.has(w.t.start))) continue
      const single = Boolean(f.suggestion) && !/\s/.test(span) && !/[\s…]/.test(f.suggestion!) && f.suggestion !== span
      issues.push({ category: 'grammar', code: f.code, severity: 'major', start: f.start, end: f.end, message: checkPrefix(f.message), suggestion: f.suggestion, safe: single, grammar: f.grammar })
    } else if (f.code === 'accent' && !han) {
      // e / è, a / à, ou / où: both words exist, so only the checker can tell
      const tok = words.find((w) => w.t.start === f.start && w.t.end === f.end)
      if (tok?.known && f.suggestion && !issues.some((x) => x.start === f.start)) {
        issues.push({ category: 'spelling', code: 'accent', severity: 'minor', start: f.start, end: f.end, message: checkPrefix(f.message), suggestion: matchCase(span, f.suggestion), safe: !/\s/.test(f.suggestion), grammar: f.grammar })
      }
    }
  }

  // ---- mechanics: capitals, final punctuation, ¿…? ¡…!, 嗎 + ？
  if (!english && words.length) {
    const sents = sentences(text)
    if (!han) {
      for (const s of sents) {
        const m = /[\p{L}\p{N}]/u.exec(text.slice(s.start, s.end))
        if (!m || /\p{N}/u.test(m[0])) continue // 6 juin 1944.
        const at = s.start + m.index
        const w = words.find((x) => x.t.start === at)
        const before = text.slice(0, s.start)
        // a dialogue tag after ! or ? inside a quotation (« Quelle chance ! s'écria-t-elle ») or after a dash (—dijo ella)
        const quoted = /[!?]\s*$/.test(before) && (before.split(/[«“]/).length - before.split(/[»”]/).length > 0)
        const incise = /^\s*[—–-]/.test(text.slice(s.start, at))
        if (w && /^\p{Ll}/u.test(w.t.text) && !quoted && !incise && !(s.start > 0 && /(?:[…:;,]|\.\.\.)\s*$/.test(before))) {
          const fix = w.t.text.charAt(0).toUpperCase() + w.t.text.slice(1)
          issues.push({ category: 'grammar', code: 'capital', severity: 'minor', start: w.t.start, end: w.t.end, suggestion: fix, safe: true, message: `Check: a sentence starts with a capital letter: “${fix}”.` })
        }
        if (profile.inverted) {
          const body = text.slice(s.start, s.end)
          for (const [open, close, what] of [['¿', '?', 'question'], ['¡', '!', 'exclamation']] as const) {
            const hasOpen = body.includes(open)
            const closeAt = body.indexOf(close)
            if (closeAt >= 0 && !hasOpen) {
              issues.push({ category: 'grammar', code: 'inverted', severity: 'minor', start: s.start + closeAt, end: s.start + closeAt + 1, message: `Check: a Spanish ${what} opens with ${open} as well as closing with ${close}.`, grammar: what === 'question' ? 'g.question-words' : undefined })
            } else if (hasOpen && closeAt < 0) {
              const o = s.start + body.indexOf(open)
              issues.push({ category: 'grammar', code: 'inverted', severity: 'minor', start: o, end: o + 1, message: `Check: close the ${what} with ${close}.` })
            }
          }
        }
      }
    } else {
      for (const s of sents) {
        const body = text.slice(s.start, s.end).trimEnd()
        const m = /([嗎咩])\s*(。|\.)$/u.exec(body)
        if (m) {
          const at = s.start + m.index + m[0].length - 1
          issues.push({ category: 'grammar', code: 'question-mark', severity: 'minor', start: at, end: at + 1, suggestion: '？', safe: true, message: `Check: a question with ${m[1]} ends with a question mark (？).`, grammar: 'g.maa-questions' })
        }
      }
    }
    const trimmed = text.trimEnd()
    // a short last line after a line break is a sign-off (Un abbraccio,\nTom), not a sentence
    const lastLine = trimmed.slice(trimmed.lastIndexOf('\n') + 1)
    const lastWords = lang.tokenize(trimmed.slice(Math.max(...[...trimmed].map((c, i) => (SENT_END.test(c) ? i + 1 : 0))))).filter(WORD_KIND)
    // …or a signature after the last sentence (… grosses bises. Paul)
    const signOff =
      (trimmed.includes('\n') && lang.tokenize(lastLine).filter(WORD_KIND).length <= 3) ||
      (lastWords.length > 0 && lastWords.length <= 3 && lastWords.every((w) => /^\p{Lu}/u.test(w.text)) && SENT_END.test(trimmed)) ||
      // …or a closing and a name (Bonne journée, Marius / Merci beaucoup, Emma Wilson)
      /,\s*\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,2}$/u.test(trimmed) ||
      // …or a Chinese letter's closing, laid out in parts (此致 貴公司 順頌商祺 陳小姐謹上)
      (han && /\s/.test(trimmed.slice(Math.max(...[...trimmed].map((c, i) => (SENT_END.test(c) ? i + 1 : 0)))).trim()))
    if (trimmed && !signOff && !CLOSERS.test(trimmed.at(-1)!) && !SENT_END.test(trimmed.at(-1)!)) {
      const last = [...tokens].reverse().find((t) => t.kind === 'word' || t.kind === 'number')
      if (last) {
        const end = han ? '。' : '.'
        issues.push({ category: 'grammar', code: 'end-punct', severity: 'minor', start: last.start, end: last.end, suggestion: last.text + end, safe: true, message: `Check: finish the last sentence with a full stop (${end}), a question mark or an exclamation mark.` })
      }
    }
  }
  issues.sort((a, b) => a.start - b.start || a.end - b.end)
  // one issue per span: the first (spelling before grammar on the same word)
  const seen = new Set<string>()
  const spanIssues = issues.filter((x) => {
    // the same words flagged twice (agreement and a learner-error rule on "un ville") count once
    const k = x.category === 'grammar' ? `${x.start}:${x.end}:grammar` : `${x.start}:${x.end}:${x.code}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  // ---- spelling and grammar scores: weighted issues per word
  const late = levelIdx >= 2
  const weight: Record<string, number> = { typo: late ? 0.5 : 1, english: 1, simplified: 0.8, unknown: late ? 0.15 : 0.5, accent: 0.4, script: 0.12 }
  const penalty = (cat: 'spelling' | 'grammar') => spanIssues.filter((x) => x.category === cat).reduce((n, x) => n + (cat === 'spelling' ? (weight[x.code] ?? 1) : x.severity === 'major' ? 1 : 0.35), 0)
  const per = Math.max(size, 6)
  let spelling = pct(1 - (4 * penalty('spelling')) / per)
  let grammar = pct(1 - (4 * penalty('grammar')) / per)

  // ---- task
  const used: string[] = []
  const missing: string[] = []
  const textPlain = lang.stripAccents(text.toLowerCase())
  // Cantonese typed in Jyutping: compare the evidence on its characters as well
  const charText = han
    ? tokens.map((t) => {
        if (t.kind !== 'word' || isHan(t.text)) return t.text
        const e = (lang.lookup(t.text.toLowerCase()) ?? []).find((x) => isHan(x.lemma))
        return e ? e.lemma : t.text
      }).join('')
    : text
  const idsInText = new Set(words.flatMap((w) => (w.entries ?? []).map((e) => e.id)))
  if (han) for (const t of lang.tokenize(charText).filter(WORD_KIND)) for (const e of lang.lookup(t.text) ?? []) idsInText.add(e.id)
  for (const id of prompt.use) {
    const e = kit.vocab.get(id)
    if (!e) continue
    // Cantonese has no inflection and the segmenter may join a word with its neighbour (兩個): any occurrence counts
    // a pronominal verb counts when its verb is there, the clitics apart (prendersela: non me la sono presa)
    const base = !han && e.pos === 'verb' ? e.lemma.toLowerCase().replace(/r(sela|sene|cela|cene|sele|si|ci|la|le|ne|lo)$/, 're') : undefined
    const baseHit = base !== undefined && base !== e.lemma.toLowerCase() && words.some((w) => w.entries?.some((x) => x.pos === 'verb' && x.lemma.toLowerCase() === base))
    const hit = idsInText.has(id) || baseHit || (han ? [e.lemma, ...(e.forms ?? [])].some((f) => isHan(f) && charText.includes(f.replace(/\s+/g, ''))) : /\s/.test(e.lemma.trim()) && [e.lemma, ...(e.forms ?? [])].some((f) => textPlain.includes(lang.stripAccents(f.toLowerCase()))))
    if (hit) used.push(id)
    else missing.push(id)
  }
  const useNeed = Math.min(prompt.useAtLeast ?? Math.min(3, prompt.use.length), prompt.use.length)
  const useScore = useNeed ? clamp01(used.length / useNeed) : 1
  const expectMet = prompt.expect.flatMap((x, i) => (patternMatches(x.pattern, charText, lang.stripAccents) ? [i] : []))
  const expectScore = prompt.expect.length === 0 || expectMet.length > 0 ? 1 : 0
  let lengthScore = 1
  if (length === 0) lengthScore = 0
  else if (length < prompt.min) lengthScore = Math.pow(length / prompt.min, 1.5)
  else if (length > prompt.max) lengthScore = Math.max(0.7, 1 - ((length - prompt.max) / prompt.max) * 0.6)
  const unitLabel = han ? 'characters' : 'words'
  if (length < prompt.min) notes.task.push(`Write a little more: ${length} of at least ${prompt.min} ${unitLabel}.`)
  else if (length > prompt.max) notes.task.push(`A little long: ${length} ${unitLabel} for about ${prompt.max}. Shorter is fine here.`)
  if (useNeed && used.length < useNeed) notes.task.push(`Use ${useNeed - used.length} more of the stop's words: ${missing.map((id) => kit.vocab.get(id)?.lemma ?? id).slice(0, 4).join(', ')}.`)
  if (prompt.expect.length && !expectMet.length) for (const x of prompt.expect) notes.task.push(x.hint)
  // copying: the model answer once seen, or the prompt's own question at any time
  const norm = (s: string) => (han ? [...s].filter(isHan) : lang.tokenize(s).filter((t) => t.kind === 'word' || t.kind === 'number').map((t) => lang.stripAccents(t.text.toLowerCase())))
  const mine = norm(text)
  const copyOf = (src: string) => {
    const other = norm(src)
    if (mine.length < 3 || other.length < 3) return false
    const common = lcs(mine, other)
    return common / mine.length >= 0.8 && common / other.length >= 0.7
  }
  const copied = mine.length > 0 && ((opts.seenModel === true && copyOf(prompt.model.es)) || (prompt.es !== undefined && copyOf(prompt.es)))
  let task = 0.35 * lengthScore + 0.3 * useScore + 0.35 * expectScore
  if (english) {
    task = Math.min(task, 0.15)
    notes.task.unshift('This looks like English. Write your answer in the course language: the dictionary only knows its words.')
  }
  if (copied) {
    task = Math.min(task, 0.3)
    notes.task.unshift(opts.seenModel && copyOf(prompt.model.es) ? 'This is very close to the model answer. Change the details to make it your own.' : 'This repeats the question. Answer it in your own words.')
  }
  const taskScore = pct(task)

  // ---- vocabulary
  const content = words.filter((w) => w.entries?.length && !known(w.lower) && !w.entries.every((e) => FUNCTION_POS.has(e.pos)))
  const lemmaOf = (w: WordInfo) => [...w.entries!].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))[0]!
  const lemmas = content.map(lemmaOf)
  const distinct = new Map(lemmas.map((e) => [e.id, e]))
  const variety = content.length ? distinct.size / content.length : 0
  const atLevel = lemmas.filter((e) => LEVEL_ORDER.indexOf(e.level) <= levelIdx).length
  const levelFit = lemmas.length ? atLevel / lemmas.length : 1
  const ambitious = [...new Set(lemmas.filter((e) => LEVEL_ORDER.indexOf(e.level) > levelIdx).map((e) => e.lemma))]
  const unitIds = opts.unitWords ?? new Set<string>()
  const unitUsed = [...new Set([...idsInText].filter((id) => unitIds.has(id)))]
  if (han) for (const id of unitIds) if (!unitUsed.includes(id) && isHan(kit.vocab.get(id)?.lemma ?? '') && charText.includes(kit.vocab.get(id)!.lemma.replace(/\s+/g, ''))) unitUsed.push(id)
  const unitTarget = Math.min(2, unitIds.size)
  const varietyScore = content.length < 3 ? clamp01(content.length / 3) : clamp01((variety - 0.3) / 0.4)
  const unitScore = unitTarget ? clamp01(unitUsed.length / unitTarget) : 1
  let vocabulary = pct(0.4 * varietyScore + 0.3 * (0.6 + 0.4 * levelFit) + 0.3 * unitScore)
  if (content.length >= 4 && variety < 0.6) notes.vocabulary.push('Some words come back several times: try a synonym or a new detail.')
  if (unitTarget && unitUsed.length < unitTarget) notes.vocabulary.push("Bring in a word or two from this stop's lessons.")
  if (ambitious.length) notes.vocabulary.push(`Ambitious: ${ambitious.slice(0, 4).join(', ')} ${ambitious.length === 1 ? 'is' : 'are'} from a later level. Nice!`)

  // a few words can't show much: below most of the asked length, the other categories count for less
  const evidence = clamp01(length / Math.max(1, 0.8 * prompt.min))
  if (evidence < 1) {
    const f = 0.2 + 0.8 * Math.pow(evidence, 1.2)
    spelling = Math.round(spelling * f)
    grammar = Math.round(grammar * f)
    vocabulary = Math.round(vocabulary * f)
    notes.grammar.push('Too short to show much yet: write more for a full score.')
  }
  if (english || length === 0) {
    spelling = english ? 0 : spelling
    grammar = english ? 0 : grammar
    vocabulary = 0
  }
  const nSpell = spanIssues.filter((x) => x.category === 'spelling').length
  const nGram = spanIssues.filter((x) => x.category === 'grammar').length
  if (nSpell) notes.spelling.push(`${nSpell} word${nSpell === 1 ? '' : 's'} to check: tap the highlights.`)
  if (nGram) notes.grammar.push(`${nGram} thing${nGram === 1 ? '' : 's'} to check: tap the highlights.`)
  if (han && spanIssues.some((x) => x.code === 'script')) notes.spelling.unshift('Jyutping is a great start. Characters are how Cantonese is written: try them next time.')

  const scores: Record<WritingCategory, number> = { task: taskScore, grammar, spelling, vocabulary }
  let overall = Math.round(WRITING_CATEGORIES.reduce((n, c) => n + WRITING_WEIGHTS[c] * scores[c], 0))
  if (english) overall = Math.min(overall, 25)
  if (length === 0) overall = 0
  // the top stamp needs a clean text: no typo, English word or grammar slip left
  const stars = Math.min(starsFor(overall), spanIssues.some((x) => x.severity === 'major') ? 2 : 3) as WritingResult['stars']

  // ---- what went well
  const wentWell: string[] = []
  if (!english && length > 0) {
    if (unitUsed.length) wentWell.push(`You used ${unitUsed.length === 1 ? 'a word' : `${unitUsed.length} words`} from this stop: ${unitUsed.map((id) => kit.vocab.get(id)?.lemma ?? id).slice(0, 6).join(', ')}.`)
    for (const i of expectMet) wentWell.push(`Task: ${prompt.expect[i]!.hint.replace(/[:：].*$/, '').replace(/[\s.…。!?！？]+$/u, '')}.`)
    if (length >= prompt.min && length <= prompt.max) wentWell.push(`A good length: ${length} ${unitLabel}.`)
    if (nSpell === 0 && size >= 3) wentWell.push(han ? 'Every character is one the course knows.' : 'Every word is spelled right.')
    if (nGram === 0 && size >= 3) wentWell.push('No grammar slips found.')
    if (ambitious.length) wentWell.push(`Ambitious vocabulary: ${ambitious.slice(0, 3).join(', ')}.`)
    if (content.length >= 4 && variety >= 0.8) wentWell.push('Varied vocabulary: hardly a word repeated.')
  }

  return {
    overall, stars, scores, issues: spanIssues, notes, wentWell,
    task: { length, unit: unitLabel, min: prompt.min, max: prompt.max, used, missing, useNeed, expectMet, english, copied },
    vocabulary: { variety, levelFit, ambitious, unitWords: unitUsed.map((id) => kit.vocab.get(id)?.lemma ?? id) },
  }
}

const QUANTIFIER_ADVERBS = new Set(['molto', 'poco', 'tanto', 'troppo', 'muito', 'pouco', 'mucho', 'demasiado', 'bastante', 'parecchio'])
const MENTION_NOUNS = new Set(['parola', 'nome', 'termine', 'aggettivo', 'mot', 'nom', 'terme', 'palabra', 'nombre', 'término', 'palavra', 'termo'])

/**
 * Agreement flags we don't trust: about a proper noun (la Bourgogne, les Corses sont fiers: a name may have
 * another gender than the common noun the dictionary knows) or inside "à la / à l'" (à la myrte, à la fois).
 */
function unsureAgreement(text: string, f: CheckerFinding, sentenceStarts: Set<number>, lookup: (w: string) => VocabEntry[] | undefined, langId: string): boolean {
  const span = text.slice(f.start, f.end)
  const spanWords = span.toLowerCase().match(/[\p{L}'’]+/gu) ?? []
  // molto / muito / mucho / poco… in their adverb form (molto dolci, muito tarde)
  if (QUANTIFIER_ADVERBS.has(spanWords[0] ?? '')) return true
  // a word talked about (la parola petaloso, il nome onestà)
  if (spanWords.some((w) => MENTION_NOUNS.has(w))) return true
  // a noun of several genders or senses (sale: salt / the rooms, le / la mode)
  for (const w of spanWords) {
    const genders = new Set((lookup(w) ?? []).filter((e) => e.pos === 'noun').map((e) => e.gender))
    if (genders.size > 1) return true
  }
  // Italian feminine plural in -e of a noun the course lacks (nelle sale: sala, not sale "salt")
  if (langId === 'it' && /^(le|delle|nelle|alle|dalle|sulle|queste|quelle)$/.test(spanWords[0] ?? '') && /e$/.test(spanWords.at(-1) ?? '')) return true
  // a dish named by its ingredients (la cacio e pepe)
  if (/^\s+(e|ed|y|et|and)\s+\p{L}/u.test(text.slice(f.end))) return true
  for (const m of f.message.matchAll(/“([^”]+)”/g)) {
    for (const w of m[1]!.split(/\s+/)) {
      if (w.length < 2) continue
      const re = new RegExp(`(?<![\\p{L}])${w.charAt(0).toUpperCase()}${w.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'gu')
      for (const hit of text.matchAll(re)) if (!sentenceStarts.has(hit.index!)) return true
    }
  }
  return /(^|[^\p{L}])à\s+(la|l['’])/iu.test(text.slice(Math.max(0, f.start - 6), f.end))
}

/** Grammar flags are suggestions, never verdicts: "Check: …". */
function checkPrefix(message: string): string {
  const m = message.replace(/^(Agreement|Article|Elision|Auxiliary|Spelling|Accent):\s*/i, '').trim()
  if (/^check\b/i.test(m)) return m
  // lower-case an ordinary first word (Age is… → age is…), not a quote, a name or a word in capitals
  return `Check: ${/^\p{Lu}\p{Ll}/u.test(m) && !/^(I|Spanish|French|Italian|Portuguese|Cantonese|Mandarin|English)\b/.test(m) ? m.charAt(0).toLowerCase() + m.slice(1) : m}`
}

/** Replace an issue's span with its suggestion (only for `safe` issues). */
export function applySuggestion(text: string, issue: Pick<WritingIssue, 'start' | 'end' | 'suggestion' | 'safe'>): string {
  if (!issue.safe || issue.suggestion === undefined) return text
  return text.slice(0, issue.start) + issue.suggestion + text.slice(issue.end)
}

/** The stamp for an overall score: 3 from 90, 2 from 70, 1 from 45. */
export function starsFor(overall: number): 0 | 1 | 2 | 3 {
  return overall >= 90 ? 3 : overall >= 70 ? 2 : overall >= 45 ? 1 : 0
}

// ---------------------------------------------------------------------------
// Content check

export const MIN_WRITING_PROMPTS = 3
export const MAX_WRITING_PROMPTS = 5

/**
 * Problems with a unit's writing prompts (scripts/check-content.ts): errors for broken references
 * and for a model answer that misses its own task (length, `use` words, `expect`), warnings for a
 * model answer the scorer flags or scores under 90. Messages start with "writing N:".
 */
export function checkWritingPrompts(
  unit: { id: string; lessons: { vocab: string[] }[]; writing: WritingPrompt[] },
  kit: WritingKit,
  refs: { level: LevelId; vocab: (id: string) => boolean; grammar: (id: string) => boolean },
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  if (!unit.writing.length) return { errors, warnings: ['no writing prompts yet'] }
  if (unit.writing.length < MIN_WRITING_PROMPTS || unit.writing.length > MAX_WRITING_PROMPTS) errors.push(`${unit.writing.length} writing prompts (aim for ${MIN_WRITING_PROMPTS}–${MAX_WRITING_PROMPTS})`)
  const unitWords = new Set(unit.lessons.flatMap((l) => l.vocab))
  unit.writing.forEach((w, i) => {
    const at = `writing ${i + 1}`
    if (w.min > w.max) errors.push(`${at}: min ${w.min} is more than max ${w.max}`)
    for (const id of w.use) if (!refs.vocab(id)) errors.push(`${at}: uses unknown vocab ${id}`)
    if (w.useAtLeast !== undefined && w.useAtLeast > w.use.length) errors.push(`${at}: useAtLeast ${w.useAtLeast} but only ${w.use.length} use words`)
    for (const g of w.grammar) if (!refs.grammar(g)) errors.push(`${at}: unknown grammar ${g}`)
    for (const x of w.expect) if (!patternCompiles(x.pattern)) errors.push(`${at}: expect pattern does not compile: ${x.pattern}`)
    const r = scoreWriting(w.model.es, w, kit, { level: refs.level, unitWords })
    const t = r.task
    if (t.length < w.min || t.length > w.max) errors.push(`${at}: the model answer has ${t.length} ${t.unit} (the task asks ${w.min}–${w.max})`)
    if (t.used.length < t.useNeed) errors.push(`${at}: the model answer uses ${t.used.length} of ${t.useNeed} use words (missing: ${t.missing.join(', ')})`)
    if (w.expect.length && !t.expectMet.length) errors.push(`${at}: the model answer matches none of its expect patterns`)
    const flags = r.issues.map((x) => `${x.code} “${w.model.es.slice(x.start, x.end)}”${x.suggestion ? ` → ${x.suggestion}` : ''}`)
    if (flags.length) warnings.push(`${at}: the scorer flags the model answer: ${flags.join('; ')}`)
    if (r.overall < 90) warnings.push(`${at}: the model answer scores ${r.overall} (task ${r.scores.task}, grammar ${r.scores.grammar}, spelling ${r.scores.spelling}, vocabulary ${r.scores.vocabulary}); aim for 90+`)
  })
  return { errors, warnings }
}

/** "Spelling" / "Grammar" for an issue (Cantonese spelling is about characters). */
export function issueLabel(x: Pick<WritingIssue, 'category' | 'code'>): string {
  return x.category === 'grammar' ? 'Grammar' : x.code === 'script' || x.code === 'simplified' ? 'Characters' : 'Spelling'
}

/** The stamp's words for a score. */
export function stampLabel(stars: number): string {
  return stars >= 3 ? 'Ready to post' : stars === 2 ? 'Nearly there' : stars === 1 ? 'Rough draft' : 'Keep writing'
}
