/**
 * The verb games' data: the course's verb kit, the round's verbs and tenses, and recording answers.
 * The rules themselves are pure functions in engine/games/verbPrompts.ts.
 */
import { useEffect, useState } from 'react'
import * as verbsModule from '@lang/verbs'
import { languagePack } from '@lang'
import { vocab, LEVEL_ORDER_LIST } from '../../engine/loader'
import { loadFinishedWords } from '../../hooks/useFinishedWords'
import { allCards, recordAnswer } from '../../db/progress'
import { finishedCards, pickGameWords } from '../../engine/vocabGame'
import { Rng } from '../../engine/random'
import type { LevelId } from '../../engine/schema'
import { kitFrom, playableVerb, deckFor, finishedTenses, type VerbsModuleLike, type GameVerb, type VerbPrompt, type FormGrade } from '../../engine/games/verbPrompts'

/** The course's conjugator, seen through the games' kit. */
export const kit = kitFrom(verbsModule as unknown as VerbsModuleLike, languagePack)

export interface VerbRound {
  deck: GameVerb[]
  tenses: string[]
  level: LevelId
}

/**
 * Verbs and tenses for a round, from the lessons the learner has finished only (engine/finished.ts):
 * their finished verbs (due and weak first) and the tenses whose grammar those lessons teach or
 * practise (the present alone until then). `undefined` while loading.
 */
export function useVerbRound(want: number, round = 0): VerbRound | undefined {
  const [r, setR] = useState<VerbRound | undefined>()
  useEffect(() => {
    let live = true
    void Promise.all([allCards(), loadFinishedWords()]).then(([cards, finished]) => {
      const level = [...finished.levels].reduce<LevelId>((m, l) => (LEVEL_ORDER_LIST.indexOf(l) > LEVEL_ORDER_LIST.indexOf(m) ? l : m), 'a1')
      const mine = pickGameWords(finishedCards(cards, finished.words), (id) => {
        const v = vocab.get(id)
        return v && playableVerb(v) ? v : undefined
      }, want, new Rng(Date.now()))
      // no top-up beyond the finished verbs: the deck may be short
      const pool = finished.entries.filter((v) => v.pos === 'verb')
      if (live) setR({ deck: deckFor(kit, mine, pool, level, want), tenses: finishedTenses(kit, finished.grammar), level })
    })
    return () => {
      live = false
    }
  }, [want, round])
  return r
}

/** Record an answer on the verb's card (a finished verb without a card is ignored by recordAnswer). */
export function recordVerb(p: VerbPrompt, verdict: FormGrade['verdict'], fast = false): void {
  void recordAnswer(p.verb.id, verdict, 'conjugate', { fast })
}

/** "Preterite (simple past)" → "Preterite": the reels and chips have little room. */
export const shortTense = (label: string) => label.replace(/\s*\(.*\)\s*$/, '')

/** "Present, Preterite": the tenses in play (those of the finished lessons), for the start screens. */
export const tensesInPlay = (tenses: readonly string[]) => tenses.map((t) => shortTense(kit.labels[t]?.en ?? t)).join(', ')
