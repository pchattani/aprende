import { Frame } from './common'
import { C, HALO, linear, niceTicks } from './scale'

/** Reliability diagram: predicted vs observed recall per bin, sized by n, with Wilson whiskers and the diagonal. */
export function CalibrationPlot({ bins, height = 250, ariaLabel }: {
  bins: { predicted: number; observed: number; obsLo: number; obsHi: number; n: number }[]
  height?: number
  ariaLabel: string
}) {
  const lows = bins.flatMap((b) => [b.predicted, b.obsLo]).filter(Number.isFinite)
  const lo = Math.max(0, Math.floor((Math.min(0.8, ...lows) - 0.02) * 10) / 10)
  const maxN = Math.max(1, ...bins.map((b) => b.n))
  return (
    <Frame height={height} label={ariaLabel}>
      {(w) => {
        const size = Math.min(w - 40, height - 34)
        const x0 = 34 + Math.max(0, (w - 40 - size) / 2)
        const top = 6
        const x = linear(lo, 1, x0, x0 + size)
        const y = linear(lo, 1, top + size, top)
        const ticks = niceTicks(lo, 1, 4)
        return (
          <g>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(lo)} x2={x(1)} y1={y(t)} y2={y(t)} stroke={C.line} />
                <line x1={x(t)} x2={x(t)} y1={y(lo)} y2={y(1)} stroke={C.line} />
                <text x={x(lo) - 6} y={y(t)} dy="0.32em" textAnchor="end" fill={C.ink2}>{`${Math.round(t * 100)}`}</text>
                <text x={x(t)} y={y(lo) + 14} textAnchor="middle" fill={C.ink2}>{`${Math.round(t * 100)}`}</text>
              </g>
            ))}
            <line x1={x(lo)} y1={y(lo)} x2={x(1)} y2={y(1)} stroke={C.ink2} strokeWidth={1} strokeDasharray="4 3" />
            <text x={x(lo + 0.04) + 6} y={y(lo + 0.04)} fill={C.ink2} transform={`rotate(-45 ${x(lo + 0.04) + 6} ${y(lo + 0.04)})`} style={{ fontSize: 9.5 }} {...HALO}>
              spot on
            </text>
            {bins.map((b, i) => (
              <g key={i}>
                <title>{`predicted ${(b.predicted * 100).toFixed(1)}%, observed ${(b.observed * 100).toFixed(1)}% (${Math.round(b.obsLo * 100)}–${Math.round(b.obsHi * 100)}%), n = ${b.n}`}</title>
                <line x1={x(b.predicted)} x2={x(b.predicted)} y1={y(Math.max(lo, b.obsLo))} y2={y(b.obsHi)} stroke={C.blue} strokeWidth={1.5} opacity={0.7} />
                <circle cx={x(b.predicted)} cy={y(Math.max(lo, b.observed))} r={4 + 5 * Math.sqrt(b.n / maxN)} fill={C.blue} stroke={C.card} strokeWidth={2} />
              </g>
            ))}
            <text x={x0 + size / 2} y={height - 2} textAnchor="middle" fill={C.ink2}>predicted recall %</text>
            <text transform={`translate(10 ${top + size / 2}) rotate(-90)`} textAnchor="middle" fill={C.ink2}>actual recall %</text>
          </g>
        )
      }}
    </Frame>
  )
}
