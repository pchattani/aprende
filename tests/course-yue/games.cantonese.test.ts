import { describe, it, expect } from 'vitest'
import { vocab, vocabUpTo } from '@/engine/loader'
import { Rng } from '@/engine/random'
import { CLASSIFIERS, acceptableClassifiers, classifierOf, measureQuestion, measureRound, sortBoard } from '@/engine/games/measureWords'
import { toneWords, wordToneRound, whichToneRound, tonesOf } from '@/engine/games/tones'
import { charReadings } from '@/lang/yue/jyutping'

// The Cantonese games on the real course content (runs in the Cantonese build only).
const nouns = [...vocab.values()].filter((v) => classifierOf(v))
const pool = vocabUpTo('a2').filter((v) => classifierOf(v))

describe('measure words on the course nouns', () => {
  it('has a playable classifier for hundreds of A1/A2 nouns', () => {
    expect(pool.length).toBeGreaterThan(300)
    // every classifier the game can ask about has a Jyutping matching the course's classifier entry
    const entries = new Map([...vocab.values()].filter((v) => v.pos === 'classifier').map((v) => [v.lemma, v.jp]))
    for (const v of pool) {
      const cl = classifierOf(v)!
      if (entries.has(cl)) expect(CLASSIFIERS[cl]!.jp, cl).toBe(entries.get(cl))
    }
  })

  it('answers with the noun’s `cl` and three real classifiers that do not fit it', () => {
    for (const [k, v] of nouns.entries()) {
      const q = measureQuestion(v, new Rng(k + 1))
      if (!q) continue
      expect(q.options[q.answer]).toBe(v.cl ?? '杯')
      const ok = acceptableClassifiers(v)
      for (const [i, c] of q.options.entries()) {
        if (i === q.answer) continue
        expect(c).not.toBe(q.cl)
        expect(ok.has(c), `${c} for ${v.lemma}`).toBe(false)
        expect(CLASSIFIERS[c]).toBeDefined()
      }
    }
  })

  it('builds full rounds and sorting boards from a new learner and from course nouns', () => {
    for (let seed = 1; seed < 25; seed++) {
      const rng = new Rng(seed)
      const learner = rng.sample(nouns, 15)
      const round = measureRound(learner, pool, rng, 12)
      expect(round.length).toBe(12)
      expect(measureRound([], pool, rng, 12).length).toBe(12)
      const board = sortBoard(round.map((q) => q.noun), pool, rng)
      expect(board?.nouns.length).toBe(6)
    }
  })
})

describe('tone detective on the course words', () => {
  it('finds plenty of plainly read one- and two-syllable words', () => {
    const a1 = vocabUpTo('a1')
    expect(toneWords(a1, 1, charReadings).length).toBeGreaterThan(100)
    const two = toneWords(a1, 2, charReadings)
    expect(two.length).toBeGreaterThan(200)
    // changed-tone words stay out
    expect(two.map((v) => v.lemma)).not.toContain('電話')
    const round = wordToneRound([], two, new Rng(5), 10)
    expect(round.length).toBe(10)
    for (const q of round) expect(q.tones).toEqual(tonesOf(q.jp))
    expect(whichToneRound(toneWords(a1, 1, charReadings), new Rng(2), 10).length).toBe(10)
  })
})
