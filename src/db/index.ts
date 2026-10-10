/** IndexedDB via Dexie: all learner state lives here (no accounts, no server). */
import Dexie, { type EntityTable } from 'dexie'
import type { CardRow, ReviewRow, LessonRow, DayRow, ReadingRow, ExamRow, KvRow, QuestRow, SouvenirRow } from '../engine/types'

export class AprendeDB extends Dexie {
  cards!: EntityTable<CardRow, 'id'>
  reviews!: EntityTable<ReviewRow, 'id'>
  lessons!: EntityTable<LessonRow, 'id'>
  days!: EntityTable<DayRow, 'date'>
  reading!: EntityTable<ReadingRow, 'id'>
  exams!: EntityTable<ExamRow, 'level'>
  kv!: EntityTable<KvRow, 'key'>
  quests!: EntityTable<QuestRow, 'id'>
  souvenirs!: EntityTable<SouvenirRow, 'id'>

  constructor(name = 'aprende') {
    super(name)
    this.version(1).stores({
      cards: 'id, kind, level, lessonId, due, stage, *grammar',
      reviews: '++id, cardId, ts',
      lessons: 'id, unitId, level',
      days: 'date',
      reading: 'id, updatedAt',
      exams: 'level',
      kv: 'key',
    })
    this.version(2).stores({
      quests: 'id, date',
      souvenirs: 'id, ts',
    })
  }
}

export const db = new AprendeDB()

export const SCHEMA_VERSION = 2
