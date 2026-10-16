/**
 * A dog's painted portrait on a perforated postage stamp: the "speaker" avatar
 * beside an exercise prompt. Denomination top left, country along the bottom.
 */
import type { ReactNode } from 'react'
import { COURSE_ID } from '../../engine/course'
import { DOG_ART, DOG_LABEL, HI_DETAIL_PX, type DogId } from './dogRegistry'
import type { Mood } from './dogArt'
import { PaintFilters } from './paint'
import { useArtId } from './brush'

const COUNTRY: Record<string, string> = { es: 'Argentina', yue: 'Hong Kong', pt: 'Brasil', it: 'Italia', fr: 'France' }
/** Background wash and frame ink for each dog's stamp. */
const STAMP_INK: Record<DogId, { wash: string; wash2: string; ink: string; value: string }> = {
  leo: { wash: '#f3c9a0', wash2: '#e4855f', ink: '#a8392c', value: '20' },
  bonchita: { wash: '#cfe0f0', wash2: '#7fa6d6', ink: '#2a4f9c', value: '35' },
  luna: { wash: '#e3eccf', wash2: '#9fc48a', ink: '#3d7a4f', value: '50' },
}

export function DogStamp({ dog, size = 72, mood = 'happy', country, className = '', tilt = 0 }: { dog: DogId; size?: number; mood?: Mood; country?: string; className?: string; tilt?: number }) {
  const id = useArtId(`st${dog}`)
  const hi = size >= HI_DETAIL_PX
  const Art = DOG_ART[dog]
  const ink = STAMP_INK[dog]
  const label = (country ?? COUNTRY[COURSE_ID] ?? '').toUpperCase()
  // perforations: holes centred on the edge, a little bigger when the stamp is small so they still read
  const step = size < 60 ? 11 : 8
  const hole = size < 60 ? 3.6 : 2.7
  const holes: ReactNode[] = []
  for (let x = step / 2; x < 100; x += step) holes.push(<circle key={`t${x}`} cx={x} cy={0} r={hole} />, <circle key={`b${x}`} cx={x} cy={118} r={hole} />)
  for (let y = step / 2; y < 118; y += step) holes.push(<circle key={`l${y}`} cx={0} cy={y} r={hole} />, <circle key={`r${y}`} cx={100} cy={y} r={hole} />)
  return (
    <div className={`inline-block shrink-0 ${className}`} style={{ width: size, height: Math.round(size * 1.18), transform: tilt ? `rotate(${tilt}deg)` : undefined, filter: 'drop-shadow(0 1px 1.2px rgba(28,37,65,0.28))' }} role="img" aria-label={`${DOG_LABEL[dog]} stamp`}>
      <svg viewBox="0 0 100 118" width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <mask id={`${id}-perf`}>
            <rect width="100" height="118" fill="#fff" />
            <g fill="#000">{holes}</g>
          </mask>
          {hi && <PaintFilters id={id} seed={dog.length * 5} />}
          <radialGradient id={`${id}-bg`} cx="0.32" cy="0.28" r="0.9">
            <stop offset="0" stopColor="#fbf3e2" />
            <stop offset="0.45" stopColor={ink.wash} />
            <stop offset="1" stopColor={ink.wash2} />
          </radialGradient>
          <clipPath id={`${id}-clip`}>
            <rect x="7" y="7" width="86" height="104" />
          </clipPath>
        </defs>
        <g mask={`url(#${id}-perf)`}>
        <rect x="0" y="0" width="100" height="118" fill="#fbf7ee" />
        <g clipPath={`url(#${id}-clip)`}>
          <rect x="7" y="7" width="86" height="104" fill={`url(#${id}-bg)`} filter={hi ? `url(#${id}-soft)` : undefined} />
          {/* a sun and a far hill, washed in behind the portrait */}
          <circle cx="78" cy="24" r="9" fill="#fff4d6" opacity="0.7" />
          <path d="M4 86 C24 76 44 80 60 84 C76 88 88 80 96 78 L96 114 L4 114 Z" fill={ink.wash2} opacity="0.55" />
          <svg x="2" y="14" width="96" height="96" viewBox="18 22 84 84" overflow="visible">
            <Art id={id} mood={mood} hi={hi} />
          </svg>
          <rect x="7" y="95" width="86" height="16" fill="#fbf7ee" opacity="0.92" />
        </g>
        <rect x="7" y="7" width="86" height="104" fill="none" stroke={ink.ink} strokeWidth="1.2" opacity="0.8" />
        <text x="11" y="20" fontFamily="var(--font-display)" fontWeight="800" fontSize="13" fill={ink.ink}>
          {ink.value}
          <tspan fontSize="7" dx="0.6">c</tspan>
        </text>
{size >= 56 && (
          <>
        <text x="50" y="103" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700" fontSize={label.length > 9 ? 6.4 : 7.6} letterSpacing="1.2" fill={ink.ink}>
          {label}
        </text>
        <text x="50" y="109.6" textAnchor="middle" fontFamily="var(--font-hand)" fontWeight="700" fontSize="8" fill="#5d4a40">
          {DOG_LABEL[dog]}
        </text>
          </>
        )}
        </g>
      </svg>
    </div>
  )
}
