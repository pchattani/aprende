/** Bits shared by the word-spelling games (Word search, Fetch!, Scramble): letter folding, word filters, best results. */
import { languagePack } from '@lang'
import type { VocabEntry } from '../../engine/schema'
import { useKvValue } from '../../hooks/useProgress'
import { GAMES_BEST_KEY, type GameBest } from './util'

export const JYUTPING = languagePack.id === 'yue'
/** Accent- (or tone-) insensitive letter: what a grid square or a keyboard key shows. */
export const fold = (ch: string) => languagePack.stripMarks(ch.toLowerCase())

/** True when the clue spells the answer (hotel = "hotel"), which would make the game trivial. */
export function givesAway(v: VocabEntry, letters: readonly string[]): boolean {
  const answer = languagePack.stripMarks(letters.join('').toLowerCase())
  const clue = languagePack.stripMarks((v.en[0] ?? '').toLowerCase().replace(/^to /, '').replace(/[^\p{L}]/gu, ''))
  return answer === clue
}

/** The letters the course's grids and keyboards use: a–z (no q, r, v, x in Jyutping) plus ñ where it is a letter of its own. */
export function courseAlphabet(): string[] {
  const az = [...'abcdefghijklmnopqrstuvwxyz'].filter((ch) => !JYUTPING || !'qrvx'.includes(ch))
  return !JYUTPING && fold('ñ') === 'ñ' ? [...az, 'ñ'] : az
}

/** This game's best result (kv `gamesBest`), live. */
export function useGameBest(id: string): GameBest | undefined {
  return useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})?.[id]
}
