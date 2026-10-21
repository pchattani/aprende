import { describe, it, expect } from 'vitest'
import { generateLesson, generateReview, generatePinned, type GenContext } from '@/engine/generate'
import { grade, gradeStrokes } from '@/engine/grade'
import { kindAllowed } from '@/engine/ladder'
import { charId, charOf, isCharId } from '@/engine/chars'
import { PICTOGRAMS } from '@/engine/pictograms'
import { kindOfId } from '@/engine/analytics/replay'
import { Lesson, VocabEntry, type ExerciseKind, type LessonSkill } from '@/engine/schema'
import type { Exercise, PinRow, Stage, WriteExercise } from '@/engine/types'
import { collectWriteChars, writeCharIssues } from '../scripts/strokes-lib.mjs'

// Fixtures: a tiny Cantonese-like vocabulary and a starter lesson (independent of the course's real content).
const V = (id: string, lemma: string, en: string, jp: string, pos = 'noun') => VocabEntry.parse({ id, lemma, en: [en], jp, pos, level: 'a1', topic: 'starter' })
const words = [
  V('w.fo2', '火', 'fire', 'fo2'),
  V('w.seoi2', '水', 'water', 'seoi2'),
  V('w.saan1', '山', 'mountain', 'saan1'),
  V('w.jan4', '人', 'person', 'jan4'),
  V('w.hau2', '口', 'mouth', 'hau2'),
  V('w.muk6', '木', 'tree', 'muk6'),
  V('w.ngo5', '我', 'I', 'ngo5', 'pron'),
  V('w.nei5', '你', 'you', 'nei5', 'pron'),
  V('w.jat1', '一', 'one', 'jat1', 'num'),
  V('w.ji6', '二', 'two', 'ji6', 'num'),
  V('w.saam1', '三', 'three', 'saam1', 'num'),
  V('w.dai6-jat1', '第一', 'first', 'dai6 jat1', 'adj'),
]
const vocab = new Map(words.map((w) => [w.id, w]))
const S = (es: string, en: string, v: string[]) => ({ es, en, vocab: v })
const lessonOf = (extra: Record<string, unknown>) =>
  Lesson.parse({
    id: 'a1.u15.l1',
    title: 'Pictures',
    vocab: ['w.fo2', 'w.seoi2', 'w.saan1', 'w.jan4', 'w.hau2', 'w.muk6'],
    sentences: [S('火。', 'Fire.', ['w.fo2']), S('水。', 'Water.', ['w.seoi2']), S('山。', 'Mountain.', ['w.saan1']), S('一個人。', 'One person.', ['w.jan4']), S('口。', 'Mouth.', ['w.hau2']), S('木。', 'Tree.', ['w.muk6']), S('我係人。', 'I am a person.', ['w.ngo5', 'w.jan4']), S('你係人。', 'You are a person.', ['w.nei5', 'w.jan4'])],
    exchanges: [{ q: { es: '你係人？', en: 'Are you a person?' }, a: { es: '我係人。', en: 'I am a person.' } }, { q: { es: '山？', en: 'A mountain?' }, a: { es: '山。', en: 'A mountain.' } }],
    ...extra,
  })
const ctx = (over: Partial<GenContext> = {}): GenContext => ({ vocab, pool: words, verbs: new Map(), stageOf: () => undefined, speech: true, speaking: 'lots', ...over })
const kinds = (xs: Exercise[]) => xs.map((e) => e.kind)
const WRITE_KINDS: ExerciseKind[] = ['trace', 'writeChar', 'typeEs', 'typeEn', 'dictation', 'conjugate', 'transform', 'findError']
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

describe('lesson skills', () => {
  it('without write: no tracing, writing or typing at all', () => {
    const lesson = lessonOf({ skills: ['listen', 'speak', 'read'], write: ['火', '水'] })
    for (const seed of SEEDS) {
      const ks = kinds(generateLesson(lesson, ctx(), { seed, count: 12 }))
      expect(ks.filter((k) => WRITE_KINDS.includes(k))).toEqual([])
    }
  })
  it('without speak: nothing to say aloud, even with speech on', () => {
    const lesson = lessonOf({ skills: ['listen', 'read', 'write'], write: ['火'] })
    for (const seed of SEEDS) expect(kinds(generateLesson(lesson, ctx(), { seed, count: 12 }))).not.toContain('speak')
  })
  it('only allowed kinds, for every combination of skills, at the exact count', () => {
    const all: LessonSkill[] = ['listen', 'speak', 'read', 'write']
    const combos = all.flatMap((a, i) => [[a], ...all.slice(i + 1).map((b) => [a, b])]).concat([all])
    for (const skills of combos) {
      const lesson = lessonOf({ skills, write: ['火', '水', '山'] })
      for (const count of [9, 12, 16]) {
        for (const seed of [1, 2, 3]) {
          const xs = generateLesson(lesson, ctx(), { seed, count })
          expect(xs.length, `${skills.join('+')} ×${count}`).toBe(count)
          for (const e of xs) expect(kindAllowed(e.kind, skills), `${e.kind} in ${skills.join('+')}`).toBe(true)
        }
      }
    }
  })
  it('hear-and-pick-the-characters needs both listen and read', () => {
    const seen = (skills: LessonSkill[]) => SEEDS.some((seed) => kinds(generateLesson(lessonOf({ skills }), ctx({ speech: false }), { seed, count: 12 })).includes('hearChar'))
    expect(seen(['listen', 'read'])).toBe(true)
    expect(seen(['listen', 'speak'])).toBe(false)
    expect(seen(['read', 'write'])).toBe(false)
  })
  it('kindAllowed: everything when a lesson lists no skills', () => {
    for (const k of ['trace', 'speak', 'typeEs', 'hearChar', 'match'] as ExerciseKind[]) expect(kindAllowed(k, undefined)).toBe(true)
    expect(kindAllowed('hearChar', ['listen'])).toBe(false)
    expect(kindAllowed('dictation', ['write'])).toBe(true)
  })
})

describe('characters to write', () => {
  const lesson = lessonOf({ skills: ['listen', 'speak', 'read', 'write'], write: ['火', '水', '山', '我'] })
  const writes = (xs: Exercise[]) => xs.filter((e): e is WriteExercise => e.kind === 'trace' || e.kind === 'writeChar')

  it('traces a character never met, with its own c.* item, reading and meaning', () => {
    const xs = writes(generateLesson(lesson, ctx(), { seed: 3, count: 12 }))
    expect(xs.length).toBeGreaterThan(0)
    for (const e of xs) {
      expect(e.kind).toBe('trace')
      expect(e.items).toEqual([charId(e.char)])
      expect(e.meaning).toBe(vocab.get([...vocab.values()].find((v) => v.lemma === e.char)!.id)!.en[0])
      expect(e.jp).toBeTruthy()
      expect(e.review).toEqual({ es: e.char, en: e.meaning })
    }
  })
  it('writes from memory once the character has been seen', () => {
    const xs = writes(generateLesson(lesson, ctx({ seenOf: (id) => (id === charId('火') || id === charId('水') || id === charId('山') || id === charId('我') ? 2 : 0) }), { seed: 3, count: 12 }))
    expect(xs.length).toBeGreaterThan(0)
    for (const e of xs) expect(e.kind).toBe('writeChar')
  })
  it('the least practised characters come first: new ones are traced before known ones are written', () => {
    const seenOf = (id: string) => (id === charId('火') ? 3 : 0)
    for (const seed of SEEDS) {
      const xs = writes(generateLesson(lesson, ctx({ seenOf }), { seed, count: 12 }))
      expect(xs.every((e) => e.kind === 'trace' && e.char !== '火')).toBe(true)
    }
  })
  it('never more than two trace/writeChar per session, and never two in a row for one item', () => {
    for (const seed of SEEDS) {
      for (const count of [9, 12, 16]) {
        const xs = generateLesson(lesson, ctx(), { seed, count })
        expect(writes(xs).length).toBeLessThanOrEqual(2)
        for (let i = 1; i < xs.length; i++) if (xs[i]!.items[0]) expect(xs[i]!.items[0]).not.toBe(xs[i - 1]!.items[0])
      }
    }
  })
  it('pictogram exercises only for characters with pictogram art', () => {
    let any = false
    for (const seed of SEEDS) {
      for (const e of generateLesson(lesson, ctx(), { seed, count: 16 })) {
        if (e.kind !== 'pictogram') continue
        any = true
        expect(e.char && PICTOGRAMS[e.char]).toBeTruthy()
        expect(e.char).not.toBe('我')
        expect(new Set(e.options).size).toBe(4)
        expect(e.options[e.answer]).toBe(e.char)
      }
    }
    expect(any).toBe(true)
    const noArt = lessonOf({ skills: ['read', 'write'], write: ['我', '你'] })
    for (const seed of SEEDS) expect(kinds(generateLesson(noArt, ctx(), { seed, count: 12 }))).not.toContain('pictogram')
  })
  it('own answers grade as correct', () => {
    const deps = { pack: { id: 'x', locale: 'x', normalize: (t: string) => t, tokenize: () => [], match: () => ({ verdict: 'wrong' as const, notes: [] }), words: (t: string) => [t] } }
    for (const e of generateLesson(lesson, ctx(), { seed: 5, count: 16 })) {
      if (e.kind === 'pictogram' || e.kind === 'hearChar') expect(grade(e, e.answer, deps).verdict).toBe('correct')
      if (e.kind === 'trace' || e.kind === 'writeChar') expect(grade(e, { mistakes: 0, hints: 0, strokes: 4 }, deps)).toMatchObject({ verdict: 'correct', correct: e.char })
    }
  })
  it('a lesson without skills or write gets none of the new kinds', () => {
    const plain = lessonOf({})
    for (const seed of SEEDS) {
      const ks = kinds(generateLesson(plain, ctx(), { seed, count: 12 }))
      expect(ks.filter((k) => ['trace', 'writeChar', 'pictogram', 'hearChar'].includes(k))).toEqual([])
    }
  })
})

describe('c.* items in review and pins', () => {
  const lookup = { word: (id: string) => vocab.get(id), sentence: () => undefined }
  it('ids', () => {
    expect(charId('火')).toBe('c.火')
    expect(charOf('c.火')).toBe('火')
    expect(isCharId('c.火')).toBe(true)
    expect(isCharId('c.fire')).toBe(false)
    expect(charOf('w.fo2')).toBeUndefined()
    expect(kindOfId('c.火')).toBe('char')
  })
  it('review: traced while new, written from memory later', () => {
    const at = (stage: Stage) => generateReview([{ id: 'c.火', kind: 'char', stage }], lookup, ctx(), 1) as WriteExercise[]
    expect(at(0).map((e) => [e.kind, e.char, e.items[0]])).toEqual([['trace', '火', 'c.火']])
    expect(at(2).map((e) => e.kind)).toEqual(['writeChar'])
    expect(at(0)[0]!.meaning).toBe('fire')
  })
  it('review: a few characters per session, and broken ids are skipped', () => {
    const cards = ['火', '水', '山', '人', '口', '木'].map((c) => ({ id: charId(c), kind: 'char' as const, stage: 2 as Stage }))
    expect(generateReview([...cards, { id: 'c.bad', kind: 'char', stage: 0 }], lookup, ctx(), 1)).toHaveLength(4)
  })
  it('pinned: a missed character comes back traced, then written', () => {
    const pin: PinRow = { id: 'c.水', ts: 0, lessonId: 'a1.u15.l1', exerciseKind: 'writeChar', given: '', expected: '水', es: '水', en: 'water', streak: 0 }
    expect(kinds(generatePinned([pin], lookup, ctx(), 1)).sort()).toEqual(['trace', 'writeChar'])
  })
})

describe('grading strokes', () => {
  it('tracing: correct with few slips, almost with hints, never wrong', () => {
    expect(gradeStrokes('trace', { mistakes: 1, hints: 0, strokes: 4 })).toBe('correct')
    expect(gradeStrokes('trace', { mistakes: 4, hints: 1, strokes: 4 })).toBe('almost')
    expect(gradeStrokes('trace', { mistakes: 30, hints: 4, strokes: 4 })).toBe('almost')
  })
  it('writing from memory: wrong when the hint did most of it', () => {
    expect(gradeStrokes('writeChar', { mistakes: 1, hints: 0, strokes: 4 })).toBe('correct')
    expect(gradeStrokes('writeChar', { mistakes: 3, hints: 1, strokes: 4 })).toBe('almost')
    expect(gradeStrokes('writeChar', { mistakes: 9, hints: 3, strokes: 4 })).toBe('wrong')
  })
})

describe('stroke data check (content:check)', () => {
  // a course folder with one unit (tests/fixtures/write-content/units/a1/u15.yaml), relative to the repository root
  const chars = collectWriteChars('tests/fixtures/write-content')
  const entry = { strokes: ['M 0 0 Z'], medians: [[[0, 0], [1, 1]]] }
  it('collects every write character with its lessons', () => {
    expect([...chars.keys()]).toEqual(['火', '水', 'ab'])
    expect(chars.get('火')).toEqual(['a1.u15.l1', 'a1.u15.l2'])
  })
  it('errors when a character has no stroke data or is not one Han character', () => {
    const issues = writeCharIssues(chars, { 火: entry })
    expect(issues).toHaveLength(2)
    expect(issues.find((i) => i.includes('水'))).toMatch(/no stroke data/)
    expect(issues.find((i) => i.includes('ab'))).toMatch(/not a single Han character/)
    expect(writeCharIssues(new Map([['火', ['x']]]), undefined)[0]).toMatch(/no stroke data/)
    expect(writeCharIssues(new Map([['火', ['x']]]), { 火: entry })).toEqual([])
  })
})
