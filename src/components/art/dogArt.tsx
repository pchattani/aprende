/**
 * Leo, Bonchita and Luna as painted portraits (acrylic pet portraits with a white sticker border;
 * see dogPortraits.ts). Each is an SVG <g> in a 120×120 box, so stamps, the trio scene and worn
 * souvenirs keep working in the same coordinates.
 */
import type { ReactNode } from 'react'
import { LEAN, type Mood } from './dogPose'
import { PORTRAITS, place, type PortraitDog } from './dogPortraits'

export type { Mood }
export interface DogArtProps {
  /** Unique id prefix (kept for the shared API). */
  id: string
  mood: Mood
  /** Full detail; the portraits look the same at every size. */
  hi: boolean
  /** A little hop (waving). */
  wave?: boolean
}

function Portrait({ dog, mood, wave }: { dog: PortraitDog; mood: Mood; wave?: boolean }) {
  const r = place(dog)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  return (
    <g transform={`rotate(${LEAN[mood]} ${cx} ${cy})${wave ? ' translate(0 -2)' : ''}`}>
      <image href={PORTRAITS[dog].src} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="none" style={{ filter: 'drop-shadow(0 1.2px 1.4px rgba(40,28,20,0.28))' }} />
    </g>
  )
}

export function LeoArt({ mood, wave }: DogArtProps): ReactNode {
  return <Portrait dog="leo" mood={mood} wave={wave} />
}
export function BonchitaArt({ mood, wave }: DogArtProps): ReactNode {
  return <Portrait dog="bonchita" mood={mood} wave={wave} />
}
export function LunaArt({ mood, wave }: DogArtProps): ReactNode {
  return <Portrait dog="luna" mood={mood} wave={wave} />
}
