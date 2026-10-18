import { useLayoutEffect, useRef, useState } from 'react'
import { DogButton } from '../ui/Dogs'
import type { Outfits } from '../../hooks/useOutfits'
import { storageKey } from '../../engine/course'
import type { Act } from '../art/dogPose'

const KEY = storageKey('mapDogsAt')
const DOG = 40

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Leo, Bonchita and Luna standing on the top edge of the current lesson's card, by the
 * route line. When the current lesson has changed since the last visit (remembered in
 * sessionStorage), they walk down (or up) the itinerary from the card they were at
 * (FLIP: start at the old card's offset, then transition to zero).
 */
export function MapDogs({ at, outfits }: { at: string; outfits: Outfits }) {
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
    // the cards share one column: the walk is vertical, from top edge to top edge
    const dy = a && b ? a.top - b.top : 0
    if (!a || !b || Math.abs(dy) > 1100) {
      // too far for a walk (another stop or region): hop in instead
      el.classList.add('is-arriving')
      timers.push(window.setTimeout(() => setAct('wave'), 0))
      timers.push(window.setTimeout(() => el.classList.remove('is-arriving'), 600))
      timers.push(window.setTimeout(() => setAct('idle'), 1800))
    } else {
      // a steady pace: the next card is a short stroll, a whole stop a longer walk
      const ms = Math.round(Math.min(1700, Math.max(800, 400 + Math.abs(dy) * 1.2)))
      el.style.transform = `translateY(${Math.round(dy)}px)`
      // wait for the page to settle (return-to-spot scroll), then walk
      timers.push(
        window.setTimeout(() => {
          el.classList.add('is-walking')
          el.style.transitionDuration = `${ms}ms`
          void el.offsetWidth
          el.style.transform = ''
          setAct('walk')
        }, 500),
      )
      timers.push(
        window.setTimeout(() => {
          el.classList.remove('is-walking')
          el.style.transitionDuration = ''
          setAct('cheer')
        }, 500 + ms + 50),
      )
      timers.push(window.setTimeout(() => setAct('idle'), 500 + ms + 50 + 1400))
    }
    return () => {
      timers.forEach((t) => clearTimeout(t))
      el.style.transform = ''
      el.style.transitionDuration = ''
      el.classList.remove('is-walking', 'is-arriving')
      setAct('idle')
    }
  }, [at])
  return (
    <div className="wm-dogs" role="group" aria-label="Leo, Bonchita and Luna are here">
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
