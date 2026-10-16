/**
 * Reads each course's learner data for the hub, straight from IndexedDB.
 *
 * Every course keeps its progress in its own database on this origin (Spanish `aprende`, the others
 * `aprende-<id>`; see src/engine/course.ts). The hub only ever reads: it never writes, never upgrades
 * and never creates a database. A course that was never opened has no database, and the hub must
 * not leave an empty one behind (the course would then open on an unexpected, version-less store).
 */
import type { CardRow, DayRow, LessonRow, ReviewRow } from '@/engine/types'

/** Everything the hub reads from one course. */
export interface CourseData {
  cards: CardRow[]
  reviews: ReviewRow[]
  days: DayRow[]
  lessons: LessonRow[]
  /** Selected kv rows (startLevel, onboarded). */
  kv: { startLevel?: string; onboarded?: boolean }
}

export const EMPTY_DATA: CourseData = { cards: [], reviews: [], days: [], lessons: [], kv: {} }

/** true / false when the browser can list databases, undefined when it cannot tell. */
async function databaseExists(name: string): Promise<boolean | undefined> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return undefined
  try {
    return (await indexedDB.databases()).some((d) => d.name === name)
  } catch {
    return undefined
  }
}

/** Opens an existing database at its current version; resolves null (and creates nothing) if it does not exist. */
function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(name)
    } catch {
      resolve(null)
      return
    }
    let created = false
    // Only fires for a database that did not exist: abort, so the browser discards it again.
    req.onupgradeneeded = () => {
      created = true
      req.transaction?.abort()
    }
    req.onsuccess = () => {
      const db = req.result
      if (created) {
        db.close()
        resolve(null)
        return
      }
      // Let the course upgrade its schema if it is open in another tab.
      db.onversionchange = () => db.close()
      resolve(db)
    }
    req.onerror = (e) => {
      e.preventDefault()
      resolve(null)
    }
    req.onblocked = () => resolve(null)
  })
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  if (!db.objectStoreNames.contains(store)) return Promise.resolve([])
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll()
      req.onsuccess = () => resolve(req.result as T[])
      req.onerror = (e) => {
        e.preventDefault()
        resolve([])
      }
    } catch {
      resolve([])
    }
  })
}

/** One course's data, or null when the learner has never opened that course on this device. */
export async function readCourse(dbName: string): Promise<CourseData | null> {
  if (typeof indexedDB === 'undefined') return null
  if ((await databaseExists(dbName)) === false) return null
  const db = await openExisting(dbName)
  if (!db) return null
  try {
    const [cards, reviews, days, lessons, kvRows] = await Promise.all([
      getAll<CardRow>(db, 'cards'),
      getAll<ReviewRow>(db, 'reviews'),
      getAll<DayRow>(db, 'days'),
      getAll<LessonRow>(db, 'lessons'),
      getAll<{ key: string; value: unknown }>(db, 'kv'),
    ])
    const kv: CourseData['kv'] = {}
    for (const r of kvRows) {
      if (r.key === 'startLevel' && typeof r.value === 'string') kv.startLevel = r.value
      if (r.key === 'onboarded') kv.onboarded = r.value === true
    }
    return { cards, reviews, days, lessons, kv }
  } finally {
    db.close()
  }
}

/** A course counts as started once the learner chose a start (welcome screen) or has any progress. */
export function isStarted(data: CourseData | null): data is CourseData {
  return Boolean(data && (data.kv.onboarded || data.lessons.length || data.cards.length || data.days.length))
}
