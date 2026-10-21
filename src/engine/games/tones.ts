/**
 * Cantonese tones for the "Tone detective" game: the six tones of Hong Kong Cantonese with
 * their pitch contours, tone parsing from Jyutping, a curated table of minimal sets (one
 * syllable, several tones, each with a common character whose usual reading is exactly that
 * syllable, so text-to-speech says what the game expects), and question generators.
 */
import type { VocabEntry } from '../schema'
import type { Rng } from '../random'

export type Tone = 1 | 2 | 3 | 4 | 5 | 6
export const TONE_LIST: readonly Tone[] = [1, 2, 3, 4, 5, 6]

export interface ToneInfo {
  tone: Tone
  /** "high level" */
  name: string
  /** Chao pitch numbers (5 high … 1 low), start and end. */
  pitch: [number, number]
  /** The tone-1-to-6 mnemonic 三九四零五二 (saam1 gau2 sei3 ling4 ng5 ji6). */
  mnemonic: string
}

export const TONES: Record<Tone, ToneInfo> = {
  1: { tone: 1, name: 'high level', pitch: [5, 5], mnemonic: '三' },
  2: { tone: 2, name: 'high rising', pitch: [3, 5], mnemonic: '九' },
  3: { tone: 3, name: 'mid level', pitch: [3, 3], mnemonic: '四' },
  4: { tone: 4, name: 'low falling', pitch: [2, 1], mnemonic: '零' },
  5: { tone: 5, name: 'low rising', pitch: [1, 3], mnemonic: '五' },
  6: { tone: 6, name: 'low level', pitch: [2, 2], mnemonic: '二' },
}

/** "tone 4, low falling": the accessible name of a tone button. */
export const toneLabel = (t: Tone): string => `tone ${t}, ${TONES[t].name}`

export interface Syllable {
  /** Toneless syllable: "si". */
  base: string
  tone: Tone
}

/** One toned Jyutping syllable ("si4") → base and tone; undefined when it has no tone number. */
export function parseSyllable(syl: string): Syllable | undefined {
  const m = /^([a-z]+)([1-6])$/.exec(syl.trim().toLowerCase())
  return m ? { base: m[1]!, tone: Number(m[2]) as Tone } : undefined
}

/** "nei5 hou2" → [{nei, 5}, {hou, 2}]; undefined when any syllable lacks a tone. */
export function parseJyutping(jp: string): Syllable[] | undefined {
  const parts = jp.trim().split(/\s+/).filter(Boolean)
  const out = parts.map(parseSyllable)
  return parts.length && out.every(Boolean) ? (out as Syllable[]) : undefined
}

/** The tones of a Jyutping string ("nei5 hou2" → [5, 2]). */
export const tonesOf = (jp: string): Tone[] => parseJyutping(jp)?.map((s) => s.tone) ?? []
/** Jyutping without its tone numbers ("nei5 hou2" → "nei hou"). */
export const toneless = (jp: string): string => jp.replace(/([a-z])[1-6](?=\s|$)/g, '$1')

export interface ToneItem {
  ch: string
  jp: string
  en: string
}

/**
 * Minimal sets: the same syllable on different tones. Every character is common and its
 * usual (first) reading is this syllable, checked against the character table in the tests.
 * A tone may list two homophones, so "same tone" pairs can be two different characters.
 */
export const MINIMAL_SETS: readonly { base: string; tones: Partial<Record<Tone, [string, string][]>> }[] = [
  { base: 'si', tones: { 1: [['詩', 'poem'], ['絲', 'silk']], 2: [['史', 'history']], 3: [['試', 'to try']], 4: [['時', 'time']], 5: [['市', 'market, city']], 6: [['事', 'matter, thing'], ['是', 'to be (written)']] } },
  { base: 'fan', tones: { 1: [['分', 'to divide; minute']], 2: [['粉', 'powder; rice noodles']], 3: [['訓', 'to sleep']], 4: [['墳', 'grave']], 5: [['憤', 'anger']], 6: [['份', 'portion, copy']] } },
  { base: 'ji', tones: { 1: [['衣', 'clothes'], ['醫', 'to heal']], 2: [['椅', 'chair']], 3: [['意', 'meaning, idea']], 4: [['兒', 'child']], 5: [['耳', 'ear']], 6: [['二', 'two']] } },
  { base: 'fu', tones: { 1: [['夫', 'husband']], 2: [['苦', 'bitter']], 3: [['富', 'rich']], 4: [['扶', 'to support']], 5: [['婦', 'woman']], 6: [['父', 'father']] } },
  { base: 'wai', tones: { 1: [['威', 'mighty']], 2: [['毀', 'to destroy']], 3: [['畏', 'to fear']], 4: [['圍', 'to surround']], 5: [['偉', 'great']], 6: [['胃', 'stomach']] } },
  { base: 'jau', tones: { 1: [['優', 'excellent'], ['休', 'to rest']], 3: [['幼', 'young']], 4: [['油', 'oil']], 5: [['有', 'to have']], 6: [['右', 'right (side)'], ['又', 'again']] } },
  { base: 'maa', tones: { 1: [['媽', 'mum']], 4: [['麻', 'numb; sesame']], 5: [['馬', 'horse']], 6: [['罵', 'to scold']] } },
  { base: 'jan', tones: { 1: [['因', 'cause, because']], 2: [['隱', 'hidden']], 3: [['印', 'to print, stamp']], 4: [['人', 'person']], 5: [['引', 'to lead']], 6: [['孕', 'pregnant']] } },
  { base: 'seoi', tones: { 2: [['水', 'water']], 3: [['歲', 'years old']], 4: [['誰', 'who (written)']], 6: [['睡', 'to sleep']] } },
  { base: 'sau', tones: { 1: [['收', 'to receive']], 2: [['手', 'hand']], 3: [['瘦', 'thin']], 4: [['仇', 'hatred']], 6: [['受', 'to bear'], ['壽', 'long life']] } },
  { base: 'dung', tones: { 1: [['東', 'east']], 2: [['懂', 'to understand']], 3: [['凍', 'cold']], 6: [['動', 'to move']] } },
  { base: 'gwai', tones: { 1: [['歸', 'to return']], 2: [['鬼', 'ghost']], 3: [['貴', 'expensive']], 6: [['跪', 'to kneel']] } },
  { base: 'tong', tones: { 1: [['湯', 'soup']], 3: [['燙', 'to scald; to iron']], 4: [['糖', 'sugar']] } },
  { base: 'gau', tones: { 2: [['九', 'nine']], 3: [['夠', 'enough']], 6: [['舊', 'old (things)']] } },
  { base: 'maai', tones: { 4: [['埋', 'to bury; close to']], 5: [['買', 'to buy']], 6: [['賣', 'to sell']] } },
  { base: 'haa', tones: { 1: [['蝦', 'prawn']], 4: [['霞', 'rosy clouds']], 6: [['夏', 'summer']] } },
  { base: 'zi', tones: { 1: [['知', 'to know']], 2: [['紙', 'paper'], ['子', 'son; seed']], 3: [['志', 'will, ambition']], 6: [['字', 'character, word']] } },
  { base: 'ci', tones: { 2: [['齒', 'tooth']], 3: [['次', 'time (occurrence)']], 4: [['詞', 'word']], 5: [['似', 'to resemble']] } },
  { base: 'sin', tones: { 1: [['先', 'first']], 3: [['線', 'line, thread']], 6: [['善', 'kind, good']] } },
  { base: 'gaai', tones: { 1: [['街', 'street']], 2: [['解', 'to explain; to untie']], 3: [['戒', 'to quit']] } },
  { base: 'hou', tones: { 2: [['好', 'good']], 4: [['豪', 'grand']], 6: [['號', 'number']] } },
  { base: 'sik', tones: { 1: [['色', 'colour'], ['識', 'to know']], 6: [['食', 'to eat']] } },
  { base: 'baak', tones: { 3: [['百', 'hundred']], 6: [['白', 'white']] } },
  { base: 'sei', tones: { 2: [['死', 'to die']], 3: [['四', 'four']] } },
  { base: 'ngo', tones: { 5: [['我', 'I, me']], 6: [['餓', 'hungry']] } },
  { base: 'jyu', tones: { 4: [['如', 'if; like']], 5: [['雨', 'rain']], 6: [['預', 'to prepare']] } },
]

/** Every character of the minimal sets as a playable item. */
export const TONE_ITEMS: readonly ToneItem[] = MINIMAL_SETS.flatMap((s) =>
  TONE_LIST.flatMap((t) => (s.tones[t] ?? []).map(([ch, en]) => ({ ch, jp: `${s.base}${t}`, en }))),
)

/** The tone contrasts learners confuse most (2/5 both rise, 3/6 both level, 4/6 both low). */
export const HARD_CONTRASTS: readonly [Tone, Tone][] = [[2, 5], [3, 6], [4, 6], [1, 3], [5, 6]]

export interface PairQuestion {
  a: ToneItem
  b: ToneItem
  same: boolean
}

/**
 * "Same or different?": `n` pairs of one syllable said twice, about half on the same tone
 * (two homophones when the table has them, else the same character twice) and half on
 * different tones, mostly from the hard contrasts.
 */
export function sameOrDifferentRound(rng: Rng, n = 10): PairQuestion[] {
  const out: PairQuestion[] = []
  const sameCount = Math.floor(n / 2) - (rng.next() < 0.5 ? 1 : 0)
  const item = (base: string, t: Tone, k = 0): ToneItem => {
    const set = MINIMAL_SETS.find((s) => s.base === base)!
    const list = set.tones[t]!
    const [ch, en] = list[k % list.length]!
    return { ch, jp: `${base}${t}`, en }
  }
  const sets = rng.shuffle(MINIMAL_SETS)
  for (let i = 0; i < n; i++) {
    const set = sets[i % sets.length]!
    const tones = TONE_LIST.filter((t) => set.tones[t])
    if (i < sameCount) {
      const t = rng.pick(tones)
      const k = rng.int(set.tones[t]!.length)
      out.push({ a: item(set.base, t, k), b: item(set.base, t, k + 1), same: true })
      continue
    }
    const hard = rng.shuffle(HARD_CONTRASTS.filter(([x, y]) => set.tones[x] && set.tones[y]))
    const [x, y] = hard.length && rng.next() < 0.75 ? hard[0]! : rng.sample(tones, 2)
    const [p, q] = rng.next() < 0.5 ? [x!, y!] : [y!, x!]
    out.push({ a: item(set.base, p as Tone), b: item(set.base, q as Tone), same: false })
  }
  return rng.shuffle(out)
}

export interface ToneQuestion {
  /** What is played or shown: a character or a word. */
  text: string
  jp: string
  en: string
  /** The tone of each syllable. */
  tones: Tone[]
  /** The vocabulary entry, when the item is one of the learner's words. */
  vocabId?: string
}

/**
 * Whether a word's Jyutping is what text-to-speech will most likely say: every character's
 * usual reading (`readings(c)[0]`) is its syllable. Leaves out changed tones (電話 din6 waa2),
 * words with a second reading for a character, and anything not written one character per syllable.
 */
export function plainReading(lemma: string, jp: string, readings: (c: string) => string[] | undefined): boolean {
  const chars = [...lemma]
  const syl = jp.trim().split(/\s+/)
  return chars.length === syl.length && chars.every((c, i) => readings(c)?.[0] === syl[i])
}

const fromVocab = (v: VocabEntry): ToneQuestion => ({ text: v.lemma, jp: v.jp!, en: v.en.slice(0, 2).join(', '), tones: tonesOf(v.jp!), vocabId: v.id })

/** Learner words of `syllables` syllables that are safe to play (plain readings, Han characters only). */
export function toneWords(words: VocabEntry[], syllables: number, readings: (c: string) => string[] | undefined): VocabEntry[] {
  return words.filter((v) => v.jp && /^\p{Script=Han}+$/u.test(v.lemma) && v.jp.split(' ').length === syllables && plainReading(v.lemma, v.jp, readings))
}

/** "Which tone?": up to half the learner's one-syllable words, the rest from the minimal sets, every tone at least once when n ≥ 6. */
export function whichToneRound(learner: VocabEntry[], rng: Rng, n = 10): ToneQuestion[] {
  const out: ToneQuestion[] = []
  const used = new Set<string>()
  for (const v of rng.shuffle(learner)) {
    if (out.length >= Math.floor(n / 2)) break
    if (used.has(v.lemma) || tonesOf(v.jp ?? '').length !== 1) continue
    used.add(v.lemma)
    out.push(fromVocab(v))
  }
  const have = () => new Set(out.map((q) => q.tones[0]))
  const items = rng.shuffle(TONE_ITEMS).filter((it) => !used.has(it.ch))
  // first fill the tones not yet heard, then anything
  for (const t of rng.shuffle(TONE_LIST)) {
    if (out.length >= n || have().has(t)) continue
    const it = items.find((x) => !used.has(x.ch) && tonesOf(x.jp)[0] === t)
    if (!it) continue
    used.add(it.ch)
    out.push({ text: it.ch, jp: it.jp, en: it.en, tones: [t] })
  }
  for (const it of items) {
    if (out.length >= n) break
    if (used.has(it.ch)) continue
    used.add(it.ch)
    out.push({ text: it.ch, jp: it.jp, en: it.en, tones: tonesOf(it.jp) })
  }
  return rng.shuffle(out)
}

/** "Two-syllable words": the learner's words first, topped up from `pool`; no repeated tone pattern more than twice. */
export function wordToneRound(learner: VocabEntry[], pool: VocabEntry[], rng: Rng, n = 10): ToneQuestion[] {
  const out: ToneQuestion[] = []
  const used = new Set<string>()
  const patterns = new Map<string, number>()
  const take = (list: VocabEntry[]) => {
    for (const v of list) {
      if (out.length >= n) return
      const tones = tonesOf(v.jp ?? '')
      const key = tones.join('')
      if (tones.length !== 2 || used.has(v.lemma) || (patterns.get(key) ?? 0) >= 2) continue
      used.add(v.lemma)
      patterns.set(key, (patterns.get(key) ?? 0) + 1)
      out.push(fromVocab(v))
    }
  }
  take(rng.shuffle(learner))
  take(rng.shuffle(pool))
  return rng.shuffle(out)
}
