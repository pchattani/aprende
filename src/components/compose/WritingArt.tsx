/**
 * Drawings for the writing stop: a postcard being written (the itinerary card and the area
 * list) and the 1–3 star stamp of a scored text. Inline SVG in the region ink (--lvl).
 */
import { StarIcon } from '../map/MapArt'

/** A postcard with a pen across it; the lines are filled in once the stop's prompts are done. */
export function PostcardPenArt({ size = 46, done = false }: { size?: number; done?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" overflow="visible">
      <g transform="rotate(-6 24 24)">
        <rect x="5" y="11" width="34" height="25" rx="3" fill="var(--card)" stroke="var(--lvl, var(--blue))" strokeWidth="2.4" />
        <path d="M27 15v17" stroke="var(--lvl, var(--blue))" strokeWidth="1.4" strokeDasharray="1.6 2.2" strokeLinecap="round" opacity="0.7" />
        <rect x="30" y="14.5" width="6" height="7" rx="1" fill="none" stroke="var(--red, #c4472f)" strokeWidth="1.4" />
        <path d="M9.5 19h13M9.5 24h13M9.5 29h9" stroke="var(--lvl, var(--blue))" strokeWidth="2" strokeLinecap="round" opacity={done ? 0.95 : 0.35} />
      </g>
      <g transform="rotate(38 34 30)">
        <rect x="31" y="12" width="6" height="24" rx="2" fill="var(--sun, #f2c15a)" stroke="#8a5a2a" strokeWidth="1.4" />
        <path d="M31 36l3 6 3-6z" fill="#f7e7c4" stroke="#8a5a2a" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M33.4 40.2l.6 1.8.6-1.8z" fill="#3a2600" />
      </g>
    </svg>
  )
}

/** The stamp: three stars, `n` of them inked. */
export function StampStars({ n, size = 22, className = '' }: { n: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <StarIcon key={i} width={size} height={size} className={i <= n ? 'text-sun drop-shadow-[0_1px_0_rgba(138,90,42,0.55)]' : 'text-[var(--line-strong)] opacity-60'} />
      ))}
    </span>
  )
}
