/**
 * Motion helpers for reward moments: the reduced-motion check, count-ups and coin flights from
 * where coins are earned to a counter (or from the purse into a purchase).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CoinIcon } from './Coin'
import './rewards.css'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/** Animates a number towards `target` (ease-out), starting from `from`. Jumps straight there when motion is reduced. */
export function useCountTo(target: number, { from, duration = 700, active = true }: { from?: number; duration?: number; active?: boolean } = {}): number {
  const [n, setN] = useState(() => (prefersReducedMotion() ? target : (from ?? target)))
  const cur = useRef(n)
  useEffect(() => {
    if (!active) return
    const start = cur.current
    if (prefersReducedMotion() || start === target) {
      cur.current = target
      setN(target)
      return
    }
    let raf = 0
    let t0 = -1
    const tick = (t: number) => {
      if (t0 < 0) t0 = t
      const k = Math.min(1, (t - t0) / duration)
      const v = Math.round(start + (target - start) * (1 - (1 - k) ** 3))
      cur.current = v
      setN(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, active])
  return n
}

interface Flight {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  delay: number
  arc: number
  last: boolean
  onLand?: (last: boolean) => void
}
let nextFlight = 1

const centre = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/**
 * Coins flying from one element to another, in a portal over the page. `launch` returns
 * immediately; `onLand` runs as each coin arrives (with last=true for the final one).
 * With reduced motion no coins fly and `onLand(true)` runs at once.
 */
export function useCoinFlight(): { launch: (from: Element | null, to: Element | null, count: number, onLand?: (last: boolean) => void) => void; layer: ReactNode } {
  const [flights, setFlights] = useState<Flight[]>([])
  const launch = useCallback((from: Element | null, to: Element | null, count: number, onLand?: (last: boolean) => void) => {
    if (!from || !to || count <= 0 || prefersReducedMotion()) {
      onLand?.(true)
      return
    }
    const a = centre(from)
    const b = centre(to)
    const n = Math.max(1, Math.min(12, count))
    const fresh = Array.from({ length: n }, (_, i): Flight => ({
      id: nextFlight++,
      x0: a.x - 11 + ((i * 37) % 30) - 15,
      y0: a.y - 11 + ((i * 23) % 14) - 7,
      x1: b.x - 11,
      y1: b.y - 11,
      delay: i * 70,
      arc: 50 + ((i * 29) % 40),
      last: i === n - 1,
      onLand,
    }))
    setFlights((f) => [...f, ...fresh])
  }, [])
  const land = (f: Flight) => {
    setFlights((all) => all.filter((x) => x.id !== f.id))
    f.onLand?.(f.last)
  }
  const layer =
    flights.length > 0 && typeof document !== 'undefined'
      ? createPortal(
          <div aria-hidden="true">
            {flights.map((f) => (
              <span
                key={f.id}
                className="coin-flight"
                style={{ '--x0': `${f.x0}px`, '--y0': `${f.y0}px`, '--x1': `${f.x1}px`, '--y1': `${f.y1}px`, '--delay': `${f.delay}ms`, '--arc': `${f.arc}px` } as React.CSSProperties}
                onAnimationEnd={() => land(f)}
              >
                <CoinIcon size={22} />
              </span>
            ))}
          </div>,
          document.body,
        )
      : null
  return { launch, layer }
}
