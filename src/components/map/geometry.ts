/**
 * Layout of the world map: each stop's lessons sit on an S-curve road that leaves the
 * stop banner at the centre line, swings out to one side and back across to the other,
 * and returns to the centre for the next banner. Coordinates are px from the centre line
 * (x) and from the top of the stop's path area (y), so the road keeps its shape at any width.
 */

/** Accessible status words for lesson nodes (e2e reads `${title}: ${label}`). */
export const STATUS_LABEL: Record<string, string> = { new: 'new', started: 'in progress', learned: 'learned', mastered: 'solid' }

export const MAP = {
  /** Vertical distance between node centres. */
  step: 100,
  /** Lesson node diameter. */
  node: 70,
  /** First node centre below the top of a stop's path area. */
  top: 66,
  /** Space below the last node before the road reaches the next banner. */
  bottom: 62,
  /** How far the road swings from the centre line. */
  amp: 82,
  /** Width of the road's SVG canvas (centred; the road never comes near its edge). */
  width: 360,
} as const

export interface MapPoint {
  x: number
  y: number
}

/**
 * Node offsets from the centre line: one full S per stop (sampled mid-interval so no two
 * neighbours line up vertically), mirrored on alternate stops.
 */
export function sCurve(count: number, dir: 1 | -1): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(MAP.amp * Math.sin((2 * Math.PI * (i + 0.5)) / count) * dir) || 0)
}

/** Node centres for a stop with `count` nodes, and the height of its path area. */
export function stopLayout(count: number, dir: 1 | -1): { points: MapPoint[]; height: number } {
  const xs = sCurve(count, dir)
  const points = xs.map((x, i) => ({ x, y: MAP.top + i * MAP.step }))
  const height = count ? MAP.top + (count - 1) * MAP.step + MAP.bottom : MAP.top
  return { points, height }
}

const r = (n: number) => Math.round(n * 10) / 10

/**
 * Smooth road through the points (Catmull-Rom as cubic Béziers), one segment per gap.
 * `lead`/`tail` are virtual points before the first and after the last one, so the road
 * enters and leaves straight down.
 */
export function roadSegments(pts: MapPoint[], lead: MapPoint, tail: MapPoint): string[] {
  const all = [lead, ...pts, tail]
  const segs: string[] = []
  for (let i = 1; i < all.length - 2; i++) {
    const p0 = all[i - 1]!
    const p1 = all[i]!
    const p2 = all[i + 1]!
    const p3 = all[i + 2]!
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    segs.push(`C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`)
  }
  return segs
}
