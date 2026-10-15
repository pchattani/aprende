import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { ensureCards, recordAnswer, recordLesson, dueCards, streak, exportAll, importAll, resetAll, totalMinutes, pinAnswer, pinnedRows, recordPinnedAnswer, unpin } from '@/db/progress'

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
    const updated = await recordAnswer('w.hola', 'correct', 'choiceEs')
    expect(updated?.reps).toBe(1)
    expect(await db.reviews.count()).toBe(1)
    expect(await totalMinutes()).toBe(0)
  })
  it('records lessons and streaks', async () => {
    await recordLesson({ lessonId: 'a1.u01.l1', total: 10, correct: 9, almost: 1, wrong: 0, completed: true, durationMs: 60000 }, 'a1.u01', 'a1')
    const s = await streak()
    expect(s.current).toBe(1)
    const row = await db.lessons.get('a1.u01.l1')
    expect(row?.completions).toBe(1)
    expect(row?.bestAccuracy).toBeCloseTo(1)
  })
  it('pins a wrong answer and unpins after two correct answers', async () => {
    await pinAnswer({ id: 's.a1.u01.l1.2', lessonId: 'a1.u01.l1', exerciseKind: 'typeEs', given: 'El casa', expected: 'La casa', es: 'La casa es pequeña.', en: 'The house is small.', missed: { given: 'El', expected: 'La' } })
    expect((await pinnedRows()).map((p) => p.id)).toEqual(['s.a1.u01.l1.2'])
    expect(await recordPinnedAnswer('s.a1.u01.l1.2', 'correct')).toBe(false)
    expect(await recordPinnedAnswer('s.a1.u01.l1.2', 'wrong')).toBe(false)
    expect((await pinnedRows())[0]!.streak).toBe(0)
    expect(await recordPinnedAnswer('s.a1.u01.l1.2', 'correct')).toBe(false)
    expect(await recordPinnedAnswer('s.a1.u01.l1.2', 'almost')).toBe(true)
    expect(await pinnedRows()).toEqual([])
    await pinAnswer({ id: 'x:1', lessonId: 'a1.u01.l1', exerciseKind: 'listen', given: 'a', expected: 'b', es: 'Hola', en: 'Hello' })
    const b = await exportAll()
    expect(b.pins?.length).toBe(1)
    await unpin('x:1')
    expect(await pinnedRows()).toEqual([])
    await importAll(b)
    expect((await pinnedRows()).length).toBe(1)
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
