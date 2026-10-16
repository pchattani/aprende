/**
 * Painted Leo, Bonchita and Luna (gouache storybook style), as SVG <g> groups in a
 * 120×120 box. Light comes from the top left. At `hi` detail every part gets the
 * watercolour filter, fur strokes, a soft cast shadow and a loose sepia contour;
 * below that the same shapes are drawn with soft gradients only, so they stay clear
 * (and cheap) at 36–48px.
 */
import type { ReactNode } from 'react'
import { Lit } from './paint'
import { rng, furStrokes, curlStrokes, fluffPath, spikyPath, lockPath, darken } from './brush'

export type Mood = 'happy' | 'curious' | 'sleepy'
export interface DogArtProps {
  /** Unique id prefix for gradients and filters (see useArtId). */
  id: string
  mood: Mood
  /** Full painterly detail (filters, fur, ink) — use at 64px and up. */
  hi: boolean
  /** Raise a front paw (waving). */
  wave?: boolean
}

const INK = '#2a2230'
const wc = (id: string, hi: boolean) => (hi ? `url(#${id}-wc)` : undefined)

/** Loose coloured-pencil contour over a painted shape (hi detail only). */
function Contour({ id, hi, d, color, w = 0.7, o = 0.55 }: { id: string; hi: boolean; d: string; color: string; w?: number; o?: number }) {
  if (!hi) return null
  void id
  return <path d={d} fill="none" stroke={color} strokeWidth={w} opacity={o} strokeLinejoin="round" strokeLinecap="round" />
}

/** A soft shadow cast by the head on the chest. */
function CastShadow({ id, hi, clip, cx = 60, cy = 72, rx = 18, ry = 6, o = 0.32, color = '#5a3418' }: { id: string; hi: boolean; clip: string; cx?: number; cy?: number; rx?: number; ry?: number; o?: number; color?: string }) {
  return (
    <g clipPath={`url(#${id}-${clip})`}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} opacity={hi ? o : o * 0.6} filter={hi ? `url(#${id}-blur)` : undefined} />
    </g>
  )
}

/** Eyes shared by the three dogs: dark iris, warm lower ring, two highlights; arcs when sleepy. */
function Eye({ x, y, r, mood, iris = '#5b3a22', lid, side }: { x: number; y: number; r: number; mood: Mood; iris?: string; lid?: string; side: -1 | 1 }) {
  if (mood === 'sleepy') {
    return (
      <g>
        <path d={`M${x - r * 1.05} ${y - r * 0.1} Q${x} ${y + r * 0.95} ${x + r * 1.05} ${y - r * 0.1}`} stroke={INK} strokeWidth={r * 0.4} fill="none" strokeLinecap="round" />
        <path d={`M${x + side * r * 0.9} ${y + r * 0.15} l${side * r * 0.35} ${r * 0.3}`} stroke={INK} strokeWidth={r * 0.22} strokeLinecap="round" />
      </g>
    )
  }
  const look = mood === 'curious' ? r * 0.14 : 0
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.14} fill={lid ?? 'rgba(40,20,10,0.18)'} />
      <circle cx={x + look} cy={y} r={r} fill="#1b1416" />
      <path d={`M${x + look - r * 0.76} ${y + r * 0.32} A${r * 0.8} ${r * 0.8} 0 0 0 ${x + look + r * 0.76} ${y + r * 0.32}`} stroke={iris} strokeWidth={r * 0.3} fill="none" opacity="0.9" />
      <circle cx={x + look - r * 0.32} cy={y - r * 0.36} r={r * 0.36} fill="#fffaf0" />
      <circle cx={x + look + r * 0.4} cy={y + r * 0.32} r={r * 0.13} fill="#fffaf0" opacity="0.85" />
    </g>
  )
}

/** A soft, darker shadow pooled under the dog. */
function Ground({ w = 34 }: { w?: number }) {
  return <ellipse cx="60" cy="113.5" rx={w} ry="4.2" fill="#3a2c2a" opacity="0.16" />
}

// ======================================================================== LEO
const LEO = {
  body: 'M39 112 C33 104 33 89 41 79 C44 73 48 63 60 63 C72 63 76 73 79 79 C87 89 87 104 81 112 Z',
  head: 'M39 46 C39 33 48 26.5 60 26.5 C72 26.5 81 33 81 46 C81 57.5 72 65 60 65 C48 65 39 57.5 39 46 Z',
  earL: 'M42 31.5 C33 32.5 27.4 41.5 26.4 52.6 C25.6 61.6 26.6 70 28.4 76.4 L30.8 72.4 L32.6 78.6 L35 73.2 L37.6 78 L39 71 C41.4 64 43.2 56 44.6 48 C46 40 46.6 33.4 42 31.5 Z',
  earR: 'M78 31.5 C87 32.5 92.6 41.5 93.6 52.6 C94.4 61.6 93.4 70 91.6 76.4 L89.2 72.4 L87.4 78.6 L85 73.2 L82.4 78 L81 71 C78.6 64 76.8 56 75.4 48 C74 40 73.4 33.4 78 31.5 Z',
  legL: 'M44.6 79 C43.6 91 45 102 46.4 110 L56.2 110 C57.2 102 57.8 91 57.4 80 Z',
  legR: 'M75.4 79 C76.4 91 75 102 73.6 110 L63.8 110 C62.8 102 62.2 91 62.6 80 Z',
  tail: 'M76 100 C90 99 99 88 98.4 74 C98 68 93.6 64.6 91.4 68.6 C90.2 71.6 92.2 76 91.2 80 C89.2 88 84 92 75 93 Z',
}
/** Leo: golden-tan Yorkie mix, long silky ears with dark tips, a parted fringe and topknot, cream beard, red harness with a blue tag. */
export function LeoArt({ id, mood, hi, wave }: DogArtProps): ReactNode {
  const r = rng(11)
  const base = '#d39a59'
  const light = '#f2d39c'
  const shade = '#94603a'
  const sepia = '#6b3d1c'
  const cream = '#f6e4c0'
  const tilt = mood === 'curious' ? -8 : mood === 'sleepy' ? 5 : 0
  const g = (k: string) => `url(#${id}-${k})`
  // fringe locks fall from the parting over the brows; the beard hangs in locks
  const fringe = [lockPath(58, 27, 43.5, 41, 9, -2.5), lockPath(58.5, 28, 49, 41.6, 8, -1.5), lockPath(59, 29, 54.6, 40.4, 6, -0.6), lockPath(62, 27, 76.5, 41, 9, 2.5), lockPath(61.5, 28, 71, 41.6, 8, 1.5), lockPath(61, 29, 65.4, 40.4, 6, 0.6)]
  const beard = [lockPath(52, 60, 51.6, 71.4, 7, -1), lockPath(56, 62, 55.6, 74, 6.5, -0.6), lockPath(60, 62, 60, 75.6, 6.5, 0), lockPath(64, 62, 64.4, 74, 6.5, 0.6), lockPath(68, 60, 68.4, 71.4, 7, 1), lockPath(51, 55, 44.6, 64.6, 6, -1.4), lockPath(69, 55, 75.4, 64.6, 6, 1.4)]
  const legL = (
    <g>
      <path d={LEO.legL} fill={g('leg')} />
      <ellipse cx="51.2" cy="110.6" rx="6.2" ry="3.6" fill={g('cream')} />
      {hi && <path d="M48.9 109 v2.6 M51.3 109.2 v2.8 M53.6 109 v2.6" stroke={shade} strokeWidth="0.6" opacity="0.6" />}
    </g>
  )
  return (
    <g>
      <defs>
        <Lit id={`${id}-coat`} base={base} light={light} shade={shade} />
        <clipPath id={`${id}-bc`}><path d={LEO.body} /></clipPath>
        <Lit id={`${id}-coatU`} base={base} light={light} shade={shade} cx={44} cy={78} r={44} user />
        <Lit id={`${id}-fringe`} base="#e6b874" light="#fbe6bb" shade="#b88346" cy={0.15} />
        <Lit id={`${id}-cream`} base={cream} light="#fffaf0" shade="#ddb987" />
        <linearGradient id={`${id}-ear`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor="#c98d4e" />
          <stop offset="0.48" stopColor="#ad7136" />
          <stop offset="1" stopColor="#5a3216" />
        </linearGradient>
        <linearGradient id={`${id}-tail`} x1="0" y1="1" x2="0.6" y2="0">
          <stop offset="0" stopColor={shade} />
          <stop offset="1" stopColor="#6f4220" />
        </linearGradient>
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={light} />
          <stop offset="0.4" stopColor={base} />
          <stop offset="0.8" stopColor={base} />
          <stop offset="1" stopColor="#b47a40" />
        </linearGradient>
      </defs>
      <Ground />
      {/* tail: a feathery plume behind, to the right */}
      <g filter={wc(id, hi)}>
        <path d={LEO.tail} fill={g('tail')} />
        {hi && <path d={furStrokes(93, 82, 4, 9, 12, 6, -1.2, r)} stroke="#4c2a12" strokeWidth="0.6" fill="none" opacity="0.45" />}
        <Contour id={id} hi={hi} d={LEO.tail} color={sepia} />
      </g>
      {/* body */}
      <g filter={wc(id, hi)}>
        <path d={LEO.body} fill={g('coatU')} />
        <ellipse cx="37.5" cy="110.5" rx="7" ry="3.6" fill={g('coat')} />
        <ellipse cx="82.5" cy="110.5" rx="7" ry="3.6" fill={g('coat')} />
        <path d="M78 84 C84 92 84 104 80 111 L74 111 C77 102 77 92 72 84 Z" fill={shade} opacity="0.35" />
        {hi && <path d={furStrokes(41, 98, 5, 11, 12, 6, 1.9, r, 0.2)} stroke={shade} strokeWidth="0.6" fill="none" opacity="0.45" />}
        {hi && <path d={furStrokes(80, 98, 5, 11, 12, 6, 1.25, r, 0.2)} stroke={darken(shade, 0.2)} strokeWidth="0.6" fill="none" opacity="0.45" />}
        <CastShadow id={id} hi={hi} clip="bc" cy={75} rx={19} ry={6} />
        <Contour id={id} hi={hi} d={LEO.body} color={sepia} />
        {/* front legs and paws */}
        {!wave && legL}
        <path d={LEO.legR} fill={g('leg')} />
        <ellipse cx="68.8" cy="110.6" rx="6.2" ry="3.6" fill={g('cream')} />
        {hi && <path d="M66.5 109 v2.6 M69 109.2 v2.8 M71.4 109 v2.6" stroke={shade} strokeWidth="0.6" opacity="0.6" />}
      </g>
      {/* chest bib with a fringe of long hair */}
      <g filter={wc(id, hi)}>
        <path d="M49 76 C52 72 68 72 71 76 C73 83 70 92 66.4 97 L63.8 94.2 L62.2 99.4 L60 95.2 L57.8 99.4 L56.2 94.2 L53.6 97 C50 92 47 83 49 76 Z" fill={g('cream')} />
      </g>
      {/* harness: a flat red strap with a ring and a blue tag */}
      <g filter={wc(id, hi)}>
        <path d="M42.4 77.6 Q60 87.4 77.6 77.6" stroke="#c63a2e" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M43.4 76.4 Q60 85.6 76.6 76.4" stroke="#e8705c" strokeWidth="1" fill="none" opacity="0.7" strokeLinecap="round" />
        <circle cx="60" cy="84.6" r="1.7" fill="none" stroke="#caa65a" strokeWidth="1.1" />
        <path d="M60 86 C64 86 65 89 64.4 91.6 C63.8 94 61.6 95.2 60 95.2 C58.4 95.2 56.2 94 55.6 91.6 C55 89 56 86 60 86 Z" fill="#2f6fc0" />
        <path d="M57.4 89.4 C58 88 59.4 87.6 60.4 87.8" stroke="#9cc0f0" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      </g>
      {/* head */}
      <g transform={`rotate(${tilt} 60 52)`}>
        {/* ears: long and silky, dark at the tips */}
        <g filter={wc(id, hi)}>
          <g transform={mood === 'curious' ? 'rotate(-12 42 34)' : mood === 'sleepy' ? 'rotate(4 42 34)' : undefined}>
            <path d={LEO.earL} fill={g('ear')} />
            {hi && <path d={furStrokes(35, 54, 4.5, 11, 14, 7, 1.72, r, 0.15)} stroke="#4a2810" strokeWidth="0.55" fill="none" opacity="0.45" />}
          </g>
          <g transform={mood === 'sleepy' ? 'rotate(-4 78 34)' : undefined}>
            <path d={LEO.earR} fill={g('ear')} />
            {hi && <path d={furStrokes(85, 54, 4.5, 11, 14, 7, 1.42, r, 0.15)} stroke="#4a2810" strokeWidth="0.55" fill="none" opacity="0.45" />}
          </g>
          <g transform={mood === 'curious' ? 'rotate(-12 42 34)' : mood === 'sleepy' ? 'rotate(4 42 34)' : undefined}><Contour id={id} hi={hi} d={LEO.earL} color={sepia} o={0.45} /></g>
          <g transform={mood === 'sleepy' ? 'rotate(-4 78 34)' : undefined}><Contour id={id} hi={hi} d={LEO.earR} color={sepia} o={0.45} /></g>
        </g>
        <g filter={wc(id, hi)}>
          <path d={LEO.head} fill={g('coat')} />
          <Contour id={id} hi={hi} d={LEO.head} color={sepia} o={0.35} />
          {/* topknot tied with a little red band */}
          <path d={lockPath(60, 29, 55.6, 18.6, 6.4, -1.8)} fill={g('fringe')} />
          <path d={lockPath(60, 29, 63.8, 19.4, 5.6, 2)} fill={g('fringe')} />
          <path d="M60 25.6 L55.4 22.8 Q54.4 25.6 55.6 28 Z M60 25.6 L64.6 22.8 Q65.6 25.6 64.4 28 Z" fill="#c63a2e" />
          <circle cx="60" cy="25.7" r="1.5" fill="#a52c22" />
          {fringe.map((d, i) => <path key={i} d={d} fill={g('fringe')} />)}
          {hi && <path d={furStrokes(50, 34, 6, 3, 8, 6, 2.5, r, 0.2)} stroke="#b07a3c" strokeWidth="0.55" fill="none" opacity="0.6" />}
          {hi && <path d={furStrokes(70, 34, 6, 3, 8, 6, 0.65, r, 0.2)} stroke="#b07a3c" strokeWidth="0.55" fill="none" opacity="0.6" />}
          {/* cream muzzle, moustache and beard */}
          <ellipse cx="60" cy="54.5" rx="11.6" ry="9" fill={g('cream')} />
          {beard.map((d, i) => <path key={i} d={d} fill={g('cream')} />)}
          {hi && <path d={furStrokes(60, 66, 7, 4, 10, 4.5, 1.57, r, 0.15)} stroke="#cfa66c" strokeWidth="0.5" fill="none" opacity="0.6" />}
        </g>
        <Eye x={51.4} y={46} r={3.5} mood={mood} side={-1} />
        <Eye x={68.6} y={46} r={3.5} mood={mood} side={1} />
        {/* nose and mouth */}
        <path d="M55.8 53 C55.8 51 64.2 51 64.2 53 C64.2 55.6 61.6 57.6 60 57.6 C58.4 57.6 55.8 55.6 55.8 53 Z" fill="#1e1a22" />
        <ellipse cx="58.2" cy="52.5" rx="1.6" ry="0.85" fill="#fff" opacity="0.55" />
        <path d="M60 57.6 v2.2" stroke={INK} strokeWidth="0.9" strokeLinecap="round" />
        {mood === 'curious' ? (
          <ellipse cx="60" cy="61.4" rx="1.5" ry="1.4" fill="#5a2e2a" />
        ) : (
          <path d="M56 59.8 Q58 62.2 60 59.9 Q62 62.2 64 59.8" stroke={INK} strokeWidth="0.9" fill="none" strokeLinecap="round" />
        )}
        {mood === 'happy' && <path d="M58.3 61 Q60 66 61.7 61 Z" fill="#e8768a" />}
      </g>
      {wave && <g filter={wc(id, hi)} transform="rotate(132 49 82)">{legL}</g>}
    </g>
  )
}

// =================================================================== BONCHITA
/** Bonchita: small black scruffy dog with wiry spiky fur, grey-white muzzle, big eyes under bushy brows, red harness. */
export function BonchitaArt({ id, mood, hi, wave }: DogArtProps): ReactNode {
  const r = rng(23)
  const base = '#2d2c36'
  const rim = '#71748e'
  const tilt = mood === 'curious' ? 9 : mood === 'sleepy' ? -5 : 0
  const g = (k: string) => `url(#${id}-${k})`
  const head = spikyPath(60, 50, 23, 20.5, 34, 4.2, rng(5), -Math.PI / 2)
  const crown = spikyPath(60, 35, 12, 5.5, 12, 3.6, rng(15), -Math.PI)
  const body = spikyPath(60, 93, 21, 20, 30, 2.8, rng(8))
  const muzzle = spikyPath(60, 59.5, 12.6, 8.6, 14, 3.4, rng(9), 0.3)
  const legL = spikyPath(51.6, 99, 4.6, 11, 14, 1.8, rng(16), -Math.PI / 2)
  const legR = spikyPath(68.4, 99, 4.6, 11, 14, 1.8, rng(17), -Math.PI / 2)
  const earL = mood === 'sleepy' ? 'M43 37 L34 27.5 Q40 26.6 49 32 Z' : 'M42.6 35 L38.8 23.6 Q42.4 24.2 44.8 27 L45.8 25.6 Q48 29 49.6 31 Z'
  const earR = mood === 'curious' ? 'M77.4 35 L87 25 Q83.4 25 80.8 27.6 L79.8 26.2 Q75 29 70.4 31 Z' : mood === 'sleepy' ? 'M77 37 L86 27.5 Q80 26.6 71 32 Z' : 'M77.4 35 L81.2 23.6 Q77.6 24.2 75.2 27 L74.2 25.6 Q72 29 70.4 31 Z'
  return (
    <g>
      <defs>
        <Lit id={`${id}-coat`} base={base} light="#5d5e74" shade="#141319" cx={0.32} cy={0.26} />
        <clipPath id={`${id}-bc`}><path d={body} /></clipPath>
        <Lit id={`${id}-coatU`} base={base} light="#5d5e74" shade="#141319" cx={46} cy={80} r={40} user />
        <Lit id={`${id}-muz`} base="#bdb8b0" light="#f3efe8" shade="#7d7a78" cy={0.2} />
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#47485c" />
          <stop offset="0.45" stopColor={base} />
          <stop offset="1" stopColor="#1d1c24" />
        </linearGradient>
      </defs>
      <Ground w={30} />
      {/* tail: a short upright tuft */}
      <g filter={wc(id, hi)}>
        <path d="M77 99 C83 95 85 87 83.4 80.6 L86 83 L86.4 80.4 C89.6 85 90 92 87.6 96.6 C85.6 100.4 81.6 102 77 102 Z" fill={g('coat')} />
      </g>
      {/* body */}
      <g filter={wc(id, hi)}>
        <path d={body} fill={g('coatU')} />
        <ellipse cx="41.4" cy="110.6" rx="6.2" ry="3.4" fill={g('coat')} />
        <ellipse cx="78.6" cy="110.6" rx="6.2" ry="3.4" fill={g('coat')} />
        {hi && <path d={furStrokes(48, 92, 7, 9, 16, 5, 2.2, r, 0.5)} stroke={rim} strokeWidth="0.75" fill="none" opacity="0.6" />}
        {hi && <path d={furStrokes(74, 98, 6, 9, 10, 5, 1.1, r, 0.5)} stroke={rim} strokeWidth="0.6" fill="none" opacity="0.3" />}
        <CastShadow id={id} hi={hi} clip="bc" cy={77} rx={17} ry={5.4} o={0.5} color="#08070c" />
      </g>
      {/* front legs, feathered at the paws */}
      <g filter={wc(id, hi)}>
        {!wave && <path d={legL} fill={g('leg')} />}
        <path d={legR} fill={g('leg')} />
        {hi && <path d={furStrokes(51, 98, 2.5, 7, 6, 5, 1.7, r, 0.3) + furStrokes(68, 98, 2.5, 7, 4, 5, 1.5, r, 0.3)} stroke={rim} strokeWidth="0.6" fill="none" opacity="0.45" />}
        {!wave && <ellipse cx="51.8" cy="110.4" rx="5" ry="2.6" fill="#1d1c24" />}
        <ellipse cx="68.2" cy="110.4" rx="5" ry="2.6" fill="#1d1c24" />
      </g>
      {/* harness */}
      <g filter={wc(id, hi)}>
        <path d="M43.4 81.6 Q60 90.6 76.6 81.6" stroke="#d24438" strokeWidth="3.8" fill="none" strokeLinecap="round" />
        <path d="M44.6 80.4 Q60 88.8 75.4 80.4" stroke="#f38d78" strokeWidth="0.9" fill="none" opacity="0.7" strokeLinecap="round" />
        <circle cx="60" cy="87.6" r="2" fill="#e9b949" stroke="#9b7420" strokeWidth="0.6" />
      </g>
      {/* head */}
      <g transform={`rotate(${tilt} 60 54)`}>
        {/* small tufted ears */}
        <g filter={wc(id, hi)}>
          <path d={earL} fill={g('coat')} />
          <path d={earR} fill={g('coat')} />
        </g>
        <g filter={wc(id, hi)}>
          <path d={head} fill={g('coat')} />
          <Contour id={id} hi={hi} d={head} color={rim} o={0.25} />
          <path d={crown} fill={g('coat')} />
          {hi && <path d={furStrokes(60, 49, 19, 16, 36, 6, (x, y) => Math.atan2(y - 54, x - 60), r, 0.45)} stroke={rim} strokeWidth="0.6" fill="none" opacity="0.42" />}
          {hi && <path d={furStrokes(47, 38, 9, 6, 16, 5, -2.2, r, 0.4)} stroke="#a4a7c0" strokeWidth="0.7" fill="none" opacity="0.6" />}
        </g>
        {/* bushy grey brows */}
        <g filter={wc(id, hi)}>
          {mood === 'sleepy' ? (
            <path d="M43.5 42.6 Q50 39.6 56 42.4 M64 42.4 Q70 39.6 76.5 42.6" stroke="#a9a5a4" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          ) : (
            <>
              <path d={mood === 'curious' ? lockPath(56.5, 38.6, 41.6, 35.4, 4.6, 3.4) : lockPath(56.6, 40, 42, 39.6, 4.6, 3)} fill="#c3bfbb" />
              <path d={mood === 'curious' ? lockPath(63.4, 40.6, 77.6, 42.4, 4.2, -1.6) : lockPath(63.4, 40, 78, 39.6, 4.6, -3)} fill="#c3bfbb" />
              {hi && <path d={furStrokes(49.5, 38.4, 6, 1.6, 8, 4, -2.6, r)} stroke="#f2eee8" strokeWidth="0.55" fill="none" opacity="0.85" />}
            </>
          )}
        </g>
        <Eye x={50} y={47.8} r={5} mood={mood} side={-1} iris="#7a4a28" lid="rgba(150,140,150,0.28)" />
        <Eye x={70} y={47.8} r={5} mood={mood} side={1} iris="#7a4a28" lid="rgba(150,140,150,0.28)" />
        {/* grey-white muzzle beard */}
        <g filter={wc(id, hi)}>
          <path d={muzzle} fill={g('muz')} />
          {hi && <path d={furStrokes(60, 62, 9, 5, 20, 4.5, 1.57, r, 0.3)} stroke="#8b8784" strokeWidth="0.55" fill="none" opacity="0.65" />}
        </g>
        <path d="M56.4 54.8 C56.4 53 63.6 53 63.6 54.8 C63.6 57.2 61.4 58.8 60 58.8 C58.6 58.8 56.4 57.2 56.4 54.8 Z" fill="#141217" />
        <ellipse cx="58.4" cy="54.5" rx="1.3" ry="0.75" fill="#fff" opacity="0.6" />
        {mood === 'happy' ? (
          <g>
            <path d="M54.6 60.6 Q60 67.6 65.4 60.6 Q60 62.4 54.6 60.6 Z" fill="#3a1d22" />
            <path d="M57.4 62.2 Q60 68 62.6 62.2 Q60 63 57.4 62.2 Z" fill="#ec7489" />
            <path d="M56.4 61 l1 1.6 l0.9 -1.2 M63.6 61 l-1 1.6 l-0.9 -1.2" stroke="#fffaf0" strokeWidth="0.7" fill="none" strokeLinejoin="round" />
          </g>
        ) : mood === 'curious' ? (
          <path d="M57 62 Q60 60.4 63 62" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M56 61.2 Q60 63.4 64 61.2" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
        )}
      </g>
      {wave && <g filter={wc(id, hi)} transform="rotate(132 50 86)"><path d={legL} fill={g('leg')} /><ellipse cx="51.8" cy="110.4" rx="5" ry="2.6" fill="#1d1c24" /></g>}
    </g>
  )
}

// ======================================================================= LUNA
/** Luna: cream curly powder-puff (bichon/poodle), round head, dark button eyes, blue collar and tag; she carries the map. */
export function LunaArt({ id, mood, hi, wave }: DogArtProps): ReactNode {
  const r = rng(37)
  const base = '#f0e3cb'
  const light = '#fffaf0'
  const shade = '#c9ad86'
  const sepia = '#9a7a52'
  const tilt = mood === 'curious' ? -9 : mood === 'sleepy' ? 6 : 0
  const g = (k: string) => `url(#${id}-${k})`
  const head = fluffPath(60, 45.5, 23.5, 21.5, 19, 3.4, rng(3), -Math.PI / 2)
  const top = fluffPath(60, 26.5, 11, 6.2, 9, 2.4, rng(4), 0)
  const body = fluffPath(60, 94, 23, 18, 18, 3.2, rng(6))
  const earL = fluffPath(37.5, 57, 8.6, 14.5, 12, 2.6, rng(7))
  const earR = fluffPath(82.5, 57, 8.6, 14.5, 12, 2.6, rng(8))
  const legL = fluffPath(51.2, 100, 6, 11, 10, 1.8, rng(9))
  const legR = fluffPath(68.8, 100, 6, 11, 10, 1.8, rng(10))
  const curl = darken(shade, 0.1)
  const earTf = (side: 'l' | 'r') => (mood === 'curious' && side === 'l' ? 'rotate(16 38 44)' : mood === 'sleepy' ? `rotate(${side === 'l' ? 5 : -5} ${side === 'l' ? 38 : 82} 44)` : undefined)
  return (
    <g>
      <defs>
        <Lit id={`${id}-coat`} base={base} light={light} shade={shade} />
        <clipPath id={`${id}-bc`}><path d={body} /></clipPath>
        <Lit id={`${id}-face`} base="#f6ecda" light={light} shade="#dcc6a2" cy={0.25} />
        <linearGradient id={`${id}-map`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8eed3" />
          <stop offset="1" stopColor="#e0c993" />
        </linearGradient>
      </defs>
      <Ground w={33} />
      {/* fluffy tail */}
      <g filter={wc(id, hi)}>
        <path d={fluffPath(85, 86, 7.5, 7, 9, 2.4, rng(12))} fill={g('coat')} />
      </g>
      {/* body */}
      <g filter={wc(id, hi)}>
        <path d={body} fill={g('coat')} />
        <path d={fluffPath(39, 109.5, 7, 4, 8, 1.6, rng(13))} fill={g('coat')} />
        <path d={fluffPath(81, 109.5, 7, 4, 8, 1.6, rng(14))} fill={g('coat')} />
        {hi && <path d={curlStrokes(60, 95, 20, 14, 34, 2.2, r)} stroke={curl} strokeWidth="0.7" fill="none" opacity="0.5" strokeLinecap="round" />}
        <CastShadow id={id} hi={hi} clip="bc" cy={76} rx={18} ry={6} o={0.3} color="#8a6a40" />
        <Contour id={id} hi={hi} d={body} color={sepia} o={0.4} />
      </g>
      {/* the map: folded, tucked under the collar */}
      <g filter={wc(id, hi)} transform="rotate(-18 76 78)">
        <path d="M66 68 L86 68 L86.6 89 L66.4 89 Z" fill={g('map')} />
        <path d="M72.8 68 V89 M79.6 68 V89" stroke="#c4a76c" strokeWidth="0.7" />
        <path d="M68 85 Q72 78 76 81 T84.6 72" stroke="#d9473b" strokeWidth="1.1" fill="none" strokeDasharray="1.8 1.4" />
        <path d="M66.6 76 Q72 76.6 75 73 T86 75" stroke="#5f8fd6" strokeWidth="1" fill="none" opacity="0.85" />
        <path d="M83.4 70.6 l2.4 2.4 M85.8 70.6 l-2.4 2.4" stroke="#d9473b" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M66 68 L86 68 L86.6 89 L66.4 89 Z" fill="none" stroke="#a88a52" strokeWidth="0.6" />
      </g>
      {/* front legs */}
      <g filter={wc(id, hi)}>
        {!wave && <path d={legL} fill={g('coat')} />}
        <path d={legR} fill={g('coat')} />
        {hi && <path d={curlStrokes(60, 101, 13, 7, 12, 1.9, r)} stroke={curl} strokeWidth="0.65" fill="none" opacity="0.45" strokeLinecap="round" />}
      </g>
      {/* head */}
      <g transform={`rotate(${tilt} 60 52)`}>
        <g filter={wc(id, hi)}>
          <g transform={earTf('l')}>
            <path d={earL} fill={g('coat')} />
            {hi && <path d={curlStrokes(37.5, 58, 6, 11, 10, 2, r)} stroke={curl} strokeWidth="0.7" fill="none" opacity="0.5" strokeLinecap="round" />}
          </g>
          <g transform={earTf('r')}>
            <path d={earR} fill={g('coat')} />
            {hi && <path d={curlStrokes(82.5, 58, 6, 11, 10, 2, r)} stroke={curl} strokeWidth="0.7" fill="none" opacity="0.5" strokeLinecap="round" />}
          </g>
          <g transform={earTf('l')}><Contour id={id} hi={hi} d={earL} color={sepia} o={0.35} /></g>
          <g transform={earTf('r')}><Contour id={id} hi={hi} d={earR} color={sepia} o={0.35} /></g>
        </g>
        <g filter={wc(id, hi)}>
          <path d={head} fill={g('coat')} />
          <Contour id={id} hi={hi} d={head} color={sepia} o={0.35} />
          <path d={top} fill={g('face')} />
          {hi && <path d={curlStrokes(60, 36, 19, 12, 30, 2.2, r)} stroke={curl} strokeWidth="0.7" fill="none" opacity="0.45" strokeLinecap="round" />}
          <path d={fluffPath(60, 56.5, 9.6, 7.2, 10, 1.6, rng(15))} fill={g('face')} />
        </g>
        <Eye x={51} y={48.4} r={4.3} mood={mood} side={-1} iris="#3a2a2a" lid="rgba(140,95,50,0.2)" />
        <Eye x={69} y={48.4} r={4.3} mood={mood} side={1} iris="#3a2a2a" lid="rgba(140,95,50,0.2)" />
        <path d="M56.2 54 C56.2 52.2 63.8 52.2 63.8 54 C63.8 56.6 61.4 58.2 60 58.2 C58.6 58.2 56.2 56.6 56.2 54 Z" fill="#1d181d" />
        <ellipse cx="58.4" cy="53.7" rx="1.4" ry="0.8" fill="#fff" opacity="0.6" />
        <path d="M60 58.2 v1.8" stroke={INK} strokeWidth="0.9" strokeLinecap="round" />
        {mood === 'curious' ? (
          <ellipse cx="60" cy="61.4" rx="1.3" ry="1.2" fill="#5a2e2a" />
        ) : (
          <path d="M56.6 60 Q58.4 62 60 60.2 Q61.6 62 63.4 60" stroke={INK} strokeWidth="0.9" fill="none" strokeLinecap="round" />
        )}
        {mood === 'happy' && <path d="M58.5 61 Q60 64.8 61.5 61 Z" fill="#e8768a" />}
        {/* cheeks */}
        {mood !== 'sleepy' && <><ellipse cx="46.6" cy="55.4" rx="3" ry="1.8" fill="#f19a8e" opacity="0.4" /><ellipse cx="73.4" cy="55.4" rx="3" ry="1.8" fill="#f19a8e" opacity="0.4" /></>}
      </g>
      {/* blue collar and gold tag */}
      <g filter={wc(id, hi)}>
        <path d="M43.4 70.6 Q60 78.4 76.6 70.6" stroke="#3460c9" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <path d="M44.6 69.6 Q60 76.6 75.4 69.6" stroke="#8fb0f5" strokeWidth="0.9" fill="none" opacity="0.7" strokeLinecap="round" />
        <circle cx="60" cy="79.2" r="2.9" fill="#e9a92e" />
        <circle cx="59" cy="78.3" r="0.9" fill="#fff4cf" />
      </g>
      {wave && <g filter={wc(id, hi)} transform="rotate(150 46 84)"><path d={legL} fill={g('coat')} /><Contour id={id} hi={hi} d={legL} color={sepia} o={0.5} />{!hi && <path d={legL} fill="none" stroke={sepia} strokeWidth="0.8" opacity="0.5" />}</g>}
    </g>
  )
}
