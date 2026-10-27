import { describe, it, expect } from 'vitest'
import { courseAccess, courseLessons, establishedLevel, isCheckpointOpen, isWritingOpen, lockHint, lessonName, stopLessonsDone, loadLessonCounts, type Progress } from '@/engine/unlock'
import { levels } from '@/engine/loader'
import type { ExamRow, LessonRow } from '@/engine/types'
import type { LevelId, LevelMeta } from '@/engine/schema'

// A small syllabus: A1 lists its starter unit u13 first (like Cantonese), then u01; A2 and B1 have one unit each;
// B2 has an unauthored unit only.
const unit = (id: string, authored = true) => ({ id, title: id, subtitle: '', grammar: [], cando: [], authored }) as unknown as LevelMeta['units'][number]
const LEVELS = [
  { id: 'a1', units: [unit('a1.u13'), unit('a1.u01'), unit('a1.u02', false)] },
  { id: 'a2', units: [unit('a2.u01')] },
  { id: 'b1', units: [unit('b1.u01')] },
  { id: 'b2', units: [unit('b2.u01', false)] },
] as Pick<LevelMeta, 'id' | 'units'>[]
const COUNTS = new Map([['a1.u13', 3], ['a1.u01', 2], ['a2.u01', 2], ['b1.u01', 2]])
const ORDER = courseLessons(LEVELS, COUNTS)

const row = (id: string, completions = 1): LessonRow => ({ id, unitId: id.split('.').slice(0, 2).join('.'), level: id.split('.')[0] as LevelId, attempts: Math.max(1, completions), completions, bestAccuracy: 1, lastAccuracy: 1, xp: 0 })
const rows = (...ids: (string | [string, number])[]) => new Map(ids.map((x) => (typeof x === 'string' ? [x, row(x)] : [x[0], row(x[0], x[1])])))
const passed = (...levels: LevelId[]) => new Map(levels.map((l) => [l, { level: l, score: 0.9, passed: true, ts: 1 } as ExamRow]))
const access = (p: Partial<Progress> = {}) => courseAccess(ORDER, { lessonRows: new Map(), exams: new Map(), startLevel: 'a1', ...p })
const open = (a: ReturnType<typeof access>) => ORDER.filter((l) => a.isOpen(l.id)).map((l) => l.id)

describe('syllabus order', () => {
  it('follows levels, then units as the syllabus lists them, then lessons; unauthored units are skipped', () => {
    expect(ORDER.map((l) => l.id)).toEqual(['a1.u13.l1', 'a1.u13.l2', 'a1.u13.l3', 'a1.u01.l1', 'a1.u01.l2', 'a2.u01.l1', 'a2.u01.l2', 'b1.u01.l1', 'b1.u01.l2'])
    expect(ORDER[2]).toEqual({ id: 'a1.u13.l3', unitId: 'a1.u13', level: 'a1', n: 3, count: 3 })
  })
})

describe('lesson access', () => {
  it('a new learner at A1 has only the first lesson open', () => {
    const a = access()
    expect(a.start).toBe(0)
    expect(open(a)).toEqual(['a1.u13.l1'])
    expect(a.blocker('a1.u13.l2')?.id).toBe('a1.u13.l1')
    expect(a.blocker('a1.u13.l1')).toBeUndefined()
    expect(a.current()?.id).toBe('a1.u13.l1')
  })

  it('completing a lesson opens the next one, across units and levels', () => {
    expect(open(access({ lessonRows: rows('a1.u13.l1') }))).toEqual(['a1.u13.l1', 'a1.u13.l2'])
    // the last lesson of a stop opens the next stop's first lesson
    const a = access({ lessonRows: rows('a1.u13.l1', 'a1.u13.l2', 'a1.u13.l3') })
    expect(a.isOpen('a1.u01.l1')).toBe(true)
    expect(a.isOpen('a1.u01.l2')).toBe(false)
    expect(a.current('a1.u13')?.id).toBe('a1.u01.l1')
    // the last lesson of a level opens the next level
    const b = access({ lessonRows: rows('a1.u13.l1', 'a1.u13.l2', 'a1.u13.l3', 'a1.u01.l1', 'a1.u01.l2') })
    expect(b.isOpen('a2.u01.l1')).toBe(true)
    expect(b.isOpen('a2.u01.l2')).toBe(false)
    expect(b.blocker('a2.u01.l2')?.id).toBe('a2.u01.l1')
  })

  it('a started but unfinished lesson does not open the next one', () => {
    const a = access({ lessonRows: rows(['a1.u13.l1', 0]) })
    expect(open(a)).toEqual(['a1.u13.l1'])
    expect(a.current()?.id).toBe('a1.u13.l1')
  })

  it('the start level: earlier levels are open, the start level is sequential from its first lesson', () => {
    const a = access({ startLevel: 'a2' })
    expect(a.start).toBe(5)
    expect(open(a)).toEqual(['a1.u13.l1', 'a1.u13.l2', 'a1.u13.l3', 'a1.u01.l1', 'a1.u01.l2', 'a2.u01.l1'])
    expect(a.current()?.id).toBe('a2.u01.l1')
    // reviewing an earlier lesson does not move the current lesson back
    expect(access({ startLevel: 'a2', lessonRows: rows('a1.u13.l1') }).current('a1.u13')?.id).toBe('a2.u01.l1')
  })

  it('a start beyond the authored lessons opens everything', () => {
    const a = access({ startLevel: 'b2' })
    expect(a.start).toBe(ORDER.length)
    expect(open(a)).toHaveLength(ORDER.length)
    expect(a.current()?.id).toBe('a1.u13.l1')
  })

  it('passing border control tests out of a level: the next level opens from its first lesson', () => {
    expect(establishedLevel('a1', passed('a1'))).toBe('a2')
    expect(establishedLevel('b1', passed('a1'))).toBe('b1')
    expect(establishedLevel('a1', new Map([['a2', { level: 'a2', score: 0.3, passed: false, ts: 1 }]]))).toBe('a1')
    expect(establishedLevel('a1', passed('c2'))).toBeUndefined()
    const a = access({ exams: passed('a1') })
    expect(a.isOpen('a1.u01.l2')).toBe(true)
    expect(a.isOpen('a2.u01.l1')).toBe(true)
    expect(a.isOpen('a2.u01.l2')).toBe(false)
    expect(a.current()?.id).toBe('a2.u01.l1')
    // the last level's exam opens the whole course
    expect(open(access({ exams: passed('b1') }))).toHaveLength(ORDER.length)
  })

  it('existing learners keep everything they reached: up to the furthest completed lesson and the next, plus any started', () => {
    // progress from before lessons were locked: lessons done out of order
    const a = access({ lessonRows: rows('a1.u13.l1', 'a1.u01.l1', ['b1.u01.l2', 0]) })
    expect(open(a)).toEqual(['a1.u13.l1', 'a1.u13.l2', 'a1.u13.l3', 'a1.u01.l1', 'a1.u01.l2', 'b1.u01.l2'])
    expect(a.isOpen('a2.u01.l1')).toBe(false)
    // the current lesson is the first gap on the route from where they last worked
    expect(a.current('a1.u01')?.id).toBe('a1.u01.l2')
    expect(a.current()?.id).toBe('a1.u13.l2')
    // changing the start back never locks what was reached
    const b = access({ startLevel: 'a1', lessonRows: rows('a2.u01.l1') })
    expect(open(b)).toEqual(['a1.u13.l1', 'a1.u13.l2', 'a1.u13.l3', 'a1.u01.l1', 'a1.u01.l2', 'a2.u01.l1', 'a2.u01.l2'])
  })

  it('unknown lessons are not locked, and everything done falls back to a lesson', () => {
    const all = access({ lessonRows: rows(...ORDER.map((l) => l.id)) })
    expect(all.isOpen('zz.u01.l1')).toBe(true)
    expect(all.current('a2.u01')?.id).toBe('a2.u01.l1')
    expect(all.after('a1.u13.l3')?.id).toBe('a1.u01.l1')
    expect(all.after('b1.u01.l2')).toBeUndefined()
  })
})

describe('lock hints', () => {
  const name = (u: string) => `Stop ${u}`
  it('names the lesson to finish: the lesson in the same stop, else the stop before', () => {
    const a = access()
    expect(lockHint(a.blocker('a1.u13.l3'), 'a1.u13', name)).toBe('Finish Lesson 2 first')
    expect(lockHint(a.blocker('a1.u01.l1'), 'a1.u01', name)).toBe('Finish Stop a1.u13 first')
    expect(lessonName(ORDER[3]!, 'a1.u13', name)).toBe('Stop a1.u01 · Lesson 1')
    expect(lessonName(ORDER[1]!, 'a1.u13', name)).toBe('Lesson 2')
  })
})

describe('checkpoint and writing stops', () => {
  it('open once all the stop lessons are completed', () => {
    const some = rows('a1.u13.l1', 'a1.u13.l2', ['a1.u13.l3', 0])
    const all = rows('a1.u13.l1', 'a1.u13.l2', 'a1.u13.l3')
    expect(stopLessonsDone('a1.u13', some, 3)).toBe(false)
    expect(isCheckpointOpen('a1.u13', some, 3)).toBe(false)
    expect(isWritingOpen('a1.u13', some, 3)).toBe(false)
    expect(isCheckpointOpen('a1.u13', all, 3)).toBe(true)
    expect(isWritingOpen('a1.u13', all, 3)).toBe(true)
    expect(isCheckpointOpen('a1.u13', new Map(), 0)).toBe(false)
  })
  it('stay open once taken', () => {
    expect(isCheckpointOpen('a1.u13', new Map(), 3, true)).toBe(true)
    expect(isWritingOpen('a1.u13', new Map(), 3, true)).toBe(true)
  })
})

describe('this course', () => {
  it('starts at the first lesson of the first authored unit the syllabus lists', async () => {
    const counts = await loadLessonCounts()
    const order = courseLessons(levels, counts)
    const first = levels[0]!.units.find((u) => u.authored)!
    expect(order[0]!.id).toBe(`${first.id}.l1`)
    expect(order.length).toBe([...counts.values()].reduce((a, b) => a + b, 0))
    const a = courseAccess(order, { lessonRows: new Map(), exams: new Map(), startLevel: 'a1' })
    expect(order.filter((l) => a.isOpen(l.id)).map((l) => l.id)).toEqual([`${first.id}.l1`])
  })
})
