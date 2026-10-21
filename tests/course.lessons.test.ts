import { describe, it, expect } from 'vitest'
import { generateLesson } from '@/engine/generate'
import { grade, type Answer } from '@/engine/grade'
import { vocab, levels, unitIsAuthored, loadUnit } from '@/engine/loader'
import { checkText, equivEs, equivEn, isWord, lookupForm } from '@/hooks/useDeps'
import { IRREGULAR } from '@lang/verbs'
import { languagePack } from '@lang'
import type { Exercise, Stage } from '@/engine/types'

// Every lesson of the current course (VITE_LANG) generates a full session whose own answers grade as correct.
const pool = [...vocab.values()]
const ctx = (stage: Stage) => ({ vocab, pool, verbs: IRREGULAR, stageOf: () => stage, speech: false, lookup: lookupForm })
const deps = { pack: languagePack, check: checkText, equivEs, equivEn, isWord }

function ownAnswer(ex: Exercise): Answer | undefined {
  switch (ex.kind) {
    case 'choiceEs':
    case 'choiceEn':
    case 'listen':
    case 'fillBlank':
    case 'reply':
    case 'pictogram':
    case 'hearChar':
      return ex.answer
    case 'match':
      return { mistakes: 0 }
    case 'trace':
    case 'writeChar':
      return { mistakes: 0, hints: 0, strokes: 3 }
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

const unitIds = levels.flatMap((l) => l.units.map((u) => u.id)).filter(unitIsAuthored)

describe('every lesson', () => {
  it('has authored units', () => {
    expect(unitIds.length).toBeGreaterThan(0)
  })
  for (const unitId of unitIds) {
    it(`${unitId}: generates exact sessions that accept their own answers`, async () => {
      const unit = await loadUnit(unitId)
      const problems: string[] = []
      for (const lesson of unit.lessons) {
        for (const stage of [0, 2] as Stage[]) {
          const exercises = generateLesson(lesson, ctx(stage), { seed: 7 + stage, count: 12 })
          if (exercises.length !== 12) problems.push(`${lesson.id} stage ${stage}: ${exercises.length} exercises`)
          for (const ex of exercises) {
            if (!ex.review?.es || !ex.review.en) problems.push(`${lesson.id} ${ex.kind}: no bilingual review`)
            const answer = ownAnswer(ex)
            if (answer === undefined) continue
            const r = grade(ex, answer, deps)
            if (r.verdict === 'wrong') problems.push(`${lesson.id} ${ex.kind}: own answer “${String(answer)}” graded wrong`)
          }
        }
      }
      expect(problems).toEqual([])
    })
  }
})
