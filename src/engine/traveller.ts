/**
 * Traveller level: a gentle, endless level curve over the total distance travelled (km, the
 * XP of src/engine/xp.ts). Early levels come every couple of lessons, later ones every few
 * days; every so often a level brings a new title (Backpacker, Explorer, Globetrotter…).
 */

/** Distance the k-th level-up asks for grows linearly: 50 km for level 2, then 20 km more each level. */
const STEP = 40
const GROWTH = 10

/** Total km needed to reach `level` (level 1 starts at 0 km). */
export function kmForLevel(level: number): number {
  const n = Math.max(0, Math.floor(level) - 1)
  return STEP * n + GROWTH * n * n
}

/** Titles and the level each one starts at, in order. */
export const TITLES: { level: number; title: string }[] = [
  { level: 1, title: 'Day-tripper' },
  { level: 3, title: 'Backpacker' },
  { level: 5, title: 'Wanderer' },
  { level: 8, title: 'Explorer' },
  { level: 12, title: 'Voyager' },
  { level: 16, title: 'Trailblazer' },
  { level: 20, title: 'Globetrotter' },
  { level: 25, title: 'Pathfinder' },
  { level: 30, title: 'Cartographer' },
  { level: 40, title: 'Legend of the road' },
]

export function titleFor(level: number): string {
  let t = TITLES[0]!.title
  for (const x of TITLES) if (level >= x.level) t = x.title
  return t
}

/** The title that starts exactly at `level`, if any (what a level-up unlocks). */
export function titleUnlockedAt(level: number): string | undefined {
  return level > 1 ? TITLES.find((t) => t.level === level)?.title : undefined
}

/** The next title ahead of `level` and the level it comes with. */
export function nextTitle(level: number): { level: number; title: string } | undefined {
  return TITLES.find((t) => t.level > level)
}

export interface TravellerLevel {
  level: number
  title: string
  /** km at which this level started and at which the next one starts. */
  floorKm: number
  nextKm: number
  /** km travelled within this level, and the km the level spans. */
  intoLevel: number
  span: number
  /** 0..1 towards the next level. */
  progress: number
}

/** Level, title and progress for a total distance in km. */
export function travellerLevel(totalKm: number): TravellerLevel {
  const km = Math.max(0, Number.isFinite(totalKm) ? totalKm : 0)
  // Invert kmForLevel, then nudge for floating point.
  let level = 1 + Math.floor((-STEP + Math.sqrt(STEP * STEP + 4 * GROWTH * km)) / (2 * GROWTH))
  while (kmForLevel(level + 1) <= km) level++
  while (level > 1 && kmForLevel(level) > km) level--
  const floorKm = kmForLevel(level)
  const nextKm = kmForLevel(level + 1)
  const span = nextKm - floorKm
  const intoLevel = km - floorKm
  return { level, title: titleFor(level), floorKm, nextKm, intoLevel, span, progress: span ? intoLevel / span : 0 }
}

/** The levels reached when the total goes from `before` to `after` km (empty when none). */
export function levelsCrossed(before: number, after: number): number[] {
  const from = travellerLevel(before).level
  const to = travellerLevel(after).level
  const out: number[] = []
  for (let l = from + 1; l <= to; l++) out.push(l)
  return out
}
