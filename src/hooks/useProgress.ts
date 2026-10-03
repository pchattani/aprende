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
