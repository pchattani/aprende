/**
 * What each game needs from the finished pool (engine/finished.ts): which finished words fit it
 * and how many (with different meanings) it needs. Shared by the games, whose "not enough words"
 * card says how many more lessons to finish, and the hub, whose cards say "Unlocks after N more
 * lessons". Kept light (no game pages imported) so the hub can load it.
 */
import { languagePack } from '@lang'
import type { VocabEntry } from '../../engine/schema'
import type { Finished } from '../../engine/finished'
import { crosswordLetters, crosswordLookup } from '../../engine/vocabGame'
import { newFetch, fetchKeyboard } from '../../engine/games/fetch'
import { scrambleOrder } from '../../engine/games/scramble'
import { dailyLetters } from '../../engine/games/dailyWord'
import { classifierOf } from '../../engine/games/measureWords'
import { sortRound } from '../../engine/games/sortIt'
import { formOf, playableVerb } from '../../engine/games/verbPrompts'
import { Rng } from '../../engine/random'
import { JYUTPING, fold, givesAway } from './wordGames'
import { kit } from './verbRound'

export interface Requirement {
  /** A finished word the game can play. */
  fit: (v: VocabEntry) => boolean
  /** Words (with different meanings) it needs to start. */
  need: number
  /** A verb game: before any verb is finished the hub says "after you've learned your first verbs". */
  verbs?: boolean
  /** A round that has to come together beyond a word count (Sort it needs two topics). */
  ok?: (entries: VocabEntry[]) => boolean
}

export const hasGloss = (v: VocabEntry) => Boolean(v.en[0])

/** Word search: the letters in the grid (accents left out later), and a clue that does not spell the answer. */
export const gridLetters = (v: VocabEntry) => crosswordLetters(v, languagePack.normalize)
export const fitsWordSearch = (v: VocabEntry) => {
  const l = gridLetters(v)
  return Boolean(l && !givesAway(v, l))
}

/** Fetch!'s on-screen keys (Jyutping has no ñ). */
export const FETCH_KEYS = fetchKeyboard(fold, JYUTPING ? [] : undefined)
const FETCH_KEYSET = new Set(FETCH_KEYS.flat())
/** What Fetch! spells: the word as the course writes it (lowercase, ligatures spelled out), or Jyutping without tones. */
export function fetchAnswer(v: VocabEntry): string | undefined {
  const a = v.jp ? v.jp.replace(/[1-6]/g, '') : languagePack.normalize(v.lemma).normalize('NFC')
  const letters = [...a].filter((ch) => /^\p{L}$/u.test(ch))
  if (letters.length < 3 || letters.length > 12 || a.length > 16 || a.split(' ').length > 3) return undefined
  if (![...a].every((ch) => ch === ' ' || ch === "'" || /^\p{L}$/u.test(ch))) return undefined
  if (givesAway(v, letters) || !letters.every((ch) => FETCH_KEYSET.has(newFetch(ch, fold).keys[0]!))) return undefined
  return a
}
export const fitsFetch = (v: VocabEntry) => fetchAnswer(v) !== undefined

const HAN = /^\p{Script=Han}$/u
/** Scramble's tiles: the characters of a Cantonese word (two to six), or the letters of a word (accents kept). */
export function scrambleTiles(v: VocabEntry): string[] | undefined {
  if (JYUTPING) {
    const chars = [...v.lemma]
    return chars.length >= 2 && chars.length <= 6 && chars.every((ch) => HAN.test(ch)) ? chars : undefined
  }
  return crosswordLetters(v, languagePack.normalize)
}
export const fitsScramble = (v: VocabEntry) => {
  const t = scrambleTiles(v)
  // a word whose tiles are all the same (拜拜) cannot be scrambled
  return Boolean(t && !givesAway(v, t) && scrambleOrder(t, new Rng(1)))
}

/** Fits a crossword grid, and its clue does not give the answer away. */
export const fitsCrossword = (v: VocabEntry) => crosswordLookup(() => v, languagePack)(v.id) !== undefined

/** Word of the day: 4–7 letters (Jyutping without tones for Cantonese). */
export const fitsDaily = (v: VocabEntry) => Boolean(v.en[0] && dailyLetters(v, languagePack))

/** A verb the verb games can drill: one word (or a pronominal one), conjugated in the present. */
export const fitsVerb = (v: VocabEntry) => playableVerb(v) && Boolean(formOf(kit, kit.conjugate(v.lemma), 'pres', 0))

/** A noun counted with a classifier the Measure words game knows. */
export const hasClassifier = (v: VocabEntry) => Boolean(classifierOf(v))

/** Tone detective: one- or two-character words with Jyutping. */
export const toneable = (v: VocabEntry) => Boolean(v.jp) && /^\p{Script=Han}{1,2}$/u.test(v.lemma)

const sortFold = (s: string) => languagePack.stripMarks(languagePack.normalize(s))

/** "N more lessons" / "your first lesson", for the not-enough-words card and the hub's locked cards. */
export function moreLessonsText(more: number, anyFinished: boolean): string {
  return more === 1 ? (anyFinished ? '1 more lesson' : 'your first lesson') : `${more} more lessons`
}

/**
 * How many more lessons until the game can be played (0: it can), undefined when the rest of
 * the course does not get there either.
 */
export function lessonsToUnlock(finished: Finished, r: Requirement): number | undefined {
  const words = finished.moreLessons(r.fit, r.need)
  if (!r.ok || words === undefined) return words
  // a round that has to come together: tried lesson by lesson, a few dozen lessons ahead at most
  const more = finished.moreLessonsUntil(r.ok, 40)
  return more === undefined ? undefined : Math.max(words, more)
}

/** Per game id (the hub's own modes and the catalog's games). */
export const REQUIRE: Record<string, Requirement> = {
  memory: { fit: hasGloss, need: 4 },
  rapid: { fit: hasGloss, need: 4 },
  crossword: { fit: fitsCrossword, need: 4 },
  listen: { fit: hasGloss, need: 4 },
  sound: { fit: hasGloss, need: 4 },
  wordsearch: { fit: fitsWordSearch, need: 4 },
  fetch: { fit: fitsFetch, need: 3 },
  scramble: { fit: fitsScramble, need: 4 },
  rain: { fit: hasGloss, need: 6 },
  sort: { fit: hasGloss, need: 6, ok: (entries) => Boolean(sortRound(entries.filter(hasGloss), entries, { lang: languagePack.id, rng: new Rng(1), fold: sortFold })) },
  daily: { fit: fitsDaily, need: 1 },
  slots: { fit: fitsVerb, need: 1, verbs: true },
  blitz: { fit: fitsVerb, need: 1, verbs: true },
  duel: { fit: fitsVerb, need: 1, verbs: true },
  measure: { fit: hasClassifier, need: 4 },
  // the first two levels play curated syllables; the two-syllable level checks its own words
  tones: { fit: toneable, need: 0 },
}
