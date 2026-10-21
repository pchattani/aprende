/**
 * Sort it: target-language words go into two (later three) baskets. The baskets are topics
 * the learner has enough words for (Food vs Clothes), or, when topic data is thin, grammatical
 * gender (el / la) or part of speech (nouns vs verbs). Every card's word belongs to exactly one
 * basket: words whose spelling also names an entry in another basket (naranja the fruit and the
 * colour, el/la capital) never become cards.
 */
import type { VocabEntry } from '../schema'
import type { Rng } from '../random'

export type SortMode = 'topic' | 'gender' | 'pos'

export interface Basket {
  /** The topic, gender (m / f) or part of speech it collects. */
  key: string
  label: string
  /** Second line under the label (gender: "masculine"). */
  hint?: string
  /** Emoji shown above the label ('' for gender baskets, whose label is the article). */
  icon: string
}

export interface SortCard {
  v: VocabEntry
  /** Index into the round's baskets. */
  basket: number
}

export interface SortRound {
  mode: SortMode
  /** Two or three baskets; the third (if any) joins at `thirdFrom`. */
  baskets: Basket[]
  cards: SortCard[]
  /** Index of the first card for which the third basket is shown (cards.length when there is none). */
  thirdFrom: number
}

export const SORT_ROUND = 15
/** Cards played with two baskets before a third one joins. */
const TWO_BASKET_CARDS = 7
/** Fewest words a basket needs to be picked (the third basket needs a few less). */
const MIN_PER_BASKET = 4
const MIN_THIRD = 3
/** Shortest round worth playing. */
export const SORT_MIN = 8

/** Concrete topics with a label a learner sorts by at a glance. Abstract ones (connectors, verbs-daily…) are left out. */
export const TOPIC_BASKETS: Record<string, { label: string; icon: string }> = {
  food: { label: 'Food', icon: '🍎' },
  drink: { label: 'Drinks', icon: '🥤' },
  clothing: { label: 'Clothes', icon: '👕' },
  colours: { label: 'Colours', icon: '🎨' },
  body: { label: 'Body', icon: '🦶' },
  family: { label: 'Family', icon: '👪' },
  relationships: { label: 'People & relationships', icon: '💞' },
  feelings: { label: 'Feelings', icon: '💛' },
  weather: { label: 'Weather', icon: '⛅' },
  nature: { label: 'Nature', icon: '🌳' },
  environment: { label: 'Environment', icon: '♻️' },
  animals: { label: 'Animals', icon: '🐾' },
  house: { label: 'Home', icon: '🏠' },
  furniture: { label: 'Furniture', icon: '🛋️' },
  city: { label: 'In town', icon: '🏙️' },
  transport: { label: 'Transport', icon: '🚌' },
  travel: { label: 'Travel', icon: '🧳' },
  countries: { label: 'Countries', icon: '🌍' },
  jobs: { label: 'Jobs', icon: '👩‍🍳' },
  work: { label: 'Work', icon: '💼' },
  school: { label: 'School', icon: '📚' },
  science: { label: 'Science', icon: '🔬' },
  sport: { label: 'Sport', icon: '⚽' },
  health: { label: 'Health', icon: '🩺' },
  money: { label: 'Money', icon: '💶' },
  economy: { label: 'Economy', icon: '📈' },
  tech: { label: 'Technology', icon: '💻' },
  media: { label: 'Media', icon: '📰' },
  arts: { label: 'Arts', icon: '🎭' },
  politics: { label: 'Politics', icon: '🏛️' },
  law: { label: 'Law', icon: '⚖️' },
  numbers: { label: 'Numbers', icon: '🔢' },
  time: { label: 'Time', icon: '⏰' },
  days: { label: 'Days', icon: '🗓️' },
  months: { label: 'Months', icon: '📅' },
}

/** Topics close enough that a word could sit in either: never two of a group in one round. */
const CLASHES: string[][] = [
  ['food', 'drink'],
  ['house', 'furniture'],
  ['city', 'transport', 'travel', 'countries'],
  ['weather', 'nature', 'environment', 'animals', 'science'],
  ['body', 'health', 'sport'],
  ['family', 'relationships', 'feelings'],
  ['jobs', 'work', 'economy', 'money'],
  ['politics', 'law', 'economy'],
  ['media', 'tech', 'arts', 'science'],
  ['school', 'science', 'work'],
  ['time', 'days', 'months', 'numbers'],
]
export function topicsClash(a: string, b: string): boolean {
  return a === b || CLASHES.some((g) => g.includes(a) && g.includes(b))
}

/** Parts of speech a topic card may have (verbs and phrases would blur the baskets: "to eat" is not food). */
const TOPIC_POS = new Set(['noun', 'adj', 'num'])

/** Articles for the gender baskets, per course; courses without grammatical gender have none. */
export const GENDER_ARTICLES: Record<string, { m: string; f: string } | undefined> = {
  es: { m: 'el', f: 'la' },
  pt: { m: 'o', f: 'a' },
  it: { m: 'il / lo', f: 'la' },
  fr: { m: 'le', f: 'la' },
}

const POS_BASKETS: Record<string, { label: string; icon: string }> = {
  noun: { label: 'Things', icon: '📦' },
  verb: { label: 'Actions', icon: '🏃' },
  adj: { label: 'Describing words', icon: '🌈' },
}
const POS_HINT: Record<string, string> = { noun: 'nouns', verb: 'verbs', adj: 'adjectives' }

interface ModeSpec {
  mode: SortMode
  /** The basket key a word would go in under this mode (undefined: not sortable here). */
  keyOf: (v: VocabEntry) => string | undefined
  /** The key of any entry with the same spelling, for the one-basket check (wider than keyOf). */
  anyKeyOf: (v: VocabEntry) => string | undefined
  basket: (key: string) => Basket
  /** Keys that may share a round. */
  compatible: (a: string, b: string) => boolean
  /** Any same-spelling entry with another key rules a word out, not only one in another basket of the round (gender). */
  strict?: boolean
}

function topicSpec(): ModeSpec {
  return {
    mode: 'topic',
    keyOf: (v) => (v.topic && TOPIC_BASKETS[v.topic] && TOPIC_POS.has(v.pos) ? v.topic : undefined),
    anyKeyOf: (v) => v.topic,
    basket: (key) => ({ key, ...TOPIC_BASKETS[key]! }),
    compatible: (a, b) => !topicsClash(a, b),
  }
}

function genderSpec(articles: { m: string; f: string }): ModeSpec {
  return {
    mode: 'gender',
    keyOf: (v) => (v.pos === 'noun' && (v.gender === 'm' || v.gender === 'f') ? v.gender : undefined),
    // a noun of both genders (mf) or a same-spelling noun of the other gender rules the word out
    anyKeyOf: (v) => (v.pos === 'noun' ? (v.gender ?? 'unknown') : undefined),
    basket: (key) => (key === 'm' ? { key, label: articles.m, hint: 'masculine', icon: '' } : { key, label: articles.f, hint: 'feminine', icon: '' }),
    compatible: () => true,
    strict: true,
  }
}

function posSpec(): ModeSpec {
  return {
    mode: 'pos',
    keyOf: (v) => (POS_BASKETS[v.pos] ? v.pos : undefined),
    anyKeyOf: (v) => v.pos,
    basket: (key) => ({ key, ...POS_BASKETS[key]!, hint: POS_HINT[key] }),
    compatible: () => true,
  }
}

/**
 * True when no other entry spelled the same (after `fold`) would belong to a different basket
 * of the round, so the word has exactly one right answer.
 */
export function belongsToOne(v: VocabEntry, keys: ReadonlySet<string>, sameSpelling: readonly VocabEntry[], spec: Pick<ModeSpec, 'keyOf' | 'anyKeyOf' | 'strict'>): boolean {
  const own = spec.keyOf(v)
  if (!own || !keys.has(own)) return false
  return sameSpelling.every((e) => {
    if (e.id === v.id) return true
    const k = spec.anyKeyOf(e)
    // gender: a noun of the other (or both) genders; topic / pos: an entry in another basket of this round
    return k === undefined || k === own || (!spec.strict && !keys.has(k))
  })
}

/** Weighted pick of a key: topics with more words are likelier, so baskets fill. */
function weightedPick(keys: string[], counts: Map<string, number>, rng: Rng): string | undefined {
  const total = keys.reduce((n, k) => n + counts.get(k)!, 0)
  if (!total) return undefined
  let r = rng.next() * total
  for (const k of keys) {
    r -= counts.get(k)!
    if (r < 0) return k
  }
  return keys[keys.length - 1]
}

/**
 * Build a round under one mode, or undefined if the learner's words cannot fill one. Baskets:
 * two compatible keys with at least MIN_PER_BASKET clean words each, and a third with at
 * least MIN_THIRD when there is one.
 */
function roundFor(spec: ModeSpec, words: readonly VocabEntry[], bySpelling: (v: VocabEntry) => readonly VocabEntry[], rng: Rng, size: number, fold: (s: string) => string): SortRound | undefined {
  // one card per spelling
  const seen = new Set<string>()
  const pool = words.filter((v) => {
    const f = fold(v.lemma)
    if (!spec.keyOf(v) || seen.has(f) || !v.en[0]) return false
    seen.add(f)
    return true
  })
  const groups = new Map<string, VocabEntry[]>()
  for (const v of pool) {
    const k = spec.keyOf(v)!
    groups.set(k, [...(groups.get(k) ?? []), v])
  }
  const keys = rng.shuffle([...groups.keys()])
  const counts = new Map(keys.map((k) => [k, groups.get(k)!.length]))
  const big = keys.filter((k) => counts.get(k)! >= MIN_PER_BASKET)
  let best: SortRound | undefined
  for (let attempt = 0; attempt < 12; attempt++) {
    const a = weightedPick(big, counts, rng)
    if (!a) break
    const partners = big.filter((k) => k !== a && spec.compatible(a, k))
    const b = weightedPick(partners, counts, rng)
    if (!b) {
      big.splice(big.indexOf(a), 1)
      continue
    }
    const thirds = keys.filter((k) => k !== a && k !== b && counts.get(k)! >= MIN_THIRD && spec.compatible(a, k) && spec.compatible(b, k))
    const c = weightedPick(thirds, counts, rng)
    const chosen = c ? [a, b, c] : [a, b]
    const set = new Set(chosen)
    const clean = chosen.map((k) => rng.shuffle(groups.get(k)!.filter((v) => belongsToOne(v, set, bySpelling(v), spec))))
    if (clean[0]!.length < MIN_PER_BASKET || clean[1]!.length < MIN_PER_BASKET) continue
    const withThird = clean[2] && clean[2].length >= MIN_THIRD
    const cards = deal(withThird ? clean : clean.slice(0, 2), size, rng)
    if (cards.cards.length < SORT_MIN || cards.cards.length <= (best?.cards.length ?? 0)) continue
    const baskets = (withThird ? chosen : chosen.slice(0, 2)).map(spec.basket)
    best = { mode: spec.mode, baskets, cards: cards.cards, thirdFrom: withThird ? cards.thirdFrom : cards.cards.length }
    // a full round wins at once; a short one only if no other pairing fills up
    if (best.cards.length >= size) break
  }
  return best
}

/**
 * Deal the cards: the first TWO_BASKET_CARDS from the first two baskets (alternating at
 * random, never more than two in a row from one basket while both have words), the rest
 * from all baskets with the third basket's words spread in.
 */
function deal(groups: VocabEntry[][], size: number, rng: Rng): { cards: SortCard[]; thirdFrom: number } {
  const left = groups.map((g) => [...g])
  const cards: SortCard[] = []
  const take = (allowed: number[]) => {
    const open = allowed.filter((b) => left[b]!.length)
    if (!open.length) return false
    const last2 = cards.slice(-2).map((c) => c.basket)
    const fresh = open.filter((b) => !(last2.length === 2 && last2[0] === b && last2[1] === b))
    // favour the fuller basket a little so the round stays balanced
    const from = fresh.length ? fresh : open
    const b = rng.next() < 0.6 ? from.reduce((m, x) => (left[x]!.length > left[m]!.length ? x : m), from[0]!) : rng.pick(from)
    cards.push({ v: left[b]!.pop()!, basket: b })
    return true
  }
  const two = groups.length > 2 ? Math.min(TWO_BASKET_CARDS, size) : size
  while (cards.length < two && take([0, 1]));
  const thirdFrom = groups.length > 2 ? cards.length : size
  if (groups.length > 2) {
    // the third basket's first word comes right after it appears
    if (cards.length < size && left[2]!.length) cards.push({ v: left[2]!.pop()!, basket: 2 })
    while (cards.length < size && take([0, 1, 2]));
  }
  return { cards, thirdFrom: Math.min(thirdFrom, cards.length) }
}

/**
 * A round of Sort it from the learner's words: topic baskets first, then gender (courses
 * with articles), then part of speech. `all` is the whole course vocabulary (for the
 * one-basket check), `fold` the spelling key (lowercase, marks stripped).
 */
export function sortRound(words: readonly VocabEntry[], all: Iterable<VocabEntry>, opts: { lang: string; rng: Rng; fold: (s: string) => string; size?: number; modes?: SortMode[] }): SortRound | undefined {
  const size = opts.size ?? SORT_ROUND
  const index = new Map<string, VocabEntry[]>()
  for (const e of all) {
    const f = opts.fold(e.lemma)
    index.set(f, [...(index.get(f) ?? []), e])
  }
  const bySpelling = (v: VocabEntry) => index.get(opts.fold(v.lemma)) ?? [v]
  const articles = GENDER_ARTICLES[opts.lang]
  const specs: Record<SortMode, ModeSpec | undefined> = { topic: topicSpec(), gender: articles && genderSpec(articles), pos: posSpec() }
  for (const m of opts.modes ?? ['topic', 'gender', 'pos']) {
    const spec = specs[m]
    if (!spec) continue
    const r = roundFor(spec, words, bySpelling, opts.rng, size, opts.fold)
    if (r) return r
  }
  return undefined
}
