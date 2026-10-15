import { describe, it, expect } from 'vitest'
import { pickGameWords, memoryBoard, rapidRound, rapidPoints } from '@/engine/vocabGame'
import { Rng } from '@/engine/random'
import { IRREGULAR } from '@/lang/es/verbs'
import type { CardRow } from '@/engine/types'
import type { VocabEntry } from '@/engine/schema'

const V = (id: string, lemma: string, en: string): VocabEntry => ({ id, lemma, pos: 'noun', gender: 'm', en: [en], level: 'a1', tags: [] }) as VocabEntry
const words = Array.from({ length: 12 }, (_, i) => V(`w.p${i}`, `palabra${i}`, `word${i}`))
const vocab = new Map(words.map((w) => [w.id, w]))
const card = (id: string, due: number, stability: number): CardRow => ({ id, kind: 'word', level: 'a1', lessonId: 'a1.u01.l1', grammar: [], stage: 0, streak: 0, due, stability, difficulty: 5, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 1, lapses: 0, state: 2 })

describe('vocab games', () => {
  it('picks due and weak words first, without duplicate meanings', () => {
    const now = 1_000_000
    const cards = words.map((w, i) => card(w.id, i < 3 ? now - 1 : now + 100_000, i))
    const picked = pickGameWords(cards, (id) => vocab.get(id), 8, new Rng(1), now)
    expect(picked.length).toBe(8)
    for (const id of ['w.p0', 'w.p1', 'w.p2']) expect(picked.map((p) => p.id)).toContain(id)
    expect(new Set(picked.map((p) => p.en[0])).size).toBe(8)
  })
  it('builds a 16-tile memory board with 8 pairs, deterministically', () => {
    const a = memoryBoard(words, new Rng(5))
    const b = memoryBoard(words, new Rng(5))
    expect(a).toEqual(b)
    expect(a.length).toBe(16)
    const keys = new Map<string, number>()
    for (const t of a) keys.set(t.key, (keys.get(t.key) ?? 0) + 1)
    expect([...keys.values()].every((n) => n === 2)).toBe(true)
    expect(a.filter((t) => t.side === 'es').length).toBe(8)
  })
  it('builds quick-fire questions with four distinct options and a scoring multiplier', () => {
    const ctx = { vocab, pool: words, verbs: IRREGULAR, stageOf: () => 0 as const, speech: false }
    const round = rapidRound(words.slice(0, 5), ctx, new Rng(2))
    expect(round.length).toBe(5)
    for (const q of round) {
      expect(q.options.length).toBe(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options[q.answer]).toBe(q.v.en[0])
    }
    expect(rapidPoints(0)).toBe(10)
    expect(rapidPoints(3)).toBe(20)
    expect(rapidPoints(30)).toBe(40)
  })
})
