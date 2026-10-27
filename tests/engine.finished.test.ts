import { describe, it, expect } from 'vitest'
import * as esVerbs from '@/lang/es/verbs'
import * as esNorm from '@/lang/es/normalize'
import { IRREGULAR } from '@/lang/es/verbs'
import { finishedPool, makeFinished, countFitting, type LessonIdsLike } from '@/engine/finished'
import { finishedCards, pickGameWords, rapidRound } from '@/engine/vocabGame'
import { distractorWords } from '@/engine/generate'
import { kitFrom, finishedTenses, deckFor, type VerbsModuleLike } from '@/engine/games/verbPrompts'
import { dailyCandidates, wordOfDay } from '@/engine/games/dailyWord'
import { distractorClassifiers, metClassifiers, classifierOf } from '@/engine/games/measureWords'
import { sameOrDifferentRound, whichToneRound, MINIMAL_SETS } from '@/engine/games/tones'
import { Rng } from '@/engine/random'
import type { CardRow, LessonRow } from '@/engine/types'
import type { VocabEntry } from '@/engine/schema'

// The games' finished pool (engine/finished.ts) on a small synthetic course: words come only from
// lessons with completions > 0, never from a lesson started and left halfway (it has cards).

const V = (id: string, lemma: string, en: string, pos: VocabEntry['pos'] = 'noun', extra: Partial<VocabEntry> = {}): VocabEntry => ({ id, lemma, pos, gender: 'm', en: [en], level: 'a1', tags: [], ...extra }) as VocabEntry
const WORDS = [
  V('w.perro', 'perro', 'dog'), V('w.gato', 'gato', 'cat'), V('w.casa', 'casa', 'house'), V('w.mesa', 'mesa', 'table'),
  V('w.libro', 'libro', 'book'), V('w.silla', 'silla', 'chair'), V('w.hablar', 'hablar', 'to speak', 'verb'), V('w.comer', 'comer', 'to eat', 'verb'),
  // lesson 3 (started, not finished) and lesson 4 (not started)
  V('w.ciudad', 'ciudad', 'city'), V('w.playa', 'playa', 'beach'), V('w.tener', 'tener', 'to have', 'verb'), V('w.sol', 'sol', 'sun'),
  V('w.luna', 'luna', 'moon'), V('w.mar', 'mar', 'sea'), V('w.ir', 'ir', 'to go', 'verb'), V('w.agua', 'agua', 'water'),
]
const vocab = new Map(WORDS.map((w) => [w.id, w]))
const ORDER: LessonIdsLike[] = [
  { id: 'a1.u01.l1', vocab: ['w.perro', 'w.gato', 'w.casa', 'w.mesa'], grammar: ['g.present-regular', 'g.articles'] },
  { id: 'a1.u01.l2', vocab: ['w.libro', 'w.silla', 'w.hablar', 'w.comer'], grammar: ['g.present-regular'] },
  { id: 'a1.u01.l3', vocab: ['w.ciudad', 'w.playa', 'w.tener', 'w.sol'], grammar: ['g.preterite-regular'] },
  { id: 'a2.u01.l1', vocab: ['w.luna', 'w.mar', 'w.ir', 'w.agua'], grammar: ['g.imperfect'] },
]
const INDEX = new Map(ORDER.map((l) => [l.id, l]))
const row = (id: string, completions: number): LessonRow => ({ id, unitId: id.slice(0, 6), level: id.slice(0, 2) as LessonRow['level'], attempts: Math.max(1, completions), completions, bestAccuracy: 0, lastAccuracy: 0, xp: 0 })
const ROWS = [row('a1.u01.l1', 2), row('a1.u01.l2', 1), row('a1.u01.l3', 0)]
const FINISHED = ['w.perro', 'w.gato', 'w.casa', 'w.mesa', 'w.libro', 'w.silla', 'w.hablar', 'w.comer']
const card = (id: string, due: number, stability = 1): CardRow => ({ id, kind: 'word', level: 'a1', lessonId: 'a1.u01.l1', grammar: [], stage: 0, streak: 0, due, stability, difficulty: 5, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 1, lapses: 0, state: 2 })

describe('the finished pool', () => {
  it('holds the vocab and grammar of lessons with completions > 0 only', () => {
    const pool = finishedPool(ROWS, INDEX)
    expect([...pool.lessons]).toEqual(['a1.u01.l1', 'a1.u01.l2'])
    expect([...pool.words].sort()).toEqual([...FINISHED].sort())
    expect(pool.words.has('w.ciudad')).toBe(false)
    expect([...pool.grammar].sort()).toEqual(['g.articles', 'g.present-regular'])
    expect([...pool.levels]).toEqual(['a1'])
  })

  it('is empty for a new learner, and ignores lessons the course no longer has', () => {
    expect(finishedPool([], INDEX).words.size).toBe(0)
    const pool = finishedPool([row('a1.u09.l9', 1)], INDEX)
    expect(pool.lessons.has('a1.u09.l9')).toBe(true)
    expect(pool.words.size).toBe(0)
  })

  it('counts the lessons still to finish before a game has enough words', () => {
    const fin = makeFinished(finishedPool(ROWS, INDEX), ORDER, (id) => vocab.get(id))
    expect(fin.entries.map((v) => v.id).sort()).toEqual([...FINISHED].sort())
    expect(fin.moreLessons(() => true, 8)).toBe(0)
    expect(fin.moreLessons(() => true, 9)).toBe(1)
    expect(fin.moreLessons(() => true, 13)).toBe(2)
    expect(fin.moreLessons(() => true, 99)).toBeUndefined()
    const verbs = (v: VocabEntry) => v.pos === 'verb'
    expect(fin.moreLessons(verbs, 3)).toBe(1)
    const fresh = makeFinished(finishedPool([], INDEX), ORDER, (id) => vocab.get(id))
    expect(fresh.moreLessons(() => true, 4)).toBe(1)
    expect(fresh.moreLessons(verbs, 1)).toBe(2)
    expect(fresh.moreLessonsUntil((list) => list.some((v) => v.id === 'w.mar'))).toBe(4)
    expect(countFitting(fin.entries, verbs)).toBe(2)
  })
})

describe('games play finished words only', () => {
  const pool = finishedPool(ROWS, INDEX)
  const fin = makeFinished(pool, ORDER, (id) => vocab.get(id))
  // cards for every word, those of the started lesson due first
  const now = 1_000_000
  const cards = WORDS.map((w, i) => card(w.id, FINISHED.includes(w.id) ? now + 1000 * i : now - 1, i))

  it('picks from the finished words, due and weak first, never a started lesson’s words', () => {
    for (let seed = 1; seed < 30; seed++) {
      const picked = pickGameWords(finishedCards(cards, pool.words), (id) => vocab.get(id), 6, new Rng(seed), now)
      expect(picked).toHaveLength(6)
      for (const v of picked) expect(FINISHED).toContain(v.id)
    }
    // a finished word without a card still plays, after every carded word
    const some = finishedCards(cards.filter((c) => c.id !== 'w.mesa'), pool.words)
    expect(some.map((c) => c.id)).toContain('w.mesa')
    expect(some.at(-1)!.id).toBe('w.mesa')
    expect(finishedCards(cards, new Set()).length).toBe(0)
  })

  it('takes options and distractors from the finished words only, fewer rather than unfinished', () => {
    const ctx = { vocab, pool: fin.entries, verbs: IRREGULAR, stageOf: () => 0 as const, speech: false }
    const glosses = new Set(fin.entries.map((v) => v.en[0]))
    for (let seed = 1; seed < 30; seed++) {
      const round = rapidRound(fin.entries, ctx, new Rng(seed), 1)
      expect(round.length).toBe(fin.entries.length)
      for (const q of round) for (const o of q.options) expect(glosses).toContain(o)
      for (const v of fin.entries) for (const d of distractorWords(v, ctx, new Rng(seed), 3)) expect(FINISHED).toContain(d.id)
    }
    // two finished words: one distractor, not three from elsewhere
    const tiny = { ...ctx, pool: fin.entries.slice(0, 2) }
    const q = rapidRound(fin.entries.slice(0, 1), tiny, new Rng(3), 1)
    expect(q[0]!.options).toHaveLength(2)
    expect(rapidRound(fin.entries.slice(0, 1), tiny, new Rng(3))).toHaveLength(0)
  })

  it('keeps Word of the day to finished words, with nothing to pick for a new learner', () => {
    const pack = { normalize: (s: string) => s.toLowerCase(), stripMarks: (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '') }
    const list = dailyCandidates(fin.entries, pack)
    expect(list.length).toBeGreaterThan(0)
    for (const v of list) expect(FINISHED).toContain(v.id)
    for (let d = 1; d <= 28; d++) expect(FINISHED).toContain(wordOfDay(list.map((v) => v.id), `2026-10-${String(d).padStart(2, '0')}`, 'es'))
    expect(dailyCandidates(makeFinished(finishedPool([], INDEX), ORDER, (id) => vocab.get(id)).entries, pack)).toEqual([])
  })
})

describe('verb games and finished grammar', () => {
  const kit = kitFrom(esVerbs as unknown as VerbsModuleLike, { id: 'es', match: esNorm.match, normalize: esNorm.normalize })
  it('plays the present only until a finished lesson teaches another tense', () => {
    expect(finishedTenses(kit, finishedPool(ROWS, INDEX).grammar)).toEqual(['pres'])
    expect(finishedTenses(kit, finishedPool([...ROWS, row('a1.u01.l3', 1)], INDEX).grammar)).toEqual(['pres', 'pret'])
    // the level alone opens nothing: an A2 lesson finished opens only what it teaches
    expect(finishedTenses(kit, finishedPool([row('a2.u01.l1', 1)], INDEX).grammar)).toEqual(['pres', 'impf'])
  })
  it('deals finished verbs only, no irregular stars beyond them', () => {
    const fin = makeFinished(finishedPool(ROWS, INDEX), ORDER, (id) => vocab.get(id))
    const verbs = fin.entries.filter((v) => v.pos === 'verb')
    const deck = deckFor(kit, verbs.slice(0, 1), verbs, 'a1', 12)
    expect(deck.map((v) => v.lemma).sort()).toEqual(['comer', 'hablar'])
  })
})

describe('Cantonese games and the finished pool', () => {
  const N = (lemma: string, jp: string, cl: string, en: string): VocabEntry => ({ id: `w.${jp}`, lemma, jp, pos: 'noun', cl, en: [en], level: 'a1', tags: [], topic: 'animals' }) as VocabEntry
  it('offers wrong measure words met in finished lessons when there are enough', () => {
    const finished = [N('狗', 'gau2', '隻', 'dog'), N('魚', 'jyu2', '條', 'fish'), N('書', 'syu1', '本', 'book'), N('紙', 'zi2', '張', 'paper'), N('車', 'ce1', '架', 'car')]
    const met = metClassifiers(finished)
    expect([...met].sort()).toEqual(['張', '本', '條', '架', '隻'].sort())
    for (let seed = 1; seed < 40; seed++) {
      const wrong = distractorClassifiers(finished[0]!, new Rng(seed), 3, met)
      expect(wrong).toHaveLength(3)
      for (const c of wrong) expect(met).toContain(c)
      expect(wrong).not.toContain(classifierOf(finished[0]!))
    }
    // too few met: the rest fill in
    expect(distractorClassifiers(finished[0]!, new Rng(1), 3, new Set(['條']))).toHaveLength(3)
  })
  it('leans the curated tone drills on finished characters', () => {
    const chars = new Set(['媽', '馬', '罵'])
    for (let seed = 1; seed < 20; seed++) {
      const which = whichToneRound([], new Rng(seed), 10, chars)
      for (const ch of chars) expect(which.map((q) => q.text)).toContain(ch)
      const pairs = sameOrDifferentRound(new Rng(seed), 10, chars)
      const maa = MINIMAL_SETS.find((s) => s.base === 'maa')!
      const maaChars = new Set(Object.values(maa.tones).flatMap((l) => l!.map(([ch]) => ch)))
      expect(pairs.some((p) => maaChars.has(p.a.ch))).toBe(true)
    }
  })
})
