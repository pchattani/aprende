/**
 * Placement test: a short adaptive multiple-choice test that places a learner
 * in the course. It is built from content that already exists (the checkpoint
 * exams' grammar items and the vocabulary lists), so it needs no extra authoring.
 *
 * Flow: one stage per authored level with an exam, in order (A1, A2, B1…).
 * A stage has STAGE_SIZE items; scoring at least PASS_COUNT passes the stage
 * and the learner moves to the next level's stage. The first failed stage ends
 * the test. Placement = the first level whose stage was not passed, or the level
 * after the last authored stage when every stage is passed.
 */
import { Rng } from './random'
import type { Exam, LevelId, VocabEntry } from './schema'
import { LEVEL_ORDER } from './schema'

export const STAGE_SIZE = 8
export const GRAMMAR_PER_STAGE = 5
export const PASS_COUNT = 6

export interface PlacementItem {
  kind: 'grammar' | 'vocab'
  prompt: string
  options: string[]
  answer: number
  /** Language of the prompt, for TTS and lang attributes. */
  lang: 'es' | 'en'
}

export interface PlacementStage {
  level: LevelId
  items: PlacementItem[]
}

/** Vocabulary recognition item: the Spanish lemma, four English glosses. */
export function vocabItem(entry: VocabEntry, pool: VocabEntry[], rng: Rng): PlacementItem | undefined {
  const target = entry.en[0]
  if (!target) return undefined
  const distractors = rng
    .shuffle(pool.filter((v) => v.id !== entry.id && v.pos === entry.pos && v.en[0] && v.en[0] !== target))
    .slice(0, 3)
    .map((v) => v.en[0]!)
  if (distractors.length < 3) return undefined
  const options = rng.shuffle([target, ...distractors])
  return { kind: 'vocab', prompt: entry.lemma, options, answer: options.indexOf(target), lang: 'es' }
}

/** Build one stage from a level's exam grammar items and its vocabulary. */
export function buildStage(level: LevelId, exam: Exam | undefined, levelVocab: VocabEntry[], seed: number): PlacementStage {
  const rng = new Rng(seed)
  const items: PlacementItem[] = []
  const grammar = rng.shuffle(exam?.grammar ?? []).slice(0, GRAMMAR_PER_STAGE)
  for (const g of grammar) items.push({ kind: 'grammar', prompt: g.prompt, options: g.options, answer: g.answer, lang: 'es' })
  // Prefer content words with a single, unambiguous first gloss.
  const candidates = rng.shuffle(levelVocab.filter((v) => (v.pos === 'noun' || v.pos === 'verb' || v.pos === 'adj') && v.en.length > 0))
  for (const c of candidates) {
    if (items.length >= STAGE_SIZE) break
    const it = vocabItem(c, levelVocab, rng)
    if (it) items.push(it)
  }
  return { level, items: rng.shuffle(items) }
}

export function stagePassed(correct: number, total: number = STAGE_SIZE): boolean {
  return total > 0 && correct >= Math.min(PASS_COUNT, total)
}

/** The level to start at, given the ordered stage levels and which were passed. */
export function placementLevel(stageLevels: LevelId[], passed: boolean[]): LevelId {
  for (let i = 0; i < stageLevels.length; i++) {
    if (!passed[i]) return stageLevels[i]!
  }
  const last = stageLevels[stageLevels.length - 1]
  if (!last) return 'a1'
  const next = LEVEL_ORDER[LEVEL_ORDER.indexOf(last) + 1]
  return next ?? last
}
