import { describe, it, expect } from 'vitest'
import { buildCheckpoint, checkpointSeed, type CheckpointExercise } from '@/engine/checkpoint'
import { grade, type Answer } from '@/engine/grade'
import { vocab, levels, unitIsAuthored, loadUnit, units } from '@/engine/loader'
import { checkText, equivEs, equivEn, isWord, lookupForm } from '@/hooks/useDeps'
import { IRREGULAR } from '@lang/verbs'
import { languagePack } from '@lang'
import type { Unit } from '@/engine/schema'

// Every stop of the current course (VITE_LANG) builds a balanced checkpoint whose own answers grade as correct.
const pool = [...vocab.values()]
const ctx = { vocab, pool, verbs: IRREGULAR, stageOf: () => undefined, speech: false, lookup: lookupForm }
const deps = { pack: languagePack, check: checkText, equivEs, equivEn, isWord }

function ownAnswer(ex: CheckpointExercise): Answer | undefined {
  switch (ex.kind) {
    case 'choiceEs':
    case 'choiceEn':
    case 'listen':
    case 'fillBlank':
    case 'reply':
      return ex.answer
    case 'match':
      return { mistakes: 0 }
    case 'wordBank':
    case 'order':
    case 'orderText':
      return languagePack.words(ex.answers[0]!)
    case 'speak':
      return undefined
    default:
      return 'answers' in ex ? ex.answers[0] : undefined
  }
}

const signature = (list: CheckpointExercise[]) => list.map((e) => `${e.kind}|${'prompt' in e ? e.prompt : ''}|${e.items.join(',')}`).join('\n')

const unitIds = levels.flatMap((l) => l.units.map((u) => u.id)).filter(unitIsAuthored)

/** The stops just before this one in the same region, nearest first. */
async function previousOf(unitId: string): Promise<Unit[]> {
  const ref = units.get(unitId)!
  const level = levels.find((l) => l.id === ref.level)!
  const prevIds = level.units.slice(Math.max(0, ref.index - 2), ref.index).map((u) => u.id).reverse().filter(unitIsAuthored)
  return Promise.all(prevIds.map(loadUnit))
}

describe('every checkpoint', () => {
  it('has authored units', () => {
    expect(unitIds.length).toBeGreaterThan(0)
  })
  for (const unitId of unitIds) {
    it(`${unitId}: balanced, gradeable and varied`, async () => {
      const unit = await loadUnit(unitId)
      const previous = await previousOf(unitId)
      const problems: string[] = []
      const a = buildCheckpoint(unit, previous, ctx, checkpointSeed(unitId, 0))
      const b = buildCheckpoint(unit, previous, ctx, checkpointSeed(unitId, 1))
      for (const [name, list] of [['v0', a], ['v1', b]] as const) {
        const reading = list.filter((e) => e.part === 'reading')
        const writing = list.filter((e) => e.part === 'writing')
        const recall = list.filter((e) => e.part === 'recall')
        if (list.length < 8 || list.length > 12) problems.push(`${name}: ${list.length} exercises`)
        if (reading.filter((e) => 'passage' in e && e.passage && e.passage.lines.length >= 2).length < 2) problems.push(`${name}: ${reading.length} reading with a passage`)
        if (writing.length < 3) problems.push(`${name}: ${writing.length} writing`)
        const lessonsCovered = new Set(writing.map((e) => e.source)).size
        if (lessonsCovered < Math.min(3, unit.lessons.length)) problems.push(`${name}: writing covers ${lessonsCovered} lessons`)
        if (previous.length && recall.length < 2) problems.push(`${name}: ${recall.length} recall`)
        if (!previous.length && recall.length) problems.push(`${name}: recall without a previous stop`)
        for (const ex of list) {
          if (!ex.review?.es || !ex.review.en) problems.push(`${name} ${ex.part} ${ex.kind}: no bilingual review`)
          if ('options' in ex && new Set(ex.options).size !== ex.options.length) problems.push(`${name} ${ex.kind}: duplicate options ${ex.options.join(' / ')}`)
          const answer = ownAnswer(ex)
          if (answer === undefined) {
            problems.push(`${name} ${ex.kind}: no own answer`)
            continue
          }
          const r = grade(ex, answer, deps)
          if (r.verdict === 'wrong') problems.push(`${name} ${ex.part} ${ex.kind}: own answer “${String(answer)}” graded wrong`)
        }
      }
      if (signature(a) === signature(b)) problems.push('two seeds gave the same quiz')
      expect(problems).toEqual([])
    })
  }
})
