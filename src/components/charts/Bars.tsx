import { Frame, YGrid } from './common'
import { C, HALO, compact, dateTick, linear, niceDomain, niceTicks, textW } from './scale'

export interface BarDatum {
  label: string
  value: number
  /** Optional interval drawn as a whisker. */
  lo?: number
  hi?: number
  color?: string
  title?: string
}

export function Bars({ data, height = 150, refLine, formatY = (v) => compact(v), yMin, yMax, ariaLabel, labelEvery }: {
  data: BarDatum[]
  height?: number
  refLine?: { value: number; label: string }
  formatY?: (v: number) => string
  yMin?: number
  yMax?: number
  ariaLabel: string
  labelEvery?: number
}) {
  const vals = data.flatMap((d) => [d.value, d.hi ?? d.value]).filter(Number.isFinite)
  if (refLine) vals.push(refLine.value)
  const [d0, d1] = yMin !== undefined && yMax !== undefined ? [yMin, yMax] : niceDomain(yMin ?? 0, Math.max(1, ...vals))
  return (
    <Frame height={height} label={ariaLabel}>
      {(w) => {
        const ticks = niceTicks(d0, d1, 3)
        const padL = Math.max(...ticks.map((t) => textW(formatY(t)))) + 10
        const top = 12
        const bottom = height - 20
        const y = linear(d0, d1, bottom, top)
        const band = (w - padL - 4) / Math.max(1, data.length)
        const bw = Math.min(24, Math.max(2, band - 2))
        const longest = Math.max(...data.map((d) => (/^\d{4}-\d{2}-\d{2}$/.test(d.label) ? dateTick(d.label) : d.label).length))
        const every = labelEvery ?? Math.max(1, Math.ceil((data.length * (textW('x'.repeat(longest)) + 14)) / (w - padL)))
        return (
          <g>
            <YGrid ticks={ticks} y={y} x0={padL} x1={w - 4} fmt={formatY} />
            {data.map((d, i) => {
              const cx = padL + band * (i + 0.5)
              const y0 = y(Math.max(d0, 0))
              const yv = y(d.value)
              const h = Math.abs(y0 - yv)
              const r = Math.min(4, bw / 2, h)
              const up = d.value >= 0
              return (
                <g key={i}>
                  <title>{d.title ?? `${d.label}: ${formatY(d.value)}`}</title>
                  {h > 0 && (
                    <path
                      d={up
                        ? `M${cx - bw / 2},${y0}V${yv + r}Q${cx - bw / 2},${yv} ${cx - bw / 2 + r},${yv}H${cx + bw / 2 - r}Q${cx + bw / 2},${yv} ${cx + bw / 2},${yv + r}V${y0}Z`
                        : `M${cx - bw / 2},${y0}V${yv - r}Q${cx - bw / 2},${yv} ${cx - bw / 2 + r},${yv}H${cx + bw / 2 - r}Q${cx + bw / 2},${yv} ${cx + bw / 2},${yv - r}V${y0}Z`}
                      fill={d.color ?? C.blue}
                    />
                  )}
                  {d.lo !== undefined && d.hi !== undefined && Number.isFinite(d.lo) && (
                    <line x1={cx} x2={cx} y1={y(d.lo)} y2={y(d.hi)} stroke={C.ink} strokeWidth={1.25} />
                  )}
                  <rect x={cx - band / 2} y={top} width={band} height={bottom - top} fill="transparent" />
                  {(i % every === 0 || i === data.length - 1) && (data.length - 1 - i >= every || i === data.length - 1) && (
                    <text x={cx} y={height - 5} textAnchor="middle" fill={C.ink2}>
                      {/^\d{4}-\d{2}-\d{2}$/.test(d.label) ? dateTick(d.label) : d.label}
                    </text>
                  )}
                </g>
              )
            })}
            {refLine && (
              <g>
                <line x1={padL} x2={w - 4} y1={y(refLine.value)} y2={y(refLine.value)} stroke={C.ink} strokeWidth={1} strokeDasharray="4 3" />
                <text x={w - 4} y={y(refLine.value) - 4} textAnchor="end" fill={C.ink} {...HALO}>
                  {refLine.label}
                </text>
              </g>
            )}
            <line x1={padL} x2={w - 4} y1={y(Math.max(d0, 0))} y2={y(Math.max(d0, 0))} stroke={C.ink2} strokeWidth={1} />
          </g>
        )
      }}
    </Frame>
  )
}
