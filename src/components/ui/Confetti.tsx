import { useMemo } from 'react'

const COLORS = ['#d9473b', '#2f5bd3', '#e9a92e', '#2f8f5b', '#1c2541', '#f2e6cf']

/** A burst of falling confetti, CSS-animated, removed after it falls. */
export function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        color: COLORS[i % COLORS.length]!,
        dx: `${((i * 53) % 80) - 40}px`,
        dur: `${2.2 + ((i * 7) % 10) / 6}s`,
        delay: `${((i * 11) % 12) / 10}s`,
        rot: (i * 29) % 360,
      })),
    [count],
  )
  return (
    // A paint-contained layer clips the falling pieces, so they never widen the page on phones.
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5]" style={{ contain: 'paint' }}>
      {pieces.map((p, i) => (
        <span key={i} className="confetti" style={{ left: p.left, background: p.color, transform: `rotate(${p.rot}deg)`, '--dx': p.dx, '--dur': p.dur, '--delay': p.delay } as React.CSSProperties} />
      ))}
    </div>
  )
}
