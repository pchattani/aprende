import { describe, it, expect } from 'vitest'
import { Rng } from '@/engine/random'
import { buildStage, vocabItem, stagePassed, placementLevel, STAGE_SIZE, GRAMMAR_PER_STAGE } from '@/engine/placement'
import { levelUnlocked, lessonUnlocked, levelIndex } from '@/engine/unlock'
import { levels, vocab } from '@/engine/loader'
import type { Exam, VocabEntry } from '@/engine/schema'

const exam: Exam = {
  level: 'a1',
  title: 'T',
  passScore: 0.8,
  reading: { text: 'x', questions: [{ q: 'q', options: ['a', 'b'], answer: 0 }, { q: 'q', options: ['a', 'b'], answer: 0 }, { q: 'q', options: ['a', 'b'], answer: 0 }] },
  listening: { dictation: ['a', 'b', 'c'], questions: [] },
  grammar: Array.from({ length: 10 }, (_, i) => ({ prompt: `g${i} ___`, options: ['x', 'y', 'z'], answer: i % 3 })),
  writing: { prompt: 'p', minWords: 1, modelAnswer: 'm', checklist: ['a', 'b', 'c'] },
  speaking: ['a', 'b', 'c'],
}

describe('placement stages', () => {
  const a1 = [...vocab.values()].filter((v) => v.level === 'a1')

  it('builds a stage of the right size and mix, deterministically from the seed', () => {
    const s1 = buildStage('a1', exam, a1, 42)
    const s2 = buildStage('a1', exam, a1, 42)
    expect(s1.items).toHaveLength(STAGE_SIZE)
    expect(s1.items.filter((i) => i.kind === 'grammar')).toHaveLength(GRAMMAR_PER_STAGE)
    expect(s1.items.filter((i) => i.kind === 'vocab')).toHaveLength(STAGE_SIZE - GRAMMAR_PER_STAGE)
    expect(s1).toEqual(s2)
    for (const it of s1.items) {
      expect(it.options.length).toBeGreaterThanOrEqual(3)
      expect(it.options[it.answer]).toBeDefined()
    }
  })

  it('vocab items have four distinct options including the right gloss', () => {
    const entry = a1.find((v) => v.lemma === 'casa')!
    const it = vocabItem(entry, a1, new Rng(1))!
    expect(it.options).toHaveLength(4)
    expect(new Set(it.options).size).toBe(4)
    expect(it.options[it.answer]).toBe('house')
    expect(it.prompt).toBe('casa')
  })

  it('refuses a vocab item when there are not enough same-class distractors', () => {
    const tiny: VocabEntry[] = a1.filter((v) => v.pos === 'noun').slice(0, 3)
    expect(vocabItem(tiny[0]!, tiny, new Rng(1))).toBeUndefined()
  })

  it('a stage without an exam still produces vocabulary items', () => {
    const s = buildStage('a1', undefined, a1, 7)
    expect(s.items.length).toBe(STAGE_SIZE)
    expect(s.items.every((i) => i.kind === 'vocab')).toBe(true)
  })

  it('pass threshold and placement decision', () => {
    expect(stagePassed(6)).toBe(true)
    expect(stagePassed(5)).toBe(false)
    expect(stagePassed(3, 3)).toBe(true)
    expect(placementLevel(['a1', 'a2', 'b1'], [false])).toBe('a1')
    expect(placementLevel(['a1', 'a2', 'b1'], [true, false])).toBe('a2')
    expect(placementLevel(['a1', 'a2', 'b1'], [true, true, false])).toBe('b1')
    expect(placementLevel(['a1', 'a2', 'b1'], [true, true, true])).toBe('b2')
    expect(placementLevel([], [])).toBe('a1')
  })
})

describe('open course', () => {
  const none = new Map()
  const counts = new Map<string, number>()
  const b1 = levels.find((l) => l.id === 'b1')!
  it('every level and lesson is open regardless of the starting level', () => {
    expect(levelUnlocked('a1', none, none, counts)).toBe(true)
    expect(levelUnlocked('c2', none, none, counts, 'a1')).toBe(true)
    expect(lessonUnlocked('b1.u07.l3', b1, none, none, counts, 'a1')).toBe(true)
    expect(levelIndex('b1')).toBeGreaterThan(levelIndex('a2'))
  })
})
