/**
 * Calibration on the real content of the current course (VITE_LANG): every writing prompt's model
 * answer must score 90+ overall with nothing flagged for spelling or grammar (from B1, words outside
 * the course dictionary are allowed), and meet its own
 * task (length, `use` words, `expect`). Doubles as a content check of the writing blocks; run it
 * for every course with node scripts/courses.mjs "npx vitest run tests/course.writing.test.ts".
 */
import { describe, it, expect } from 'vitest'
import { levels, unitIsAuthored, loadUnit, pack } from '@/engine/loader'
import { scoreFor } from '@/hooks/useWriting'

const unitIds = levels.flatMap((l) => l.units.map((u) => u.id)).filter(unitIsAuthored)

describe(`${pack.name}: writing model answers`, () => {
  it('score 90+ with no spelling or grammar issue, and meet their own task', async () => {
    const problems: string[] = []
    const scores: number[] = []
    for (const id of unitIds) {
      const unit = await loadUnit(id)
      unit.writing.forEach((w, i) => {
        const r = scoreFor(unit, w, w.model.es)
        scores.push(r.overall)
        const where = `${id} writing ${i + 1}`
        // from B1 a word outside the course dictionary is fine (it is only a "check" for learners too)
        const late = !/^a/.test(id)
        for (const x of r.issues) if (!(late && x.code === 'unknown')) problems.push(`${where}: ${x.code} “${w.model.es.slice(x.start, x.end)}”: ${x.message}`)
        if (r.overall < 90) problems.push(`${where}: scores ${r.overall} (${JSON.stringify(r.scores)})`)
        if (r.task.length < w.min || r.task.length > w.max) problems.push(`${where}: ${r.task.length} ${r.task.unit}, the task asks ${w.min}–${w.max}`)
        if (r.task.used.length < r.task.useNeed) problems.push(`${where}: uses ${r.task.used.length} of ${r.task.useNeed} use words`)
        if (w.expect.length && !r.task.expectMet.length) problems.push(`${where}: matches none of its expect patterns`)
      })
    }
    if (scores.length) {
      scores.sort((a, b) => a - b)
      console.log(`${pack.name}: ${scores.length} model answers, lowest ${scores[0]}, median ${scores[Math.floor(scores.length / 2)]}, ${problems.length} problem(s)`)
    }
    expect(problems).toEqual([])
  }, 120_000)
})
