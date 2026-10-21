/**
 * Where a character came from, as a three-step strip: a painted picture of the thing → its ancient
 * (oracle-bone-like) form → the modern character. The steps fade in one after the other, the ancient
 * strokes draw themselves and each picture has a gentle idle motion (flames flicker, rain falls, doors
 * swing); none of it moves under prefers-reduced-motion. Pictures keep their own painted colours; the
 * tiles, the ancient form and the modern character follow the theme through CSS variables.
 * Drawn for every character in engine/pictograms.ts (100×100 boxes).
 */
import type { ReactNode } from 'react'
import { PICTOGRAMS } from '../../engine/pictograms'
import { TL } from '../../engine/course'
import { PaintFilters } from './paint'
import { darken, lighten, useArtId } from './brush'

// painted colours (the souvenirs' palette)
const FLAME = '#e8742f'
const FLAME_Y = '#f6c54e'
const FLAME_R = '#d9473b'
const LOG = '#8a5a33'
const WATER = '#3f7fc9'
const WATER_L = '#8fc1ea'
const LEAF = '#6aa356'
const LEAF_D = '#3f7343'
const MOUNT = '#6f8fb0'
const SNOW = '#f7f3ea'
const SKY = '#bcd6ee'
const NIGHT = '#2c3a6b'
const MOON = '#f2cf6a'
const DOOR = '#c2563a'
const FRAME = '#7a4a2e'
const BRASS = '#e9b44a'
const SKIN = '#e7a77c'
const SHIRT = '#2f6fc0'
const TROUSERS = '#3b4a6b'
const LIP = '#d9473b'
const RICE = '#8fbf5a'
const GRAIN = '#e3c15a'
const BANK = '#b88a55'
const CLOUD = '#a8b3c4'
const TRUNK = '#7b5134'
const SAND = '#d9b26a'
const BALL = '#d9473b'

type Draw = (id: string) => ReactNode
/** A thin contour in a darker shade of the fill (reads on light and dark tiles alike). */
const edge = (c: string, w = 1.2) => ({ stroke: darken(c, 0.35), strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const })
const lin = (id: string, from: string, to: string, x2 = 0, y2 = 1) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    <stop offset="0" stopColor={from} />
    <stop offset="1" stopColor={to} />
  </linearGradient>
)
const drop = (x: number, y: number, s = 1) => `M${x} ${y - 6 * s} C${x + 3.6 * s} ${y - 1 * s} ${x + 3.6 * s} ${y + 3 * s} ${x} ${y + 3.4 * s} C${x - 3.6 * s} ${y + 3 * s} ${x - 3.6 * s} ${y - 1 * s} ${x} ${y - 6 * s}Z`

/** The four plots of a field, and where the raindrops fall. */
const PLOTS = [
  { x: 16, y: 16, c: RICE },
  { x: 52, y: 16, c: GRAIN },
  { x: 16, y: 52, c: GRAIN },
  { x: 52, y: 52, c: RICE },
]
const RAIN: [number, number][] = [[28, 60], [50, 58], [72, 60], [39, 76], [61, 74], [28, 90], [50, 90], [72, 90]]

/** The painted pictures. */
const PICTURES: Record<string, Draw> = {
  火: (id) => (
    <>
      <defs>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.8" r="0.5">
          <stop offset="0" stopColor={FLAME_Y} stopOpacity="0.55" />
          <stop offset="1" stopColor={FLAME_Y} stopOpacity="0" />
        </radialGradient>
        {lin(`${id}-fl`, FLAME_R, FLAME)}
        {lin(`${id}-in`, FLAME, FLAME_Y)}
      </defs>
      <ellipse cx="50" cy="74" rx="42" ry="22" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft)`}>
        <rect x="18" y="76" width="64" height="9" rx="4.5" fill={LOG} transform="rotate(-12 50 80)" {...edge(LOG)} />
        <rect x="18" y="76" width="64" height="9" rx="4.5" fill={lighten(LOG, 0.12)} transform="rotate(12 50 80)" {...edge(LOG)} />
        <g className="picto-flicker">
          <path d="M50 12 C61 28 73 40 70 58 C68 72 60 80 50 80 C40 80 31 72 30 58 C29 47 37 40 40 29 C44 37 46 41 47 44 C49 33 47 22 50 12Z" fill={`url(#${id}-fl)`} {...edge(FLAME_R, 1)} />
          <path d="M50 38 C57 48 62 55 60 65 C59 73 55 78 50 78 C45 78 41 73 40 66 C40 58 46 54 47 47 C49 51 50 53 50 55 C51 49 50 44 50 38Z" fill={`url(#${id}-in)`} />
          <path d="M27 50 C31 56 32 61 30 66 C26 64 24 58 27 50Z M73 46 C70 54 70 60 72 64 C76 61 77 54 73 46Z" fill={FLAME} opacity="0.85" />
        </g>
      </g>
    </>
  ),
  水: (id) => (
    <>
      <defs>{lin(`${id}-w`, WATER_L, WATER)}</defs>
      <g filter={`url(#${id}-soft)`}>
        <path d="M36 4 C28 30 62 38 52 60 C46 74 32 84 28 98 L72 98 C74 84 84 74 78 58 C70 40 50 32 64 4Z" fill={`url(#${id}-w)`} {...edge(WATER, 1)} />
        <g className="picto-flow" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round">
          <path d="M44 14 C42 24 56 30 56 40" />
          <path d="M62 50 C66 60 58 68 52 76" />
          <path d="M44 84 C42 88 42 92 44 96" />
        </g>
        <g fill={WATER_L} {...edge(WATER, 0.8)}>
          <path d={drop(18, 28, 1.2)} />
          <path d={drop(14, 62, 1)} />
          <path d={drop(84, 32, 1)} />
          <path d={drop(88, 66, 1.2)} />
        </g>
      </g>
    </>
  ),
  山: (id) => (
    <>
      <defs>
        {lin(`${id}-m`, lighten(MOUNT, 0.25), MOUNT, 1, 1)}
        {lin(`${id}-b`, lighten(MOUNT, 0.45), lighten(MOUNT, 0.15), 1, 1)}
      </defs>
      <g filter={`url(#${id}-soft)`}>
        <path d="M4 84 L26 42 L48 84Z" fill={`url(#${id}-b)`} {...edge(MOUNT, 1)} />
        <path d="M52 84 L74 42 L96 84Z" fill={`url(#${id}-b)`} {...edge(MOUNT, 1)} />
        <path d="M20 84 L50 14 L80 84Z" fill={`url(#${id}-m)`} {...edge(MOUNT, 1)} />
        <path d="M50 14 L59 35 L54 32 L49 37 L44 32 L41 35Z" fill={SNOW} />
        <path d="M26 42 L31 52 L27 50 L23 53Z M74 42 L79 52 L75 50 L71 53Z" fill={SNOW} opacity="0.9" />
        <path d="M2 84 Q50 78 98 84 L98 96 L2 96Z" fill={LEAF} {...edge(LEAF, 1)} />
      </g>
    </>
  ),
  門: (id) => (
    <>
      <defs>{lin(`${id}-d`, lighten(DOOR, 0.15), darken(DOOR, 0.1), 1, 0)}</defs>
      <g filter={`url(#${id}-soft)`}>
        <rect x="8" y="88" width="84" height="6" rx="2" fill={darken(FRAME, 0.1)} />
        <rect x="10" y="20" width="9" height="70" rx="2" fill={FRAME} {...edge(FRAME)} />
        <rect x="81" y="20" width="9" height="70" rx="2" fill={FRAME} {...edge(FRAME)} />
        <path d="M5 12 Q50 6 95 12 L95 21 L5 21Z" fill={FRAME} {...edge(FRAME)} />
        {(['l', 'r'] as const).map((side) => {
          const x = side === 'l' ? 20 : 51
          return (
            <g key={side} className={`picto-swing-${side}`}>
              <rect x={x} y="25" width="29" height="62" rx="2" fill={`url(#${id}-d)`} {...edge(DOOR)} />
              {[34, 46, 58, 70, 80].map((y) => [x + 7, x + 14.5, x + 22].map((cx) => <circle key={`${y}${cx}`} cx={cx} cy={y} r="1.5" fill={BRASS} />))}
              <circle cx={side === 'l' ? x + 26 : x + 3} cy="56" r="3.4" fill="none" stroke={BRASS} strokeWidth="1.6" />
            </g>
          )
        })}
      </g>
    </>
  ),
  口: (id) => (
    <>
      <defs>{lin(`${id}-l`, lighten(LIP, 0.2), darken(LIP, 0.1))}</defs>
      <g filter={`url(#${id}-soft)`}>
        <path d="M12 50 C24 30 42 33 50 40 C58 33 76 30 88 50 C76 72 62 80 50 80 C38 80 24 72 12 50Z" fill={`url(#${id}-l)`} {...edge(LIP)} />
        <g className="picto-talk">
          <path d="M22 50 C33 45 43 47 50 49 C57 47 67 45 78 50 C70 63 60 69 50 69 C40 69 30 63 22 50Z" fill="#5a1f24" />
          <path d="M26 50 C35 47 44 48.5 50 50 C56 48.5 65 47 74 50 L72 54 C64 52 56 53 50 53.5 C44 53 36 52 28 54Z" fill="#fffaf0" />
          <path d="M38 64 C42 58 58 58 62 64 C58 68 42 68 38 64Z" fill="#e8807a" />
        </g>
      </g>
    </>
  ),
  人: (id) => (
    <>
      <ellipse cx="50" cy="91" rx="26" ry="3.5" fill={darken(SKY, 0.4)} opacity="0.25" />
      <g className="picto-walk" filter={`url(#${id}-soft)`} strokeLinecap="round">
        <path d="M47 60 L33 88" stroke={TROUSERS} strokeWidth="8" />
        <path d="M47 60 L60 74 L64 88" fill="none" stroke={darken(TROUSERS, 0.15)} strokeWidth="8" strokeLinejoin="round" />
        <path d="M55 32 L47 60" stroke={SHIRT} strokeWidth="13" />
        <path d="M53 36 L44 52" stroke={darken(SKIN, 0.1)} strokeWidth="5" />
        <path d="M55 36 L66 50" stroke={SKIN} strokeWidth="5" />
        <circle cx="58" cy="20" r="9" fill={SKIN} {...edge(SKIN, 1)} />
        <path d="M50 17 C52 9 64 8 67 16 C62 14 56 15 50 17Z" fill={darken(LOG, 0.3)} />
      </g>
    </>
  ),
  田: (id) => (
    <>
      <g filter={`url(#${id}-soft)`}>
        <rect x="10" y="10" width="80" height="80" rx="9" fill={BANK} {...edge(BANK)} />
        {PLOTS.map(({ x, y, c }) => (
          <g key={`${x}${y}`}>
            <rect x={x} y={y} width="32" height="32" rx="4" fill={c} />
            {[7, 15, 23].map((dy) => (
              <path key={dy} d={`M${x + 4} ${y + dy + 2} L${x + 28} ${y + dy}`} stroke={darken(c, 0.2)} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
            ))}
          </g>
        ))}
      </g>
    </>
  ),
  月: (id) => (
    <>
      <defs>
        <radialGradient id={`${id}-glow`} cx="0.55" cy="0.5" r="0.5">
          <stop offset="0" stopColor={MOON} stopOpacity="0.35" />
          <stop offset="1" stopColor={MOON} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="16" fill={NIGHT} />
      <circle cx="54" cy="50" r="42" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft)`}>
        <path d="M64 12 C24 18 16 74 64 88 C42 72 38 30 64 12Z" fill={MOON} {...edge(MOON, 1)} />
      </g>
      <g className="picto-twinkle" fill="#fffaf0">
        <circle cx="76" cy="24" r="1.6" />
        <circle cx="84" cy="56" r="1.2" />
        <circle cx="70" cy="78" r="1.4" />
        <circle cx="16" cy="18" r="1.1" />
      </g>
    </>
  ),
  雨: (id) => (
    <>
      <defs>{lin(`${id}-s`, SKY, lighten(SKY, 0.5))}</defs>
      <rect x="4" y="4" width="92" height="20" rx="6" fill={`url(#${id}-s)`} />
      <g filter={`url(#${id}-soft)`}>
        <path d="M18 42 C14 32 26 26 32 30 C34 20 50 18 54 28 C60 22 74 24 74 34 C84 32 88 44 80 48 L22 48 C16 48 14 44 18 42Z" fill={CLOUD} {...edge(CLOUD, 1)} />
        <g className="picto-rain" fill={WATER_L} {...edge(WATER, 0.7)}>
          {RAIN.map(([x, y]) => (
            <path key={`${x}${y}`} d={drop(x, y, 0.95)} />
          ))}
        </g>
      </g>
    </>
  ),
  木: (id) => (
    <>
      <defs>{lin(`${id}-soil`, lighten(TRUNK, 0.45), lighten(TRUNK, 0.25))}</defs>
      <rect x="4" y="66" width="92" height="30" rx="6" fill={`url(#${id}-soil)`} />
      <g filter={`url(#${id}-soft)`} strokeLinecap="round" fill="none">
        <path d="M50 66 L50 30 M50 44 L36 30 M50 40 L64 28" stroke={TRUNK} strokeWidth="6" />
        <path d="M50 66 C46 76 38 82 26 88 M50 66 C54 76 62 82 74 88 M50 66 L50 90" stroke={darken(TRUNK, 0.15)} strokeWidth="3.5" />
        <g className="picto-sway">
          <circle cx="36" cy="26" r="15" fill={LEAF} />
          <circle cx="64" cy="24" r="16" fill={LEAF} />
          <circle cx="50" cy="16" r="15" fill={lighten(LEAF, 0.12)} />
          <circle cx="50" cy="32" r="12" fill={LEAF_D} opacity="0.55" />
        </g>
      </g>
    </>
  ),
  上: (id) => (
    <g filter={`url(#${id}-soft)`}>
      <path d="M8 72 Q50 66 92 72 L92 92 L8 92Z" fill={LEAF} {...edge(LEAF)} />
      <circle className="picto-bob" cx="50" cy="40" r="12" fill={BALL} {...edge(BALL)} />
      <path d="M44 34 Q48 30 53 32" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M50 22 L50 10 M44 15 L50 9 L56 15" stroke={darken(SKY, 0.35)} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  下: (id) => (
    <g filter={`url(#${id}-soft)`}>
      <path d="M6 26 Q50 20 94 28" stroke={TRUNK} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M62 27 L62 42" stroke={darken(TRUNK, 0.1)} strokeWidth="2" />
      <circle className="picto-bob" cx="62" cy="54" r="12" fill={BALL} {...edge(BALL)} />
      <path d="M62 42 C66 38 72 38 74 42 C70 44 66 44 62 42Z" fill={LEAF} />
      <path d="M30 40 L30 64 M24 58 L30 65 L36 58" stroke={darken(SKY, 0.35)} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  大: (id) => (
    <g className="picto-walk" filter={`url(#${id}-soft)`} strokeLinecap="round">
      <path d="M50 58 L30 90 M50 58 L70 90" stroke={TROUSERS} strokeWidth="8" />
      <path d="M50 34 L50 60" stroke={SHIRT} strokeWidth="14" />
      <path d="M12 34 Q30 40 50 38 Q70 40 88 34" stroke={SKIN} strokeWidth="6" fill="none" />
      <circle cx="50" cy="20" r="10" fill={SKIN} {...edge(SKIN, 1)} />
    </g>
  ),
  小: (id) => (
    <g filter={`url(#${id}-soft)`}>
      <ellipse cx="50" cy="84" rx="40" ry="8" fill={lighten(SAND, 0.35)} />
      <ellipse cx="50" cy="38" rx="6" ry="8" fill={SAND} {...edge(SAND)} />
      <ellipse cx="28" cy="62" rx="5" ry="7" fill={SAND} transform="rotate(-25 28 62)" {...edge(SAND)} />
      <ellipse cx="72" cy="62" rx="5" ry="7" fill={SAND} transform="rotate(25 72 62)" {...edge(SAND)} />
    </g>
  ),
  一: (id) => <Rods id={id} n={1} />,
  二: (id) => <Rods id={id} n={2} />,
  三: (id) => <Rods id={id} n={3} />,
}

/** Counting rods (wooden sticks laid flat). */
function Rods({ id, n }: { id: string; n: number }) {
  const ys = n === 1 ? [50] : n === 2 ? [38, 62] : [28, 50, 72]
  return (
    <g filter={`url(#${id}-soft)`}>
      {ys.map((y, i) => (
        <rect key={y} x={14 + i * 2} y={y - 4} width={72 - i * 4} height="8" rx="4" fill={i % 2 ? lighten(LOG, 0.15) : LOG} {...edge(LOG)} />
      ))}
    </g>
  )
}

/** Ancient forms: brush strokes like the oracle-bone and bronze inscriptions (pathLength 1 so they can draw in). */
const ANCIENT: Record<string, string[]> = {
  火: ['M20 74 Q50 92 80 74', 'M50 84 L50 22', 'M32 78 L24 46', 'M68 78 L76 46', 'M38 52 L33 44', 'M62 52 L67 44'],
  水: ['M50 12 Q38 30 50 48 Q62 66 50 88', 'M30 22 Q24 30 30 40', 'M28 56 Q22 64 28 74', 'M70 26 Q76 34 70 44', 'M72 60 Q78 68 72 78'],
  山: ['M16 78 L84 78', 'M16 78 L16 50', 'M50 78 L50 22', 'M84 78 L84 50', 'M16 50 L26 64', 'M84 50 L74 64'],
  門: ['M14 16 L86 16', 'M20 16 L20 88', 'M80 16 L80 88', 'M28 30 L44 30 L44 66 L28 66 Z', 'M56 30 L72 30 L72 66 L56 66 Z'],
  口: ['M20 34 L26 76 L74 76 L80 34', 'M20 34 Q50 40 80 34'],
  人: ['M58 14 Q52 44 30 86', 'M52 44 Q62 60 72 84'],
  田: ['M18 20 Q50 14 82 20 Q86 50 82 82 Q50 86 18 82 Q14 50 18 20 Z', 'M50 18 L50 84', 'M16 51 L84 51'],
  月: ['M62 12 Q20 36 36 88', 'M62 12 Q48 52 36 88', 'M46 44 L56 48'],
  雨: ['M14 20 L86 20', 'M30 34 L30 44', 'M50 32 L50 42', 'M70 34 L70 44', 'M30 56 L30 66', 'M50 54 L50 64', 'M70 56 L70 66', 'M40 76 L40 86', 'M60 76 L60 86'],
  木: ['M50 12 L50 88', 'M50 34 L30 14', 'M50 34 L70 14', 'M50 64 L28 86', 'M50 64 L72 86'],
  上: ['M14 72 Q50 66 86 72', 'M38 46 L62 44'],
  下: ['M14 30 Q50 24 86 30', 'M38 54 L62 52'],
  大: ['M50 14 L50 52', 'M16 42 Q50 30 84 42', 'M50 52 L28 86', 'M50 52 L72 86', 'M50 14 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0'],
  小: ['M50 26 L50 56', 'M32 50 L26 66', 'M68 50 L74 66'],
  一: ['M18 50 L82 50'],
  二: ['M24 38 L76 38', 'M18 62 L82 62'],
  三: ['M24 28 L76 28', 'M28 50 L72 50', 'M18 72 L82 72'],
}

function Tile({ children, label, tone }: { children: ReactNode; label: string; tone: 'picture' | 'bone' | 'paper' }) {
  const bg = tone === 'bone' ? 'color-mix(in srgb, var(--sun) 16%, var(--card))' : tone === 'picture' ? 'color-mix(in srgb, var(--blue) 7%, var(--card))' : 'var(--card)'
  return (
    <div className="picto-step flex min-w-0 flex-1 flex-col items-center">
      <div className="aspect-square w-full overflow-hidden rounded-xl border border-line shadow-card" style={{ background: bg }}>
        {children}
      </div>
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-wide text-ink-2">{label}</p>
    </div>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="picto-arrow mt-[-1rem] h-4 w-4 shrink-0 self-center text-ink-2" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The painted picture alone (100×100), for places that show only where a character came from. */
export function PictogramPicture({ char, className }: { char: string; className?: string }) {
  const id = useArtId('pg')
  const draw = PICTURES[char]
  if (!draw) return null
  return (
    <svg viewBox="0 0 100 100" className={`picto-picture block h-full w-full ${className ?? ''}`} aria-hidden="true">
      <defs>
        <PaintFilters id={id} seed={char.charCodeAt(0) % 17} wobble={2.2} grain={false} />
      </defs>
      {draw(id)}
    </svg>
  )
}

/** The ancient form: strokes on a scrap of bone with a couple of cracks. */
export function AncientForm({ char, className }: { char: string; className?: string }) {
  const paths = ANCIENT[char]
  if (!paths) return null
  return (
    <svg viewBox="0 0 100 100" className={`block h-full w-full ${className ?? ''}`} aria-hidden="true">
      <path d="M8 70 L22 62 L26 66 M92 22 L80 30" fill="none" style={{ stroke: 'var(--line-strong)' }} strokeWidth="1" strokeLinecap="round" />
      <g fill="none" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'color-mix(in srgb, var(--red) 55%, var(--ink))' }}>
        {paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} className="picto-ink" style={{ animationDelay: `${0.9 + i * 0.18}s` }} />
        ))}
      </g>
    </svg>
  )
}

export interface PictogramProps {
  char: string
  /** false hides the modern character (a pictogram exercise asks for it): the last tile shows a question mark. */
  reveal?: boolean
  /** Captions under the tiles (default on). */
  labels?: boolean
  className?: string
}

/** picture → ancient form → modern character, in a row that fits a 390px screen. */
export function Pictogram({ char, reveal = true, labels = true, className }: PictogramProps) {
  const info = PICTOGRAMS[char]
  if (!PICTURES[char] || !info) return null
  return (
    <figure className={`picto flex items-start gap-1.5 ${className ?? ''}`} aria-label={reveal ? `${char} (${info.en}) grew from a picture: ${info.story}` : `A picture and its ancient character: ${info.story}`} data-char={reveal ? char : undefined}>
      <Tile label={labels ? (info.type === 'pictogram' ? 'picture' : 'idea') : ''} tone="picture">
        <PictogramPicture char={char} />
      </Tile>
      <Arrow />
      <Tile label={labels ? 'ancient' : ''} tone="bone">
        <AncientForm char={char} />
      </Tile>
      <Arrow />
      <Tile label={labels ? (reveal ? 'today' : '?') : ''} tone="paper">
        <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden="true">
          {reveal ? (
            <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="70" lang={TL} className="picto-modern" style={{ fill: 'var(--ink)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
              {char}
            </text>
          ) : (
            <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="56" style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              ?
            </text>
          )}
        </svg>
      </Tile>
    </figure>
  )
}
