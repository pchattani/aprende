/**
 * Quests and rewards. Three quests a day, chosen deterministically from the
 * date, with progress read from the day's counters. Rewards are souvenirs from
 * the region the learner is travelling through, then wardrobe accessories in colours.
 */
import { Rng, hashString } from './random'
import type { DayRow } from './types'
import { LEVEL_ORDER, type LevelId } from './schema'
import { REGIONAL_SOUVENIRS, WARDROBE, SOUVENIRS, type Souvenir } from './journey'
import { ui } from './loader'

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
  { id: 'rev15', kind: 'reviews', target: 15, es: '', en: 'Answer 15 review items', emoji: '🔁' },
  { id: 'rev30', kind: 'reviews', target: 30, es: '', en: 'Answer 30 review items', emoji: '🔁' },
  { id: 'les1', kind: 'lessons', target: 1, es: '', en: 'Complete a lesson', emoji: '📍' },
  { id: 'les2', kind: 'lessons', target: 2, es: '', en: 'Complete two lessons', emoji: '📍' },
  { id: 'min10', kind: 'minutes', target: 10, es: '', en: 'Practise for 10 minutes', emoji: '⏱️' },
  { id: 'min20', kind: 'minutes', target: 20, es: '', en: 'Practise for 20 minutes', emoji: '⏱️' },
  { id: 'perf1', kind: 'perfect', target: 1, es: '', en: 'Finish a lesson with no mistakes', emoji: '✨' },
  { id: 'new10', kind: 'newItems', target: 10, es: '', en: 'Meet 10 new items', emoji: '🗺️' },
]

// Quest titles are in the target language, from content/<lang>/ui.yaml.
for (const q of QUEST_POOL) q.es = ui.quests[q.id] ?? q.en

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

/** Once the region's own souvenirs are found, the share of rewards that come from the wardrobe. */
export const WARDROBE_SHARE = 0.6

/**
 * Pick a reward souvenir (never a badge):
 * 1. an unowned souvenir of the current region;
 * 2. a mix of unowned souvenirs of earlier regions and unowned wardrobe items (WARDROBE_SHARE of
 *    the time), preferring wardrobe kinds of the current level or earlier;
 * 3. anything unowned (later regions). Undefined only when the learner owns everything.
 */
export function pickReward(level: LevelId, owned: Set<string>, seed: number): Souvenir | undefined {
  const rng = new Rng(seed)
  const unowned = (s: Souvenir) => !owned.has(s.id) && !s.badge
  const rank = LEVEL_ORDER.indexOf(level)
  const local = REGIONAL_SOUVENIRS.filter((s) => s.level === level && unowned(s))
  if (local.length) return rng.pick(local)
  const earlier = REGIONAL_SOUVENIRS.filter((s) => unowned(s) && LEVEL_ORDER.indexOf(s.level) < rank)
  const wardrobe = WARDROBE.filter(unowned)
  const near = wardrobe.filter((s) => LEVEL_ORDER.indexOf(s.level) <= rank)
  const wear = near.length ? near : wardrobe
  if (earlier.length && wear.length) return rng.next() < WARDROBE_SHARE ? rng.pick(wear) : rng.pick(earlier)
  if (wear.length) return rng.pick(wear)
  if (earlier.length) return rng.pick(earlier)
  const any = SOUVENIRS.filter(unowned)
  return any.length ? rng.pick(any) : undefined
}

/** Surprise find after a lesson: deterministic per lesson and day, roughly one in four. */
export function surpriseFind(lessonId: string, date: string, accuracy: number): boolean {
  const roll = new Rng(hashString(`find:${lessonId}:${date}`)).next()
  const chance = accuracy >= 0.9 ? 0.35 : 0.2
  return roll < chance
}
