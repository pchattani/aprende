import { Frame } from './common'
import { C } from './scale'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Weekday × hour matrix. `count` shades by number of answers; `accuracy`
 * shades by recall between the observed min and max (cells under `minN` stay blank).
 */
export function Heatmap({ matrix, mode, minN = 8, height = 170, ariaLabel }: {
  matrix: { n: number; k: number }[][]
  mode: 'count' | 'accuracy'
  minN?: number
  height?: number
  ariaLabel: string
}) {
  const cells = matrix.flat()
  const maxN = Math.max(1, ...cells.map((c) => c.n))
  const accs = cells.filter((c) => c.n >= minN).map((c) => c.k / c.n)
  const aLo = accs.length ? Math.min(...accs) : 0
  const aHi = accs.length ? Math.max(...accs) : 1
  const fill = mode === 'count' ? C.blue : C.ink
  return (
    <div>
      <Frame height={height} label={ariaLabel}>
        {(w) => {
          const padL = 30
          const top = 2
          const bottom = height - 18
          const cw = (w - padL - 2) / 24
          const ch = (bottom - top) / 7
          return (
            <g>
              {DAYS.map((d, r) => (
                <text key={d} x={padL - 6} y={top + ch * (r + 0.5)} dy="0.32em" textAnchor="end" fill={C.ink2}>{d}</text>
              ))}
              {[0, 6, 12, 18, 23].map((h) => (
                <text key={h} x={padL + cw * (h + 0.5)} y={height - 4} textAnchor="middle" fill={C.ink2}>{`${String(h).padStart(2, '0')}h`}</text>
              ))}
              {matrix.map((row, r) =>
                row.map((c, h) => {
                  const show = mode === 'count' ? c.n > 0 : c.n >= minN
                  const v = mode === 'count' ? Math.sqrt(c.n / maxN) : aHi > aLo ? (c.k / c.n - aLo) / (aHi - aLo) : 0.5
                  return (
                    <rect key={`${r}-${h}`} x={padL + cw * h + 1} y={top + ch * r + 1} width={Math.max(1, cw - 2)} height={Math.max(1, ch - 2)} rx={2} fill={show ? fill : C.line} opacity={show ? 0.12 + 0.88 * v : 0.35}>
                      <title>{`${DAYS[r]} ${String(h).padStart(2, '0')}:00 · ${c.n} answers${c.n ? ` · ${Math.round((c.k / c.n) * 100)}% right` : ''}`}</title>
                    </rect>
                  )
                }),
              )}
            </g>
          )
        }}
      </Frame>
      <div className="mt-1 flex items-center justify-end gap-2 font-mono text-[10.5px] text-muted">
        <span>{mode === 'count' ? 'fewer' : `${Math.round(aLo * 100)}%`}</span>
        <span className="h-2 w-24 rounded-sm" style={{ background: `linear-gradient(to right, color-mix(in srgb, ${fill} 12%, transparent), ${fill})` }} />
        <span>{mode === 'count' ? `${maxN} answers` : `${Math.round(aHi * 100)}%`}</span>
        {mode === 'accuracy' && <span>· blank: n &lt; {minN}</span>}
      </div>
    </div>
  )
}
