/**
 * One dog character as a standalone <svg>: the animated rig, its worn items and an optional overlay.
 */
import type { ReactNode, SVGProps } from 'react'
import type { Act, Mood } from './dogArt'
import { DOG_ART, DOG_LABEL, HI_DETAIL_PX, PORTRAIT, type DogId } from './dogRegistry'
import { PaintFilters } from './paint'
import { useArtId } from './brush'
import { place } from './dogPortraits'

export type DogFigureProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  dog: DogId
  size?: number
  mood?: Mood
  wave?: boolean
  /** Force the detail level instead of deriving it from size. */
  detail?: 'hi' | 'lo'
  /** Crop to the head and shoulders (used by stamps). */
  portrait?: boolean
  /** Drawn on top of the dog in its 120×120 space. */
  overlay?: ReactNode
  /** What the dog is doing (cheer, talk, walk, wave…); defaults from the mood. */
  act?: Act
  /** Worn items, placed in the rig so they move with the head; `beside` widens the frame for an item set down next to the dog. */
  wear?: { body?: ReactNode; head?: ReactNode; front?: ReactNode; beside?: boolean }
}

/** Room (in the 120 space) for an item standing beside the dog. */
const BESIDE = 30

export function DogFigure({ dog, size = 96, mood = 'happy', wave, detail, portrait, overlay, act, wear, ...rest }: DogFigureProps) {
  const id = useArtId(dog)
  const hi = detail ? detail === 'hi' : size >= HI_DETAIL_PX
  const Art = DOG_ART[dog]
  // the frame hugs the dog's own width (the three portraits differ), so dogs side by side space evenly
  const r = place(dog)
  const w = r.w + 2 + (wear?.beside ? BESIDE : 0)
  const box = portrait ? PORTRAIT[dog].join(' ') : `${(r.x - 1).toFixed(2)} 0 ${w.toFixed(2)} 120`
  const width = portrait ? size : Math.round((size * w) / 120)
  return (
    <svg width={width} height={size} viewBox={box} role="img" aria-label={DOG_LABEL[dog]} overflow="visible" {...rest}>
      {hi && (
        <defs>
          <PaintFilters id={id} seed={dog.length * 7} />
        </defs>
      )}
      <Art id={id} mood={mood} hi={hi} wave={wave} act={act} bodyOverlay={wear?.body} headOverlay={wear?.head} frontOverlay={wear?.front} />
      {overlay}
    </svg>
  )
}
