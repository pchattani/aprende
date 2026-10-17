/**
 * Checkpoint quiz after each stop: a short mixed quiz that combines reading
 * (a passage from the stop with comprehension questions), writing (producing
 * the target language from English, drawn from every lesson of the stop) and
 * recall (a few items from the previous one or two stops of the region).
 * Deterministic per seed; the page seeds it from the unit id and the attempt.
 */
import type { Unit, Lesson, Sentence, Dialogue, MiniText } from './schema'
import type { Exercise, ChoiceExercise, TypeExercise, WordBankExercise } from './types'
import { Rng, hashString } from './random'
import { sentenceId, exchangeId, reviewOf, replyTyped, replyExercise, focusedFillBlank, type GenContext } from './generate'
import { words as wordsOf } from '@lang/normalize'

export type CheckpointPart = 'reading' | 'writing' | 'recall'
/** An exercise of the checkpoint, tagged with its part and where it came from (lesson id, or unit id for reading). */
export type CheckpointExercise = Exercise & { part: CheckpointPart; source: string }

/** Saved in kv `checkpoint:<unitId>`. Scores are fractions (0–1). */
export interface CheckpointRecord {
  best: number
  last: number
  /** Day of the last attempt (YYYY-MM-DD). */
  date: string
  /** How many attempts scored at least the pass mark. */
  passes: number
  /** Finished attempts (seeds the next version). */
  attempts?: number
}

export const CHECKPOINT_PASS = 0.8
export const CHECKPOINT_PARTS: CheckpointPart[] = ['reading', 'writing', 'recall']

export function checkpointSeed(unitId: string, attempt: number): number {
  return hashString(`checkpoint:${unitId}:${attempt}`)
}

type PassageLine = { speaker?: string; text: string; en?: string }
interface Passage {
  title?: string
  lines: PassageLine[]
}

const MAX_WORDS = 14

/** Content words of an English line, to keep "false" statements and distractors clearly different. */
function gist(en: string): Set<string> {
  return new Set(en.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(' ').filter((w) => w.length > 2))
}
function tooClose(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true
  const A = gist(a)
  const B = gist(b)
  if (!A.size || !B.size) return false
  const shared = [...A].filter((w) => B.has(w)).length
  return shared / new Set([...A, ...B]).size >= 0.5
}

/** English meanings that are clearly different from `en` (and from each other), first from `primary`, then `backup`. */
function englishDistractors(en: string, primary: string[], backup: string[], rng: Rng, n: number): string[] {
  const out: string[] = []
  for (const list of [primary, backup]) {
    for (const o of rng.shuffle(list)) {
      if (out.length >= n) return out
      if (tooClose(o, en) || out.some((x) => tooClose(x, o))) continue
      out.push(o)
    }
  }
  return out
}

function dialoguePassage(d: Dialogue): Passage {
  return { title: d.title, lines: d.lines.map((l) => ({ speaker: l.speaker, text: l.es, en: l.en })) }
}
function textPassage(t: MiniText): Passage {
  return { title: t.title, lines: t.es.map((text, i) => ({ text, en: t.en[i] })) }
}

/** Every English line of the stop: dialogue lines, lesson sentences and texts (backup distractors). */
function stopEnglish(unit: Unit): string[] {
  return [
    ...unit.dialogues.flatMap((d) => d.lines.map((l) => l.en)),
    ...unit.lessons.flatMap((l) => [...l.sentences.map((s) => s.en), ...l.texts.flatMap((t) => t.en)]),
  ]
}

// ---------------------------------------------------------------------------
// Reading

function authoredQuestion(d: Dialogue, qi: number, rng: Rng): ChoiceExercise | undefined {
  const q = d.questions[qi]!
  if (q.answer >= q.options.length || new Set(q.options).size !== q.options.length) return undefined
  // Shuffle the options so a retake does not repeat the same letter.
  const order = rng.shuffle(q.options.map((_, i) => i))
  const options = order.map((i) => q.options[i]!)
  const answer = order.indexOf(q.answer)
  return {
    kind: 'choiceEs', items: [], grammar: [], prompt: q.q, options, answer, passage: dialoguePassage(d),
    translation: q.explain, review: { es: d.title, en: q.explain ?? `${q.q} ${q.options[q.answer]}` },
  }
}

/** Lines worth asking about: not too short, not too long, unique in the passage. */
function askable(p: Passage): number[] {
  return p.lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.en && wordsOf(l.text).length >= 2 && wordsOf(l.text).length <= 18 && p.lines.filter((o) => o.text === l.text).length === 1)
    .map(({ i }) => i)
}

/** "What does the highlighted line mean?": the line's English among other lines of the passage and the stop. */
function meaningQuestion(p: Passage, focus: number, backup: string[], rng: Rng): ChoiceExercise | undefined {
  const line = p.lines[focus]!
  const en = line.en!
  const others = englishDistractors(en, p.lines.filter((_, i) => i !== focus).map((l) => l.en ?? '').filter(Boolean), backup, rng, 3)
  if (others.length < 2) return undefined
  const options = rng.shuffle([en, ...others])
  return { kind: 'choiceEs', items: [], grammar: [], prompt: 'What does the highlighted line mean?', options, answer: options.indexOf(en), passage: { ...p, focus }, translation: en, review: { es: line.text, en } }
}

/** True or false: the highlighted line means a given English sentence (its own, or another line's). */
function trueFalseQuestion(p: Passage, focus: number, rng: Rng): ChoiceExercise | undefined {
  const line = p.lines[focus]!
  const en = line.en!
  const truth = rng.next() < 0.5
  let statement = en
  if (!truth) {
    const wrong = englishDistractors(en, p.lines.filter((_, i) => i !== focus).map((l) => l.en ?? '').filter(Boolean), [], rng, 1)[0]
    if (!wrong) return undefined
    statement = wrong
  }
  const options = ['True', 'False']
  return { kind: 'choiceEs', items: [], grammar: [], prompt: `True or false? The highlighted line means “${statement}”`, options, answer: truth ? 0 : 1, passage: { ...p, focus }, translation: en, review: { es: line.text, en } }
}

/** "Who says the highlighted line?" (the speaker is hidden on that line). */
function whoSaidQuestion(p: Passage, focus: number, rng: Rng): ChoiceExercise | undefined {
  const line = p.lines[focus]!
  const speakers = [...new Set(p.lines.map((l) => l.speaker).filter((s): s is string => Boolean(s)))]
  if (!line.speaker || speakers.length < 2) return undefined
  const options = rng.shuffle([line.speaker, ...rng.sample(speakers.filter((s) => s !== line.speaker), 2)])
  const lines = p.lines.map((l, i) => (i === focus ? { ...l, speaker: '?' } : l))
  return { kind: 'choiceEs', items: [], grammar: [], prompt: 'Who says the highlighted line?', options, answer: options.indexOf(line.speaker), passage: { ...p, lines, focus }, translation: line.en, review: { es: line.text, en: `${line.speaker}: ${line.en ?? ''}` } }
}

/** Generated questions on a passage, each on a different line: meaning and true/false alternate; who-said is a fallback. */
function generatedQuestions(p: Passage, n: number, backup: string[], rng: Rng): ChoiceExercise[] {
  const out: ChoiceExercise[] = []
  const makers = [(f: number) => meaningQuestion(p, f, backup, rng), (f: number) => trueFalseQuestion(p, f, rng)]
  let turn = rng.int(2)
  for (const focus of rng.shuffle(askable(p))) {
    if (out.length >= n) break
    const q = makers[turn]!(focus) ?? makers[1 - turn]!(focus) ?? whoSaidQuestion(p, focus, rng)
    if (!q) continue
    out.push(q)
    turn = 1 - turn
  }
  return out
}

function readingPart(unit: Unit, rng: Rng, target: number): CheckpointExercise[] {
  const backup = stopEnglish(unit)
  const out: ChoiceExercise[] = []
  const dialogues = unit.dialogues.filter((d) => d.lines.length >= 2)
  const texts = unit.lessons.flatMap((l) => l.texts)
  // 1. A dialogue of the stop: two authored questions, then generated ones.
  if (dialogues.length) {
    const d = rng.pick(dialogues)
    const p = dialoguePassage(d)
    const fromText = texts.length ? 1 : 0
    for (const qi of rng.shuffle(d.questions.map((_, i) => i))) {
      if (out.length >= Math.min(2, target - fromText)) break
      const q = authoredQuestion(d, qi, rng)
      if (q) out.push(q)
    }
    out.push(...generatedQuestions(p, target - fromText - out.length, backup, rng))
  }
  // 2. A lesson mini-text: one question (more when the stop has no dialogue).
  if (texts.length) {
    for (const t of rng.shuffle(texts)) {
      if (out.length >= target) break
      out.push(...generatedQuestions(textPassage(t), dialogues.length ? 1 : Math.min(2, target - out.length), backup, rng))
    }
  }
  return out.slice(0, target).map((e) => ({ ...e, part: 'reading' as const, source: unit.id }))
}

// ---------------------------------------------------------------------------
// Writing and recall

type WriteKind = 'typeEs' | 'wordBank' | 'fillBlank' | 'reply'

function fits(s: Sentence, kind: Exclude<WriteKind, 'reply'>): boolean {
  const n = wordsOf(s.es).length
  if (n === 0 || n > MAX_WORDS) return false
  if (s.kinds && !s.kinds.includes(kind)) return false
  if (kind === 'wordBank') return n >= 3
  if (kind === 'fillBlank') return n >= 2
  return true
}

function typeSentence(s: Sentence, id: string): TypeExercise {
  return { kind: 'typeEs', items: [id, ...s.vocab], grammar: s.grammar, prompt: s.en, answers: [s.es, ...s.altEs], translation: s.en, review: reviewOf(s) }
}
function wordBankSentence(s: Sentence, id: string, lesson: Lesson, rng: Rng): WordBankExercise {
  const ws = wordsOf(s.es)
  const otherWords = lesson.sentences.flatMap((o) => wordsOf(o.es)).filter((w) => !ws.includes(w))
  const distract = rng.sample([...new Set(otherWords)], 2)
  return { kind: 'wordBank', items: [id, ...s.vocab], grammar: s.grammar, prompt: s.en, tiles: rng.shuffle([...ws, ...distract]), answers: [s.es, ...s.altEs], translation: s.en, review: reviewOf(s) }
}
/** English → pick the target-language sentence among other sentences of the lesson. */
function pickSentence(s: Sentence, id: string, lesson: Lesson, rng: Rng): ChoiceExercise | undefined {
  const others: string[] = []
  for (const o of rng.shuffle(lesson.sentences)) {
    if (others.length >= 3) break
    if (o.es === s.es || others.includes(o.es) || tooClose(o.en, s.en)) continue
    others.push(o.es)
  }
  if (others.length < 2) return undefined
  const options = rng.shuffle([s.es, ...others])
  return { kind: 'choiceEn', items: [id, ...s.vocab], grammar: s.grammar, prompt: s.en, options, answer: options.indexOf(s.es), translation: s.es, review: reviewOf(s) }
}

/** One writing exercise from a lesson, of the wanted kind when the lesson allows it, else a typed translation. */
function writeFrom(lesson: Lesson, kind: WriteKind, ctx: GenContext, rng: Rng, used: Set<string>): Exercise | undefined {
  if (kind === 'reply') {
    const xs = rng.shuffle(lesson.exchanges.map((x, i) => ({ x, id: exchangeId(lesson.id, i) }))).filter(({ x, id }) => !used.has(id) && wordsOf(x.a.es).length <= MAX_WORDS)
    const pick = xs[0]
    if (pick) {
      used.add(pick.id)
      return replyTyped(pick.x, pick.id)
    }
    kind = 'typeEs'
  }
  const k = kind
  const all = lesson.sentences.map((s, i) => ({ s, id: sentenceId(lesson.id, i, s) })).filter(({ id }) => !used.has(id))
  const pool = rng.shuffle(all.filter(({ s }) => fits(s, k)))
  const fallback = rng.shuffle(all.filter(({ s }) => fits(s, 'typeEs')))
  const pick = pool[0] ?? fallback[0]
  if (!pick) return undefined
  used.add(pick.id)
  if (!pool[0]) return typeSentence(pick.s, pick.id)
  if (k === 'wordBank') return wordBankSentence(pick.s, pick.id, lesson, rng)
  // The standard fill-in-the-blank builder (no learner slip to target: it picks the lesson word itself).
  if (k === 'fillBlank') return focusedFillBlank(pick.s, pick.id, { given: '', expected: '' }, ctx, rng, lesson)
  return typeSentence(pick.s, pick.id)
}

function writingPart(unit: Unit, ctx: GenContext, rng: Rng, target: number): CheckpointExercise[] {
  const out: CheckpointExercise[] = []
  const used = new Set<string>()
  // Every lesson once (in a shuffled order), then again for the extra slots.
  const lessons = rng.shuffle(unit.lessons)
  const kinds = rng.shuffle<WriteKind>(['typeEs', 'typeEs', 'wordBank', 'fillBlank', 'reply'])
  while (kinds.length < target) kinds.push(rng.pick<WriteKind>(['typeEs', 'wordBank', 'reply']))
  for (let i = 0; out.length < target && i < target * 2; i++) {
    const lesson = lessons[i % lessons.length]!
    const ex = writeFrom(lesson, kinds[out.length]!, ctx, rng, used)
    if (ex) out.push({ ...ex, part: 'writing', source: lesson.id })
  }
  return out
}

function recallPart(previous: Unit[], rng: Rng, target: number): CheckpointExercise[] {
  const out: CheckpointExercise[] = []
  if (!previous.length) return out
  const used = new Set<string>()
  const kinds = rng.shuffle<'typeEs' | 'pick' | 'reply'>(['typeEs', 'pick', 'reply'])
  for (let i = 0; out.length < target && i < target * 3; i++) {
    // Mostly the stop just before, one item from the stop before that.
    const unit = previous[i % 3 === 2 && previous[1] ? 1 : 0]!
    const lesson = rng.pick(unit.lessons)
    const kind = kinds[out.length % kinds.length]!
    let ex: Exercise | undefined
    if (kind === 'reply' && lesson.exchanges.length >= 2) {
      const xi = rng.int(lesson.exchanges.length)
      const id = exchangeId(lesson.id, xi)
      if (!used.has(id)) {
        used.add(id)
        const r = replyExercise(lesson.exchanges[xi]!, id, lesson, rng)
        if (new Set(r.options).size === r.options.length && r.options.length >= 3) ex = r
      }
    }
    if (!ex) {
      const cands = rng.shuffle(lesson.sentences.map((s, si) => ({ s, id: sentenceId(lesson.id, si, s) }))).filter(({ s, id }) => !used.has(id) && fits(s, 'typeEs'))
      const c = cands[0]
      if (!c) continue
      used.add(c.id)
      ex = kind === 'pick' ? pickSentence(c.s, c.id, lesson, rng) ?? typeSentence(c.s, c.id) : typeSentence(c.s, c.id)
    }
    out.push({ ...ex, part: 'recall', source: lesson.id })
  }
  return out
}

/**
 * Build the checkpoint for a stop. `previousUnits` are the stops just before it in
 * the same region, nearest first (only the first two are used).
 * 4 reading + 5 writing + 2–3 recall; with no previous stop, 4 reading + 6 writing.
 */
export function buildCheckpoint(unit: Unit, previousUnits: Unit[], ctx: GenContext, seed: number): CheckpointExercise[] {
  const rng = new Rng(seed)
  const previous = previousUnits.slice(0, 2)
  const recallTarget = previous.length === 0 ? 0 : previous.length === 1 ? 2 : 3
  const reading = readingPart(unit, rng, 4)
  const recall = recallPart(previous, rng, recallTarget)
  // Writing fills the rest: 5 (6 without recall), plus any reading question the stop could not supply.
  const writing = writingPart(unit, ctx, rng, (recallTarget ? 5 : 6) + Math.max(0, 4 - reading.length))
  // Reading first (questions on one passage stay together), then writing, then recall.
  return [...reading, ...rng.shuffle(writing), ...rng.shuffle(recall)]
}
