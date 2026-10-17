/**
 * The painted portraits of Leo, Bonchita and Luna: acrylic pet portraits with a white sticker
 * border (Leo's and Bonchita's are the owner's canvases; Luna's is painted to match), and where
 * their features are, so worn souvenirs, stamps and avatars line up with each portrait.
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
  /** Beside the portrait, where a held item stands. */
  paw: Pt
}

export const PORTRAITS: Record<PortraitDog, Portrait> = {
  leo: {
    src: leoUrl, aspect: 442 / 560, height: 104,
    eyes: [[0.29, 0.32], [0.62, 0.41]], nose: [0.38, 0.5], mouth: [0.36, 0.6],
    hat: [0.44, 0.1], hatW: 0.56, ear: [0.8, 0.16],
    neck: [0.43, 0.8], neckW: 0.5, chest: [0.43, 0.9], paw: [1.05, 0.98],
  },
  bonchita: {
    src: bonchitaUrl, aspect: 621 / 560, height: 98,
    eyes: [[0.345, 0.355], [0.635, 0.39]], nose: [0.47, 0.52], mouth: [0.47, 0.62],
    hat: [0.5, 0.14], hatW: 0.5, ear: [0.8, 0.16],
    neck: [0.5, 0.86], neckW: 0.46, chest: [0.66, 0.9], paw: [1.02, 0.98],
  },
  luna: {
    src: lunaUrl, aspect: 582 / 560, height: 102,
    eyes: [[0.32, 0.3], [0.555, 0.32]], nose: [0.455, 0.55], mouth: [0.455, 0.63],
    hat: [0.43, 0.08], hatW: 0.5, ear: [0.7, 0.12],
    neck: [0.46, 0.79], neckW: 0.44, chest: [0.46, 0.89], paw: [1.02, 0.98],
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
