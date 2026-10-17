/**
 * Non-visual helpers for the souvenir illustrations: reading a souvenir's `art`/`color`
 * (defensively, while content is being tagged) and how each kind fits on a dog.
 */
import { ART_KINDS, WARDROBE_COLOURS, type ArtKind } from '../../engine/artKinds'

const KINDS = new Set<string>(ART_KINDS)
export const isArtKind = (s: unknown): s is ArtKind => typeof s === 'string' && KINDS.has(s)

/** Anything with an emoji and, once content is tagged, an `art` kind and optional colour. */
export interface SouvenirLike {
  emoji: string
  art?: string
  color?: string
}

/** The drawn kind and colour of a souvenir, or undefined when it has no (valid) `art` yet. */
export function souvenirArt(s: SouvenirLike | { emoji: string }): { kind: ArtKind; color?: string } | undefined {
  const art = (s as { art?: unknown }).art
  const color = (s as { color?: unknown }).color
  if (!isArtKind(art)) return undefined
  return { kind: art, ...(typeof color === 'string' && color ? { color } : {}) }
}

/**
 * Parses wardrobe-style ids, `wear-<kind>` or `wear-<kind>-<colour>` (e.g. `wear-bucket-hat-blue`),
 * so outfits can show drawn items even before the souvenir list has them.
 */
export function parseWearId(id: string): { kind: ArtKind; color?: string } | undefined {
  if (!id.startsWith('wear-')) return undefined
  const rest = id.slice(5)
  if (isArtKind(rest)) return { kind: rest }
  const cut = rest.lastIndexOf('-')
  if (cut < 0) return undefined
  const kind = rest.slice(0, cut)
  const colour = WARDROBE_COLOURS.find((c) => c.id === rest.slice(cut + 1))
  return isArtKind(kind) && colour ? { kind, color: colour.hex } : undefined
}

/**
 * How a kind is fitted when worn, in its 48×48 drawing:
 *  - hats: `py` is the lowest point of the brim/band (it sits on the dog's hat line), `w` the
 *    head opening that is matched to the dog's head width;
 *  - glasses and masks: `gap` is the distance between the lens centres, `py` their height;
 *  - neck pieces: `py` is the collar line, `w` the width matched to the neck.
 */
export interface WearFit {
  py: number
  w?: number
  gap?: number
  /** Extra rotation when worn (degrees). */
  rot?: number
}
export const HAT_FIT: Partial<Record<ArtKind, WearFit>> = {
  beret: { py: 36, w: 27, rot: -9 },
  cap: { py: 38.5, w: 28 },
  beanie: { py: 38, w: 31 },
  sunhat: { py: 37, w: 25 },
  'bucket-hat': { py: 37.5, w: 25 },
  sombrero: { py: 37, w: 26 },
}
export const EYE_FIT: Partial<Record<ArtKind, WearFit>> = {
  sunglasses: { py: 24, gap: 20 },
  'round-glasses': { py: 24, gap: 20 },
  'carnival-mask': { py: 23, gap: 16 },
}
export const NECK_FIT: Partial<Record<ArtKind, WearFit>> = {
  scarf: { py: 17, w: 34 },
  bandana: { py: 15, w: 33 },
  bowtie: { py: 24, w: 52 },
  lei: { py: 9, w: 36 },
  necklace: { py: 10, w: 40 },
}
/** Worn over the body (neck centre at 24,6 and shoulders 40 wide in the worn drawing). */
export const BODY_KINDS = new Set<ArtKind>(['poncho', 'football-shirt'])
/** Held up high from the paw (umbrella, balloon): drawn with a long shaft or string. */
export const HIGH_KINDS = new Set<ArtKind>(['umbrella', 'balloon'])
/** Tucked behind an ear when put in the hat slot. */
export const EAR_KINDS = new Set<ArtKind>(['flower', 'feather', 'leaf', 'star'])
/** Long things that are turned crosswise when carried in the mouth. */
export const MOUTH_TURN: Partial<Record<ArtKind, number>> = { baguette: 35, flute: 30, chopsticks: 45, feather: 50, key: 20, guitar: 50, violin: -40, fish: 0, scroll: 0 }
/** Relative size when held at the paw (1 = default). */
export const PAW_SIZE: Partial<Record<ArtKind, number>> = {
  guitar: 1.5, accordion: 1.3, violin: 1.35, drum: 1.15, painting: 1.2, kite: 1.3, flag: 1.4, poncho: 1.2, 'football-shirt': 1.2, map: 1.1, sombrero: 1.2, lantern: 1.1,
  key: 0.8, candy: 0.75, star: 0.8, shell: 0.8, stone: 0.85, keychain: 0.8, bracelet: 0.8, ticket: 0.9, chocolate: 0.85, cookie: 0.8, medal: 0.85, soap: 0.8, feather: 0.9,
}
