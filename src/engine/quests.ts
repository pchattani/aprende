/**
 * Quests and rewards. Three quests a day, chosen deterministically from the
 * date, with progress read from the day's counters. Rewards are souvenirs from
 * the region the learner is travelling through.
 */
import { Rng, hashString } from './random'
import type { DayRow } from './types'
import type { LevelId } from './schema'
import { souvenirsFor, SOUVENIRS, type Souvenir } from './journey'

export type QuestKind = 'reviews' | 'lessons' | 'minutes' | 'perfect' | 'newItems'
export interface QuestDef {
  id: string
  kind: QuestKind
  target: number
  /** Spanish title with the dogs, and the English line. */
  es: string
  en: string
  emoji: string
}

export const QUEST_POOL: QuestDef[] = [
  { id: 'rev15', kind: 'reviews', target: 15, es: 'Leo quiere repasar', en: 'Answer 15 review items', emoji: '🔁' },
  { id: 'rev30', kind: 'reviews', target: 30, es: 'Bonchita no se cansa', en: 'Answer 30 review items', emoji: '🔁' },
  { id: 'les1', kind: 'lessons', target: 1, es: 'Una parada más', en: 'Complete a lesson', emoji: '📍' },
  { id: 'les2', kind: 'lessons', target: 2, es: 'Dos paradas en un día', en: 'Complete two lessons', emoji: '📍' },
  { id: 'min10', kind: 'minutes', target: 10, es: 'Diez minutos de paseo', en: 'Practise for 10 minutes', emoji: '⏱️' },
  { id: 'min20', kind: 'minutes', target: 20, es: 'Un paseo largo', en: 'Practise for 20 minutes', emoji: '⏱️' },
  { id: 'perf1', kind: 'perfect', target: 1, es: 'Sin tropezar', en: 'Finish a lesson with no mistakes', emoji: '✨' },
  { id: 'new10', kind: 'newItems', target: 10, es: 'Luna abre el mapa', en: 'Meet 10 new items', emoji: '🗺️' },
]

export function progressFor(q: QuestDef, day: Partial<DayRow> | undefined): number {
  if (!day) return 0
  switch (q.kind) {
    case 'reviews': return day.reviews ?? 0
    case 'lessons': return day.lessons ?? 0
    case 'minutes': return day.minutes ?? 0
    case 'perfect': return day.perfect ?? 0
    case 'newItems': return day.newItems ?? 0
  }
}

/** The day's three quests: one easy, one medium, one varied, chosen from the date. */
export function questsForDate(date: string): QuestDef[] {
  const rng = new Rng(hashString('quests:' + date))
  const easy = rng.pick(QUEST_POOL.filter((q) => ['les1', 'rev15', 'min10'].includes(q.id)))
  const medium = rng.pick(QUEST_POOL.filter((q) => ['les2', 'rev30', 'min20'].includes(q.id)))
  const other = rng.pick(QUEST_POOL.filter((q) => ['perf1', 'new10'].includes(q.id)))
  return [easy, medium, other]
}

/** Pick a reward souvenir: unowned, from the current region first, then anywhere; undefined if all owned. */
export function pickReward(level: LevelId, owned: Set<string>, seed: number): Souvenir | undefined {
  const rng = new Rng(seed)
  const local = souvenirsFor(level).filter((s) => !owned.has(s.id))
  if (local.length) return rng.pick(local)
  const any = SOUVENIRS.filter((s) => !owned.has(s.id))
  return any.length ? rng.pick(any) : undefined
}

/** Surprise find after a lesson: deterministic per lesson and day, roughly one in four. */
export function surpriseFind(lessonId: string, date: string, accuracy: number): boolean {
  const roll = new Rng(hashString(`find:${lessonId}:${date}`)).next()
  const chance = accuracy >= 0.9 ? 0.35 : 0.2
  return roll < chance
}
