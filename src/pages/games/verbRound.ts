/**
 * The verb games' data: the course's verb kit, the round's verbs and tenses, and recording answers.
 * The rules themselves are pure functions in engine/games/verbPrompts.ts.
 */
import { useEffect, useState } from 'react'
import * as verbsModule from '@lang/verbs'
import { languagePack } from '@lang'
import { vocab } from '../../engine/loader'
import { allCards, recordAnswer } from '../../db/progress'
import { pickGameWords } from '../../engine/vocabGame'
import { Rng } from '../../engine/random'
import type { LevelId } from '../../engine/schema'
import { kitFrom, learnerReach, playableVerb, deckFor, reachedTenses, type VerbsModuleLike, type GameVerb, type VerbPrompt, type FormGrade } from '../../engine/games/verbPrompts'

/** The course's conjugator, seen through the games' kit. */
export const kit = kitFrom(verbsModule as unknown as VerbsModuleLike, languagePack)

export interface VerbRound {
  deck: GameVerb[]
  tenses: string[]
  level: LevelId
}

/**
 * Verbs and tenses for a round: the learner's verbs (due and weak first) topped up with the
 * stars of their level, and the tenses they have reached. `undefined` while loading.
 */
export function useVerbRound(want: number, round = 0): VerbRound | undefined {
  const [r, setR] = useState<VerbRound | undefined>()
  useEffect(() => {
    let live = true
    void allCards().then((cards) => {
      const { level, grammar } = learnerReach(cards)
      const mine = pickGameWords(cards, (id) => {
        const v = vocab.get(id)
        return v && playableVerb(v) ? v : undefined
      }, want, new Rng(Date.now()))
      const pool = [...vocab.values()].filter((v) => v.pos === 'verb')
      if (live) setR({ deck: deckFor(kit, mine, pool, level, want), tenses: reachedTenses(kit, level, grammar), level })
    })
    return () => {
      live = false
    }
  }, [want, round])
  return r
}

/** Record an answer on the verb's card (top-up verbs without a card are ignored by recordAnswer). */
export function recordVerb(p: VerbPrompt, verdict: FormGrade['verdict'], fast = false): void {
  void recordAnswer(p.verb.id, verdict, 'conjugate', { fast })
}

/** "Preterite (simple past)" → "Preterite": the reels and chips have little room. */
export const shortTense = (label: string) => label.replace(/\s*\(.*\)\s*$/, '')
