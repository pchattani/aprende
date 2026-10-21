/**
 * Region quiz: a short mixed quiz per region (level) built from the units'
 * dialogue questions, the level check's grammar items and vocabulary, with the
 * plausible-distractor sampler. Deterministic per seed (level + day).
 */
import type { Unit, Exam, VocabEntry, LevelId } from './schema'
import type { MCQItem } from '../components/MCQ'
import { Rng } from './random'
import { distractorWords, type GenContext } from './generate'
import type { TaughtGate } from './taught'
import { IRREGULAR } from '@lang/verbs'
import { ui, fill } from './loader'

export interface QuizItem extends MCQItem {
  source: 'dialogue' | 'grammar' | 'vocab'
}

export const QUIZ_SIZE = 12
export const QUIZ_PASS = 0.8

/** With a taught-words gate (`taught`), only items whose target-language text is taught, and only taught words. */
export function buildRegionQuiz(level: LevelId, units: Unit[], exam: Exam | undefined, vocab: VocabEntry[], seed: number, stamped: ReadonlySet<string> = new Set(), taught?: TaughtGate): QuizItem[] {
  const rng = new Rng(seed)
  const out: QuizItem[] = []
  const seen = new Set<string>()
  const push = (q: QuizItem) => {
    const k = q.prompt.toLowerCase()
    if (seen.has(k) || q.answer >= q.options.length || new Set(q.options).size !== q.options.length) return
    seen.add(k)
    out.push(q)
  }

  // 1. Dialogue questions: at most one per unit, stamped units first.
  const unitsOrdered = rng.shuffle(units).sort((a, b) => Number(stamped.has(b.id)) - Number(stamped.has(a.id)))
  for (const u of unitsOrdered) {
    if (out.length >= 6) break
    const qs = u.dialogues.flatMap((d) => d.questions.map((q) => ({ q, d }))).filter(({ q, d }) => !taught || [d.title, q.q, ...q.options].every((t) => taught.ok(t)))
    if (!qs.length) continue
    const { q, d } = rng.pick(qs)
    push({ prompt: `${d.title}: ${q.q}`, options: q.options, answer: q.answer, explain: q.explain, source: 'dialogue' })
  }
  // 2. Grammar items from the level check.
  const grammarItems = rng.shuffle((exam?.grammar ?? []).filter((g) => !taught || [g.prompt, ...g.options].every((t) => taught.ok(t))))
  for (const g of grammarItems.slice(0, 3)) push({ prompt: g.prompt, options: g.options, answer: g.answer, explain: g.explain, source: 'grammar' })
  // 3. Vocabulary: target-language word → English meaning, distractors from the same topic/unit.
  const levelWords = vocab.filter((v) => v.level === level && v.en[0] && (!taught || taught.ids.has(v.id)))
  const ctx: GenContext = { vocab: new Map(vocab.map((v) => [v.id, v])), pool: vocab, verbs: IRREGULAR, stageOf: () => 0, speech: false }
  const wordItem = (v: VocabEntry): QuizItem | undefined => {
    const ds = distractorWords(v, ctx, rng, 3)
    if (ds.length < 3) return undefined
    const options = rng.shuffle([v.en[0]!, ...ds.map((d) => d.en[0]!)])
    // with a taught-words gate the question is asked in English until its own words are taught
    const ask = fill(ui.whatDoesItMean, { word: v.lemma })
    const prompt = taught && !taught.ok(ask) ? `What does “${v.lemma}” mean?` : ask
    return { prompt, options, answer: options.indexOf(v.en[0]!), explain: `${v.lemma} = ${v.en.slice(0, 2).join(', ')}`, source: 'vocab' }
  }
  const words = rng.shuffle(levelWords)
  let wi = 0
  while (wi < words.length && out.filter((q) => q.source === 'vocab').length < 3) {
    const q = wordItem(words[wi++]!)
    if (q) push(q)
  }
  // 4. Fill to size: more grammar, then more vocabulary.
  for (const g of grammarItems.slice(3)) {
    if (out.length >= QUIZ_SIZE) break
    push({ prompt: g.prompt, options: g.options, answer: g.answer, explain: g.explain, source: 'grammar' })
  }
  while (out.length < QUIZ_SIZE && wi < words.length) {
    const q = wordItem(words[wi++]!)
    if (q) push(q)
  }
  return rng.shuffle(out).slice(0, QUIZ_SIZE)
}
