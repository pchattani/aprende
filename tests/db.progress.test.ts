import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { ensureCards, recordAnswer, recordLesson, dueCards, streak, exportAll, importAll, resetAll, totalXp } from '@/db/progress'

beforeEach(async () => {
  await resetAll()
})

describe('progress', () => {
  it('creates cards once and schedules them', async () => {
    const items = [{ id: 'w.hola', kind: 'word' as const, level: 'a1' as const, lessonId: 'a1.u01.l1', grammar: [] }]
    expect(await ensureCards(items)).toBe(1)
    expect(await ensureCards(items)).toBe(0)
    const due = await dueCards(10)
    expect(due.map((c) => c.id)).toEqual(['w.hola'])
    const updated = await recordAnswer('w.hola', 'correct', 'choiceEs', { xp: 1 })
    expect(updated?.reps).toBe(1)
    expect(await db.reviews.count()).toBe(1)
    expect(await totalXp()).toBe(1)
  })
  it('records lessons and streaks', async () => {
    await recordLesson({ lessonId: 'a1.u01.l1', total: 10, correct: 9, almost: 1, wrong: 0, heartsLeft: 3, xp: 15, completed: true, durationMs: 60000 }, 'a1.u01', 'a1')
    const s = await streak()
    expect(s.current).toBe(1)
    const row = await db.lessons.get('a1.u01.l1')
    expect(row?.completions).toBe(1)
    expect(row?.bestAccuracy).toBeCloseTo(0.9)
  })
  it('round-trips a backup', async () => {
    await ensureCards([{ id: 'w.adios', kind: 'word', level: 'a1', lessonId: 'a1.u01.l1', grammar: [] }])
    const b = await exportAll()
    await resetAll()
    expect(await db.cards.count()).toBe(0)
    await importAll(b)
    expect(await db.cards.count()).toBe(1)
    await expect(importAll({ app: 'other' } as never)).rejects.toThrow()
  })
})
