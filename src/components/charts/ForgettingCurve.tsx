import { Frame } from './common'
import { C, HALO, dayTick, dayTicks, linear, logScale, niceTicks, pathOf } from './scale'

/** Observed recall versus days since the previous review (log x), Wilson whiskers, and a fitted curve. */
export function ForgettingCurve({ bins, fit, halfLife, height = 210, ariaLabel }: {
  bins: { t: number; p: number; lo: number; hi: number; n: number }[]
  fit?: (t: number) => number
  halfLife?: number
  height?: number
  ariaLabel: string
}) {
  const tMin = Math.max(0.03, Math.min(...bins.map((b) => b.t)) / 1.6)
  const tMax = Math.max(tMin * 10, Math.max(...bins.map((b) => b.t)) * 1.6)
  const yLo = Math.max(0, Math.floor((Math.min(0.9, ...bins.map((b) => b.lo)) - 0.03) * 10) / 10)
  const maxN = Math.max(1, ...bins.map((b) => b.n))
  return (
    <Frame height={height} label={ariaLabel}>
      {(w) => {
        const padL = 30
        const top = 10
        const bottom = height - 22
        const x = logScale(tMin, tMax, padL, w - 10)
        const y = linear(yLo, 1, bottom, top)
        const ticks = niceTicks(yLo, 1, 4)
        const fitPts = fit ? Array.from({ length: 60 }, (_, i) => tMin * Math.pow(tMax / tMin, i / 59)).map((t) => ({ x: x(t), y: y(Math.min(1, Math.max(yLo, fit(t)))) })) : []
        return (
          <g>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={w - 10} y1={y(t)} y2={y(t)} stroke={C.line} />
                <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fill={C.ink2}>{`${Math.round(t * 100)}`}</text>
              </g>
            ))}
            {dayTicks(tMin, tMax).map((t) => (
              <text key={t} x={x(t)} y={height - 6} textAnchor="middle" fill={C.ink2}>{dayTick(t)}</text>
            ))}
            {fit && <path d={pathOf(fitPts)} fill="none" stroke={C.ink} strokeWidth={1.5} />}
            {halfLife !== undefined && halfLife > tMin && halfLife < tMax && (
              <g>
                <line x1={x(halfLife)} x2={x(halfLife)} y1={top} y2={bottom} stroke={C.red} strokeDasharray="4 3" />
                <text x={x(halfLife) - 4} y={top + 8} textAnchor="end" fill={C.red} {...HALO}>{`½ at ${dayTick(halfLife)}`}</text>
              </g>
            )}
            {bins.map((b, i) => (
              <g key={i}>
                <title>{`${dayTick(b.t)} since last review: ${(b.p * 100).toFixed(0)}% (${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}%), n = ${b.n}`}</title>
                <line x1={x(b.t)} x2={x(b.t)} y1={y(Math.max(yLo, b.lo))} y2={y(b.hi)} stroke={C.blue} strokeWidth={1.5} opacity={0.7} />
                <circle cx={x(b.t)} cy={y(Math.max(yLo, b.p))} r={3.5 + 4 * Math.sqrt(b.n / maxN)} fill={C.blue} stroke={C.card} strokeWidth={2} />
              </g>
            ))}
            <line x1={padL} x2={w - 10} y1={bottom} y2={bottom} stroke={C.ink2} />
          </g>
        )
      }}
    </Frame>
  )
}
