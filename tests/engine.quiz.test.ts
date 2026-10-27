import { describe, it, expect } from 'vitest'
import { buildRegionQuiz, QUIZ_SIZE } from '@/engine/quiz'
import type { Unit, Exam, VocabEntry } from '@/engine/schema'

const V = (id: string, lemma: string, en: string, topic?: string): VocabEntry => ({ id, lemma, pos: 'noun', gender: 'f', en: [en], level: 'a1', tags: [], topic }) as VocabEntry
const vocab = [
  V('w.derecha', 'derecha', 'right', 'directions'), V('w.izquierda', 'izquierda', 'left', 'directions'), V('w.arriba', 'arriba', 'top', 'directions'), V('w.detras', 'detrás', 'behind', 'directions'),
  V('w.manzana', 'manzana', 'apple', 'food'), V('w.pera', 'pera', 'pear', 'food'), V('w.uva', 'uva', 'grape', 'food'), V('w.pan', 'pan', 'bread', 'food'),
  V('w.casa', 'casa', 'house'), V('w.mesa', 'mesa', 'table'), V('w.silla', 'silla', 'chair'), V('w.puerta', 'puerta', 'door'),
]
const sentence = (n: number) => ({ es: `Frase ${n}.`, en: `Sentence ${n}.`, altEs: [], altEn: [], grammar: [], vocab: [] })
const unit = (id: string, questions: number): Unit => ({
  id,
  title: id,
  lessons: [{ id: `${id}.l1`, title: 'L', teach: [], vocab: [], sentences: [1, 2, 3, 4].map(sentence), exchanges: [], texts: [], spicy: [] }],
  writing: [],
  dialogues: [{ id: `${id}.d1`, title: `Diálogo ${id}`, lines: [{ speaker: 'A', es: 'Hola.', en: 'Hi.' }, { speaker: 'B', es: 'Hola.', en: 'Hi.' }], questions: Array.from({ length: questions }, (_, i) => ({ q: `¿Pregunta ${id} ${i + 1}?`, options: ['a', 'b', 'c'], answer: i % 3 })) }],
})
const exam = { grammar: Array.from({ length: 6 }, (_, i) => ({ prompt: `Gramática ${i + 1} ____`, options: ['x', 'y', 'z'], answer: i % 3, explain: 'because' })) } as unknown as Exam

describe('buildRegionQuiz', () => {
  const units = ['a1.u01', 'a1.u02', 'a1.u03', 'a1.u04', 'a1.u05', 'a1.u06', 'a1.u07'].map((id, i) => unit(id, i === 0 ? 0 : 3))
  it('builds 12 unique items with valid answers, mixing sources', () => {
    const q = buildRegionQuiz('a1', units, exam, vocab, 7)
    expect(q.length).toBe(QUIZ_SIZE)
    expect(new Set(q.map((x) => x.prompt)).size).toBe(q.length)
    for (const x of q) {
      expect(x.answer).toBeGreaterThanOrEqual(0)
      expect(x.answer).toBeLessThan(x.options.length)
      expect(new Set(x.options).size).toBe(x.options.length)
    }
    const sources = new Set(q.map((x) => x.source))
    expect(sources.has('dialogue')).toBe(true)
    expect(sources.has('grammar')).toBe(true)
    expect(sources.has('vocab')).toBe(true)
    expect(q.filter((x) => x.source === 'dialogue').length).toBeLessThanOrEqual(6)
  })
  it('is deterministic for a seed and prefers stamped units for dialogue questions', () => {
    const a = buildRegionQuiz('a1', units, exam, vocab, 3, new Set(['a1.u07']))
    const b = buildRegionQuiz('a1', units, exam, vocab, 3, new Set(['a1.u07']))
    expect(a).toEqual(b)
    expect(a.some((x) => x.prompt.includes('a1.u07'))).toBe(true)
  })
  it('falls back gracefully when a level has no dialogue questions or exam', () => {
    const q = buildRegionQuiz('a1', [unit('a1.u01', 0)], undefined, vocab, 1)
    expect(q.length).toBeGreaterThan(0)
    expect(q.every((x) => x.source === 'vocab')).toBe(true)
  })
})
