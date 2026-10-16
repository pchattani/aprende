/**
 * One painted dog as a standalone <svg>. Picks the detail level from the size:
 * at 64px and up the watercolour filters and fur strokes are on; smaller dogs are
 * drawn with soft gradients only so they stay legible and cheap.
 */
import type { ReactNode, SVGProps } from 'react'
import type { Mood } from './dogArt'
import { DOG_ART, DOG_LABEL, HI_DETAIL_PX, type DogId } from './dogRegistry'
import { PaintFilters } from './paint'
import { useArtId } from './brush'

export type DogFigureProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  dog: DogId
  size?: number
  mood?: Mood
  wave?: boolean
  /** Force the detail level instead of deriving it from size. */
  detail?: 'hi' | 'lo'
  /** Crop to the head and shoulders (used by stamps). */
  portrait?: boolean
  /** Drawn on top of the dog in its 120×120 space (wearables). */
  overlay?: ReactNode
}

export function DogFigure({ dog, size = 96, mood = 'happy', wave, detail, portrait, overlay, ...rest }: DogFigureProps) {
  const id = useArtId(dog)
  const hi = detail ? detail === 'hi' : size >= HI_DETAIL_PX
  const Art = DOG_ART[dog]
  return (
    <svg width={size} height={size} viewBox={portrait ? '16 12 88 88' : '0 0 120 120'} role="img" aria-label={DOG_LABEL[dog]} overflow="visible" {...rest}>
      {hi && (
        <defs>
          <PaintFilters id={id} seed={dog.length * 7} />
        </defs>
      )}
      <Art id={id} mood={mood} hi={hi} wave={wave} />
      {overlay}
    </svg>
  )
}
