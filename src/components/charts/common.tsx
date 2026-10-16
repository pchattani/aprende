/**
 * Shared pieces for the hand-written SVG charts: a measured frame (so text is
 * drawn at 1:1 and never scales with the page), scales and tick generators.
 * Colours come only from the Airmail tokens, so charts follow dark mode.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { C, FONT, type Scale } from './scale'

/** Measures its own width and renders an SVG of that width (viewBox = pixel size). */
export function Frame({ height, label, children, className = '' }: { height: number; label: string; children: (w: number) => ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(340)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const width = Math.round(el.getBoundingClientRect().width)
      if (width > 0) setW(width)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={`w-full ${className}`}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img" aria-label={label} className="block overflow-visible font-mono" style={{ fontSize: FONT }}>
        {children(w)}
      </svg>
    </div>
  )
}

/** Horizontal gridlines with left-aligned tick labels. */
export function YGrid({ ticks, y, x0, x1, fmt }: { ticks: number[]; y: Scale; x0: number; x1: number; fmt: (v: number) => string }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} />
          <text x={x0 - 6} y={y(t)} dy="0.32em" textAnchor="end" fill={C.ink2}>
            {fmt(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Legend row: short line keys with labels (text in ink, identity on the key). */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; swatch?: 'line' | 'box' | 'dot' }[] }) {
  return (
    <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <svg width="16" height="10" aria-hidden>
            {it.swatch === 'box' ? (
              <rect x="2" y="1" width="12" height="8" rx="2" fill={it.color} />
            ) : it.swatch === 'dot' ? (
              <circle cx="8" cy="5" r="4" fill={it.color} />
            ) : (
              <line x1="1" x2="15" y1="5" y2="5" stroke={it.color} strokeWidth="2" strokeDasharray={it.dashed ? '3 3' : undefined} strokeLinecap="round" />
            )}
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}

