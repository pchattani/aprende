import { describe, it, expect } from 'vitest'
import { soundBoards, rapidRound } from '@/engine/vocabGame'
import { Rng } from '@/engine/random'
import { vocab, vocabUpTo } from '@/engine/loader'
import { IRREGULAR } from '@lang/verbs'
import { languagePack } from '@lang'
import type { VocabEntry } from '@/engine/schema'

const V = (id: string, lemma: string): VocabEntry => ({ id, lemma, pos: 'noun', en: [id], level: 'a1', tags: [] }) as VocabEntry

describe('listening games', () => {
  it('builds sound-match boards of four distinct-sounding words, each used once', () => {
    const words = ['si', 'sí', 'casa', 'perro', 'gato', 'mesa', 'agua', 'tren', 'sol', 'mar', 'pan', 'luz', 'flor'].map((l, i) => V(`w.${i}`, l))
    const key = (v: VocabEntry) => v.lemma.normalize('NFD').replace(/[̀-ͯ]/g, '')
    const boards = soundBoards(words, new Rng(3), key)
    expect(boards.length).toBe(3)
    const all = boards.flat()
    expect(new Set(all.map((v) => v.id)).size).toBe(all.length)
    for (const b of boards) {
      expect(b.length).toBe(4)
      expect(new Set(b.map(key)).size).toBe(4)
    }
    expect(soundBoards(words, new Rng(3), key)).toEqual(boards)
    expect(soundBoards(words.slice(0, 3), new Rng(1), key)).toEqual([])
  })
  it('makes a 10-word listening round with four meanings from this course', () => {
    const words = [...vocab.values()].filter((v) => v.level === 'a1').slice(0, 30)
    const round = rapidRound(words, { vocab, pool: vocabUpTo('a1'), verbs: IRREGULAR, stageOf: () => 0, speech: false }, new Rng(4)).slice(0, 10)
    expect(round.length).toBe(10)
    for (const q of round) {
      expect(new Set(q.options).size).toBe(4)
      expect(q.options[q.answer]).toBe(q.v.en[0])
      // typing what you hear: the lemma (and, for Cantonese, its Jyutping) is accepted
      expect(languagePack.match(q.v.lemma, [q.v.lemma]).verdict).toBe('correct')
      if (q.v.jp) expect(languagePack.match(q.v.jp, [q.v.lemma, q.v.jp]).verdict).toBe('correct')
    }
  })
})
