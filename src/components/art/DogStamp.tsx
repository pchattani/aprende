/**
 * A dog's painted portrait on a perforated postage stamp: the "speaker" avatar beside an
 * exercise prompt. The dog is shown as a bust (head, neck, shoulders and chest running off
 * the bottom of the picture), on a wash chosen to contrast with its coat. Denomination top
 * left, country and name in the strip under the picture.
 */
import type { ReactNode } from 'react'
import { COURSE_ID } from '../../engine/course'
import { DOG_ART, DOG_LABEL, HI_DETAIL_PX, PORTRAIT, type DogId } from './dogRegistry'
import type { Act, Mood } from './dogArt'
import { PaintFilters } from './paint'
import { useArtId } from './brush'

const COUNTRY: Record<string, string> = { es: 'Argentina', yue: 'Hong Kong', pt: 'Brasil', it: 'Italia', fr: 'France' }
/** Background wash (light centre → edge), the hill behind the shoulders, and the frame ink for each dog's stamp. */
const STAMP_INK: Record<DogId, { wash: string; wash2: string; hill: string; ink: string; value: string }> = {
  // honey-tan Leo on a cool sky
  leo: { wash: '#e4f0f6', wash2: '#9cc4de', hill: '#7fae86', ink: '#a8392c', value: '20' },
  // charcoal Bonchita on warm apricot
  bonchita: { wash: '#fdf0d8', wash2: '#f2b98a', hill: '#e48f6a', ink: '#2a4f9c', value: '35' },
  // cream Luna on sage green
  luna: { wash: '#e6efd6', wash2: '#8fb878', hill: '#5f9560', ink: '#3d7a4f', value: '50' },
}

/** `act` makes the portrait inside the stamp act (talk, cheer, sad…; see art/dogPose.ts); it defaults from the mood. */
export function DogStamp({ dog, size = 72, mood = 'happy', act, country, className = '', tilt = 0 }: { dog: DogId; size?: number; mood?: Mood; act?: Act; country?: string; className?: string; tilt?: number }) {
  const id = useArtId(`st${dog}`)
  const hi = size >= HI_DETAIL_PX
  const Art = DOG_ART[dog]
  const ink = STAMP_INK[dog]
  const [cx, cy, cs] = PORTRAIT[dog]
  const label = (country ?? COUNTRY[COURSE_ID] ?? '').toUpperCase()
  const showText = size >= 56
  // the picture fills the frame; the text strip takes the bottom when there is room for it
  const picH = showText ? 84 : 104
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
          <radialGradient id={`${id}-bg`} cx="0.32" cy="0.26" r="0.95">
            <stop offset="0" stopColor="#fdf9ef" />
            <stop offset="0.38" stopColor={ink.wash} />
            <stop offset="1" stopColor={ink.wash2} />
          </radialGradient>
          <clipPath id={`${id}-clip`}>
            <rect x="7" y="7" width="86" height={picH} />
          </clipPath>
        </defs>
        <g mask={`url(#${id}-perf)`}>
          <rect x="0" y="0" width="100" height="118" fill="#fbf7ee" />
          <g clipPath={`url(#${id}-clip)`}>
            <rect x="7" y="7" width="86" height={picH} fill={`url(#${id}-bg)`} filter={hi ? `url(#${id}-soft)` : undefined} />
            {/* a sun and a far hill, washed in behind the portrait */}
            <circle cx="80" cy="22" r="8" fill="#fff6dc" opacity="0.75" />
            <path d={`M4 ${picH - 6} C24 ${picH - 18} 44 ${picH - 12} 60 ${picH - 8} C76 ${picH - 4} 88 ${picH - 14} 96 ${picH - 16} L96 ${picH + 8} L4 ${picH + 8} Z`} fill={ink.hill} opacity="0.5" />
            {/* the bust: the crop runs the chest off the bottom edge of the picture */}
            <svg x="7" y={7 + picH - 86} width="86" height="86" viewBox={`${cx} ${cy} ${cs} ${cs}`} overflow="hidden">
              <Art id={id} mood={mood} hi={hi} act={act} />
            </svg>
          </g>
          <rect x="7" y="7" width="86" height={picH} fill="none" stroke={ink.ink} strokeWidth="1.2" opacity="0.85" />
          <text x="11" y="19" fontFamily="var(--font-display)" fontWeight="800" fontSize="12" fill={ink.ink} stroke="#fbf7ee" strokeWidth="2.4" paintOrder="stroke">
            {ink.value}
            <tspan fontSize="7" dx="0.6">c</tspan>
          </text>
          {showText && (
            <>
              <text x="50" y="100.6" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700" fontSize={label.length > 9 ? 6.4 : 7.4} letterSpacing="1.2" fill={ink.ink}>
                {label}
              </text>
              <text x="50" y="109" textAnchor="middle" fontFamily="var(--font-hand)" fontWeight="700" fontSize="8" fill="#5d4a40">
                {DOG_LABEL[dog]}
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  )
}
