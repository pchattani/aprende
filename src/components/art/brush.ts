/**
 * Shared tools for the painted illustrations: a seeded random generator, colour
 * mixing, a unique-id hook and organic outline generators (fluffy coats, wiry
 * tufts, fur strokes, locks of hair, curls).
 */
import { useId } from 'react'

/** Deterministic 32-bit hash of a string (FNV-1a). */
export function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Small, fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export type Rng = () => number
export const range = (r: Rng, a: number, b: number): number => a + (b - a) * r()
export const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length]!

/** Round to one decimal so generated paths stay short. */
export const f = (n: number): string => (Math.round(n * 10) / 10).toString()

// ---------------------------------------------------------------- colour
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}
/** Mix two hex colours: t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}
export const lighten = (c: string, t: number): string => mix(c, '#fffaf0', t)
export const darken = (c: string, t: number): string => mix(c, '#1d1a2a', t)
/** Nudge hue/brightness a little so seeded variants of one palette differ. */
export function jitter(c: string, r: Rng, amount = 0.08): string {
  const [R, G, B] = hexToRgb(c)
  const k = 1 + (r() - 0.5) * amount * 2
  const s = (r() - 0.5) * amount * 120
  return rgbToHex(R * k + s, G * k, B * k - s)
}

// ---------------------------------------------------------------- ids
/** A unique, url()-safe id prefix per drawing (React ids contain characters url() dislikes). */
export function useArtId(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

// ---------------------------------------------------------------- outlines
/** A cloud-like outline around an ellipse: used for fluffy coats and foliage. */
export function fluffPath(cx: number, cy: number, rx: number, ry: number, bumps: number, depth: number, r: Rng, start = 0): string {
  const pts: [number, number][] = []
  for (let i = 0; i < bumps; i++) {
    const a = start + (i / bumps) * Math.PI * 2
    const k = 1 + (r() - 0.5) * 0.08
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`
  for (let i = 0; i < bumps; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % bumps]!
    const mx = (p[0] + q[0]) / 2
    const my = (p[1] + q[1]) / 2
    // push the control point outwards from the centre
    const ox = mx - cx
    const oy = my - cy
    const len = Math.hypot(ox, oy) || 1
    const dd = depth * (0.7 + r() * 0.6)
    d += ` Q${f(mx + (ox / len) * dd)} ${f(my + (oy / len) * dd)} ${f(q[0])} ${f(q[1])}`
  }
  return d + 'Z'
}

/** A scruffy outline with pointed tufts around an ellipse (wiry coats, grass clumps). */
export function spikyPath(cx: number, cy: number, rx: number, ry: number, tufts: number, len: number, r: Rng, start = 0): string {
  let d = ''
  for (let i = 0; i < tufts; i++) {
    const a0 = start + (i / tufts) * Math.PI * 2
    const a1 = start + ((i + 0.5) / tufts) * Math.PI * 2
    const base = 1 + (r() - 0.5) * 0.06
    const x0 = cx + Math.cos(a0) * rx * base
    const y0 = cy + Math.sin(a0) * ry * base
    const l = len * (0.55 + r() * 0.8)
    const lean = (r() - 0.5) * 0.5
    const tx = cx + Math.cos(a1 + lean * 0.3) * (rx + l)
    const ty = cy + Math.sin(a1 + lean * 0.3) * (ry + l)
    d += i === 0 ? `M${f(x0)} ${f(y0)}` : ` L${f(x0)} ${f(y0)}`
    // slightly curved tuft
    const cxm = cx + Math.cos(a1 - 0.08) * (rx + l * 0.45)
    const cym = cy + Math.sin(a1 - 0.08) * (ry + l * 0.45)
    d += ` Q${f(cxm)} ${f(cym)} ${f(tx)} ${f(ty)}`
  }
  return d + 'Z'
}

/** Short hair strokes scattered in an ellipse, flowing in a direction (radians) with some spread. */
export function furStrokes(cx: number, cy: number, rx: number, ry: number, n: number, len: number, dir: number | ((x: number, y: number) => number), r: Rng, curl = 0.35): string {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const rad = Math.sqrt(r())
    const x = cx + Math.cos(a) * rx * rad
    const y = cy + Math.sin(a) * ry * rad
    const th = (typeof dir === 'function' ? dir(x, y) : dir) + (r() - 0.5) * 0.5
    const l = len * (0.6 + r() * 0.7)
    const x2 = x + Math.cos(th) * l
    const y2 = y + Math.sin(th) * l
    const c = (r() - 0.5) * curl * l * 2
    const mx = (x + x2) / 2 - Math.sin(th) * c
    const my = (y + y2) / 2 + Math.cos(th) * c
    d += `M${f(x)} ${f(y)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`
  }
  return d
}

/** A tapered lock of hair from a root (x0,y0) to a tip (x1,y1), `w` wide at the root, bowed by `bend`. */
export function lockPath(x0: number, y0: number, x1: number, y1: number, w: number, bend = 0): string {
  const dx = x1 - x0
  const dy = y1 - y0
  const l = Math.hypot(dx, dy) || 1
  const px = -dy / l
  const py = dx / l
  const mx = (x0 + x1) / 2 + px * bend
  const my = (y0 + y1) / 2 + py * bend
  return `M${f(x0 + (px * w) / 2)} ${f(y0 + (py * w) / 2)}Q${f(mx + px * w * 0.32)} ${f(my + py * w * 0.32)} ${f(x1)} ${f(y1)}Q${f(mx - px * w * 0.32)} ${f(my - py * w * 0.32)} ${f(x0 - (px * w) / 2)} ${f(y0 - (py * w) / 2)}Z`
}

/** Small curls (open loops) scattered in an ellipse: curly coats. */
export function curlStrokes(cx: number, cy: number, rx: number, ry: number, n: number, size: number, r: Rng): string {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const rad = Math.sqrt(r())
    const x = cx + Math.cos(a) * rx * rad
    const y = cy + Math.sin(a) * ry * rad
    const s = size * (0.6 + r() * 0.7)
    const rot = r() * Math.PI * 2
    const p = (k: number, m: number) => [x + Math.cos(rot + k) * s * m, y + Math.sin(rot + k) * s * m] as const
    const [ax, ay] = p(0, 1)
    const [bx, by] = p(1.7, 1.1)
    const [ex, ey] = p(3.6, 0.8)
    d += `M${f(ax)} ${f(ay)}Q${f(bx)} ${f(by)} ${f(ex)} ${f(ey)}`
  }
  return d
}

