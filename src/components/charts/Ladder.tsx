import { Frame, Legend, YGrid } from './common'
import { C, HALO, compact, dateTick, linear, niceDomain, niceTicks, textW } from './scale'

/** Due forecast: cards falling due per day, stacked young / mature, with the backlog as its own bar. */
export function Ladder({ days, backlog, throughput, height = 170, ariaLabel }: {
  days: { date: string; young: number; mature: number }[]
  backlog: number
  throughput?: number
  height?: number
  ariaLabel: string
}) {
  const totals = days.map((d) => d.young + d.mature)
  const [d0, d1] = niceDomain(0, Math.max(5, backlog, throughput ?? 0, ...totals))
  return (
    <div>
      <Legend items={[{ label: 'Overdue now', color: C.red, swatch: 'box' }, { label: 'Young (S < 21 d)', color: C.blue, swatch: 'box' }, { label: 'Mature', color: C.ink2, swatch: 'box' }]} />
      <Frame height={height} label={ariaLabel}>
        {(w) => {
          const ticks = niceTicks(d0, d1, 3)
          const padL = Math.max(...ticks.map((t) => textW(compact(t)))) + 10
          const top = 12
          const bottom = height - 20
          const y = linear(d0, d1, bottom, top)
          const n = days.length + 1
          const band = (w - padL - 4) / n
          const bw = Math.min(18, Math.max(2, band - 2))
          const bar = (cx: number, from: number, to: number, fill: string, key: string, title: string, round: boolean) => {
            if (to <= from) return null
            const y0 = y(from)
            const y1 = y(to)
            const r = round ? Math.min(3, bw / 2, y0 - y1) : 0
            return (
              <path key={key} d={`M${cx - bw / 2},${y0}V${y1 + r}Q${cx - bw / 2},${y1} ${cx - bw / 2 + r},${y1}H${cx + bw / 2 - r}Q${cx + bw / 2},${y1} ${cx + bw / 2},${y1 + r}V${y0}Z`} fill={fill}>
                <title>{title}</title>
              </path>
            )
          }
          const every = Math.max(1, Math.ceil((n * 56) / (w - padL)))
          return (
            <g>
              <YGrid ticks={ticks} y={y} x0={padL} x1={w - 4} fmt={(v) => compact(v)} />
              {bar(padL + band * 0.5, 0, backlog, C.red, 'b', `Overdue now: ${backlog}`, true)}
              <text x={padL + band * 0.5} y={height - 5} textAnchor="middle" fill={C.ink2}>
                now
              </text>
              {days.map((d, i) => {
                const cx = padL + band * (i + 1.5)
                // Surface gap of 2px between the stacked segments.
                return (
                  <g key={d.date}>
                    {bar(cx, 0, d.mature, C.ink2, 'm', `${d.date}: ${d.mature} mature`, d.young === 0)}
                    {d.young > 0 && bar(cx, d.mature, d.mature + d.young, C.blue, 'y', `${d.date}: ${d.young} young, ${d.mature} mature`, true)}
                    {d.young > 0 && d.mature > 0 && <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(d.mature)} y2={y(d.mature)} stroke={C.card} strokeWidth={2} />}
                    {(i + 1) % every === 0 && i < days.length - 1 && (
                      <text x={cx} y={height - 5} textAnchor="middle" fill={C.ink2}>
                        {dateTick(d.date)}
                      </text>
                    )}
                  </g>
                )
              })}
              {throughput !== undefined && Number.isFinite(throughput) && (
                <g>
                  <line x1={padL} x2={w - 4} y1={y(throughput)} y2={y(throughput)} stroke={C.ink} strokeWidth={1} strokeDasharray="4 3" />
                  <text x={w - 4} y={y(throughput) - 4} textAnchor="end" fill={C.ink} {...HALO}>
                    {`you clear ${Math.round(throughput)}/day`}
                  </text>
                </g>
              )}
              <line x1={padL} x2={w - 4} y1={bottom} y2={bottom} stroke={C.ink2} strokeWidth={1} />
            </g>
          )
        }}
      </Frame>
    </div>
  )
}
