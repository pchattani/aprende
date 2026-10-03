/**
 * Mastery computation: lessons, units and levels are "mastered" by evidence of
 * retention in spaced review, not by one completion.
 */
import type { CardRow, LessonRow, ReviewRow } from './types'

/** 0..1 score of a single item: stage weight blended with retention. */
export function itemScore(c: CardRow, now = Date.now()): number {
  const stageScore = c.stage / 3
  const overdueDays = Math.max(0, (now - c.due) / 86_400_000)
  const decay = overdueDays > 0 ? Math.max(0.5, 1 - overdueDays / 30) : 1
  const evidence = Math.min(1, c.reps / 4)
  return stageScore * 0.6 * decay + evidence * 0.4 * decay
}

export function lessonMastery(cards: CardRow[], now = Date.now()): number {
  if (cards.length === 0) return 0
  return cards.reduce((s, c) => s + itemScore(c, now), 0) / cards.length
}

export type Ring = 'locked' | 'new' | 'started' | 'learned' | 'mastered'

export function ringFor(lesson: LessonRow | undefined, mastery: number): Ring {
  if (!lesson || lesson.attempts === 0) return 'new'
  if (mastery >= 0.9 && lesson.completions >= 1) return 'mastered'
  if (lesson.completions >= 1) return 'learned'
  return 'started'
}

/** Grammar ids whose recent lapse rate is high. */
export function weakSkills(reviews: ReviewRow[], minReviews = 6, threshold = 0.35): { grammar: string; errorRate: number; n: number }[] {
  const acc = new Map<string, { n: number; wrong: number }>()
  for (const r of reviews) {
    for (const g of r.grammar) {
      const a = acc.get(g) ?? { n: 0, wrong: 0 }
      a.n++
      if (!r.correct) a.wrong++
      acc.set(g, a)
    }
  }
  return [...acc.entries()]
    .filter(([, a]) => a.n >= minReviews && a.wrong / a.n >= threshold)
    .map(([grammar, a]) => ({ grammar, errorRate: a.wrong / a.n, n: a.n }))
    .sort((x, y) => y.errorRate - x.errorRate)
}

/** Words known for recognition (stage>=1) and production (stage>=2). */
export function wordCounts(cards: CardRow[]): { seen: number; recognised: number; productive: number } {
  let seen = 0
  let recognised = 0
  let productive = 0
  for (const c of cards) {
    if (c.kind !== 'word') continue
    seen++
    if (c.stage >= 1) recognised++
    if (c.stage >= 2) productive++
  }
  return { seen, recognised, productive }
}

/** Streak from a sorted list of active day strings (YYYY-MM-DD). */
export function streakFrom(days: string[], today: string): { current: number; longest: number } {
  const set = new Set(days)
  let current = 0
  let d = today
  if (!set.has(today)) d = shiftDay(today, -1) // streak survives until the end of today
  while (set.has(d)) {
    current++
    d = shiftDay(d, -1)
  }
  let longest = 0
  const sorted = [...set].sort()
  let run = 0
  let prev: string | undefined
  for (const day of sorted) {
    run = prev && shiftDay(prev, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = day
  }
  return { current, longest }
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d + delta)
  return todayKey(dt)
}

/** Estimate CEFR level from productive word count and mastered grammar. */
export function estimateLevel(productiveWords: number, grammarMastered: number): string {
  if (productiveWords >= 9000 && grammarMastered >= 220) return 'C2'
  if (productiveWords >= 6000 && grammarMastered >= 180) return 'C1'
  if (productiveWords >= 3500 && grammarMastered >= 140) return 'B2'
  if (productiveWords >= 2000 && grammarMastered >= 100) return 'B1'
  if (productiveWords >= 900 && grammarMastered >= 50) return 'A2'
  if (productiveWords >= 200) return 'A1'
  return 'Pre-A1'
}
