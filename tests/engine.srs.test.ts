import { describe, it, expect } from 'vitest'
import { newCard, review, Rating, isDue, gradeFor } from '@/engine/srs'
import { streakFrom, shiftDay, weakSkills, lessonMastery, estimateLevel } from '@/engine/mastery'
import { kindsFor } from '@/engine/ladder'

describe('srs', () => {
  it('schedules further out after correct answers and resets on failure', () => {
    const now = new Date('2026-01-01T10:00:00Z')
    let c = newCard('w.casa', 'word', 'a1', 'a1.u01.l1', [], now)
    expect(isDue(c, now.getTime())).toBe(true)
    c = review(c, Rating.Good, now)
    const d1 = c.due
    expect(d1).toBeGreaterThan(now.getTime())
    c = review(c, Rating.Good, new Date(d1))
    expect(c.due - d1).toBeGreaterThan(0)
    expect(c.stage).toBe(1) // two correct in a row promotes
    const beforeLapse = c.stability
    c = review(c, Rating.Again, new Date(c.due))
    expect(c.lapses).toBeGreaterThanOrEqual(0)
    expect(c.stage).toBe(0)
    expect(c.stability).toBeLessThanOrEqual(beforeLapse + 1e-9)
  })
  it('maps verdicts to grades', () => {
    expect(gradeFor('wrong')).toBe(Rating.Again)
    expect(gradeFor('almost')).toBe(Rating.Hard)
    expect(gradeFor('correct')).toBe(Rating.Good)
    expect(gradeFor('correct', true)).toBe(Rating.Easy)
  })
  it('ladder stages climb to production', () => {
    expect(kindsFor('word', 0)).toContain('choiceEs')
    expect(kindsFor('word', 3)).toContain('typeEs')
    expect(kindsFor('word', 0)).not.toContain('typeEs')
  })
})

describe('mastery', () => {
  it('computes streaks across day boundaries', () => {
    expect(streakFrom(['2026-01-01', '2026-01-02', '2026-01-03'], '2026-01-03')).toEqual({ current: 3, longest: 3 })
    expect(streakFrom(['2026-01-01', '2026-01-02'], '2026-01-03').current).toBe(2) // today not yet studied
    expect(streakFrom(['2026-01-01'], '2026-01-03').current).toBe(0)
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('finds weak grammar', () => {
    const r = Array.from({ length: 10 }, (_, i) => ({ cardId: 'x', ts: i, rating: 1 as const, correct: i % 2 === 0, exercise: 'typeEs' as const, grammar: ['g.ser-present'] }))
    expect(weakSkills(r)[0]?.grammar).toBe('g.ser-present')
  })
  it('lesson mastery grows with stage', () => {
    const now = Date.now()
    const low = newCard('a', 'word', 'a1', 'l', [], new Date(now))
    const high = { ...low, stage: 3 as const, reps: 6, due: now + 86_400_000 }
    expect(lessonMastery([high], now)).toBeGreaterThan(lessonMastery([low], now))
  })
  it('estimates level', () => {
    expect(estimateLevel(50, 2)).toBe('Pre-A1')
    expect(estimateLevel(2500, 120)).toBe('B1')
  })
})
