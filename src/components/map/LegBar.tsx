/** A thin route line that fills with ink, with a paw marking how far you've come. */
export function LegBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)))
  return (
    <div className={`relative mt-2 h-2.5 ${className}`} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span className="absolute inset-x-0 top-1/2 h-0 -translate-y-1/2 border-t-2 border-dotted border-line" />
      <span className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--lvl,var(--blue))] transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
      <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-[var(--lvl,var(--blue))]" style={{ left: `${pct * 100}%` }} />
    </div>
  )
}

/** A chunky, game-style progress bar (rounded track with a glossy fill). */
export function ChunkyBar({ value, max, className = '', label }: { value: number; max: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)))
  return (
    <div className={`relative h-3 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--lvl,var(--blue))_14%,var(--card-2))] ${className}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span className="absolute inset-y-0 left-0 origin-left rounded-full bg-[var(--lvl,var(--blue))] transition-transform duration-500" style={{ width: '100%', transform: `scaleX(${pct})` }} />
      <span className="absolute inset-x-1.5 top-[3px] h-[3px] rounded-full bg-white/35" aria-hidden="true" style={{ transform: `scaleX(${pct})`, transformOrigin: 'left' }} />
    </div>
  )
}
