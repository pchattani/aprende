/**
 * A postcard: white card border with a soft shadow around a painting, an optional
 * handwritten caption, a postage stamp in the corner and a round postmark.
 * `Postcard` puts a stop's painted scene in the frame.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { LevelId } from '../../engine/schema'
import { sceneFor, type StopLike } from '../../engine/scenes'
import { PaintedScene } from './PaintedScene'
import { useArtId } from './brush'

/** Postcard card stock: warm white, dimmed a touch on dark pages (mixes with the page paper). */
const CARD = 'color-mix(in srgb, #fcf9f2 90%, var(--paper, #f6f4ee))'
const POSTMARK_INK = '#2c3e6e'

/** A small perforated postage stamp (SVG), with a tiny painted vignette and a value. */
export function MiniStamp({ size = 34, color = '#d4583f', value = '20', children }: { size?: number; color?: string; value?: string; children?: ReactNode }) {
  const id = useArtId('ms')
  const w = 40
  const h = 48
  const perf: ReactNode[] = []
  for (let x = 2; x <= w; x += 4) perf.push(<circle key={`t${x}`} cx={x} cy={0} r="1.5" />, <circle key={`b${x}`} cx={x} cy={h} r="1.5" />)
  for (let y = 2; y <= h; y += 4) perf.push(<circle key={`l${y}`} cx={0} cy={y} r="1.5" />, <circle key={`r${y}`} cx={w} cy={y} r="1.5" />)
  return (
    <svg width={size} height={(size * h) / w} viewBox={`-1 -1 ${w + 2} ${h + 2}`} aria-hidden="true" style={{ filter: 'drop-shadow(0 1px 1px rgba(28,37,65,0.25))' }}>
      <defs>
        <mask id={`${id}-m`}>
          <rect x="-1" y="-1" width={w + 2} height={h + 2} fill="#fff" />
          <g fill="#000">{perf}</g>
        </mask>
      </defs>
      <g mask={`url(#${id}-m)`}>
        <rect x="0" y="0" width={w} height={h} fill="#fbf7ee" />
        <rect x="3.5" y="3.5" width={w - 7} height={h - 7} fill={color} opacity="0.2" />
        <rect x="3.5" y="3.5" width={w - 7} height={h - 7} fill="none" stroke={color} strokeWidth="0.8" />
        {children ?? (
          <g>
            <circle cx="27" cy="15" r="4" fill="#f6d27a" />
            <path d="M3.5 36 Q12 24 20 30 T36.5 26 V44.5 H3.5 Z" fill={color} opacity="0.75" />
            <path d="M3.5 40 Q14 33 22 37 T36.5 35 V44.5 H3.5 Z" fill={color} />
          </g>
        )}
        <text x="6" y="12" fontFamily="var(--font-display)" fontWeight="800" fontSize="8" fill={color}>
          {value}
        </text>
      </g>
    </svg>
  )
}

/** A round rubber-stamp postmark with the place along the rim, a date in the middle and wavy cancel lines. */
export function Postmark({ place, date, size = 64, color = POSTMARK_INK, rotate = -12 }: { place: string; date?: string; size?: number; color?: string; rotate?: number }) {
  const id = useArtId('pm')
  const label = place.toUpperCase().slice(0, 26)
  return (
    <svg width={size * 1.9} height={size} viewBox="0 0 114 60" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)`, mixBlendMode: 'multiply', opacity: 0.78 }}>
      <defs>
        <path id={`${id}-arc`} d="M10 30 A20 20 0 0 1 50 30" />
        <filter id={`${id}-rough`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="a" />
          <feComposite in="SourceGraphic" in2="a" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${id}-rough)`} fill="none" stroke={color}>
        <circle cx="30" cy="30" r="27" strokeWidth="2" />
        <circle cx="30" cy="30" r="17" strokeWidth="1" />
        <text fill={color} stroke="none" fontFamily="var(--font-mono)" fontWeight="700" fontSize={label.length > 16 ? 5.2 : 6.4} letterSpacing="0.6">
          <textPath href={`#${id}-arc`} startOffset="50%" textAnchor="middle">
            {label}
          </textPath>
        </text>
        {date && (
          <text x="30" y="33" textAnchor="middle" fill={color} stroke="none" fontFamily="var(--font-mono)" fontWeight="700" fontSize="6.6">
            {date}
          </text>
        )}
        <path d="M30 47 l-3 4 h6 Z" fill={color} stroke="none" />
        {[22, 30, 38].map((y) => (
          <path key={y} d={`M60 ${y} q6 -4 12 0 t12 0 t12 0 t12 0 t12 0`} strokeWidth="1.8" />
        ))}
      </g>
    </svg>
  )
}

export interface PostcardFrameProps {
  children: ReactNode
  caption?: ReactNode
  /** Place name for the postmark (shown when `postmark` is set). */
  place?: string
  date?: string
  stamp?: boolean | ReactNode
  postmark?: boolean
  /** Degrees; a slight tilt looks hand-placed. */
  tilt?: number
  /** Region ink for the stamp. */
  ink?: string
  className?: string
  style?: CSSProperties
}

export function PostcardFrame({ children, caption, place, date, stamp, postmark, tilt = 0, ink = '#d4583f', className = '', style }: PostcardFrameProps) {
  return (
    <figure
      className={`relative m-0 ${className}`}
      style={{
        background: CARD,
        padding: '5%',
        paddingBottom: caption ? '2%' : '5%',
        borderRadius: 3,
        boxShadow: '0 1px 1px rgba(28,37,65,0.12), 0 10px 22px -12px rgba(28,37,65,0.45)',
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        containerType: 'inline-size',
        ...style,
      }}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: '3 / 2', borderRadius: 1 }}>
        {children}
      </div>
      {caption && (
        <figcaption className="font-hand truncate px-1 pt-1 text-center leading-tight" style={{ color: '#3d3550', fontSize: 'clamp(0.95rem, 4.2cqw, 1.5rem)' }}>
          {caption}
        </figcaption>
      )}
      {stamp && <div className="absolute" style={{ right: '3%', top: '3%', transform: 'rotate(4deg)' }}>{stamp === true ? <MiniStamp color={ink} /> : stamp}</div>}
      {postmark && place && (
        <div className="pointer-events-none absolute" style={{ right: '-2%', top: '9%' }}>
          <Postmark place={place} date={date} size={44} />
        </div>
      )}
    </figure>
  )
}

const INK: Record<LevelId, string> = { a1: '#d4583f', a2: '#d99227', b1: '#3f8f5f', b2: '#2f6fc0', c1: '#6d55c2', c2: '#b8406f' }

/** A stop's painted postcard, ready to drop into a page. */
export function Postcard({ stop, level, progress = 1, fade = 0, quality = 'full', lazy, caption, stamp, postmark, date, tilt, className, courseId }: {
  stop: StopLike
  level: LevelId
  progress?: number
  fade?: number
  quality?: 'thumb' | 'full'
  lazy?: boolean
  caption?: ReactNode
  stamp?: boolean
  postmark?: boolean
  date?: string
  tilt?: number
  className?: string
  courseId?: string
}) {
  const scene = sceneFor(stop, level, courseId)
  return (
    <PostcardFrame caption={caption} place={stop.name} date={date} stamp={stamp} postmark={postmark} tilt={tilt} ink={INK[level]} className={className}>
      <PaintedScene scene={scene} progress={progress} fade={fade} quality={quality} lazy={lazy} title={stop.name} className="block h-full w-full" />
    </PostcardFrame>
  )
}
