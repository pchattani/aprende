import { describe, it, expect } from 'vitest'
import { db } from '@/db'
import { seedDemo } from '@/dev/demo'
import { levels, vocab, grammar } from '@/engine/loader'
import { computeInsights, courseSummary, type CourseMeta } from '@/engine/analytics'

// The demo's thresholds are calibrated on the Spanish course in UTC (day boundaries are local time).
;(globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env.TZ = 'UTC'
const NOW = Date.UTC(2026, 9, 16, 20, 0)

function meta(): CourseMeta {
  const words = new Map<string, number>()
  for (const v of vocab.values()) words.set(v.level, (words.get(v.level) ?? 0) + 1)
  const g = new Map<string, string[]>()
  for (const n of grammar.values()) g.set(n.level, [...(g.get(n.level) ?? []), n.id])
  return { levels: levels.map((l) => ({ id: l.id, items: (words.get(l.id) ?? 0) + (g.get(l.id)?.length ?? 0), grammar: g.get(l.id) ?? [] })) }
}

describe('demo learner', () => {
  it('reads like a diligent A1–A2 learner with a few honest weak spots', async () => {
    const out = await seedDemo({ now: NOW, others: false })
    const data = { cards: await db.cards.toArray(), reviews: await db.reviews.toArray(), days: await db.days.toArray(), lessons: await db.lessons.toArray() }
    const m = meta()
    const s = courseSummary(data, m, NOW)
    const ins = computeInsights(data, m, NOW)
    const info = {
      out, recall30: s.recall30, level: s.levelEstimate, nav: s.nav, lessons: s.lessonsDone, minutes: s.totalMinutes, km: s.km,
      productive: data.cards.filter((c) => c.kind === 'word' && c.stage >= 2).length,
      calib: [ins.calibration.meanPredicted, ins.calibration.meanObserved, ins.calibration.verdict],
      backlog: ins.workload.backlog, throughput: ins.workload.throughput, dd: ins.nav.drawdown.pct,
      weakGrammar: ins.recall.byGrammar.filter((g) => g.flag === 'below').map((g) => `${g.id} ${g.p.toFixed(2)} n${g.n}`),
      modality: ins.recall.byModality.map((g) => `${g.id} ${g.p.toFixed(2)} ${g.flag}`),
      fatigue: ins.fatigue.recommendedMinutes, blocks: ins.consistency.significant, best: ins.consistency.best?.label, worst: ins.consistency.worst?.label,
      eta: ins.eta.next, suggestions: ins.suggestions.map((x) => `${x.severity} ${x.id}`),
    }
    // A diligent learner: 80–92% recall, working through A1–A2, most of the course order covered.
    expect(s.recall30.p).toBeGreaterThan(0.78)
    expect(s.recall30.p).toBeLessThan(0.92)
    expect(['A1', 'A2']).toContain(s.levelEstimate)
    expect(info.productive).toBeGreaterThan(100)
    expect(out.lessons).toBeGreaterThanOrEqual(25)
    expect(ins.workload.backlog).toBeLessThan(ins.workload.throughput)
    // Honest weak spots: a hard grammar point, weaker listening, the break's drawdown, evenings beating late nights.
    expect(ins.recall.byGrammar.some((g) => g.flag === 'below')).toBe(true)
    expect(ins.recall.byModality.find((x) => x.id === 'listening')?.flag).toBe('below')
    expect(ins.nav.drawdown.pct).toBeLessThan(-0.02)
    expect(ins.consistency.best?.from).toBe(18)
    expect(ins.fatigue.recommendedMinutes).toBeDefined()
    expect(ins.suggestions.length).toBeGreaterThanOrEqual(4)
  }, 120_000)
})
