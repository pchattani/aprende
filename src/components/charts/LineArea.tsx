import { Frame, Legend, YGrid } from './common'
import { C, HALO, dateTick, linear, niceDomain, niceTicks, pathOf, textW, compact } from './scale'

export interface LineSeries {
  id: string
  label: string
  values: readonly (number | null)[]
  color?: string
  width?: number
  dashed?: boolean
  /** Soft wash under the line. */
  area?: boolean
  /** Emphasised end dot with its value. */
  endLabel?: boolean
}

export interface LineAreaProps {
  series: LineSeries[]
  /** One label per x index (YYYY-MM-DD keys are shortened automatically). */
  xLabels: readonly string[]
  height?: number
  yMin?: number
  yMax?: number
  /** Running peak of the first series: the gap to it is shaded as drawdown. */
  peak?: readonly number[]
  /** A shaded band (confidence/forecast cone). */
  band?: { lo: readonly (number | null)[]; hi: readonly (number | null)[]; color?: string }
  refY?: { value: number; label: string }
  /** Vertical marker (e.g. today). */
  markX?: { index: number; label: string }
  formatY?: (v: number) => string
  ariaLabel: string
  legend?: boolean
}

export function LineArea({ series, xLabels, height = 190, yMin, yMax, peak, band, refY, markX, formatY = (v) => compact(v), ariaLabel, legend }: LineAreaProps) {
  const all: number[] = []
  for (const s of series) for (const v of s.values) if (v !== null && Number.isFinite(v)) all.push(v)
  if (band) for (const v of [...band.lo, ...band.hi]) if (v !== null && Number.isFinite(v)) all.push(v)
  if (refY) all.push(refY.value)
  const lo0 = yMin ?? Math.min(0, ...all)
  const hi0 = yMax ?? Math.max(1, ...all)
  const [d0, d1] = yMin !== undefined && yMax !== undefined ? [yMin, yMax] : niceDomain(lo0, hi0 === lo0 ? lo0 + 1 : hi0)
  const n = xLabels.length
  const showLegend = legend ?? series.length > 1
  return (
    <div>
      {showLegend && <Legend items={series.map((s) => ({ label: s.label, color: s.color ?? C.blue, dashed: s.dashed }))} />}
      <Frame height={height} label={ariaLabel}>
        {(w) => {
          const ticks = niceTicks(d0, d1, 4)
          const padL = Math.max(...ticks.map((t) => textW(formatY(t)))) + 10
          const ends = series.filter((s) => s.endLabel)
          const endText = ends.map((s) => {
            const last = [...s.values].reverse().find((v) => v !== null && Number.isFinite(v))
            return last === undefined || last === null ? '' : formatY(last)
          })
          const padR = Math.max(8, ...endText.map((t) => textW(t) + 12))
          const top = 10
          const bottom = height - 22
          const x = linear(0, Math.max(1, n - 1), padL, w - padR)
          const y = linear(d0, d1, bottom, top)
          const pts = (vals: readonly (number | null)[]) => vals.map((v, i) => ({ x: x(i), y: v === null ? NaN : y(v) }))
          // X ticks: about one per 80 px, always including the last.
          const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - padL - padR) / 80))))
          const xt: number[] = []
          for (let i = n - 1; i >= 0; i -= every) xt.unshift(i)
          const first = series[0]
          return (
            <g>
              <YGrid ticks={ticks} y={y} x0={padL} x1={w - padR} fmt={formatY} />
              {xt.map((i) => (
                <text key={i} x={x(i)} y={height - 6} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fill={C.ink2}>
                  {/^\d{4}-\d{2}-\d{2}$/.test(xLabels[i] ?? '') ? dateTick(xLabels[i]!) : xLabels[i]}
                </text>
              ))}
              {band && (
                <path
                  d={(() => {
                    const idx = band.lo.map((_, i) => i).filter((i) => band.lo[i] !== null && band.hi[i] !== null && Number.isFinite(band.lo[i]!) && Number.isFinite(band.hi[i]!))
                    if (!idx.length) return ''
                    const up = idx.map((i) => `${x(i).toFixed(1)},${y(band.hi[i]!).toFixed(1)}`)
                    const dn = [...idx].reverse().map((i) => `${x(i).toFixed(1)},${y(band.lo[i]!).toFixed(1)}`)
                    return `M${up.join('L')}L${dn.join('L')}Z`
                  })()}
                  fill={band.color ?? C.blue}
                  opacity={0.12}
                />
              )}
              {peak && first && (
                <path
                  d={(() => {
                    const up = peak.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`)
                    const dn = first.values.map((v, i) => `${x(i).toFixed(1)},${y(v ?? 0).toFixed(1)}`).reverse()
                    return `M${up.join('L')}L${dn.join('L')}Z`
                  })()}
                  fill={C.red}
                  opacity={0.22}
                />
              )}
              {refY && (
                <g>
                  <line x1={padL} x2={w - padR} y1={y(refY.value)} y2={y(refY.value)} stroke={C.ink2} strokeWidth={1} strokeDasharray="4 3" />
                  <text x={padL + 4} y={y(refY.value) - 4} fill={C.ink2} {...HALO}>
                    {refY.label}
                  </text>
                </g>
              )}
              {markX && (
                <g>
                  <line x1={x(markX.index)} x2={x(markX.index)} y1={top} y2={bottom} stroke={C.ink2} strokeWidth={1} />
                  <text x={x(markX.index) + 4} y={top + 8} fill={C.ink2} {...HALO}>
                    {markX.label}
                  </text>
                </g>
              )}
              {series.map((s) =>
                s.area ? <path key={`a-${s.id}`} d={`${pathOf(pts(s.values))}L${x(lastIndex(s.values)).toFixed(1)},${bottom}L${x(firstIndex(s.values)).toFixed(1)},${bottom}Z`} fill={s.color ?? C.blue} opacity={0.1} /> : null,
              )}
              {series.map((s) => (
                <path key={s.id} d={pathOf(pts(s.values))} fill="none" stroke={s.color ?? C.blue} strokeWidth={s.width ?? 2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '4 4' : undefined}>
                  <title>{s.label}</title>
                </path>
              ))}
              {ends.map((s, j) => {
                const i = lastIndex(s.values)
                const v = s.values[i]
                if (v === null || v === undefined) return null
                return (
                  <g key={`e-${s.id}`}>
                    <circle cx={x(i)} cy={y(v)} r={4.5} fill={s.color ?? C.blue} stroke={C.card} strokeWidth={2} />
                    <text x={x(i) + 8} y={y(v)} dy="0.32em" fill={C.ink} fontWeight={700} {...HALO}>
                      {endText[j]}
                    </text>
                  </g>
                )
              })}
              <line x1={padL} x2={w - padR} y1={bottom} y2={bottom} stroke={C.line} strokeWidth={1} />
            </g>
          )
        }}
      </Frame>
    </div>
  )
}

function lastIndex(vals: readonly (number | null)[]): number {
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i] !== null && Number.isFinite(vals[i]!)) return i
  return 0
}
function firstIndex(vals: readonly (number | null)[]): number {
  for (let i = 0; i < vals.length; i++) if (vals[i] !== null && Number.isFinite(vals[i]!)) return i
  return 0
}
