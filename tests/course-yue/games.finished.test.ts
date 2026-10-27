import { describe, it, expect } from 'vitest'
import { lessonOrder } from '@/engine/lessonIndex'
import { finishedFrom } from '@/engine/finishedData'
import { taught } from '@/engine/taughtData'
import { finishedCards, pickGameWords } from '@/engine/vocabGame'
import { vocab } from '@/engine/loader'
import { Rng } from '@/engine/random'
import { classifierOf, measureRound, metClassifiers, sortBoard } from '@/engine/games/measureWords'
import { pickDecoys } from '@/engine/games/scramble'
import { toneWords, wordToneRound } from '@/engine/games/tones'
import { dailyCandidates } from '@/engine/games/dailyWord'
import { languagePack } from '@/lang/yue'
import { charReadings } from '@/lang/yue/jyutping'
import type { CardRow, LessonRow } from '@/engine/types'

// The Cantonese games on the finished pool (runs in the Cantonese build only): the demo-sized
// learner has finished the first 40 lessons and started the next one.

const row = (id: string, completions: number): LessonRow => ({ id, unitId: id.slice(0, 6), level: id.slice(0, 2) as LessonRow['level'], attempts: 1, completions, bestAccuracy: 0.9, lastAccuracy: 0.9, xp: 10 })
const N = 40
const fin = finishedFrom([...lessonOrder.slice(0, N).map((l) => row(l.id, 1)), row(lessonOrder[N]!.id, 0)])
const readings = (c: string) => charReadings(c)

describe('finished pool on the Cantonese course', () => {
  it('shares its lesson index with the taught-words gate', () => {
    expect(lessonOrder.map((l) => l.id)).toEqual(taught.order)
    expect(fin.words).toEqual(taught.at(lessonOrder[N - 1]!.id))
    expect(fin.words.has(lessonOrder[N]!.vocab.find((id) => !fin.words.has(id)) ?? '')).toBe(false)
  })

  it('counts with finished nouns and, when it can, wrong measure words met in them', () => {
    const nouns = fin.entries.filter((v) => classifierOf(v))
    const met = metClassifiers(fin.entries)
    for (let seed = 1; seed <= 10; seed++) {
      const learner = pickGameWords(finishedCards([] as CardRow[], fin.words), (id) => {
        const v = vocab.get(id)
        return v && classifierOf(v) ? v : undefined
      }, 40, new Rng(seed))
      const qs = measureRound(learner, nouns, new Rng(seed), 12, met)
      expect(qs.length).toBeGreaterThanOrEqual(4)
      let fromMet = 0
      let options = 0
      for (const q of qs) {
        expect(fin.words.has(q.noun.id)).toBe(true)
        for (const [i, c] of q.options.entries()) {
          if (i === q.answer) continue
          options++
          if (met.has(c)) fromMet++
        }
      }
      // mostly met ones: an unmet classifier only fills in when too few met ones fit the noun
      expect(fromMet / options).toBeGreaterThan(0.6)
      const board = sortBoard(qs.map((q) => q.noun), nouns, new Rng(seed))
      for (const v of board?.nouns ?? []) expect(fin.words.has(v.id)).toBe(true)
    }
  })

  it('plays finished two-syllable words for the tones and decoys from finished characters', () => {
    const two = toneWords(fin.entries, 2, readings)
    expect(two.length).toBeGreaterThanOrEqual(10)
    const round = wordToneRound(two.slice(0, 3), two, new Rng(2), 10)
    for (const q of round) expect(fin.words.has(q.vocabId!)).toBe(true)
    const pool = fin.entries.flatMap((v) => [...v.lemma].filter((ch) => /\p{Script=Han}/u.test(ch)))
    const chars = new Set(pool)
    for (const d of pickDecoys(['朋', '友'], pool, 2, new Rng(3))) expect(chars.has(d)).toBe(true)
    for (const v of dailyCandidates(fin.entries, languagePack)) expect(fin.words.has(v.id)).toBe(true)
  })
})
