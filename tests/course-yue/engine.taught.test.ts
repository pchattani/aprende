import { describe, it, expect } from 'vitest'
import { generateLesson, generateReview, sentenceId, exchangeId, exchangeAsSentence } from '@/engine/generate'
import { buildCheckpoint } from '@/engine/checkpoint'
import { buildRegionQuiz } from '@/engine/quiz'
import { grade, type Answer } from '@/engine/grade'
import { taughtGateAt, taught } from '@/engine/taughtData'
import { vocab, vocabUpTo, loadUnit, loadLesson, loadExam, pack } from '@/engine/loader'
import { checkText, equivEs, equivEn, isWord, lookupForm } from '@/hooks/useDeps'
import { IRREGULAR } from '@lang/verbs'
import { languagePack } from '@lang'
import type { Exercise, Stage } from '@/engine/types'
import type { Lesson } from '@/engine/schema'
import type { TaughtGate } from '@/engine/taught'

// The taught-words gate on the Cantonese course (features.taughtOnly): runs in the Cantonese build only.
const HAN = /\p{Script=Han}/u
const ctx = (stage: Stage, gate: TaughtGate | undefined, speech = false) => ({ vocab, pool: vocabUpTo('a1'), verbs: IRREGULAR, stageOf: () => stage, speech, lookup: lookupForm, taught: gate })
const deps = { pack: languagePack, check: checkText, equivEs, equivEn, isWord }

/** Cantonese the exercise shows or plays to be understood before it is answered (pictograms and characters to write aside). */
function shown(ex: Exercise): string[] {
  const out: string[] = []
  const add = (...xs: (string | undefined)[]) => out.push(...xs.filter((x): x is string => Boolean(x)))
  switch (ex.kind) {
    case 'choiceEs':
      // a reading passage as a whole, and the line asked about
      add(ex.passage ? undefined : ex.prompt, ex.audio, ex.passage?.title, ex.passage?.lines.map((l) => l.text).join(''), ex.passage?.focus !== undefined ? ex.passage.lines[ex.passage.focus]!.text : undefined)
      break
    case 'listen':
      add(ex.audio)
      break
    case 'choiceEn':
    case 'hearChar':
      add(...ex.options, ex.audio)
      break
    case 'reply':
    case 'fillBlank':
      add(...ex.options, ...(ex.askEn ? [] : [ex.prompt, ex.audio]))
      break
    case 'wordBank':
    case 'order': {
      // the sentence to build, and any extra tiles on their own
      const own = languagePack.words(ex.answers[0]!)
      add(ex.answers[0], ...ex.tiles.filter((t) => !own.includes(t)))
      break
    }
    case 'orderText':
      add(ex.tiles.join(''), ex.prompt.replace('Put the sentences in order', ''))
      break
    case 'match':
      add(...ex.pairs.map((p) => p.left))
      break
    case 'findError':
      add(ex.wrong)
      break
    case 'typeEs':
    case 'typeEn':
    case 'dictation':
    case 'speak':
    case 'conjugate':
    case 'transform':
      if (!ex.askEn) add(ex.prompt, ex.audio)
      break
  }
  return out.filter((t) => HAN.test(t))
}
function ownAnswer(ex: Exercise): Answer | undefined {
  if ('options' in ex) return ex.answer
  if (ex.kind === 'match') return { mistakes: 0 }
  if (ex.kind === 'trace' || ex.kind === 'writeChar') return { mistakes: 0, hints: 0, strokes: 3 }
  if (ex.kind === 'wordBank' || ex.kind === 'order' || ex.kind === 'orderText') return languagePack.words(ex.answers[0]!)
  if (ex.kind === 'speak') return undefined
  return 'answers' in ex ? ex.answers[0] : undefined
}

describe('the taught-words gate on the Cantonese course', () => {
  it('is on for Cantonese and indexes the starter path first', () => {
    expect(pack.features.taughtOnly).toBe(true)
    expect(taught.order.slice(0, 2)).toEqual(['a1.u13.l1', 'a1.u13.l2'])
    expect(taughtGateAt('a1.u13.l1').ids).toEqual(new Set(['w.jat1', 'w.ji6', 'w.saam1', 'w.sei3', 'w.ng5']))
    expect(taughtGateAt('a1.u13.l2').ids.has('w.jat1')).toBe(true)
  })

  it('a1.u13.l1: exact sessions, only taught Cantonese shown, the sums asked in English', async () => {
    const { lesson } = await loadLesson('a1.u13.l1')
    const gate = taughtGateAt('a1.u13.l1')
    let asked = 0
    for (let seed = 1; seed <= 30; seed++) {
      for (const stage of [0, 1, 2, 3] as Stage[]) {
        for (const count of [9, 12, 16]) {
          const exercises = generateLesson(lesson, ctx(stage, gate, seed % 2 === 0), { seed, count })
          expect(exercises.length, `seed ${seed} stage ${stage}`).toBe(count)
          for (const ex of exercises) {
            for (const t of shown(ex)) expect(gate.ok(t), `${ex.kind} shows “${t}”`).toBe(true)
            expect(shown(ex).join(' ')).not.toMatch(/加|係|同/)
            if (ex.askEn) {
              asked++
              expect('prompt' in ex && ex.prompt).toMatch(/^What's \w+ plus \w+\?$/)
            }
          }
        }
      }
    }
    expect(asked).toBeGreaterThan(30)
  })

  it('turns a below-threshold exchange into an English question with a taught answer among taught options', () => {
    const lesson: Lesson = {
      id: 'a1.u13.l1', title: 'T', teach: [], vocab: ['w.jat1', 'w.ji6', 'w.saam1', 'w.sei3', 'w.ng5'], skills: ['read'], spicy: [], texts: [],
      sentences: ['一。', '二。', '三。', '四。', '二同三。'].map((es) => ({ es, en: es, altEs: [], altEn: [], grammar: [], vocab: [] })),
      exchanges: [{ q: { es: '一加一係幾多呀？', en: "What's one plus one?", altEs: [], altEn: [] }, a: { es: '二！', en: 'Two!', altEs: [], altEn: [] }, alt: ['係二。'], grammar: [], vocab: ['w.ji6'] }],
    }
    const gate = taughtGateAt('a1.u13.l1')
    for (let seed = 1; seed <= 10; seed++) {
      const ex = generateLesson(lesson, ctx(0, gate), { seed, count: 12 }).find((e) => e.items[0] === exchangeId(lesson.id, 0))
      expect(ex, `seed ${seed}`).toBeDefined()
      expect(ex!.askEn).toBe(true)
      expect(ex!.kind).toBe('reply')
      if (ex!.kind !== 'reply') continue
      expect(ex!.prompt).toBe("What's one plus one?")
      expect(ex!.audio).toBeUndefined()
      expect(ex!.options[ex!.answer]).toBe('二！')
      // never the same answer written differently (二。) among the wrong options
      expect(ex!.options.filter((o) => o.replace(/[！。]/g, '') === '二')).toHaveLength(1)
      for (const o of ex!.options) expect(gate.ok(o)).toBe(true)
      expect(grade(ex!, ex!.answer, deps).verdict).toBe('correct')
    }
    // the same lesson without the gate shows the Cantonese question (as every other course does)
    const plain = generateLesson(lesson, ctx(0, undefined), { seed: 1, count: 12 }).find((e) => e.items[0] === exchangeId(lesson.id, 0))
    expect(plain?.askEn).toBeUndefined()
  })

  it('never shows a below-threshold sentence in Cantonese, and keeps the exact count with word drills', () => {
    const base = { id: 'a1.u13.l1', title: 'T', teach: [], vocab: ['w.jat1', 'w.ji6', 'w.saam1', 'w.sei3', 'w.ng5'], spicy: [], texts: [], exchanges: [] }
    const lesson: Lesson = { ...base, sentences: ['二同三。', '一加一。', '我係五。', '三同四。'].map((es) => ({ es, en: `${es} (en)`, altEs: [], altEn: [], grammar: [], vocab: ['w.ji6'] })) }
    const gate = taughtGateAt('a1.u13.l1')
    for (let seed = 1; seed <= 20; seed++) {
      for (const stage of [0, 2] as Stage[]) {
        const exercises = generateLesson(lesson, ctx(stage, gate, true), { seed, count: 12 })
        expect(exercises).toHaveLength(12)
        for (const ex of exercises) {
          expect(ex.items.some((i) => i.startsWith('s.')), `${ex.kind}`).toBe(false)
          for (const t of shown(ex)) expect(gate.ok(t), `${ex.kind} shows “${t}”`).toBe(true)
        }
        expect(exercises.filter((e) => e.kind === 'match').length).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('every Cantonese lesson: exact sessions in taught Cantonese that accept their own answers', async () => {
    const problems: string[] = []
    const units = [...new Set(taught.order.map((id) => id.split('.').slice(0, 2).join('.')))]
    for (const unitId of units) {
      const unit = await loadUnit(unitId)
      for (const lesson of unit.lessons) {
        const gate = taughtGateAt(lesson.id)
        for (const stage of [0, 2] as Stage[]) {
          const exercises = generateLesson(lesson, { ...ctx(stage, gate), pool: vocabUpTo(lesson.id.split('.')[0] as 'a1') }, { seed: 7 + stage, count: 12 })
          if (exercises.length !== 12) problems.push(`${lesson.id} stage ${stage}: ${exercises.length} exercises`)
          for (const ex of exercises) {
            for (const t of shown(ex)) if (!gate.ok(t)) problems.push(`${lesson.id} ${ex.kind} shows untaught “${t}”`)
            const answer = ownAnswer(ex)
            if (answer !== undefined && grade(ex, answer, deps).verdict === 'wrong') problems.push(`${lesson.id} ${ex.kind}: own answer “${String(answer)}” graded wrong`)
          }
        }
      }
    }
    expect(problems).toEqual([])
  }, 120_000)

  it('review and checkpoint show only taught Cantonese', async () => {
    const unit = await loadUnit('a1.u13')
    // a review session is gated at the furthest lesson the learner has reached
    const gate = taughtGateAt(unit.lessons.at(-1)!.id)
    const lessons = new Map(unit.lessons.map((l) => [l.id, l]))
    const cards = unit.lessons.flatMap((l) => [
      ...l.sentences.map((s, i) => ({ id: sentenceId(l.id, i, s), kind: 'sentence' as const, stage: 1 as Stage })),
      ...l.exchanges.map((_, i) => ({ id: exchangeId(l.id, i), kind: 'sentence' as const, stage: 0 as Stage })),
      ...l.vocab.map((id) => ({ id, kind: 'word' as const, stage: 2 as Stage })),
    ])
    const sentence = (id: string) => {
      const p = id.split('.')
      const l = lessons.get(p.slice(1, 4).join('.'))!
      const n = Number(p[4])
      return p[0] === 'x' ? { s: exchangeAsSentence(l.exchanges[n - 1]!), lesson: l, exchange: l.exchanges[n - 1]! } : { s: l.sentences[n - 1]!, lesson: l }
    }
    const review = generateReview(cards, { word: (id) => vocab.get(id), sentence }, ctx(1, gate), 3)
    expect(review.some((e) => e.askEn)).toBe(true)
    for (const ex of review) for (const t of shown(ex)) expect(gate.ok(t), `review ${ex.kind} “${t}”`).toBe(true)
    const quiz = buildCheckpoint(unit, [], ctx(0, gate), 5)
    expect(quiz.length).toBeGreaterThanOrEqual(8)
    for (const ex of quiz) for (const t of shown(ex)) expect(gate.ok(t), `checkpoint ${ex.kind} “${t}”`).toBe(true)
  })

  it('checkpoints along the starter path and the A1 region quiz use taught Cantonese only', async () => {
    const unitIds = [...new Set(taught.order.map((id) => id.split('.').slice(0, 2).join('.')))].slice(0, 14)
    const units = await Promise.all(unitIds.map((id) => loadUnit(id)))
    units.forEach((unit, i) => {
      const gate = taughtGateAt(unit.lessons.at(-1)!.id)
      const quiz = buildCheckpoint(unit, units.slice(Math.max(0, i - 2), i).reverse(), ctx(0, gate), 11 + i)
      expect(quiz.length, unit.id).toBeGreaterThanOrEqual(8)
      for (const ex of quiz) for (const t of shown(ex)) expect(gate.ok(t), `${unit.id} checkpoint ${ex.kind} “${t}”`).toBe(true)
    })
    const gate = taughtGateAt(units.at(-1)!.lessons.at(-1)!.id)
    const quiz = buildRegionQuiz('a1', units, await loadExam('a1'), [...vocab.values()], 3, new Set(), gate)
    expect(quiz.length).toBeGreaterThanOrEqual(6)
    for (const q of quiz) for (const t of [q.prompt, ...q.options].filter((x) => HAN.test(x))) expect(gate.ok(t.replace(/^.*?: /, '').replace(/“|”/g, '')), `quiz “${t}”`).toBe(true)
  })
})
