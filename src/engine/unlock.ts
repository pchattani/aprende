/**
 * Unlock rules for the path.
 *
 * - The learner has a *starting level* (chosen on first launch, by the placement
 *   test, or by pressing "Start here" on any level). Every level up to and
 *   including it is open; levels below it have all lessons open for practice.
 * - Within the starting level and above, lessons unlock sequentially and the
 *   next level opens when the checkpoint exam is passed (or, where no exam is
 *   authored, when every lesson is completed).
 */
import { levels, units, examExists, type UnitRef } from './loader'
import type { LessonRow, ExamRow } from './types'
import { LEVEL_ORDER, type LevelId, type LevelMeta } from './schema'

export interface LessonRef {
  id: string
  index: number
  unit: UnitRef
}

export const DEFAULT_START_LEVEL: LevelId = 'a1'

export function levelIndex(level: LevelId): number {
  return LEVEL_ORDER.indexOf(level)
}

/** Ordered lesson ids per level (authored units only, 4 lessons assumed unless loaded). */
export function lessonIdsFor(level: LevelMeta, lessonCounts: Map<string, number>): LessonRef[] {
  const out: LessonRef[] = []
  for (const u of level.units) {
    if (!u.authored) continue
    const n = lessonCounts.get(u.id) ?? 4
    for (let i = 1; i <= n; i++) out.push({ id: `${u.id}.l${i}`, index: i, unit: units.get(u.id)! })
  }
  return out
}

export function levelUnlocked(
  level: LevelId,
  lessonRows: Map<string, LessonRow>,
  exams: Map<LevelId, ExamRow>,
  lessonCounts: Map<string, number>,
  startLevel: LevelId = DEFAULT_START_LEVEL,
): boolean {
  const idx = levels.findIndex((l) => l.id === level)
  if (idx <= 0) return true
  if (levelIndex(level) <= levelIndex(startLevel)) return true
  const prev = levels[idx - 1]!
  if (exams.get(prev.id)?.passed) return true
  // No exam authored for the previous level: unlock when every lesson is completed.
  if (!examExists(prev.id)) {
    const ids = lessonIdsFor(prev, lessonCounts)
    return ids.length > 0 && ids.every((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0)
  }
  return false
}

export function levelComplete(level: LevelMeta, lessonRows: Map<string, LessonRow>, lessonCounts: Map<string, number>): boolean {
  const ids = lessonIdsFor(level, lessonCounts)
  return ids.length > 0 && ids.every((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0)
}

/**
 * A lesson is unlocked when its level is unlocked and the previous lesson in
 * the level is completed. Levels below the starting level are fully open.
 */
export function lessonUnlocked(
  lessonId: string,
  level: LevelMeta,
  lessonRows: Map<string, LessonRow>,
  exams: Map<LevelId, ExamRow>,
  lessonCounts: Map<string, number>,
  startLevel: LevelId = DEFAULT_START_LEVEL,
): boolean {
  if (!levelUnlocked(level.id, lessonRows, exams, lessonCounts, startLevel)) return false
  if (levelIndex(level.id) < levelIndex(startLevel)) return true
  const ids = lessonIdsFor(level, lessonCounts)
  const i = ids.findIndex((l) => l.id === lessonId)
  if (i <= 0) return i === 0
  return (lessonRows.get(ids[i - 1]!.id)?.completions ?? 0) > 0
}
