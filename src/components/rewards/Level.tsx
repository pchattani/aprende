/**
 * The traveller level: a gold postal seal with the level number, the header chip and the
 * progress bar towards the next level.
 */
import { useId, type Ref } from 'react'
import { useTraveller } from '../../hooks/useCoins'
import { travellerLevel } from '../../engine/traveller'
import './rewards.css'

/** Points of a serrated seal edge, like a wax seal or a postmark rosette. */
function sealPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const pts: string[] = []
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI * i) / teeth - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join(' L')} Z`
}
const SEAL = sealPath(50, 50, 47, 42, 20)

/** A gold seal with the level number on a blue medallion; `ribbon` adds two red tails. */
export function LevelBadge({ level, size = 56, ribbon = false, className = '' }: { level: number; size?: number; ribbon?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')
  const digits = String(level).length
  const fs = digits >= 3 ? 26 : digits === 2 ? 34 : 40
  return (
    <svg width={size} height={size * (ribbon ? 1.18 : 1)} viewBox={`0 0 100 ${ribbon ? 118 : 100}`} className={className} aria-hidden="true" overflow="visible">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe08f" />
          <stop offset="0.5" stopColor="#e9a92e" />
          <stop offset="1" stopColor="#b97a0e" />
        </linearGradient>
        <radialGradient id={`${id}b`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#4b77e6" />
          <stop offset="1" stopColor="#1d3a8c" />
        </radialGradient>
      </defs>
      {ribbon && (
        <g>
          <path d="M30 70 L18 116 L31 108 L38 118 L48 76 Z" fill="#b93a30" />
          <path d="M70 70 L82 116 L69 108 L62 118 L52 76 Z" fill="#d9473b" />
        </g>
      )}
      <path d={SEAL} fill="#9c6407" transform="translate(0 2.5)" />
      <path d={SEAL} fill={`url(#${id}g)`} />
      <circle cx="50" cy="50" r="35" fill={`url(#${id}b)`} stroke="#8a5a08" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.3" strokeDasharray="2.2 3" />
      <path d="M27 38 A26 26 0 0 1 46 24" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" fill="none" />
      <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={fs} fontWeight="800" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}>
        {level}
      </text>
    </svg>
  )
}

/** The bar towards the next level, filled by transform (scaleX). */
export function LevelBar({ progress, className = '' }: { progress: number; className?: string }) {
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div className={`trav-bar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label="Progress to the next traveller level">
      <span style={{ transform: `scaleX(${p})` }} />
    </div>
  )
}

/**
 * Traveller level for the header: the seal, "Lv 4" and a slim bar to the next level.
 * Reads total km live; pass `km` to show a fixed distance instead.
 */
export function LevelChip({ km, showTitle = false, className = '', ref }: { km?: number; showTitle?: boolean; className?: string; ref?: Ref<HTMLSpanElement> }) {
  const live = useTraveller()
  const t = km !== undefined ? travellerLevel(km) : live
  const level = t?.level ?? 1
  const label = t ? `Traveller level ${level}, ${t.title}: ${Math.round(t.intoLevel)} of ${t.span} km to level ${level + 1}` : 'Traveller level'
  return (
    <span ref={ref} className={`coin-chip ${className}`} title={label}>
      <LevelBadge level={level} size={22} />
      <span className="flex flex-col gap-[3px]" aria-hidden="true">
        <span className="text-[0.8rem] leading-none">
          Lv {level}
          {showTitle && t && <span className="ml-1 font-sans text-[0.72rem] font-bold text-ink-2">{t.title}</span>}
        </span>
        <span className="block h-[4px] w-11 overflow-hidden rounded-full bg-surface-2">
          <span className="block h-full origin-left rounded-full bg-sun transition-transform duration-500" style={{ transform: `scaleX(${t?.progress ?? 0})` }} />
        </span>
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
