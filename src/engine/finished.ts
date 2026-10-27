/**
 * The finished pool: what the learner has finished, for the games. A lesson is finished once it
 * has been completed (`completions > 0`); its words are the `vocab` of those lessons and its
 * grammar the lesson's `teach` and the grammar ids of its sentences, exchanges and texts.
 * Cards alone do not count: a lesson started and left halfway has cards but is not finished.
 *
 * Pure: the lesson index comes in (engine/finishedData.ts builds it from engine/lessonIndex.ts).
 */
import type { LessonRow } from './types'
import type { LevelId, VocabEntry } from './schema'

/** A lesson's ids, as the lesson index has them. */
export interface LessonIdsLike {
  id: string
  vocab: readonly string[]
  grammar: readonly string[]
}

export interface FinishedPool {
  /** Ids of the lessons completed at least once. */
  lessons: ReadonlySet<string>
  /** Levels with at least one finished lesson. */
  levels: ReadonlySet<LevelId>
  /** Vocabulary ids of the finished lessons. */
  words: ReadonlySet<string>
  /** Grammar ids taught or practised in the finished lessons. */
  grammar: ReadonlySet<string>
}

export function finishedPool(rows: Iterable<Pick<LessonRow, 'id' | 'completions'>>, index: ReadonlyMap<string, LessonIdsLike>): FinishedPool {
  const lessons = new Set<string>()
  const levels = new Set<LevelId>()
  const words = new Set<string>()
  const grammar = new Set<string>()
  for (const r of rows) {
    if (!(r.completions > 0)) continue
    lessons.add(r.id)
    levels.add(r.id.split('.')[0] as LevelId)
    const l = index.get(r.id)
    for (const v of l?.vocab ?? []) words.add(v)
    for (const g of l?.grammar ?? []) grammar.add(g)
  }
  return { lessons, levels, words, grammar }
}

/** The finished pool with its vocabulary entries, and how far away a game still is. */
export interface Finished extends FinishedPool {
  /** The finished words' entries (ids the course does not have are left out). */
  entries: VocabEntry[]
  /**
   * How many more lessons (the unfinished ones, in syllabus order) the learner has to finish
   * before at least `need` words with different meanings fit the game: 0 when they already
   * do, undefined when the rest of the course does not get there.
   */
  moreLessons(fit: (v: VocabEntry) => boolean, need: number): number | undefined
  /** The same for any test of the words (a round that has to come together): 0 when `ok` already holds. */
  moreLessonsUntil(ok: (entries: VocabEntry[]) => boolean, limit?: number): number | undefined
}

/** Distinct meanings among the entries that fit (games never play two words with the same gloss). */
export function countFitting(entries: Iterable<VocabEntry>, fit: (v: VocabEntry) => boolean): number {
  const glosses = new Set<string>()
  for (const v of entries) if (v.en[0] && fit(v)) glosses.add(v.en[0].toLowerCase())
  return glosses.size
}

export function makeFinished(pool: FinishedPool, order: readonly LessonIdsLike[], lookup: (id: string) => VocabEntry | undefined): Finished {
  const entries = [...pool.words].flatMap((id) => {
    const v = lookup(id)
    return v ? [v] : []
  })
  const ahead = order.filter((l) => !pool.lessons.has(l.id))
  const until = (ok: (entries: VocabEntry[]) => boolean, limit = ahead.length): number | undefined => {
    if (ok(entries)) return 0
    const have = new Set(pool.words)
    const acc = [...entries]
    for (let k = 0; k < Math.min(limit, ahead.length); k++) {
      for (const id of ahead[k]!.vocab) {
        const v = !have.has(id) ? lookup(id) : undefined
        have.add(id)
        if (v) acc.push(v)
      }
      if (ok(acc)) return k + 1
    }
    return undefined
  }
  return {
    ...pool,
    entries,
    moreLessons(fit, need) {
      // counted as the lessons add up (a whole course of words, once per game on the hub)
      const glosses = new Set<string>()
      const add = (v: VocabEntry) => {
        if (v.en[0] && fit(v)) glosses.add(v.en[0].toLowerCase())
      }
      entries.forEach(add)
      if (glosses.size >= need) return 0
      const have = new Set(pool.words)
      for (let k = 0; k < ahead.length; k++) {
        for (const id of ahead[k]!.vocab) {
          const v = !have.has(id) ? lookup(id) : undefined
          have.add(id)
          if (v) add(v)
        }
        if (glosses.size >= need) return k + 1
      }
      return undefined
    },
    moreLessonsUntil: until,
  }
}
