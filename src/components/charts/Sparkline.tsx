import { C } from './scale'

/** Tiny trend line for KPI tiles; the last point is marked. */
export function Sparkline({ values, color = C.blue, height = 26, ariaLabel }: { values: readonly number[]; color?: string; height?: number; ariaLabel?: string }) {
  const v = values.filter(Number.isFinite)
  if (v.length < 2) return <div style={{ height }} />
  const lo = Math.min(...v)
  const hi = Math.max(...v)
  const W = 100
  const x = (i: number) => (i / (v.length - 1)) * W
  const y = (val: number) => (hi > lo ? height - 3 - ((val - lo) / (hi - lo)) * (height - 6) : height / 2)
  const d = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(val).toFixed(2)}`).join('')
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} className="block overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
