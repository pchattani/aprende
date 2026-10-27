/**
 * Course access rules.
 *
 * The learner's *established level* is where their journey starts: the level chosen on the
 * welcome screen or given by the placement test (kv `startLevel`, DEFAULT_START_LEVEL when
 * never chosen), moved forward by every border control passed (passing a level's exam tests
 * out of it: the next level opens from its first lesson).
 *
 * In syllabus order (levels, then units as syllabus.yaml lists them, then lessons in file order):
 * - lessons before the established start are open, for review and practice;
 * - from the start on, the course is sequential: the first lesson at the start is open, and
 *   completing a lesson opens the next one (across units and levels);
 * - nothing a learner has reached ever locks again: every lesson up to the furthest one completed
 *   (and the one after it) stays open, and so does any lesson they have started (it has a row).
 *   This also keeps open everything learners reached before lessons were locked.
 *
 * A stop's checkpoint and its writing stop open once all of the stop's lessons are completed.
 * Border control (the level exams), the region quizzes, reviews, games and readers are never locked.
 */
import { units, type UnitRef } from './loader'
import { stopFor } from './journey'
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

export function levelComplete(level: LevelMeta, lessonRows: Map<string, LessonRow>, lessonCounts: Map<string, number>): boolean {
  const ids = lessonIdsFor(level, lessonCounts)
  return ids.length > 0 && ids.every((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0)
}

/** A lesson in syllabus order. */
export interface CourseLesson {
  id: string
  unitId: string
  level: LevelId
  /** 1-based position in its unit. */
  n: number
  /** Lessons in its unit. */
  count: number
}

/** Every authored lesson in syllabus order. `lessonCounts` holds each authored unit's number of lessons (units missing from it are skipped). */
export function courseLessons(levels: readonly Pick<LevelMeta, 'id' | 'units'>[], lessonCounts: ReadonlyMap<string, number>): CourseLesson[] {
  const out: CourseLesson[] = []
  for (const lv of levels)
    for (const u of lv.units) {
      const count = u.authored ? (lessonCounts.get(u.id) ?? 0) : 0
      for (let n = 1; n <= count; n++) out.push({ id: `${u.id}.l${n}`, unitId: u.id, level: lv.id, n, count })
    }
  return out
}

/**
 * The established level: the chosen start, or further on when a later border control was passed
 * (the level after the furthest exam passed). Undefined once the last level's exam is passed: everything is open.
 */
export function establishedLevel(startLevel: LevelId, exams: ReadonlyMap<LevelId, ExamRow>): LevelId | undefined {
  let at = Math.max(0, levelIndex(startLevel))
  for (const e of exams.values()) if (e.passed) at = Math.max(at, levelIndex(e.level) + 1)
  return LEVEL_ORDER[at]
}

/** What the access rules read: lesson rows, exam results and the chosen start (kv `startLevel`). */
export interface Progress {
  lessonRows: ReadonlyMap<string, LessonRow>
  exams: ReadonlyMap<LevelId, ExamRow>
  startLevel: LevelId
}

export interface CourseAccess {
  /** Every authored lesson in syllabus order. */
  order: readonly CourseLesson[]
  /** Index in `order` of the first lesson at the established start (order.length when the whole course is open). */
  start: number
  /** Every lesson up to this index is open (and so is any lesson with a row). */
  openThrough: number
  lesson(id: string): CourseLesson | undefined
  isOpen(lessonId: string): boolean
  /** For a locked lesson, the lesson to finish first (the one before it); undefined when open. */
  blocker(lessonId: string): CourseLesson | undefined
  /** The lesson after this one in syllabus order. */
  after(lessonId: string): CourseLesson | undefined
  /**
   * The current lesson: the next open, unfinished one. Searched from `fromUnit` (where the learner
   * last worked) when that is at or past the established start, else from the start.
   */
  current(fromUnit?: string): CourseLesson | undefined
}

export function courseAccess(order: readonly CourseLesson[], { lessonRows, exams, startLevel }: Progress): CourseAccess {
  const pos = new Map(order.map((l, i) => [l.id, i]))
  const est = establishedLevel(startLevel, exams)
  const estIdx = est === undefined ? Infinity : levelIndex(est)
  let start = order.findIndex((l) => levelIndex(l.level) >= estIdx)
  if (start < 0) start = order.length
  const done = (i: number) => (lessonRows.get(order[i]!.id)?.completions ?? 0) > 0
  let furthest = -1
  for (let i = 0; i < order.length; i++) if (done(i)) furthest = i
  const openThrough = Math.max(start, furthest + 1)
  const openAt = (i: number) => i <= openThrough || lessonRows.has(order[i]!.id)
  return {
    order,
    start,
    openThrough,
    lesson: (id) => order[pos.get(id) ?? -1],
    isOpen(id) {
      const i = pos.get(id)
      return i === undefined || openAt(i)
    },
    blocker(id) {
      const i = pos.get(id)
      return i === undefined || openAt(i) ? undefined : order[i - 1]
    },
    after: (id) => order[(pos.get(id) ?? Infinity) + 1],
    current(fromUnit) {
      const from = order.findIndex((l) => l.unitId === fromUnit)
      const begin = from >= 0 && (from >= start || start >= order.length) ? from : start
      const find = (lo: number) => {
        for (let i = lo; i < order.length; i++) if (!done(i) && openAt(i)) return order[i]
        return undefined
      }
      return find(begin) ?? find(start) ?? find(0) ?? order[from >= 0 ? from : Math.min(start, order.length - 1)]
    },
  }
}

/** The journey name of a unit's stop ("Recoleta"), else the unit's title. */
export function stopNameOf(unitId: string): string {
  return stopFor(unitId)?.stop.name ?? units.get(unitId)?.title ?? unitId
}

/**
 * How to name another lesson from a lesson's point of view: "Lesson 3" in the same stop,
 * else the stop's name with the lesson ("Recoleta · Lesson 1"), or the stop alone when `stopOnly`.
 */
export function lessonName(l: CourseLesson, fromUnitId: string, stopName: (unitId: string) => string = stopNameOf, stopOnly = false): string {
  if (l.unitId === fromUnitId) return `Lesson ${l.n}`
  return stopOnly ? stopName(l.unitId) : `${stopName(l.unitId)} · Lesson ${l.n}`
}

/** "Finish Lesson 2 first", or "Finish Recoleta first" when the lesson before is the last one of the previous stop. */
export function lockHint(blocker: CourseLesson | undefined, unitId: string, stopName: (unitId: string) => string = stopNameOf): string {
  if (!blocker) return 'Finish the lessons before it first'
  return `Finish ${lessonName(blocker, unitId, stopName, blocker.n === blocker.count)} first`
}

/** Whether all `lessonCount` lessons of a stop have been completed. */
export function stopLessonsDone(unitId: string, lessonRows: ReadonlyMap<string, LessonRow>, lessonCount: number): boolean {
  if (lessonCount <= 0) return false
  for (let n = 1; n <= lessonCount; n++) if ((lessonRows.get(`${unitId}.l${n}`)?.completions ?? 0) === 0) return false
  return true
}

/** A stop's checkpoint opens when all its lessons are completed (and stays open once taken). */
export function isCheckpointOpen(unitId: string, lessonRows: ReadonlyMap<string, LessonRow>, lessonCount: number, attempted = false): boolean {
  return attempted || stopLessonsDone(unitId, lessonRows, lessonCount)
}

/** A stop's writing stop (/writing/:unitId) opens when all its lessons are completed (and stays open once written). */
export function isWritingOpen(unitId: string, lessonRows: ReadonlyMap<string, LessonRow>, lessonCount: number, attempted = false): boolean {
  return attempted || stopLessonsDone(unitId, lessonRows, lessonCount)
}

/** Each authored unit's number of lessons, from the course outline (never every unit file at once). */
export async function loadLessonCounts(): Promise<Map<string, number>> {
  const { unitOutlines } = await import('./lessonIndex')
  const authored = [...units.values()].filter((u) => u.authored)
  return new Map(authored.map((u) => [u.id, unitOutlines.get(u.id)?.lessons.length ?? 0]))
}
