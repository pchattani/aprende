import { describe, it, expect } from 'vitest'
import * as esVerbs from '@/lang/es/verbs'
import * as esNorm from '@/lang/es/normalize'
import { IRREGULAR } from '@/lang/es/verbs'
import { languagePack } from '@/lang/es'
import { vocab } from '@/engine/loader'
import { lessonOrder } from '@/engine/lessonIndex'
import { finishedFrom } from '@/engine/finishedData'
import { finishedCards, pickGameWords, rapidRound } from '@/engine/vocabGame'
import { distractorWords } from '@/engine/generate'
import { kitFrom, finishedTenses, deckFor, playableVerb, type VerbsModuleLike } from '@/engine/games/verbPrompts'
import { dailyCandidates } from '@/engine/games/dailyWord'
import { sortRound } from '@/engine/games/sortIt'
import { Rng } from '@/engine/random'
import type { CardRow, LessonRow } from '@/engine/types'

// The games' finished pool on the Spanish course (runs in the Spanish build only): the first
// lessons finished, the next one started and left halfway (its words have cards but never play).

const row = (id: string, completions: number): LessonRow => ({ id, unitId: id.slice(0, 6), level: id.slice(0, 2) as LessonRow['level'], attempts: 1, completions, bestAccuracy: 0.9, lastAccuracy: 0.9, xp: 10 })
const rowsUpTo = (n: number) => [...lessonOrder.slice(0, n).map((l) => row(l.id, 1)), row(lessonOrder[n]!.id, 0)]
const card = (id: string, due: number): CardRow => ({ id, kind: 'word', level: 'a1', lessonId: 'a1.u01.l1', grammar: [], stage: 0, streak: 0, due, stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 1, lapses: 0, state: 2 })
const kit = kitFrom(esVerbs as unknown as VerbsModuleLike, { id: 'es', match: esNorm.match, normalize: esNorm.normalize })
const fold = (s: string) => languagePack.stripMarks(languagePack.normalize(s))

describe('finished pool on the Spanish course', () => {
  const fin = finishedFrom(rowsUpTo(8))
  const started = new Set(lessonOrder[8]!.vocab.filter((id) => !fin.words.has(id)))
  const now = Date.now()
  // every word of the first 12 lessons has a card; the started lesson's are all due
  const cards = lessonOrder.slice(0, 12).flatMap((l) => l.vocab.map((id) => card(id, started.has(id) ? now - 1 : now + 86_400_000)))

  it('is the vocab of the lessons completed, not of the one left halfway', () => {
    expect(fin.lessons.size).toBe(8)
    expect(started.size).toBeGreaterThan(0)
    expect(fin.words).toEqual(new Set(lessonOrder.slice(0, 8).flatMap((l) => l.vocab)))
    for (const id of started) expect(fin.words.has(id)).toBe(false)
    expect(fin.entries.length).toBeGreaterThan(30)
  })

  it('picks game words and distractors from finished words only', () => {
    const ctx = { vocab, pool: fin.entries, verbs: IRREGULAR, stageOf: () => 0 as const, speech: false }
    const glosses = new Set(fin.entries.map((v) => v.en[0]))
    for (let seed = 1; seed <= 10; seed++) {
      const words = pickGameWords(finishedCards(cards, fin.words), (id) => vocab.get(id), 30, new Rng(seed), now)
      expect(words.length).toBeGreaterThan(20)
      for (const v of words) expect(fin.words.has(v.id), v.id).toBe(true)
      for (const q of rapidRound(words, ctx, new Rng(seed), 1)) for (const o of q.options) expect(glosses.has(o), o).toBe(true)
      for (const v of words.slice(0, 10)) for (const d of distractorWords(v, ctx, new Rng(seed), 3)) expect(fin.words.has(d.id), d.id).toBe(true)
    }
  })

  it('sorts and hides finished words only', () => {
    const round = sortRound(fin.entries, vocab.values(), { lang: 'es', rng: new Rng(4), fold })
    for (const c of round?.cards ?? []) expect(fin.words.has(c.v.id)).toBe(true)
    const daily = dailyCandidates(fin.entries, languagePack)
    expect(daily.length).toBeGreaterThan(5)
    for (const v of daily) expect(fin.words.has(v.id)).toBe(true)
  })

  it('needs a lesson for a new learner, and counts the lessons to go', () => {
    const fresh = finishedFrom([])
    expect(fresh.entries).toEqual([])
    expect(dailyCandidates(fresh.entries, languagePack)).toEqual([])
    expect(fresh.moreLessons((v) => Boolean(v.en[0]), 4)).toBe(1)
    expect(fresh.moreLessons(playableVerb, 1)).toBeGreaterThanOrEqual(1)
  })
})

describe('verb games on the Spanish course', () => {
  const upTo = (id: string) => finishedFrom(lessonOrder.slice(0, lessonOrder.findIndex((l) => l.id === id) + 1).map((l) => row(l.id, 1)))
  it('plays the present only through A1, then the tenses finished lessons teach', () => {
    expect(finishedTenses(kit, finishedFrom(rowsUpTo(10)).grammar)).toEqual(['pres'])
    expect(finishedTenses(kit, upTo('a1.u12.l4').grammar)).toEqual(['pres'])
    expect(finishedTenses(kit, upTo('a2.u01.l1').grammar)).toEqual(['pres', 'pret'])
    const a2 = finishedTenses(kit, upTo('a2.u03.l1').grammar)
    expect(a2).toContain('impf')
    expect(a2).not.toContain('fut')
    expect(a2).not.toContain('subjPres')
  })
  it('deals verbs from finished lessons only', () => {
    const fin = finishedFrom(rowsUpTo(10))
    const verbs = fin.entries.filter((v) => v.pos === 'verb')
    expect(verbs.length).toBeGreaterThan(0)
    const deck = deckFor(kit, verbs.slice(0, 2), verbs, 'a1', 16)
    for (const v of deck) expect(fin.words.has(v.id)).toBe(true)
  })
})
