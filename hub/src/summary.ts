/** Per-course and all-languages summaries shown on the hub. Pure functions of the data read in progress.ts. */
import { shiftDay, streakFrom, todayKey } from '@/engine/mastery'
import type { DayRow } from '@/engine/types'
import type { CourseData } from './progress'

export interface CourseSummary {
  /** Lessons completed at least once. */
  lessonsDone: number
  /** Word cards at stage 2 or above (recognised and recalled). */
  wordsLearned: number
  /** Consecutive active days up to today (or yesterday: the run survives until the end of today). */
  daysOnTheRoad: number
  totalMinutes: number
  /** Distance travelled: the sum of each day's XP. */
  km: number
  /** YYYY-MM-DD of the last active day, if any. */
  lastActive?: string
  /** Current level (a1…c2): the level of the latest lesson touched, else the chosen start level. */
  level: string
  /** XP per day for the last 30 days, oldest first (today last). */
  last30: number[]
  /** Active dates (YYYY-MM-DD), for the all-languages run. */
  activeDates: string[]
  /** CEFR level estimated from what the learner can use ("Pre-A1", "A2"…), when the analytics engine provides it. */
  levelEstimate?: string
}

export interface OverallSummary {
  /** Consecutive days with any language studied. */
  daysOnTheRoad: number
  /** Distinct days with any language studied. */
  activeDays: number
  totalMinutes: number
  km: number
  wordsLearned: number
  lessonsDone: number
}

const isActive = (d: DayRow) => d.minutes > 0 || d.reviews > 0 || d.lessons > 0

/** The hub's own minimal summary. */
export function localSummary(data: CourseData, now = new Date()): CourseSummary {
  const today = todayKey(now)
  const activeDates = data.days.filter(isActive).map((d) => d.date).sort()
  const byDate = new Map(data.days.map((d) => [d.date, d.xp]))
  const touched = (l: CourseData['lessons'][number]) => l.lastCompleted ?? l.firstCompleted ?? 0
  const latest = [...data.lessons].sort((a, b) => touched(b) - touched(a))[0]
  return {
    lessonsDone: data.lessons.filter((l) => l.completions > 0).length,
    wordsLearned: data.cards.filter((c) => c.kind === 'word' && c.stage >= 2).length,
    daysOnTheRoad: streakFrom(activeDates, today).current,
    totalMinutes: data.days.reduce((s, d) => s + (d.minutes || 0), 0),
    km: data.days.reduce((s, d) => s + (d.xp || 0), 0),
    lastActive: activeDates.at(-1),
    level: latest?.level ?? data.kv.startLevel ?? 'a1',
    last30: Array.from({ length: 30 }, (_, i) => byDate.get(shiftDay(today, i - 29)) ?? 0),
    activeDates,
  }
}

/** Numbers that a richer summary (src/engine/analytics) may provide, by their name there; only these are taken from it. */
const NUMERIC_KEYS = {
  lessonsDone: 'lessonsDone',
  wordsLearned: 'wordsLearned',
  daysOnTheRoad: 'daysOnTheRoad',
  daysOnRoad: 'daysOnTheRoad',
  totalMinutes: 'totalMinutes',
  km: 'km',
} as const satisfies Record<string, keyof CourseSummary>

/**
 * Merges whatever matching fields an external summary provides over the local one, so a different
 * or evolving shape can never break the hub: unknown or mistyped fields are ignored.
 */
export function mergeSummary(local: CourseSummary, external: unknown): CourseSummary {
  if (!external || typeof external !== 'object') return local
  const ext = external as Record<string, unknown>
  const out: CourseSummary = { ...local }
  for (const [from, to] of Object.entries(NUMERIC_KEYS)) {
    const v = ext[from]
    if (typeof v === 'number' && Number.isFinite(v)) out[to] = v
  }
  // `level` stays the journey level (where the learner is travelling); an estimate is kept beside it.
  if (typeof ext.levelEstimate === 'string') out.levelEstimate = ext.levelEstimate
  if (typeof ext.lastActive === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ext.lastActive)) out.lastActive = ext.lastActive
  if (Array.isArray(ext.last30) && ext.last30.length === 30 && ext.last30.every((n) => typeof n === 'number')) out.last30 = ext.last30 as number[]
  return out
}

export function overallSummary(courses: CourseSummary[], now = new Date()): OverallSummary {
  const dates = new Set(courses.flatMap((c) => c.activeDates))
  return {
    daysOnTheRoad: streakFrom([...dates], todayKey(now)).current,
    activeDays: dates.size,
    totalMinutes: courses.reduce((s, c) => s + c.totalMinutes, 0),
    km: courses.reduce((s, c) => s + c.km, 0),
    wordsLearned: courses.reduce((s, c) => s + c.wordsLearned, 0),
    lessonsDone: courses.reduce((s, c) => s + c.lessonsDone, 0),
  }
}
