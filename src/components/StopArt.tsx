import { useMemo } from 'react'
import type { Stop } from '../engine/journey'
import type { LevelId } from '../engine/schema'
import { sceneFor } from '../engine/scenes'
import { PaintedScene } from './art/PaintedScene'

/**
 * The painted picture of a stop. `progress` paints it in from a pencil sketch (lessons
 * done), `fade` washes it out (memory fading: cards due).
 */
export function StopArt({ stop, level, progress = 1, fade = 0, quality = 'thumb', lazy = true, className = '' }: { stop: Pick<Stop, 'unitId' | 'name' | 'emoji' | 'en' | 'es'>; level: LevelId; progress?: number; fade?: number; quality?: 'thumb' | 'full'; lazy?: boolean; className?: string }) {
  const scene = useMemo(() => sceneFor(stop, level), [stop, level])
  return <PaintedScene scene={scene} progress={progress} fade={fade} quality={quality} lazy={lazy} className={`block ${className}`} title={stop.name} />
}
