import { useMemo } from 'react'

const COLORS = ['#7c5cff', '#ff5fa2', '#ff9f43', '#2ed8a3', '#3ba7ff', '#ffd36a']

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
    <div aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="confetti" style={{ left: p.left, background: p.color, transform: `rotate(${p.rot}deg)`, '--dx': p.dx, '--dur': p.dur, '--delay': p.delay } as React.CSSProperties} />
      ))}
    </div>
  )
}
