/**
 * The game economy: coins named after the country's money (pesos, reais, euros, 蚊).
 * Learners earn them by finishing lessons, clearing checkpoints, claiming daily errands
 * and keeping the road going; they spend them on wardrobe accessories in the dogs' shop.
 * Pure rules only: the balance lives in the kv table (db/progress.ts: awardCoins).
 */
import type { LessonResult } from './types'
import type { LevelId } from './schema'
import type { Souvenir } from './journey'
import { ui } from './loader'

export interface Currency {
  /** Singular name (peso, real, euro, 蚊). */
  name: string
  plural: string
  /** Money symbol ($, R$, €, HK$). */
  symbol: string
}

/** This course's currency, from content/<lang>/ui.yaml. */
export const CURRENCY: Currency = { name: ui.currency.name, plural: ui.currency.plural ?? ui.currency.name, symbol: ui.currency.symbol }

/** "1 peso", "25 pesos", "25蚊". */
export function coinsLabel(n: number, cur: Currency = CURRENCY): string {
  const word = Math.abs(n) === 1 ? cur.name : cur.plural
  // Chinese writes the measure right after the number, with no space.
  return /^\p{Script=Han}/u.test(word) ? `${n}${word}` : `${n} ${word}`
}

// ---------------------------------------------------------------------------
// Earning

export const LESSON_BASE = 10
export const ACCURACY_BONUS_MAX = 10
export const PERFECT_BONUS = 5

export interface LessonCoins {
  base: number
  accuracy: number
  perfect: number
  total: number
}

/**
 * Coins for a lesson: a base for finishing it, an accuracy bonus that grows from nothing at
 * 50% to ACCURACY_BONUS_MAX at 100%, and a bonus for a clean sweep. Unfinished sessions earn none.
 */
export function lessonCoins(r: Pick<LessonResult, 'correct' | 'almost' | 'wrong' | 'total' | 'completed'>): LessonCoins {
  if (!r.completed || r.total <= 0) return { base: 0, accuracy: 0, perfect: 0, total: 0 }
  const acc = (r.correct + r.almost) / r.total
  const base = LESSON_BASE
  const accuracy = Math.round(ACCURACY_BONUS_MAX * Math.max(0, Math.min(1, (acc - 0.5) / 0.5)))
  const perfect = r.wrong === 0 ? PERFECT_BONUS : 0
  return { base, accuracy, perfect, total: base + accuracy + perfect }
}

export const CHECKPOINT_PASS_COINS = 20
export const CHECKPOINT_FIRST_BONUS = 30

/** Coins for a checkpoint: something for every pass, a bigger purse the first time a stop is cleared. */
export function checkpointCoins(passed: boolean, firstPass: boolean): number {
  if (!passed) return 0
  return CHECKPOINT_PASS_COINS + (firstPass ? CHECKPOINT_FIRST_BONUS : 0)
}

export const WRITING_PROMPT_COINS = 5
export const WRITING_STARS_BONUS = 5
export const WRITING_SET_BONUS = 10

/**
 * Coins for a writing check: a little purse the first time a prompt reaches the pass mark
 * (engine/writing.ts WRITING_PASS), a bonus the first time it earns all three stamps, and one
 * for the stop's whole set done. Re-checks pay nothing more, so revising is free but not farmable.
 */
export function writingCoins(r: { firstPass: boolean; firstThreeStars: boolean; setDone: boolean }): number {
  return (r.firstPass ? WRITING_PROMPT_COINS : 0) + (r.firstThreeStars ? WRITING_STARS_BONUS : 0) + (r.setDone ? WRITING_SET_BONUS : 0)
}

/** Coins per daily errand, by how much it asks (ids from engine/quests.ts QUEST_POOL). */
export const ERRAND_COINS: Record<string, number> = {
  les1: 10, rev15: 10, min10: 10,
  les2: 20, rev30: 20, min20: 20,
  perf1: 15, new10: 15,
}
export function errandCoins(questId: string): number {
  return ERRAND_COINS[questId] ?? 10
}

/** Days on the road that pay a bonus, and how much. Past the table, every hundredth day pays STREAK_CENTURY. */
export const STREAK_MILESTONES: Record<number, number> = { 3: 15, 7: 40, 14: 60, 30: 120, 50: 150, 100: 300, 365: 1000 }
export const STREAK_CENTURY = 300

/** The bonus for reaching `days` on the road today (0 unless it is a milestone). */
export function streakMilestoneCoins(days: number): number {
  if (STREAK_MILESTONES[days]) return STREAK_MILESTONES[days]
  return days > 100 && days % 100 === 0 ? STREAK_CENTURY : 0
}

/** The next milestone after `days`, for "3 more days to a bonus" hints. */
export function nextStreakMilestone(days: number): { days: number; coins: number } {
  const table = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b)
  const next = table.find((d) => d > days)
  if (next) return { days: next, coins: STREAK_MILESTONES[next]! }
  const century = (Math.floor(days / 100) + 1) * 100
  return { days: century, coins: streakMilestoneCoins(century) }
}

/** The travel fund that comes with a new traveller level. */
export function levelUpCoins(level: number): number {
  return level <= 1 ? 0 : 15 + 5 * level
}

// ---------------------------------------------------------------------------
// Spending

/** Shop prices of wardrobe items by the region their kind belongs to: later kinds cost more. */
export const PRICE_BY_LEVEL: Record<LevelId, number> = { a1: 40, a2: 60, b1: 80, b2: 100, c1: 130, c2: 160 }

/**
 * The shop price of a souvenir, or undefined when it cannot be bought: regional souvenirs
 * and badges are found on the road, only wardrobe accessories are for sale.
 */
export function priceFor(s: Pick<Souvenir, 'level' | 'wardrobe' | 'badge'>): number | undefined {
  if (!s.wardrobe || s.badge) return undefined
  return PRICE_BY_LEVEL[s.level]
}

/** True when the balance covers the price. */
export function canAfford(balance: number, price: number | undefined): boolean {
  return price !== undefined && balance >= price
}
