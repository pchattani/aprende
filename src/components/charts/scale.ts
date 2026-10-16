/** Scales, ticks and formatters for the hand-written SVG charts (no React). */

export const C = {
  ink: 'var(--ink)',
  ink2: 'var(--ink-2)',
  line: 'var(--line)',
  card: 'var(--card)',
  blue: 'var(--blue)',
  red: 'var(--red)',
  ok: 'var(--ok)',
  bad: 'var(--bad)',
  sun: 'var(--sun)',
}

export const FONT = 10.5

export type Scale = ((v: number) => number) & { domain: [number, number]; range: [number, number] }

export function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  const span = d1 - d0 || 1
  const f = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as Scale
  f.domain = [d0, d1]
  f.range = [r0, r1]
  return f
}

export function logScale(d0: number, d1: number, r0: number, r1: number): Scale {
  const a = Math.log10(d0)
  const b = Math.log10(d1)
  const f = ((v: number) => r0 + ((Math.log10(Math.max(v, 1e-12)) - a) / (b - a || 1)) * (r1 - r0)) as Scale
  f.domain = [d0, d1]
  f.range = [r0, r1]
  return f
}

/** "Nice" step (1, 2, 2.5, 5 × 10^k) for about `target` ticks. */
export function niceStep(span: number, target = 4): number {
  const raw = span / Math.max(1, target)
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const n = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
}

export function niceTicks(lo: number, hi: number, target = 4): number[] {
  const step = niceStep(hi - lo, target)
  const out: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  return out
}

/** Domain expanded to nice bounds. */
export function niceDomain(lo: number, hi: number, target = 4): [number, number] {
  if (!(hi > lo)) return [lo - 1, hi + 1]
  const step = niceStep(hi - lo, target)
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step]
}

/** Powers of ten (with 3s when the range is short) between lo and hi. */
export function logTicks(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of hi / lo < 300 ? [1, 3] : [1]) {
      const v = m * Math.pow(10, e)
      if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v)
    }
  }
  return out
}

/** Human day ticks for log axes (1h, 6h, 1d, 3d, 1w, 1mo, 3mo, 1y) within [lo, hi]. */
export function dayTicks(lo: number, hi: number): number[] {
  return [1 / 24, 0.25, 1, 3, 7, 30, 90, 365, 1095].filter((t) => t >= lo * 0.999 && t <= hi * 1.001)
}

/** Text halo so labels stay legible where they cross marks. */
export const HALO = { paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3, strokeLinejoin: 'round' } as const

/** Compact number for axes: 1200 → 1.2K. */
export function compact(v: number, digits = 0): string {
  const a = Math.abs(v)
  if (a >= 10_000) return `${(v / 1000).toFixed(0)}K`
  if (a >= 1000) return `${(v / 1000).toFixed(1)}K`
  return v.toFixed(digits)
}

/** Days for log axes: 0.04 → 1h, 0.5 → 12h, 3 → 3d, 30 → 30d, 365 → 1y. */
export function dayTick(d: number): string {
  if (d < 1) return `${Math.round(d * 24)}h`
  if (d >= 365) return `${Math.round(d / 365)}y`
  if (d === 7) return '1w'
  if (d === 30) return '1mo'
  if (d === 90) return '3mo'
  return `${d >= 10 ? Math.round(d) : +d.toFixed(1)}d`
}

/** Short date label from YYYY-MM-DD: "12 Oct". */
export function dateTick(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Approximate rendered width of mono text at the chart font size. */
export const textW = (s: string, size: number = FONT) => s.length * size * 0.6


/** Build an SVG path from points, breaking at non-finite values. */
export function pathOf(pts: { x: number; y: number }[]): string {
  let d = ''
  let pen = false
  for (const p of pts) {
    if (!Number.isFinite(p.y) || !Number.isFinite(p.x)) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    pen = true
  }
  return d
}
