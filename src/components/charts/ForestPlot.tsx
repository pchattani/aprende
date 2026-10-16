import { Link } from 'react-router'
import { C } from './scale'

export interface ForestRow {
  id: string
  label: string
  p: number
  lo: number
  hi: number
  n: number
  flag: 'below' | 'above' | null
  href?: string
}

/**
 * Forest plot: one row per group with its Wilson interval against the
 * learner's baseline. Rows significantly below are inked red, above green.
 * Labels are HTML (they wrap and truncate cleanly); the marks are SVG with
 * percentage coordinates so dots stay round at any width.
 */
export function ForestPlot({ rows, baseline, min, max, ariaLabel }: { rows: ForestRow[]; baseline: number; min?: number; max?: number; ariaLabel: string }) {
  const lo = min ?? Math.max(0, Math.floor(Math.min(baseline, ...rows.map((r) => r.lo)) * 10) / 10)
  const hi = max ?? Math.min(1, Math.ceil(Math.max(baseline, ...rows.map((r) => r.hi)) * 10) / 10)
  const pos = (v: number) => `${(((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * 100).toFixed(2)}%`
  const ticks = [lo, (lo + hi) / 2, hi]
  return (
    <div role="figure" aria-label={ariaLabel}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_4.2rem] items-center gap-x-2 text-[12px]">
        <span />
        <div className="relative h-4 font-mono text-[10px] text-muted">
          {ticks.map((t, i) => (
            <span key={i} className={`absolute ${i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: pos(t) }}>{`${Math.round(t * 100)}%`}</span>
          ))}
        </div>
        <span className="text-right font-mono text-[10px] text-muted">recall · n</span>
        {rows.map((r) => {
          const color = r.flag === 'below' ? C.bad : r.flag === 'above' ? C.ok : C.ink
          const label = r.href ? (
            <Link to={r.href} className="underline decoration-[var(--line)] underline-offset-2 hover:decoration-current">{r.label}</Link>
          ) : (
            r.label
          )
          return (
            <div key={r.id} className="contents">
              <span className="self-stretch border-t border-line py-1.5 leading-tight font-semibold" title={r.label} style={{ color: r.flag ? color : undefined }}>
                <span className="line-clamp-2">{label}</span>
              </span>
              <div className="relative min-h-[26px] self-stretch border-t border-line">
              <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <line x1={pos(baseline)} x2={pos(baseline)} y1="0" y2="100%" stroke={C.ink2} strokeDasharray="3 3" />
                <line x1={pos(r.lo)} x2={pos(r.hi)} y1="50%" y2="50%" stroke={color} strokeWidth="2" strokeLinecap="round" />
                <circle cx={pos(r.p)} cy="50%" r="4.5" fill={color} stroke={C.card} strokeWidth="2">
                  <title>{`${r.label}: ${Math.round(r.p * 100)}% (95% CI ${Math.round(r.lo * 100)}–${Math.round(r.hi * 100)}%), n = ${r.n}`}</title>
                </circle>
              </svg>
              </div>
              <span className="self-stretch border-t border-line py-1.5 text-right font-mono text-[11.5px]" style={{ color: r.flag ? color : undefined }}>
                {Math.round(r.p * 100)}% <span className="text-muted">{r.n}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
