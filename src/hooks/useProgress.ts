import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { CardRow, LessonRow, DayRow, ExamRow } from '../engine/types'
import type { LevelId } from '../engine/schema'

export function useLessonRows(): Map<string, LessonRow> | undefined {
  return useLiveQuery(async () => new Map((await db.lessons.toArray()).map((l) => [l.id, l])), [])
}
export function useAllCards(): CardRow[] | undefined {
  return useLiveQuery(() => db.cards.toArray(), [])
}
export function useDays(): DayRow[] | undefined {
  return useLiveQuery(() => db.days.toArray(), [])
}
export function useDueCount(): number | undefined {
  return useLiveQuery(() => db.cards.where('due').belowOrEqual(Date.now()).count(), [])
}
export function useExams(): Map<LevelId, ExamRow> | undefined {
  return useLiveQuery(async () => new Map((await db.exams.toArray()).map((e) => [e.level, e])), [])
}

/** Live value of a key in the kv table (undefined while loading). */
export function useKvValue<T>(key: string, fallback: T): T | undefined {
  return useLiveQuery(async () => {
    const row = await db.kv.get(key)
    return row ? (row.value as T) : fallback
  }, [key])
}

/** Today's three quests with progress and claim state. */
export function useQuests(date: string) {
  return useLiveQuery(async () => {
    const [day, rows, souvenirs] = await Promise.all([db.days.get(date), db.quests.where('date').equals(date).toArray(), db.souvenirs.toArray()])
    return { day, rows: new Map(rows.map((r) => [r.questId, r])), owned: new Set(souvenirs.map((s) => s.id)) }
  }, [date])
}
export function useSouvenirs() {
  return useLiveQuery(() => db.souvenirs.orderBy('ts').reverse().toArray(), [])
}
