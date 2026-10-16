/**
 * The Pawsport mark: a round rubber-stamp postmark with a paw print whose big pad
 * is a little globe, and a red-and-blue airmail band on the rim. Ink is currentColor
 * so it follows the page ink; it reads at 16px.
 */
import type { CSSProperties } from 'react'
import { useArtId } from './brush'

export const MARK_RED = '#d9473b'
export const MARK_BLUE = '#2f5bd3'

/** Paths for the mark in a 32×32 box (shared with the favicon and app icons). */
const MARK = {
  ring: { cx: 16, cy: 16, r: 13.6 },
  pad: 'M16 13.6c3.9 0 7.1 3.1 7.1 6.6 0 2.7-2 4-4.3 4-1.1 0-1.9-.5-2.8-.5s-1.7.5-2.8.5c-2.3 0-4.3-1.3-4.3-4 0-3.5 3.2-6.6 7.1-6.6z',
  toes: [
    { cx: 9.4, cy: 12.8, rx: 1.9, ry: 2.4, rot: -22 },
    { cx: 13.4, cy: 9.2, rx: 2.0, ry: 2.6, rot: -8 },
    { cx: 18.6, cy: 9.2, rx: 2.0, ry: 2.6, rot: 8 },
    { cx: 22.6, cy: 12.8, rx: 1.9, ry: 2.4, rot: 22 },
  ],
  /** Globe lines cut into the pad. */
  meridians: 'M16 14.4v9.2M9.6 19.4h12.8M16 14.4c-2.2 1.6-2.6 7.4 0 9.4M16 14.4c2.2 1.6 2.6 7.4 0 9.4',
}

/** The airmail band: alternating red and blue dashes on an arc of the rim (bottom right). */
function AirmailArc({ width = 3.2 }: { width?: number }) {
  const r = MARK.ring.r + 0.2
  const a0 = (20 * Math.PI) / 180
  const a1 = (110 * Math.PI) / 180
  const p = (a: number) => `${(16 + Math.cos(a) * r).toFixed(2)} ${(16 + Math.sin(a) * r).toFixed(2)}`
  const d = `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`
  return (
    <>
      <path d={d} stroke="#fbf7ee" strokeWidth={width + 0.6} fill="none" strokeLinecap="butt" />
      <path d={d} stroke={MARK_RED} strokeWidth={width} fill="none" strokeDasharray="2.6 2.6" />
      <path d={d} stroke={MARK_BLUE} strokeWidth={width} fill="none" strokeDasharray="2.6 2.6" strokeDashoffset="2.6" />
    </>
  )
}

export function PawsportMark({ size = 32, className = '', style, title }: { size?: number; className?: string; style?: CSSProperties; title?: string }) {
  const id = useArtId('pm')
  const small = size < 24
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} style={style} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <mask id={`${id}-pad`}>
          <rect width="32" height="32" fill="#fff" />
          {!small && <path d={MARK.meridians} stroke="#000" strokeWidth="0.9" fill="none" />}
        </mask>
      </defs>
      <circle {...MARK.ring} fill="none" stroke="currentColor" strokeWidth={small ? 2.6 : 2.2} />
      {!small && <circle cx="16" cy="16" r="11.2" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 1.4" opacity="0.7" />}
      <g fill="currentColor">
        <path d={MARK.pad} mask={`url(#${id}-pad)`} />
        {MARK.toes.map((t, i) => (
          <ellipse key={i} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} transform={`rotate(${t.rot} ${t.cx} ${t.cy})`} />
        ))}
      </g>
      <AirmailArc width={small ? 3.6 : 3.2} />
    </svg>
  )
}

export function PawsportWordmark({ size = 32, className = '', label = 'Pawsport' }: { size?: number; className?: string; label?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.28 }} aria-label={label} role="img">
      <PawsportMark size={size} />
      <span aria-hidden="true" className="font-display" style={{ fontSize: size * 0.82, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1, fontVariationSettings: '"wdth" 88' }}>
        {label}
      </span>
    </span>
  )
}
