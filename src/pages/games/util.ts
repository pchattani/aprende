/** Helpers shared by the mini games: the learner's words and best scores. */
import { useEffect, useState } from 'react'
import type { VocabEntry } from '../../engine/schema'
import { vocab } from '../../engine/loader'
import { allCards, getKv, setKv } from '../../db/progress'
import { finishedCards, pickGameWords } from '../../engine/vocabGame'
import { loadFinishedWords } from '../../hooks/useFinishedWords'
import { Rng } from '../../engine/random'

/** Best results per game id, in kv `gamesBest`. */
export interface GameBest {
  /** Highest score. */
  score?: number
  /** Fastest finish. */
  ms?: number
  plays?: number
  /** Last day played (YYYY-MM-DD), for daily games. */
  day?: string
  /** Free-form per-game extras (a daily game's streak…). */
  extra?: Record<string, number | string>
}
export const GAMES_BEST_KEY = 'gamesBest'

/** Record a finished round: keeps the best score / fastest time and counts plays. */
export async function recordGame(id: string, result: { score?: number; ms?: number; day?: string; extra?: Record<string, number | string> }): Promise<GameBest> {
  const all = await getKv<Record<string, GameBest>>(GAMES_BEST_KEY, {})
  const b = all[id] ?? {}
  const next: GameBest = {
    score: result.score === undefined ? b.score : Math.max(b.score ?? 0, result.score),
    ms: result.ms === undefined ? b.ms : Math.min(b.ms ?? Infinity, result.ms),
    plays: (b.plays ?? 0) + 1,
    day: result.day ?? b.day,
    extra: { ...b.extra, ...result.extra },
  }
  await setKv(GAMES_BEST_KEY, { ...all, [id]: next })
  return next
}

/**
 * The learner's words for a game: only words of lessons they have finished (engine/finished.ts),
 * due and weakest first (see pickGameWords), filtered by `fit`. `undefined` while loading; fewer
 * than the game needs means "finish N more lessons first" (TooFew with the game's id).
 */
export function useGameWords(want: number, fit: (v: VocabEntry) => boolean = () => true, round = 0): VocabEntry[] | undefined {
  const [words, setWords] = useState<VocabEntry[] | undefined>()
  useEffect(() => {
    let live = true
    void Promise.all([allCards(), loadFinishedWords()]).then(([cards, finished]) => {
      const lookup = (id: string) => {
        const v = vocab.get(id)
        return v && fit(v) ? v : undefined
      }
      if (live) setWords(pickGameWords(finishedCards(cards, finished.words), lookup, want, new Rng(Date.now())))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, round])
  return words
}

