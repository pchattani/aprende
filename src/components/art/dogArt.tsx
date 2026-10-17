/**
 * Leo, Bonchita and Luna as animated characters: each portrait is a puppet (art/DogRig.tsx) that
 * breathes, blinks and acts (cheer, talk, walk, wave, curious, sad, sleepy) in the shared 120×120
 * box, so stamps, the trio scene and worn souvenirs keep working in the same coordinates.
 */
import type { ReactNode } from 'react'
import { MOOD_ACT, type Act, type Mood } from './dogPose'
import { DogRig } from './DogRig'
import type { PortraitDog } from './dogPortraits'

export type { Mood, Act }
export interface DogArtProps {
  /** Unique id prefix (kept for the shared API). */
  id: string
  mood: Mood
  /** Full detail; the rig looks the same at every size. */
  hi: boolean
  /** Raise a paw and wave. */
  wave?: boolean
  /** What the dog is doing; defaults from the mood. */
  act?: Act
  bodyOverlay?: ReactNode
  headOverlay?: ReactNode
  frontOverlay?: ReactNode
  holding?: boolean
}

type Props = DogArtProps & { dog: PortraitDog }
function Art({ dog, mood, wave, act, bodyOverlay, headOverlay, frontOverlay, holding }: Props): ReactNode {
  return <DogRig dog={dog} act={act ?? (wave ? 'wave' : MOOD_ACT[mood])} bodyOverlay={bodyOverlay} headOverlay={headOverlay} frontOverlay={frontOverlay} holding={holding} />
}

export function LeoArt(p: DogArtProps): ReactNode {
  return <Art dog="leo" {...p} />
}
export function BonchitaArt(p: DogArtProps): ReactNode {
  return <Art dog="bonchita" {...p} />
}
export function LunaArt(p: DogArtProps): ReactNode {
  return <Art dog="luna" {...p} />
}
