/**
 * The journey: Leo, Bonchita and Luna tour the country of the course. Each CEFR
 * level is a region and each unit is a stop. Data lives in content/<lang>/journey.yaml.
 */
import type { LevelId } from './schema'
import type { LessonRow } from './types'
import type { ArtKind, WardrobeColour, WearSlot } from './artKinds'
import { journeyData, ui, fill } from './loader'
import { WARDROBE } from './wardrobe'

export type { WearSlot } from './artKinds'

export interface Stop {
  unitId: string
  name: string
  emoji: string
  /** One-line Spanish caption shown on the stop card. */
  es: string
  en: string
  /** A short fact about the place, in Spanish at the region's level and in English, shown when the stamp is earned. */
  fact?: { es: string; en: string }
}
export interface Region {
  level: LevelId
  name: string
  es: string
  gradient: string
  stops: Stop[]
}

/** Regions and stops come from content/<lang>/journey.yaml; unit ids follow the stop order. */
export const REGIONS: Region[] = journeyData.regions.map((r) => ({
  level: r.level,
  name: r.name,
  es: r.es,
  gradient: `level-${r.level}`,
  stops: r.stops.map((s, i) => ({ unitId: `${r.level}.u${String(i + 1).padStart(2, '0')}`, name: s.name, emoji: s.emoji, es: s.es, en: s.en, fact: s.fact })),
}))

const BY_UNIT = new Map<string, { region: Region; stop: Stop; index: number }>()
for (const region of REGIONS) region.stops.forEach((stop, index) => BY_UNIT.set(stop.unitId, { region, stop, index }))

export function stopFor(unitId: string): { region: Region; stop: Stop; index: number } | undefined {
  return BY_UNIT.get(unitId)
}
export function regionFor(level: LevelId): Region | undefined {
  return REGIONS.find((r) => r.level === level)
}

/** Lessons of a unit that earn its passport stamp: four, or every lesson when the unit has fewer. */
export function stampTarget(lessonCount: number): number {
  return Math.min(4, Math.max(1, lessonCount || 4))
}
/** A stop is stamped once enough of its lessons have been completed at least once. */
export function isStamped(unitId: string, rows: ReadonlyMap<string, LessonRow> | LessonRow[], lessonCount = 4): boolean {
  const list = Array.isArray(rows) ? rows : [...rows.values()]
  const done = list.filter((r) => r.unitId === unitId && r.completions > 0).length
  return done >= stampTarget(lessonCount)
}

/**
 * Souvenirs: regional ones the dogs find at each region (journey.yaml), wardrobe accessories
 * in colours (engine/wardrobe.ts), and region badges. Quests and lucky finds hand out the first two.
 */
export interface Souvenir {
  id: string
  level: LevelId
  /** Fallback picture; SouvenirArt draws `art` in `color`. */
  emoji: string
  art: ArtKind
  /** Main colour of the illustration (#rrggbb). */
  color?: string
  es: string
  en: string
  blurb: string
  /** Souvenirs the dogs can wear or carry (see the Perros page). */
  wearable?: { slot: WearSlot }
  /** Wardrobe items: the accessory and its colour. */
  wardrobe?: { kind: ArtKind; colour: WardrobeColour }
  /** Region badges earned by passing the region quiz; never handed out by quests. */
  badge?: boolean
}
/** The region's own souvenirs, from content/<lang>/journey.yaml. */
export const REGIONAL_SOUVENIRS: Souvenir[] = journeyData.souvenirs.map((s) => ({
  id: s.id, level: s.level, emoji: s.emoji, art: s.art, ...(s.color ? { color: s.color } : {}), es: s.es, en: s.en, blurb: s.blurb,
  ...(s.slot ? { wearable: { slot: s.slot } } : {}),
}))
export { WARDROBE }
export const SOUVENIRS: Souvenir[] = [
  ...REGIONAL_SOUVENIRS,
  ...WARDROBE,
  // Region badges: earned with 80% or more in the region quiz.
  ...REGIONS.map((r): Souvenir => ({ id: `badge-${r.level}`, level: r.level, emoji: '🏅', art: 'medal', es: fill(ui.badgeName, { region: r.name }), en: `${r.name} badge`, blurb: `Passed the ${r.name} region quiz.`, badge: true })),
]
const BY_ID = new Map(SOUVENIRS.map((s) => [s.id, s]))
export function wearableSouvenirs(): Souvenir[] {
  return SOUVENIRS.filter((s) => s.wearable)
}
/** The region's own souvenirs and its badge (not the wardrobe, which belongs to every region). */
export function souvenirsFor(level: LevelId): Souvenir[] {
  return SOUVENIRS.filter((s) => s.level === level && !s.wardrobe)
}
export function souvenirById(id: string): Souvenir | undefined {
  return BY_ID.get(id)
}
