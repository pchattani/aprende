/** Calendar and session helpers (local time). */
import { todayKey, shiftDay } from '../mastery'

export const DAY_MS = 86_400_000
export const MIN_MS = 60_000

export { todayKey, shiftDay }

/** Local-date key (YYYY-MM-DD) of a timestamp. */
export const dayKeyOf = (ts: number): string => todayKey(new Date(ts))

/** Local midnight that starts the day `key`. */
export function startOfDay(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).getTime()
}

/** Last millisecond of the day `key`. */
export function endOfDay(key: string): number {
  return startOfDay(shiftDay(key, 1)) - 1
}

/** Keys of the `n` days ending at `lastKey` (inclusive), oldest first. */
export function dayRange(lastKey: string, n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(shiftDay(lastKey, -i))
  return out
}

/** Whole days between two keys (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS)
}

export interface Session<T> {
  start: number
  end: number
  items: T[]
}

/** Split time-ordered events into sessions: a gap longer than `gapMs` (default 30 min) starts a new one. */
export function sessions<T extends { ts: number }>(events: readonly T[], gapMs = 30 * MIN_MS): Session<T>[] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts)
  const out: Session<T>[] = []
  let cur: Session<T> | undefined
  for (const e of sorted) {
    if (!cur || e.ts - cur.end > gapMs) {
      cur = { start: e.ts, end: e.ts, items: [] }
      out.push(cur)
    }
    cur.items.push(e)
    cur.end = e.ts
  }
  return out
}

/** Monday-first weekday index 0..6 (Mon = 0) of a timestamp in local time. */
export const weekdayOf = (ts: number): number => (new Date(ts).getDay() + 6) % 7
export const hourOf = (ts: number): number => new Date(ts).getHours()
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export interface Cell {
  n: number
  k: number
}

/** 7 × 24 matrix (Mon-first weekday × hour) of counts and successes. */
export function weekdayHourMatrix<T extends { ts: number; correct: boolean }>(events: readonly T[]): Cell[][] {
  const m: Cell[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ n: 0, k: 0 })))
  for (const e of events) {
    const c = m[weekdayOf(e.ts)]![hourOf(e.ts)]!
    c.n++
    if (e.correct) c.k++
  }
  return m
}
