import { describe, it, expect } from 'vitest'
import { questsForDate, progressFor, pickReward, surpriseFind, QUEST_POOL } from '@/engine/quests'
import { REGIONS, SOUVENIRS, stopFor, souvenirsFor } from '@/engine/journey'
import { levels } from '@/engine/loader'

describe('journey data', () => {
  it('has one stop per unit of the syllabus', () => {
    for (const l of levels) {
      const region = REGIONS.find((r) => r.level === l.id)!
      expect(region.stops).toHaveLength(l.units.length)
      for (const u of l.units) expect(stopFor(u.id)?.stop.unitId).toBe(u.id)
    }
  })
  it('has unique souvenir ids and some per region', () => {
    expect(new Set(SOUVENIRS.map((s) => s.id)).size).toBe(SOUVENIRS.length)
    for (const r of REGIONS) expect(souvenirsFor(r.level).length).toBeGreaterThanOrEqual(5)
  })
})

describe('quests', () => {
  it('gives three different quests per day, deterministically', () => {
    const a = questsForDate('2026-10-10')
    const b = questsForDate('2026-10-10')
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
    expect(new Set(a.map((q) => q.id)).size).toBe(3)
    expect(a.every((q) => QUEST_POOL.includes(q))).toBe(true)
  })
  it('reads progress from the day counters', () => {
    const day = { date: '2026-10-10', xp: 0, reviews: 12, lessons: 1, newItems: 4, minutes: 7, perfect: 1 }
    expect(progressFor({ id: 'x', kind: 'reviews', target: 15, es: '', en: '', emoji: '' }, day)).toBe(12)
    expect(progressFor({ id: 'x', kind: 'perfect', target: 1, es: '', en: '', emoji: '' }, day)).toBe(1)
    expect(progressFor({ id: 'x', kind: 'minutes', target: 10, es: '', en: '', emoji: '' }, undefined)).toBe(0)
  })
  it('rewards unowned souvenirs from the current region first, then anywhere, then none', () => {
    const owned = new Set<string>()
    const r1 = pickReward('a1', owned, 1)!
    expect(r1.level).toBe('a1')
    for (const s of souvenirsFor('a1')) owned.add(s.id)
    const r2 = pickReward('a1', owned, 2)!
    expect(r2.level).not.toBe('a1')
    for (const s of SOUVENIRS) owned.add(s.id)
    expect(pickReward('a1', owned, 3)).toBeUndefined()
  })
  it('surprise finds are deterministic and more likely after a clean lesson', () => {
    expect(surpriseFind('a1.u01.l1', '2026-10-10', 1)).toBe(surpriseFind('a1.u01.l1', '2026-10-10', 1))
    let hi = 0
    let lo = 0
    for (let i = 0; i < 200; i++) {
      if (surpriseFind(`l${i}`, '2026-10-10', 1)) hi++
      if (surpriseFind(`l${i}`, '2026-10-10', 0.5)) lo++
    }
    expect(hi).toBeGreaterThan(lo)
    expect(hi).toBeGreaterThan(30)
    expect(hi).toBeLessThan(110)
  })
})
