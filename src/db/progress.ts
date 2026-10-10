/**
 * Progress service: the only module that writes learner state. Wraps Dexie
 * tables with the engine's rules (FSRS scheduling, ladder, minutes and active days).
 */
import { db, SCHEMA_VERSION } from './index'
import type { CardRow, ReviewRow, LessonRow, DayRow, ItemKind, LessonResult, ReadingRow, ExamRow, QuestRow, SouvenirRow } from '../engine/types'
import { newCard, review as applyReview, gradeFor } from '../engine/srs'
import { todayKey, streakFrom } from '../engine/mastery'
import type { ExerciseKind, LevelId } from '../engine/schema'

export interface ItemSpec {
  id: string
  kind: ItemKind
  level: LevelId
  lessonId: string
  grammar: string[]
}

/** Create cards for items the learner has not met yet. Returns number created. */
export async function ensureCards(items: ItemSpec[], now = new Date()): Promise<number> {
  const ids = items.map((i) => i.id)
  const existing = new Set((await db.cards.bulkGet(ids)).filter(Boolean).map((c) => c!.id))
  const fresh = items.filter((i) => !existing.has(i.id)).map((i) => newCard(i.id, i.kind, i.level, i.lessonId, i.grammar, now))
  if (fresh.length) await db.cards.bulkAdd(fresh)
  return fresh.length
}

export async function getCards(ids: string[]): Promise<Map<string, CardRow>> {
  const rows = await db.cards.bulkGet(ids)
  const m = new Map<string, CardRow>()
  rows.forEach((r) => {
    if (r) m.set(r.id, r)
  })
  return m
}

/** Record one answer: updates the card (FSRS + ladder), logs the review, bumps today's counters. */
export async function recordAnswer(cardId: string, verdict: 'correct' | 'almost' | 'wrong', exercise: ExerciseKind, opts: { fast?: boolean; now?: Date } = {}): Promise<CardRow | undefined> {
  const now = opts.now ?? new Date()
  const card = await db.cards.get(cardId)
  if (!card) return undefined
  const updated = applyReview(card, gradeFor(verdict, opts.fast), now)
  const log: ReviewRow = { cardId, ts: now.getTime(), rating: gradeFor(verdict, opts.fast), correct: verdict !== 'wrong', exercise, grammar: card.grammar }
  await db.transaction('rw', db.cards, db.reviews, db.days, async () => {
    await db.cards.put(updated)
    await db.reviews.add(log)
    await bumpDay(todayKey(now), { reviews: 1 })
  })
  return updated
}

export async function bumpDay(date: string, delta: Partial<Omit<DayRow, 'date'>>): Promise<void> {
  const row = (await db.days.get(date)) ?? { date, xp: 0, reviews: 0, lessons: 0, newItems: 0, minutes: 0 }
  row.xp += delta.xp ?? 0
  row.perfect = (row.perfect ?? 0) + (delta.perfect ?? 0)
  row.reviews += delta.reviews ?? 0
  row.lessons += delta.lessons ?? 0
  row.newItems += delta.newItems ?? 0
  row.minutes += delta.minutes ?? 0
  await db.days.put(row)
}

export async function recordLesson(result: LessonResult, unitId: string, level: LevelId, now = new Date()): Promise<LessonRow> {
  const accuracy = result.total ? result.correct / result.total : 0
  const row: LessonRow = (await db.lessons.get(result.lessonId)) ?? {
    id: result.lessonId, unitId, level, attempts: 0, completions: 0, bestAccuracy: 0, lastAccuracy: 0, xp: 0,
  }
  row.attempts++
  row.lastAccuracy = accuracy
  if (result.completed) {
    row.completions++
    row.bestAccuracy = Math.max(row.bestAccuracy, accuracy)
    row.firstCompleted ??= now.getTime()
    row.lastCompleted = now.getTime()
  }
  await db.transaction('rw', db.lessons, db.days, async () => {
    await db.lessons.put(row)
    await bumpDay(todayKey(now), { lessons: result.completed ? 1 : 0, perfect: result.completed && result.wrong === 0 ? 1 : 0, minutes: Math.round(result.durationMs / 60000) })
  })
  return row
}

export async function dueCards(limit: number, now = Date.now(), filter?: (c: CardRow) => boolean): Promise<CardRow[]> {
  let q = await db.cards.where('due').belowOrEqual(now).sortBy('due')
  if (filter) q = q.filter(filter)
  return q.slice(0, limit)
}

export async function dueCount(now = Date.now()): Promise<number> {
  return db.cards.where('due').belowOrEqual(now).count()
}

export async function lessonRows(): Promise<Map<string, LessonRow>> {
  return new Map((await db.lessons.toArray()).map((l) => [l.id, l]))
}

export async function cardsForLesson(lessonId: string): Promise<CardRow[]> {
  return db.cards.where('lessonId').equals(lessonId).toArray()
}

export async function allCards(): Promise<CardRow[]> {
  return db.cards.toArray()
}

export async function recentReviews(limit = 500): Promise<ReviewRow[]> {
  return db.reviews.orderBy('ts').reverse().limit(limit).toArray()
}

export async function streak(now = new Date()): Promise<{ current: number; longest: number }> {
  const days = (await db.days.filter((d) => d.minutes > 0 || d.reviews > 0 || d.lessons > 0).toArray()).map((d) => d.date)
  return streakFrom(days, todayKey(now))
}

/** Total minutes practised across all days. */
export async function totalMinutes(): Promise<number> {
  return (await db.days.toArray()).reduce((s, d) => s + d.minutes, 0)
}

export async function dayRows(): Promise<DayRow[]> {
  return db.days.toArray()
}

export async function saveReading(row: ReadingRow): Promise<void> {
  await db.reading.put(row)
}
export async function readingRows(): Promise<ReadingRow[]> {
  return db.reading.orderBy('updatedAt').reverse().toArray()
}
export async function deleteReading(id: string): Promise<void> {
  await db.reading.delete(id)
}

export async function recordExam(row: ExamRow): Promise<void> {
  const prev = await db.exams.get(row.level)
  if (!prev || row.score >= prev.score || row.passed) await db.exams.put({ ...row, passed: row.passed || (prev?.passed ?? false) })
}
export async function examRows(): Promise<Map<LevelId, ExamRow>> {
  return new Map((await db.exams.toArray()).map((e) => [e.level, e]))
}

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const r = await db.kv.get(key)
  return r ? (r.value as T) : fallback
}
export async function setKv(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value })
}

// ---- backup
export interface Backup {
  app: 'aprende'
  schema: number
  exportedAt: string
  cards: CardRow[]
  reviews: ReviewRow[]
  lessons: LessonRow[]
  days: DayRow[]
  reading: ReadingRow[]
  exams: ExamRow[]
  kv: { key: string; value: unknown }[]
  quests?: QuestRow[]
  souvenirs?: SouvenirRow[]
}

export async function exportAll(): Promise<Backup> {
  return {
    app: 'aprende', schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(),
    cards: await db.cards.toArray(), reviews: await db.reviews.toArray(), lessons: await db.lessons.toArray(),
    days: await db.days.toArray(), reading: await db.reading.toArray(), exams: await db.exams.toArray(), kv: await db.kv.toArray(),
    quests: await db.quests.toArray(), souvenirs: await db.souvenirs.toArray(),
  }
}

export async function importAll(b: Backup): Promise<void> {
  if (b.app !== 'aprende' || !Array.isArray(b.cards)) throw new Error('Not an Aprende backup file')
  await db.transaction('rw', [db.cards, db.reviews, db.lessons, db.days, db.reading, db.exams, db.kv, db.quests, db.souvenirs], async () => {
    await Promise.all([db.cards.clear(), db.reviews.clear(), db.lessons.clear(), db.days.clear(), db.reading.clear(), db.exams.clear(), db.kv.clear(), db.quests.clear(), db.souvenirs.clear()])
    await db.cards.bulkAdd(b.cards)
    await db.reviews.bulkAdd(b.reviews.map(({ id: _id, ...r }) => r) as ReviewRow[])
    await db.lessons.bulkAdd(b.lessons)
    await db.days.bulkAdd(b.days)
    await db.reading.bulkAdd(b.reading ?? [])
    await db.exams.bulkAdd(b.exams ?? [])
    await db.kv.bulkAdd(b.kv ?? [])
    await db.quests.bulkAdd(b.quests ?? [])
    await db.souvenirs.bulkAdd(b.souvenirs ?? [])
  })
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviews, db.lessons, db.days, db.reading, db.exams, db.kv, db.quests, db.souvenirs], async () => {
    await Promise.all([db.cards.clear(), db.reviews.clear(), db.lessons.clear(), db.days.clear(), db.reading.clear(), db.exams.clear(), db.kv.clear(), db.quests.clear(), db.souvenirs.clear()])
  })
}

/** Marks onboarding done and records the level the learner starts the course at. */
export async function chooseStartLevel(level: LevelId): Promise<void> {
  await setKv('startLevel', level)
  await setKv('onboarded', true)
}

// ---- quests and souvenirs
export async function ownedSouvenirs(): Promise<Set<string>> {
  return new Set((await db.souvenirs.toArray()).map((s) => s.id))
}
export async function awardSouvenir(id: string, source: string, lessonId?: string, now = Date.now()): Promise<boolean> {
  if (await db.souvenirs.get(id)) return false
  await db.souvenirs.add({ id, ts: now, source, lessonId })
  return true
}
export async function questRows(date: string): Promise<Map<string, QuestRow>> {
  return new Map((await db.quests.where('date').equals(date).toArray()).map((q) => [q.questId, q]))
}
export async function claimQuest(date: string, questId: string, rewardId: string | undefined, now = Date.now()): Promise<void> {
  const id = `${date}:${questId}`
  await db.quests.put({ id, date, questId, claimedAt: now, rewardId })
  if (rewardId) await awardSouvenir(rewardId, 'quest', undefined, now)
}
