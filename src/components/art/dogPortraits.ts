/**
 * The illustrated portraits of Leo, Bonchita and Luna (from the owner's reference illustration of
 * the three dogs), and where their features are, so worn souvenirs, stamps and avatars line up with each portrait.
 *
 * Feature points are fractions of the image (x of its width, y of its height); `place` fits the
 * portrait in the shared 120×120 box, centred on the face, bottom at y = 114.
 */
import leoUrl from './portraits/leo.webp'
import bonchitaUrl from './portraits/bonchita.webp'
import lunaUrl from './portraits/luna.webp'

export type PortraitDog = 'leo' | 'bonchita' | 'luna'
type Pt = [number, number]

interface Portrait {
  src: string
  /** width / height of the image */
  aspect: number
  /** Height in the 120 box. */
  height: number
  eyes: [Pt, Pt]
  nose: Pt
  mouth: Pt
  /** Top of the head between the ears (hat brim) and the head's width there (fraction of image width). */
  hat: Pt
  hatW: number
  /** Behind the viewer's right ear. */
  ear: Pt
  /** Collar line centre and width. */
  neck: Pt
  neckW: number
  chest: Pt
  /** Where the dog holds an item up in its front paws (in front of the chest). */
  paw: Pt
  /** Coat colours for the paws drawn around a held item. */
  fur: string
  furDark: string
}

export const PORTRAITS: Record<PortraitDog, Portrait> = {
  leo: {
    src: leoUrl, aspect: 596 / 560, height: 100, fur: '#e3b56c', furDark: '#a8763a',
    eyes: [[0.38, 0.36], [0.66, 0.31]], nose: [0.555, 0.5], mouth: [0.56, 0.62],
    hat: [0.5, 0.07], hatW: 0.5, ear: [0.86, 0.12],
    neck: [0.55, 0.8], neckW: 0.5, chest: [0.55, 0.9], paw: [0.55, 0.9],
  },
  bonchita: {
    src: bonchitaUrl, aspect: 500 / 560, height: 102, fur: '#3a3436', furDark: '#151213',
    eyes: [[0.4, 0.27], [0.69, 0.31]], nose: [0.53, 0.45], mouth: [0.53, 0.57],
    hat: [0.53, 0.05], hatW: 0.5, ear: [0.86, 0.08],
    neck: [0.53, 0.72], neckW: 0.52, chest: [0.53, 0.84], paw: [0.53, 0.86],
  },
  luna: {
    src: lunaUrl, aspect: 334 / 560, height: 108, fur: '#f3e4c8', furDark: '#c9a874',
    eyes: [[0.2, 0.3], [0.58, 0.29]], nose: [0.4, 0.42], mouth: [0.4, 0.52],
    hat: [0.4, 0.04], hatW: 0.62, ear: [0.82, 0.12],
    neck: [0.42, 0.63], neckW: 0.62, chest: [0.42, 0.75], paw: [0.42, 0.8],
  },
}

export const GROUND_Y = 114

/** The portrait's rectangle in the 120 box, centred on the eyes. */
export function place(dog: PortraitDog): { x: number; y: number; w: number; h: number } {
  const p = PORTRAITS[dog]
  const h = p.height
  const w = h * p.aspect
  const faceFrac = (p.eyes[0][0] + p.eyes[1][0]) / 2
  const x = Math.min(Math.max(60 - faceFrac * w, 2 - (w > 116 ? (w - 116) / 2 : 0)), 118 - w + (w > 116 ? (w - 116) / 2 : 0))
  return { x, y: GROUND_Y - h, w, h }
}

/** A feature point of the portrait in the 120 box. */
export function at(dog: PortraitDog, [fx, fy]: Pt): Pt {
  const r = place(dog)
  return [r.x + fx * r.w, r.y + fy * r.h]
}

/** How far the head is tilted (degrees, from the line through the eyes) and the point it turns around. */
export function headTilt(dog: PortraitDog): { deg: number; cx: number; cy: number } {
  const p = PORTRAITS[dog]
  const [x1, y1] = at(dog, p.eyes[0])
  const [x2, y2] = at(dog, p.eyes[1])
  return { deg: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 }
}

/** Square crop (x, y, size) around the whole portrait, for stamps. */
export function portraitBox(dog: PortraitDog): [number, number, number] {
  const r = place(dog)
  const size = Math.max(r.w, r.h) + 2
  return [r.x + r.w / 2 - size / 2, r.y + r.h / 2 - size / 2, size]
}
