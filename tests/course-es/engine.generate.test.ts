import { describe, it, expect } from 'vitest'
import { generateLesson, generateReview, generatePinned, sentenceId, distractorWords, deAdjacent } from '@/engine/generate'
import { Rng, hashString } from '@/engine/random'
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
  exchanges: [], texts: [], spicy: [],
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
    const a = generateLesson(lesson, ctx(0), { seed: 42, count: 12, extra })
    const b = generateLesson(lesson, ctx(0), { seed: 42, count: 12, extra })
    expect(a).toEqual(b)
    expect(a.length).toBe(12)
    for (const n of [9, 12, 16]) expect(generateLesson(lesson, ctx(0), { seed: 5, count: n, extra }).length).toBe(n)
  })
  it('gives every exercise a bilingual review', () => {
    for (const stage of [0, 1, 2, 3] as Stage[]) {
      for (const seed of [1, 2, 3]) {
        for (const e of generateLesson(lesson, ctx(stage, true), { seed, count: 12, extra })) {
          expect(e.review?.es, `${e.kind} ${seed} ${stage}`).toBeTruthy()
          expect(e.review?.en, `${e.kind} ${seed} ${stage}`).toBeTruthy()
        }
      }
    }
  })
  it('never puts the same item in two neighbouring exercises', () => {
    for (let seed = 0; seed < 20; seed++) {
      const ex = generateLesson(lesson, ctx(1), { seed, count: 12, extra })
      for (let i = 1; i < ex.length; i++) {
        const a = ex[i - 1]!.items[0] ?? ex[i - 1]!.review?.es
        const b = ex[i]!.items[0] ?? ex[i]!.review?.es
        expect(a, `seed ${seed} index ${i}`).not.toBe(b)
      }
    }
    const dup = deAdjacent([{ kind: 'speak', items: ['s.1'], grammar: [], prompt: '', answers: [] }, { kind: 'speak', items: ['s.1'], grammar: [], prompt: '', answers: [] }, { kind: 'speak', items: ['s.2'], grammar: [], prompt: '', answers: [] }])
    expect(dup.map((e) => e.items[0])).toEqual(['s.1', 's.2', 's.1'])
  })
  it('leaves the previous session\'s sentences for last', () => {
    const big: Lesson = { ...lesson, sentences: Array.from({ length: 12 }, (_, i) => ({ es: `Frase número ${i + 1} aquí.`, en: `Sentence number ${i + 1} here.`, altEs: [], altEn: [], grammar: [], vocab: [] })) }
    const first = generateLesson(big, ctx(0), { seed: 1, count: 7 })
    const usedIds = new Set(first.flatMap((e) => e.items.filter((i) => i.startsWith('s.'))))
    expect(usedIds.size).toBeGreaterThanOrEqual(4)
    const second = generateLesson(big, ctx(0), { seed: 2, count: 7, avoid: usedIds })
    const again = second.flatMap((e) => e.items.filter((i) => i.startsWith('s.'))).filter((i) => usedIds.has(i))
    expect(again).toEqual([])
  })
  it('caps speaking exercises', () => {
    const ex = generateLesson(lesson, ctx(3, true), { seed: 9, count: 16, extra })
    expect(ex.filter((e) => e.kind === 'speak').length).toBeLessThanOrEqual(2)
    const lots = generateLesson(lesson, { ...ctx(3, true), speaking: 'lots' }, { seed: 9, count: 16, extra })
    expect(lots.filter((e) => e.kind === 'speak').length).toBeLessThanOrEqual(3)
  })
  it('never uses the same sentence twice in one session', () => {
    const ex = generateLesson(lesson, ctx(0), { seed: 3, count: 20 })
    const ids = ex.flatMap((e) => e.items.filter((i) => i.startsWith('s.')).slice(0, 1))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('fills spare slots from extra sentences instead of repeating', () => {
    const ex = generateLesson(lesson, ctx(0), { seed: 3, count: 20, extra })
    expect(ex.some((e) => 'prompt' in e && (e.prompt.startsWith('Frase extra') || e.prompt === 'What did you hear?'))).toBe(true)
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

const extra = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ s: { es: `Frase extra número ${n}.`, en: `Extra sentence number ${n}.`, altEs: [], altEn: [], grammar: [], vocab: [] }, id: `d.x.${n}` }))

describe('distractorWords', () => {
  it('prefers words from the same topic and never a synonym', () => {
    const pool = [
      V('w.derecha', 'derecha', 'noun', 'right', { gender: 'f', topic: 'directions' }), V('w.izquierda', 'izquierda', 'noun', 'left', { gender: 'f', topic: 'directions' }),
      V('w.arriba', 'arriba', 'noun', 'top', { gender: 'f', topic: 'directions' }), V('w.detras', 'detrás', 'noun', 'behind', { gender: 'f', topic: 'directions' }),
      V('w.ojo', 'ojo', 'noun', 'eye', { gender: 'm' }), V('w.bolsa', 'bolsa', 'noun', 'bag', { gender: 'f' }), V('w.correcto', 'correcto', 'noun', 'right', { gender: 'm' }),
    ]
    const c = { vocab: new Map(pool.map((v) => [v.id, v])), pool, verbs: IRREGULAR, stageOf: () => 0 as Stage, speech: false }
    const ds = distractorWords(pool[0]!, c, new Rng(3), 3)
    expect(ds.map((d) => d.lemma).sort()).toEqual(['arriba', 'detrás', 'izquierda'])
    for (let seed = 0; seed < 10; seed++) expect(distractorWords(pool[0]!, c, new Rng(seed), 6).map((d) => d.id)).not.toContain('w.correcto')
  })
})

describe('generatePinned', () => {
  it('builds a focused fill-blank around the missed word', () => {
    const pins = [{ id: 's.a1.u01.l1.2', ts: 1, lessonId: 'a1.u01.l1', exerciseKind: 'typeEs' as const, given: 'El casa es pequeña', expected: 'La casa es pequeña.', es: 'La casa es pequeña.', en: 'The house is small.', missed: { given: 'El', expected: 'La' }, streak: 0 }]
    const ex = generatePinned(pins, { word: (id) => vocab.get(id), sentence: (id) => (id === 's.a1.u01.l1.2' ? { s: lesson.sentences[1]!, lesson } : undefined) }, ctx(1), 4)
    const fb = ex.find((e) => e.kind === 'fillBlank')
    expect(fb).toBeDefined()
    if (fb && fb.kind === 'fillBlank') {
      expect(fb.prompt).toBe('____ casa es pequeña.')
      expect(fb.options.map((o) => o.toLowerCase())).toContain('el')
      expect(fb.options.map((o) => o.toLowerCase())).toContain('la')
    }
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

describe('without the taught-words gate (every course but Cantonese)', () => {
  // A pin of the generator's output on this fixture, taken before the gate was added: courses without
  // `features.taughtOnly` must keep generating exactly the same sessions. Change it only on purpose.
  const PINNED = 3504805879
  it('generates exactly what it did before the gate', () => {
    const out: unknown[] = []
    for (const stage of [0, 1, 2, 3] as Stage[]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        for (const count of [9, 12, 16]) out.push(generateLesson({ ...lesson, exchanges: [], texts: [] }, { ...ctx(stage, seed % 2 === 0), speaking: seed % 3 === 0 ? 'lots' : 'some' }, { seed, count, extra }))
      }
    }
    const cards: { id: string; kind: ItemKind; stage: Stage }[] = [...vocabList.map((v, i) => ({ id: v.id, kind: 'word' as const, stage: (i % 4) as Stage })), ...lesson.sentences.map((s, i) => ({ id: sentenceId(lesson.id, i, s), kind: 'sentence' as const, stage: (i % 4) as Stage }))]
    const sentence = (id: string) => {
      const n = Number(id.split('.').pop())
      return lesson.sentences[n - 1] ? { s: lesson.sentences[n - 1]!, lesson } : undefined
    }
    for (const seed of [1, 2, 3]) out.push(generateReview(cards, { word: (id) => vocab.get(id), sentence }, ctx(1, true), seed))
    const pins = cards.slice(4, 12).map((c, i) => ({ id: c.id, ts: i, lessonId: lesson.id, exerciseKind: 'typeEs' as const, given: 'el', expected: 'la', es: 'La casa.', en: 'The house.', streak: 0, missed: i % 2 ? { given: 'el', expected: 'la' } : undefined }))
    out.push(generatePinned(pins, { word: (id) => vocab.get(id), sentence }, ctx(1), 7))
    expect(generateLesson(lesson, { ...ctx(0), taught: undefined }, { seed: 9, count: 12, extra })).toEqual(generateLesson(lesson, ctx(0), { seed: 9, count: 12, extra }))
    expect(hashString(JSON.stringify(out))).toBe(PINNED)
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
