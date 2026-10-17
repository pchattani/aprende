import { describe, it, expect, beforeEach } from 'vitest'
import {
  lessonCoins, checkpointCoins, errandCoins, ERRAND_COINS, streakMilestoneCoins, nextStreakMilestone, levelUpCoins,
  priceFor, canAfford, coinsLabel, CURRENCY, LESSON_BASE, ACCURACY_BONUS_MAX, PERFECT_BONUS, PRICE_BY_LEVEL,
} from '@/engine/economy'
import { travellerLevel, kmForLevel, levelsCrossed, titleFor, titleUnlockedAt, nextTitle, TITLES } from '@/engine/traveller'
import { QUEST_POOL } from '@/engine/quests'
import { REGIONAL_SOUVENIRS, WARDROBE, SOUVENIRS } from '@/engine/journey'
import { LEVEL_ORDER } from '@/engine/schema'
import { xpFor } from '@/engine/xp'
import { pack } from '@/engine/loader'
import { db } from '@/db'
import { resetAll, awardCoins, coinBalance, buySouvenir, payStreakMilestone, totalKm, exportAll, importAll, ownedSouvenirs, bumpDay, COIN_LOG_KEY, getKv, type CoinEntry } from '@/db/progress'

const result = (correct: number, almost: number, wrong: number, completed = true) => ({ correct, almost, wrong, total: correct + almost + wrong, completed })

describe(`currency (${pack.name})`, () => {
  it('names the coins after the course money', () => {
    expect(CURRENCY.name).toBeTruthy()
    expect(CURRENCY.symbol).toBeTruthy()
    const expected: Record<string, string> = { es: 'peso', yue: '蚊', pt: 'real', it: 'euro', fr: 'euro' }
    if (expected[pack.id]) expect(CURRENCY.name).toBe(expected[pack.id])
  })
  it('labels amounts in the singular and plural', () => {
    const cur = { name: 'peso', plural: 'pesos', symbol: '$' }
    expect(coinsLabel(1, cur)).toBe('1 peso')
    expect(coinsLabel(25, cur)).toBe('25 pesos')
    expect(coinsLabel(25, { name: '蚊', plural: '蚊', symbol: 'HK$' })).toBe('25蚊')
  })
})

describe('coins earned', () => {
  it('pays a base, an accuracy bonus and a perfect bonus for a finished lesson', () => {
    expect(lessonCoins(result(12, 0, 0))).toEqual({ base: LESSON_BASE, accuracy: ACCURACY_BONUS_MAX, perfect: PERFECT_BONUS, total: LESSON_BASE + ACCURACY_BONUS_MAX + PERFECT_BONUS })
    const ok = lessonCoins(result(9, 0, 3))
    expect(ok.base).toBe(LESSON_BASE)
    expect(ok.perfect).toBe(0)
    expect(ok.accuracy).toBe(5) // 75%: halfway between 50% and 100%
    expect(lessonCoins(result(4, 0, 6)).accuracy).toBe(0) // below 50% earns no accuracy bonus
  })
  it('counts almost-right answers towards accuracy', () => {
    expect(lessonCoins(result(10, 2, 0)).accuracy).toBe(ACCURACY_BONUS_MAX)
  })
  it('pays nothing for an unfinished or empty session', () => {
    expect(lessonCoins(result(5, 0, 0, false)).total).toBe(0)
    expect(lessonCoins(result(0, 0, 0)).total).toBe(0)
  })
  it('grows with accuracy and never goes negative', () => {
    let prev = -1
    for (let c = 0; c <= 10; c++) {
      const t = lessonCoins(result(c, 0, 10 - c)).total
      expect(t).toBeGreaterThanOrEqual(prev)
      expect(t).toBeGreaterThanOrEqual(LESSON_BASE)
      prev = t
    }
  })
  it('pays more for the first checkpoint pass, nothing for a fail', () => {
    expect(checkpointCoins(false, false)).toBe(0)
    expect(checkpointCoins(true, true)).toBeGreaterThan(checkpointCoins(true, false))
    expect(checkpointCoins(true, false)).toBeGreaterThan(0)
  })
  it('prices every errand, harder errands paying more', () => {
    for (const q of QUEST_POOL) expect(ERRAND_COINS[q.id], q.id).toBeGreaterThan(0)
    expect(errandCoins('les2')).toBeGreaterThan(errandCoins('les1'))
    expect(errandCoins('unknown')).toBeGreaterThan(0)
  })
  it('pays streak bonuses on milestone days only', () => {
    expect(streakMilestoneCoins(1)).toBe(0)
    expect(streakMilestoneCoins(2)).toBe(0)
    expect(streakMilestoneCoins(3)).toBeGreaterThan(0)
    expect(streakMilestoneCoins(7)).toBeGreaterThan(streakMilestoneCoins(3))
    expect(streakMilestoneCoins(8)).toBe(0)
    expect(streakMilestoneCoins(400)).toBeGreaterThan(0)
    expect(streakMilestoneCoins(401)).toBe(0)
    expect(nextStreakMilestone(0).days).toBe(3)
    expect(nextStreakMilestone(3).days).toBe(7)
    expect(nextStreakMilestone(365)).toEqual({ days: 400, coins: streakMilestoneCoins(400) })
  })
  it('gives a growing travel fund on each level-up', () => {
    expect(levelUpCoins(1)).toBe(0)
    expect(levelUpCoins(2)).toBeGreaterThan(0)
    expect(levelUpCoins(10)).toBeGreaterThan(levelUpCoins(2))
  })
})

describe(`shop prices (${pack.name})`, () => {
  it('sells every wardrobe item and no regional souvenir or badge', () => {
    for (const w of WARDROBE) expect(priceFor(w), w.id).toBe(PRICE_BY_LEVEL[w.level])
    for (const s of REGIONAL_SOUVENIRS) expect(priceFor(s), s.id).toBeUndefined()
    for (const b of SOUVENIRS.filter((s) => s.badge)) expect(priceFor(b), b.id).toBeUndefined()
  })
  it('charges more for kinds of later regions', () => {
    const prices = LEVEL_ORDER.map((l) => PRICE_BY_LEVEL[l])
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
    expect(new Set(prices).size).toBe(prices.length)
  })
  it('keeps the first wardrobe item within a few lessons of earnings', () => {
    const perfect = lessonCoins(result(12, 0, 0)).total
    expect(PRICE_BY_LEVEL.a1 / perfect).toBeLessThanOrEqual(3)
    expect(canAfford(PRICE_BY_LEVEL.a1, PRICE_BY_LEVEL.a1)).toBe(true)
    expect(canAfford(PRICE_BY_LEVEL.a1 - 1, PRICE_BY_LEVEL.a1)).toBe(false)
    expect(canAfford(1000, undefined)).toBe(false)
  })
})

describe('traveller level', () => {
  it('starts at level 1 with the first title', () => {
    const t = travellerLevel(0)
    expect(t).toMatchObject({ level: 1, title: TITLES[0]!.title, floorKm: 0, intoLevel: 0, progress: 0 })
    expect(t.nextKm).toBe(kmForLevel(2))
  })
  it('levels up exactly at each threshold', () => {
    for (let l = 1; l <= 60; l++) {
      expect(travellerLevel(kmForLevel(l)).level, `at ${kmForLevel(l)} km`).toBe(l)
      if (l > 1) expect(travellerLevel(kmForLevel(l) - 1).level).toBe(l - 1)
    }
  })
  it('follows a gentle curve: each level a little longer than the last', () => {
    let prevSpan = 0
    for (let l = 1; l < 50; l++) {
      const span = kmForLevel(l + 1) - kmForLevel(l)
      expect(span).toBeGreaterThan(prevSpan)
      prevSpan = span
    }
    // A perfect first lesson doesn't level up on its own; two lessons do.
    const lesson = xpFor({ correct: 12, almost: 0, wrong: 0, completed: true })
    expect(travellerLevel(lesson).level).toBe(1)
    expect(travellerLevel(lesson * 2).level).toBe(2)
  })
  it('reports progress within the level', () => {
    const mid = (kmForLevel(4) + kmForLevel(5)) / 2
    const t = travellerLevel(mid)
    expect(t.level).toBe(4)
    expect(t.progress).toBeCloseTo(0.5)
    expect(t.intoLevel + t.floorKm).toBe(mid)
    expect(t.span).toBe(kmForLevel(5) - kmForLevel(4))
  })
  it('handles bad input', () => {
    expect(travellerLevel(-10).level).toBe(1)
    expect(travellerLevel(Number.NaN).level).toBe(1)
  })
  it('names titles like Backpacker, Explorer and Globetrotter as levels go up', () => {
    expect(titleFor(1)).toBe('Day-tripper')
    expect(titleFor(3)).toBe('Backpacker')
    expect(titleFor(9)).toBe('Explorer')
    expect(titleFor(22)).toBe('Globetrotter')
    expect(titleUnlockedAt(3)).toBe('Backpacker')
    expect(titleUnlockedAt(4)).toBeUndefined()
    expect(titleUnlockedAt(1)).toBeUndefined()
    expect(nextTitle(3)).toEqual({ level: 5, title: 'Wanderer' })
    expect(nextTitle(1000)).toBeUndefined()
    const levels = TITLES.map((t) => t.level)
    expect([...levels].sort((a, b) => a - b)).toEqual(levels)
  })
  it('lists the levels crossed by a gain', () => {
    expect(levelsCrossed(0, 10)).toEqual([])
    expect(levelsCrossed(kmForLevel(2) - 1, kmForLevel(2))).toEqual([2])
    expect(levelsCrossed(0, kmForLevel(4))).toEqual([2, 3, 4])
  })
})

describe('coin balance in the database', () => {
  beforeEach(async () => {
    await resetAll()
  })
  it('adds coins and keeps a ledger', async () => {
    expect(await coinBalance()).toBe(0)
    expect(await awardCoins(25, 'lesson:a1.u01.l1')).toBe(25)
    expect(await awardCoins(10, 'errand:les1')).toBe(35)
    expect(await awardCoins(0, 'nothing')).toBe(35)
    expect(await awardCoins(-5, 'never negative awards')).toBe(35)
    const log = await getKv<CoinEntry[]>(COIN_LOG_KEY, [])
    expect(log.map((e) => e.reason)).toEqual(['errand:les1', 'lesson:a1.u01.l1'])
  })
  it('buys a wardrobe item once, only when the balance covers it', async () => {
    const item = WARDROBE[0]!
    const price = priceFor(item)!
    expect(await buySouvenir(item.id, price)).toBe('short')
    await awardCoins(price + 5, 'test')
    expect(await buySouvenir(item.id, price)).toBe('ok')
    expect(await coinBalance()).toBe(5)
    expect((await ownedSouvenirs()).has(item.id)).toBe(true)
    expect((await db.souvenirs.get(item.id))?.source).toBe('shop')
    await awardCoins(price, 'test')
    expect(await buySouvenir(item.id, price)).toBe('owned')
    expect(await coinBalance()).toBe(price + 5)
  })
  it('pays a streak milestone at most once a day', async () => {
    expect(await payStreakMilestone(3, 15, '2026-10-17')).toBe(15)
    expect(await payStreakMilestone(3, 15, '2026-10-17')).toBe(0)
    expect(await payStreakMilestone(4, 0, '2026-10-18')).toBe(0)
    expect(await coinBalance()).toBe(15)
  })
  it('sums total km from the days', async () => {
    await bumpDay('2026-10-16', { xp: 30 })
    await bumpDay('2026-10-17', { xp: 12 })
    expect(await totalKm()).toBe(42)
  })
  it('carries the balance through export and import (it lives in kv)', async () => {
    await awardCoins(77, 'test')
    const backup = await exportAll()
    expect(backup.kv.find((r) => r.key === 'coins')?.value).toBe(77)
    await resetAll()
    expect(await coinBalance()).toBe(0)
    await importAll(backup)
    expect(await coinBalance()).toBe(77)
  })
})
