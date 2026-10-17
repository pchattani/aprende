import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { DogButton } from '../ui/Dogs'
import type { Outfits } from '../../hooks/useOutfits'
import { storageKey } from '../../engine/course'
import type { Act } from '../art/dogPose'

const KEY = storageKey('mapDogsAt')
const DOG = 40
/** Width of the three overlapping dogs. */
export const DOGS_WIDTH = DOG * 3 - 26

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Leo, Bonchita and Luna standing beside the current node. When the current node has
 * changed since the last visit (remembered in sessionStorage), they walk over from the
 * node they were at (FLIP: start at the old node's offset, then transition to zero).
 */
export function MapDogs({ at, outfits, style }: { at: string; outfits: Outfits; style: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  // idle at the node; walk while travelling; cheer on arrival (the last node was just completed); wave after a hop-in
  const [act, setAct] = useState<Act>('idle')
  useLayoutEffect(() => {
    const el = ref.current
    let prev: string | null = null
    try {
      prev = sessionStorage.getItem(KEY)
      sessionStorage.setItem(KEY, at)
    } catch {
      /* private mode: no walk */
    }
    if (!el || !prev || prev === at || reducedMotion()) return
    const from = document.getElementById(`lesson-${prev}`)
    const to = document.getElementById(`lesson-${at}`)
    const timers: number[] = []
    const a = from?.getBoundingClientRect()
    const b = to?.getBoundingClientRect()
    const dx = a && b ? a.left + a.width / 2 - (b.left + b.width / 2) : 0
    const dy = a && b ? a.top + a.height / 2 - (b.top + b.height / 2) : 0
    if (!a || !b || Math.hypot(dx, dy) > 1600) {
      // too far for a walk (another region): hop in instead
      el.classList.add('is-arriving')
      timers.push(window.setTimeout(() => setAct('wave'), 0))
      timers.push(window.setTimeout(() => el.classList.remove('is-arriving'), 600))
      timers.push(window.setTimeout(() => setAct('idle'), 1800))
    } else {
      el.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`
      // wait for the page to settle (return-to-spot scroll), then walk
      timers.push(
        window.setTimeout(() => {
          el.classList.add('is-walking')
          void el.offsetWidth
          el.style.transform = ''
          setAct('walk')
        }, 500),
      )
      timers.push(
        window.setTimeout(() => {
          el.classList.remove('is-walking')
          setAct('cheer')
        }, 500 + 1550),
      )
      timers.push(window.setTimeout(() => setAct('idle'), 500 + 1550 + 1400))
    }
    return () => {
      timers.forEach((t) => clearTimeout(t))
      el.style.transform = ''
      el.classList.remove('is-walking', 'is-arriving')
      setAct('idle')
    }
  }, [at])
  return (
    <div className="wm-dogs" style={style} role="group" aria-label="Leo, Bonchita and Luna are here">
      <div ref={ref} className="wm-dogs-walk">
        <span className="wm-dogs-shadow" aria-hidden="true" />
        <span className="wm-dogs-tag" aria-hidden="true">we're here</span>
        <span className="wm-dog relative z-[1]"><DogButton dog="leo" size={DOG} act={act} outfit={outfits.leo} /></span>
        <span className="wm-dog relative z-[2] -ml-[13px]"><DogButton dog="bonchita" size={DOG} act={act} outfit={outfits.bonchita} /></span>
        <span className="wm-dog relative z-[1] -ml-[13px]"><DogButton dog="luna" size={DOG} act={act} outfit={outfits.luna} /></span>
      </div>
    </div>
  )
}
