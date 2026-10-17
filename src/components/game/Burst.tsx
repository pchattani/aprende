/** A short sparkle burst: inked stars and dots flying out of a point, plus a ring. CSS transform/opacity only. */
const INKS = ['var(--sun)', 'var(--red)', 'var(--blue)', 'var(--ok)', 'var(--sun)']

export function Burst({ x, y }: { x: number; y: number }) {
  const n = 12
  return (
    <span className="burst" style={{ left: x, top: y }} aria-hidden="true">
      <b className="burst-ring" />
      {Array.from({ length: n }, (_, i) => {
        const star = i % 3 !== 1
        const style = {
          '--a': `${(360 / n) * i + (i % 2 ? 9 : -6)}deg`,
          '--r': `${star ? 54 + ((i * 13) % 26) : 34 + ((i * 7) % 16)}px`,
          '--s': `${star ? 14 + (i % 3) * 3 : 7}px`,
          '--c': INKS[i % INKS.length],
          '--d': `${(i % 4) * 18}ms`,
        } as React.CSSProperties
        return <i key={i} className={star ? 'burst-star' : 'burst-dot'} style={style} />
      })}
    </span>
  )
}
