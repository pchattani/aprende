import { describe, it, expect } from 'vitest'
import { generateLesson, generateReview, sentenceId } from '@/engine/generate'
import { grade } from '@/engine/grade'
import { spanish } from '@/lang/es'
import { IRREGULAR } from '@/lang/es/verbs'
import type { Lesson, VocabEntry } from '@/engine/schema'
import type { Exercise, Stage, ItemKind } from '@/engine/types'

const V = (id: string, lemma: string, pos: VocabEntry['pos'], en: string, extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id, lemma, pos, en: [en], level: 'a1', tags: [], ...extra }) as VocabEntry
const vocabList = [
  V('w.casa', 'casa', 'noun', 'house', { gender: 'f' }), V('w.perro', 'perro', 'noun', 'dog', { gender: 'm' }),
  V('w.gato', 'gato', 'noun', 'cat', { gender: 'm' }), V('w.grande', 'grande', 'adj', 'big'), V('w.pequeno', 'pequeño', 'adj', 'small'),
  V('w.tener', 'tener', 'verb', 'to have'), V('w.comer', 'comer', 'verb', 'to eat'), V('w.libro', 'libro', 'noun', 'book', { gender: 'm' }),
  V('w.mesa', 'mesa', 'noun', 'table', { gender: 'f' }), V('w.rojo', 'rojo', 'adj', 'red'),
]
const vocab = new Map(vocabList.map((v) => [v.id, v]))
const lesson: Lesson = {
  id: 'a1.u01.l1', title: 'Test', teach: ['g.tener-present'], vocab: ['w.casa', 'w.perro', 'w.gato', 'w.grande', 'w.tener', 'w.comer'],
  exchanges: [], texts: [],
  sentences: [
    { es: 'Tengo un perro grande.', en: 'I have a big dog.', altEs: ['Yo tengo un perro grande.'], altEn: [], grammar: ['g.tener-present'], vocab: ['w.tener', 'w.perro'] },
    { es: 'La casa es pequeña.', en: 'The house is small.', altEs: [], altEn: [], grammar: [], vocab: ['w.casa'] },
    { es: 'El gato come.', en: 'The cat eats.', altEs: [], altEn: ['The cat is eating.'], grammar: [], vocab: ['w.gato', 'w.comer'] },
    { es: 'Tienes un libro rojo.', en: 'You have a red book.', altEs: [], altEn: [], grammar: ['g.tener-present'], vocab: ['w.tener'], transform: { instruction: 'Change to "we"', answer: 'Tenemos un libro rojo.', alt: [] } },
    { es: 'Comemos en la mesa.', en: 'We eat at the table.', altEs: [], altEn: [], grammar: [], vocab: ['w.comer'], error: { wrong: 'Comemos en el mesa.', explain: 'mesa is feminine.' } },
  ],
}
const ctx = (stage: Stage | undefined, speech = false) => ({ vocab, pool: vocabList, verbs: IRREGULAR, stageOf: () => stage, speech })

describe('generateLesson', () => {
  it('is deterministic for a seed and hits the target count', () => {
    const a = generateLesson(lesson, ctx(0), { seed: 42, count: 12 })
    const b = generateLesson(lesson, ctx(0), { seed: 42, count: 12 })
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThanOrEqual(10)
    expect(a.length).toBeLessThanOrEqual(13)
  })
  it('starts with matching for new words and uses recognition kinds at stage 0', () => {
    const ex = generateLesson(lesson, ctx(0), { seed: 7 })
    expect(ex[0]!.kind).toBe('match')
    const sentenceKinds = new Set(ex.filter((e) => e.items.some((i) => i.startsWith('s.'))).map((e) => e.kind))
    for (const k of sentenceKinds) expect(['choiceEs', 'listen', 'wordBank', 'typeEn', 'fillBlank', 'order', 'typeEs', 'conjugate', 'dictation']).toContain(k)
  })
  it('uses production kinds at stage 3 and never uses the answer as a distractor', () => {
    const ex = generateLesson(lesson, ctx(3, true), { seed: 3, count: 14 })
    const kinds = new Set(ex.map((e) => e.kind))
    expect([...kinds].some((k) => ['typeEs', 'speak', 'transform', 'findError', 'conjugate', 'dictation'].includes(k))).toBe(true)
    for (const e of ex) {
      if ('options' in e) expect(new Set(e.options).size).toBe(e.options.length)
    }
  })
  it('attaches a grammar tip once', () => {
    const ex = generateLesson(lesson, ctx(1), { seed: 11 })
    expect(ex.filter((e) => e.teach === 'g.tener-present').length).toBeLessThanOrEqual(1)
  })
  it('builds conjugate exercises with blanks and hints', () => {
    let found: Exercise | undefined
    for (let seed = 0; seed < 40 && !found; seed++) found = generateLesson(lesson, ctx(2), { seed }).find((e) => e.kind === 'conjugate')
    expect(found).toBeDefined()
    if (found && found.kind === 'conjugate') {
      expect(found.prompt).toContain('____')
      expect(found.hint).toMatch(/tener|comer/)
    }
  })
  it('sentence ids are stable', () => {
    expect(sentenceId('a1.u01.l1', 0, lesson.sentences[0]!)).toBe('s.a1.u01.l1.1')
  })
})

describe('generateReview', () => {
  it('produces one exercise per card, grouping low-stage words into match', () => {
    const cards: { id: string; kind: ItemKind; stage: Stage }[] = vocabList.slice(0, 6).map((v) => ({ id: v.id, kind: 'word', stage: 0 }))
    cards.push({ id: 's.a1.u01.l1.1', kind: 'sentence', stage: 2 as Stage })
    const ex = generateReview(cards, { word: (id) => vocab.get(id), sentence: (id) => (id === 's.a1.u01.l1.1' ? { s: lesson.sentences[0]!, lesson } : undefined) }, ctx(0), 5)
    expect(ex.some((e) => e.kind === 'match')).toBe(true)
    expect(ex.flatMap((e) => e.items)).toContain('s.a1.u01.l1.1')
  })
})

describe('grade', () => {
  const deps = { pack: spanish }
  it('grades choices', () => {
    const ex: Exercise = { kind: 'choiceEs', items: [], grammar: [], prompt: 'casa', options: ['dog', 'house', 'cat', 'table'], answer: 1 }
    expect(grade(ex, 1, deps).verdict).toBe('correct')
    expect(grade(ex, 0, deps).verdict).toBe('wrong')
  })
  it('grades typed Spanish with accent tolerance and alternatives', () => {
    const ex: Exercise = { kind: 'typeEs', items: [], grammar: [], prompt: 'I have a big dog.', answers: ['Tengo un perro grande.', 'Yo tengo un perro grande.'] }
    expect(grade(ex, 'yo tengo un perro grande', deps).verdict).toBe('correct')
    expect(grade(ex, 'Tengo un perro pequeño', deps).verdict).toBe('wrong')
  })
  it('grades English with contractions', () => {
    const ex: Exercise = { kind: 'typeEn', items: [], grammar: [], prompt: 'Tengo un perro.', answers: ['I have a dog.'] }
    expect(grade(ex, "i've got a dog", deps).verdict).toBe('wrong')
    expect(grade(ex, 'I have a dog', deps).verdict).toBe('correct')
    const ex2: Exercise = { kind: 'typeEn', items: [], grammar: [], prompt: 'Es grande.', answers: ["It's big."] }
    expect(grade(ex2, 'it is big', deps).verdict).toBe('correct')
  })
  it('grades word bank tiles', () => {
    const ex: Exercise = { kind: 'wordBank', items: [], grammar: [], prompt: 'The cat eats.', tiles: ['come', 'el', 'gato', 'la'], answers: ['El gato come.'] }
    expect(grade(ex, ['el', 'gato', 'come'], deps).verdict).toBe('correct')
    expect(grade(ex, ['gato', 'el', 'come'], deps).verdict).toBe('wrong')
  })
  it('grades speech with partial credit', () => {
    const ex: Exercise = { kind: 'speak', items: [], grammar: [], prompt: 'Tengo un perro grande.', answers: ['Tengo un perro grande.'] }
    expect(grade(ex, 'tengo un perro grande', deps).verdict).toBe('correct')
    expect(grade(ex, 'tengo un perro', deps).verdict).toBe('almost')
    expect(grade(ex, '', deps).verdict).toBe('wrong')
  })
  it('grades match by mistakes', () => {
    const ex: Exercise = { kind: 'match', items: [], grammar: [], pairs: [{ left: 'casa', right: 'house' }] }
    expect(grade(ex, { mistakes: 0 }, deps).verdict).toBe('correct')
    expect(grade(ex, { mistakes: 3 }, deps).verdict).toBe('wrong')
  })
})
