/**
 * Pure helpers for the painted postcards: the 300×200 canvas, the painting context,
 * pigment-edged fills, atmospheric perspective, ridge lines and sky colours.
 */
import type { Palette, TimeOfDay } from '../../engine/scenes'
import { f, mix, darken, type Rng } from './brush'

export const W = 300
export const H = 200

export interface Ctx {
  r: Rng
  p: Palette
  time: TimeOfDay
  night: boolean
  /** Dusk or night: windows and lamps glow. */
  lit: boolean
  variant?: string
  id: string
  /** Horizon line (y). */
  hz: number
  /** Atmospheric haze colour (the horizon sky). */
  haze: string
}

/** Props for a painted shape: fill plus a slightly darker pigment edge. */
export function wash(fill: string, edge = 0.28, w = 0.6) {
  return { fill, stroke: darken(fill, edge), strokeWidth: w, strokeOpacity: 0.55, strokeLinejoin: 'round' as const }
}
/** Push a colour toward the haze (atmospheric perspective). */
export const far = (c: Ctx, color: string, t: number) => mix(color, c.haze, t)

/** A ridge line from x=-10 to 310, closed to the bottom. */
export function ridgePath(r: Rng, y: number, amp: number, waves = 3, rough = 0.25, bottom = H + 10): string {
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28]
  const k = [waves, waves * 2.3, waves * 5.1]
  const pts: string[] = []
  for (let x = -10; x <= 310; x += 6) {
    const t = x / W
    const v = Math.sin(t * k[0]! + ph[0]!) * 0.6 + Math.sin(t * k[1]! + ph[1]!) * 0.3 + Math.sin(t * k[2]! + ph[2]!) * rough + (r() - 0.5) * rough * 0.3
    pts.push(`${f(x)} ${f(y - v * amp)}`)
  }
  return `M-10 ${bottom} L${pts.join(' L')} L310 ${bottom} Z`
}

/** Sky colours by time of day, mixed with the region's own sky. */
export const TIME_SKY: Record<TimeOfDay, { top: string; hz: string; k: number; tint?: string; tintO: number }> = {
  dawn: { top: '#aab6e2', hz: '#fad2c2', k: 0.6, tint: '#f3c6cf', tintO: 0.12 },
  day: { top: '#000000', hz: '#000000', k: 0, tintO: 0 },
  golden: { top: '#93b0d8', hz: '#fccf8e', k: 0.55, tint: '#f6b46b', tintO: 0.16 },
  dusk: { top: '#4a5596', hz: '#f29a7c', k: 0.75, tint: '#7a5a9e', tintO: 0.3 },
  night: { top: '#121836', hz: '#3a4682', k: 0.9, tint: '#1d2858', tintO: 0.52 },
}
