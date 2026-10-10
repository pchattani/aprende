/**
 * Course access rules.
 *
 * The whole course is open: every authored lesson at every level can be started
 * at any time. The learner's *starting level* (first launch, placement test or
 * Settings) is only a recommendation that marks where the journey begins.
 * `levelUnlocked` / `lessonUnlocked` are kept for the course page and tests and
 * now always return true for authored content; `levelComplete` still reports
 * whether every lesson of a level has been completed.
 */
import { units, type UnitRef } from './loader'
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
  _level: LevelId,
  _lessonRows: Map<string, LessonRow>,
  _exams: Map<LevelId, ExamRow>,
  _lessonCounts: Map<string, number>,
  _startLevel: LevelId = DEFAULT_START_LEVEL,
): boolean {
  return true
}

export function levelComplete(level: LevelMeta, lessonRows: Map<string, LessonRow>, lessonCounts: Map<string, number>): boolean {
  const ids = lessonIdsFor(level, lessonCounts)
  return ids.length > 0 && ids.every((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0)
}

/** Every authored lesson is open. */
export function lessonUnlocked(
  _lessonId: string,
  _level: LevelMeta,
  _lessonRows: Map<string, LessonRow>,
  _exams: Map<LevelId, ExamRow>,
  _lessonCounts: Map<string, number>,
  _startLevel: LevelId = DEFAULT_START_LEVEL,
): boolean {
  return true
}
