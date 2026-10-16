import { Frame, YGrid } from './common'
import { C, HALO, compact, dayTick, dayTicks, linear, logScale, niceDomain, niceTicks, textW } from './scale'

/** Histogram on a log x axis (bins carry their own edges). */
export function Histogram({ bins, refX, height = 160, formatX = dayTick, ariaLabel }: {
  bins: { lo: number; hi: number; count: number }[]
  refX?: { value: number; label: string }
  height?: number
  formatX?: (v: number) => string
  ariaLabel: string
}) {
  const nonEmpty = bins.map((b, i) => (b.count > 0 ? i : -1)).filter((i) => i >= 0)
  const shown = nonEmpty.length ? bins.slice(Math.max(0, nonEmpty[0]! - 1), Math.min(bins.length, nonEmpty[nonEmpty.length - 1]! + 2)) : bins
  const lo = shown[0]?.lo ?? 0.1
  const hi = shown[shown.length - 1]?.hi ?? 100
  const [d0, d1] = niceDomain(0, Math.max(1, ...shown.map((b) => b.count)))
  return (
    <Frame height={height} label={ariaLabel}>
      {(w) => {
        const ticks = niceTicks(d0, d1, 3)
        const padL = Math.max(...ticks.map((t) => textW(compact(t)))) + 10
        const top = 22
        const bottom = height - 20
        const x = logScale(lo, hi, padL, w - 6)
        const y = linear(d0, d1, bottom, top)
        return (
          <g>
            <YGrid ticks={ticks} y={y} x0={padL} x1={w - 6} fmt={(v) => compact(v)} />
            {shown.map((b) => {
              const x0 = x(b.lo) + 1
              const x1 = x(b.hi) - 1
              const yv = y(b.count)
              const r = Math.min(4, (x1 - x0) / 2, bottom - yv)
              return (
                <g key={b.lo}>
                  <title>{`${formatX(b.lo)}–${formatX(b.hi)}: ${b.count}`}</title>
                  {b.count > 0 && <path d={`M${x0},${bottom}V${yv + r}Q${x0},${yv} ${x0 + r},${yv}H${x1 - r}Q${x1},${yv} ${x1},${yv + r}V${bottom}Z`} fill={C.blue} opacity={0.85} />}
                </g>
              )
            })}
            {dayTicks(lo, hi).map((t) => (
              <text key={t} x={x(t)} y={height - 5} textAnchor="middle" fill={C.ink2}>
                {formatX(t)}
              </text>
            ))}
            {refX && refX.value > lo && refX.value < hi && (
              <g>
                <line x1={x(refX.value)} x2={x(refX.value)} y1={top - 14} y2={bottom} stroke={C.ink} strokeWidth={1} strokeDasharray="4 3" />
                <text x={x(refX.value) + 4} y={top - 8} fill={C.ink} {...HALO}>
                  {refX.label}
                </text>
              </g>
            )}
            <line x1={padL} x2={w - 6} y1={bottom} y2={bottom} stroke={C.ink2} strokeWidth={1} />
          </g>
        )
      }}
    </Frame>
  )
}
