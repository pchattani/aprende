/**
 * Leo, Bonchita and Luna, drawn from photos of the real dogs, in the painted "airmail" style:
 * an inked outline over a gouache fill, light from the top left, fur texture strokes.
 * Each is an SVG <g> in a 120×120 box with the ground at y≈113.
 *  - Leo: small shaggy Yorkie/Shih-Tzu mix, honey-tan, long silky ears with caramel tips, a fringe
 *    over his eyes, cream beard, big glossy black nose, tongue tip out, dark red harness, blue tag.
 *  - Bonchita: low, compact, wiry charcoal terrier with grey frosting, wild tufts on top, tiny
 *    ears, a wide open grin with an underbite, pink-red harness.
 *  - Luna: tall, leggy cream-apricot cavapoo standing in three-quarter view, curly coat, long
 *    wavy ears, big round dark eyes, blue collar.
 * At `hi` detail (64px and up) the watercolour filter and the full fur texture are on; smaller
 * dogs keep the same shapes, outline and a few strokes so they stay recognisable at 32px.
 */
import type { ReactNode } from 'react'
import { Lit } from './paint'
import { rng, furStrokes, curlStrokes, fluffPath, spikyPath, lockPath, shagPath, mirrorX } from './brush'

import { HEAD_TILT, HEAD_PIVOT, type Mood } from './dogPose'

export type { Mood }
export interface DogArtProps {
  /** Unique id prefix for gradients and filters (see useArtId). */
  id: string
  mood: Mood
  /** Full painterly detail (filters, fur, texture) — use at 64px and up. */
  hi: boolean
  /** Raise a front paw (waving). */
  wave?: boolean
}

const wc = (id: string, hi: boolean) => (hi ? `url(#${id}-wc)` : undefined)
const PI = Math.PI

/** The ink outline drawn over a painted shape. */
function Ink({ d, c, hi, w = 1.15, o = 0.9 }: { d: string; c: string; hi: boolean; w?: number; o?: number }) {
  return <path d={d} fill="none" stroke={c} strokeWidth={hi ? w : w * 1.35} opacity={o} strokeLinejoin="round" strokeLinecap="round" />
}
/** A painted shape with its ink outline. */
function Inked({ d, fill, ink, hi, w, o }: { d: string; fill: string; ink: string; hi: boolean; w?: number; o?: number }) {
  return (
    <>
      <path d={d} fill={fill} />
      <Ink d={d} c={ink} hi={hi} w={w} o={o} />
    </>
  )
}
/** Fur texture: the full set at hi detail, a third of it (a little bolder) when small. */
function Fur({ d, c, hi, w = 0.6, o = 0.5 }: { d: string; c: string; hi: boolean; w?: number; o?: number }) {
  return <path d={d} stroke={c} strokeWidth={hi ? w : w * 1.6} fill="none" opacity={hi ? o : o * 0.8} strokeLinecap="round" />
}
const n = (hi: boolean, k: number) => (hi ? k : Math.max(2, Math.round(k / 3)))

function Ground({ w = 34, cx = 60 }: { w?: number; cx?: number }) {
  return <ellipse cx={cx} cy="113.5" rx={w} ry="4.2" fill="#3a2c2a" opacity="0.17" />
}
/** Two catchlights in a dark eye. */
function Glints({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      <circle cx={x - r * 0.34} cy={y - r * 0.36} r={r * 0.34} fill="#fffaf0" />
      <circle cx={x + r * 0.38} cy={y + r * 0.3} r={r * 0.14} fill="#fffaf0" opacity="0.85" />
    </>
  )
}

// ======================================================================== LEO
const LEO_HAUNCH = 'M28.5 102 C28.5 95 33 92 39 92 C45 92 49.5 96 49.5 102 C49.5 108 45 111.5 39 111.5 C33 111.5 28.5 108 28.5 102 Z'
/** Leo: honey-tan shaggy Yorkie/Shih-Tzu mix, sitting. */
export function LeoArt({ id, mood, hi, wave }: DogArtProps): ReactNode {
  const r = rng(11)
  const ink = '#4a2c18'
  const shade = '#9a6636'
  const g = (k: string) => `url(#${id}-${k})`
  const [px, py] = HEAD_PIVOT.leo
  const body = shagPath(60, 91, 21, 19.5, 24, 3.4, rng(3), 0.55)
  const bib = shagPath(60, 84, 10, 10.5, 12, 3.2, rng(4), 0.85)
  const legL = 'M46.6 86 C45.8 95 45.8 103 46.4 110.4 L56 110.4 C56.4 103 56.8 95 56.2 86 Z'
  const legR = mirrorX(legL)
  const head = 'M40 45 C40 32 49 24.5 60 24.5 C71 24.5 80 32 80 45 C80 56 71 63.5 60 63.5 C49 63.5 40 56 40 45 Z'
  const earL = ['M49 31 C41 30.5 35 37 33.4 47 C31.8 57 31.2 66 32.4 74 L35 71 L36.6 77.6 L39.4 72.4 L42 78.6 L44 72.4 L46.4 76 C46.6 66 47.4 54 49.6 43 Z', lockPath(45, 40, 36.4, 73, 6, -2.4), lockPath(47, 42, 42.6, 76, 5, -1)]
  const earR = earL.map((d) => mirrorX(d))
  const skirt = [45.5, 49.5, 53.5, 57.5, 62.5, 66.5, 70.5, 74.5].map((x) => lockPath(x, 80, x + (x - 60) * 0.14, 95.5 + r() * 3.5, 5.6, (x - 60) * 0.05))
  const fringe = [lockPath(58, 25.5, 43, 40, 11, -2.6), lockPath(58.6, 26.5, 49, 45.2, 9.4, -1.4), lockPath(59.6, 27.5, 55.4, 45.6, 7, -0.5)]
  const fringeAll = [...fringe, ...fringe.map((d) => mirrorX(d))]
  const muzzle = shagPath(60, 57, 12.8, 8.4, 12, 2.4, rng(7), 0.9)
  const beard = [lockPath(53.5, 62, 50.5, 72, 8.5, -1.4), lockPath(66.5, 62, 69.5, 72, 8.5, 1.4), lockPath(60, 63, 60, 75, 10, 0), lockPath(49.5, 58.5, 44.6, 67, 7, -1.4), lockPath(70.5, 58.5, 75.4, 67, 7, 1.4)]
  const stache = [lockPath(57, 55, 46.4, 57.8, 5, 1.4), lockPath(63, 55, 73.6, 57.8, 5, -1.4)]
  const tail = ['M43 100 C33 100.6 25 95 22 86 C20 79 21.4 72.4 25.6 68.4 C25.4 74 26.6 78 29.6 80.4 C29 74.6 30.6 70.6 34 69 C33 76 35.4 83.4 42 88.6 Z', lockPath(27, 72, 20, 62, 5, -2.5), lockPath(31, 73, 28.6, 62.6, 4.2, -1.6)]
  const paw = (x: number) => <ellipse cx={x} cy="110.6" rx="6.2" ry="3.3" fill={g('cream')} stroke={ink} strokeWidth={hi ? 0.9 : 1.2} opacity="0.95" />
  const leftLeg = (
    <g>
      <Inked d={legL} fill={g('leg')} ink={ink} hi={hi} />
      {paw(51.2)}
    </g>
  )
  return (
    <g>
      <defs>
        <Lit id={`${id}-coat`} base="#cf9f62" light="#f2d8a4" shade={shade} />
        <Lit id={`${id}-coatU`} base="#cf9f62" light="#f2d8a4" shade={shade} cx={46} cy={78} r={42} user />
        <Lit id={`${id}-cream`} base="#f3e7cf" light="#fffaf0" shade="#d6bd94" />
        <Lit id={`${id}-fringe`} base="#e2b676" light="#fbe6bc" shade="#b5803f" cy={0.15} />
        <linearGradient id={`${id}-ear`} x1="0" y1="0" x2="0.1" y2="1">
          <stop offset="0" stopColor="#d8a868" />
          <stop offset="0.55" stopColor="#bb8343" />
          <stop offset="1" stopColor="#8a4f22" />
        </linearGradient>
        <linearGradient id={`${id}-tail`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#c99556" />
          <stop offset="1" stopColor="#8e5428" />
        </linearGradient>
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#efd1a0" />
          <stop offset="0.5" stopColor="#d9ad72" />
          <stop offset="1" stopColor="#b07a42" />
        </linearGradient>
      </defs>
      <Ground w={35} />
      {/* feathery plume tail, curling up behind on the left */}
      <g filter={wc(id, hi)}>
        {tail.map((d, i) => <Inked key={i} d={d} fill={g('tail')} ink={ink} hi={hi} w={0.9} />)}
        <Fur d={furStrokes(28, 80, 6, 9, n(hi, 12), 6, -2.2, r, 0.3)} c="#6e3c18" hi={hi} />
      </g>
      {/* haunches and hind feet */}
      <g filter={wc(id, hi)}>
        <Inked d={LEO_HAUNCH} fill={g('coat')} ink={ink} hi={hi} />
        <Inked d={mirrorX(LEO_HAUNCH)} fill={g('coat')} ink={ink} hi={hi} />
        <ellipse cx="32" cy="110.8" rx="5" ry="2.6" fill={g('coat')} stroke={ink} strokeWidth="0.9" />
        <ellipse cx="88" cy="110.8" rx="5" ry="2.6" fill={g('coat')} stroke={ink} strokeWidth="0.9" />
      </g>
      {/* body, front legs, the shaggy chest skirt and cream bib */}
      <g filter={wc(id, hi)}>
        <Inked d={body} fill={g('coatU')} ink={ink} hi={hi} />
        <Fur d={furStrokes(60, 96, 17, 12, n(hi, 26), 7, PI / 2, r, 0.25)} c={shade} hi={hi} />
        {!wave && leftLeg}
        <Inked d={legR} fill={g('leg')} ink={ink} hi={hi} />
        {paw(68.8)}
        <Fur d={furStrokes(51, 98, 3, 8, n(hi, 6), 5, PI / 2, r, 0.2) + furStrokes(69, 98, 3, 8, n(hi, 6), 5, PI / 2, r, 0.2)} c={shade} hi={hi} />
        {skirt.map((d, i) => <path key={i} d={d} fill={g('coat')} />)}
        <Inked d={bib} fill={g('cream')} ink="#a88456" hi={hi} w={0.7} o={0.5} />
        <Fur d={furStrokes(60, 86, 7, 7, n(hi, 12), 5.5, PI / 2, r, 0.25)} c="#c9a676" hi={hi} />
      </g>
      {/* dark red harness with a ring and the round blue tag */}
      <g filter={wc(id, hi)}>
        <path d="M41.5 78.6 Q60 89 78.5 78.6" stroke={ink} strokeWidth="6.6" fill="none" strokeLinecap="round" />
        <path d="M41.5 78.6 Q60 89 78.5 78.6" stroke="#8a2430" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M42.5 77.6 Q60 87.2 77.5 77.6" stroke="#c0505a" strokeWidth="1" fill="none" strokeDasharray="1.6 1.4" opacity="0.8" />
        <circle cx="60" cy="85.6" r="1.9" fill="none" stroke="#c8ccd2" strokeWidth="1.2" />
        <ellipse cx="60" cy="92.4" rx="3.9" ry="4.7" fill="#4f8fe0" stroke={ink} strokeWidth="0.9" />
        <ellipse cx="60" cy="92.6" rx="2.1" ry="2.7" fill="#eef3f8" />
      </g>
      {/* head */}
      <g transform={`rotate(${HEAD_TILT.leo[mood]} ${px} ${py})`}>
        {/* long silky ears, caramel at the tips, hanging past the jaw */}
        <g filter={wc(id, hi)}>
          <g transform={mood === 'curious' ? 'rotate(-10 45 32)' : undefined}>
            {earL.map((d, i) => <Inked key={i} d={d} fill={g('ear')} ink={ink} hi={hi} w={0.9} />)}
            <Fur d={furStrokes(39, 55, 4.5, 13, n(hi, 16), 8, 1.72, r, 0.15)} c="#6e3c18" hi={hi} />
          </g>
          {earR.map((d, i) => <Inked key={i} d={d} fill={g('ear')} ink={ink} hi={hi} w={0.9} />)}
          <Fur d={furStrokes(81, 55, 4.5, 13, n(hi, 16), 8, 1.42, r, 0.15)} c="#6e3c18" hi={hi} />
        </g>
        <g filter={wc(id, hi)}>
          <Inked d={head} fill={g('coat')} ink={ink} hi={hi} />
          <path d={lockPath(45, 49, 41.5, 62, 7, -1)} fill={g('coat')} />
          <path d={lockPath(75, 49, 78.5, 62, 7, 1)} fill={g('coat')} />
        </g>
        {/* eyes: small dark crescents peeking under the fringe */}
        {mood === 'sleepy' ? (
          <path d="M47.4 47 Q51.2 49.6 55 47 M65 47 Q68.8 49.6 72.6 47" stroke="#1d1416" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        ) : mood === 'curious' ? (
          <>
            <ellipse cx="51.2" cy="46.4" rx="3.2" ry="3.2" fill="#1d1416" />
            <ellipse cx="68.8" cy="46.4" rx="3.2" ry="3.2" fill="#1d1416" />
            <Glints x={51.4} y={46.4} r={3} />
            <Glints x={69} y={46.4} r={3} />
          </>
        ) : (
          <>
            <path d="M47.4 45.6 A3.8 3.2 0 0 0 55 45.6 Z" fill="#1d1416" />
            <path d="M65 45.6 A3.8 3.2 0 0 0 72.6 45.6 Z" fill="#1d1416" />
            <circle cx="50.2" cy="46.6" r="0.75" fill="#fffaf0" />
            <circle cx="67.8" cy="46.6" r="0.75" fill="#fffaf0" />
          </>
        )}
        {/* the fringe from a centre parting, half over the eyes */}
        <g filter={wc(id, hi)}>
          {fringeAll.map((d, i) => <Inked key={i} d={mood === 'curious' && i % 3 === 1 ? lockPath(i < 3 ? 58.4 : 61.6, 26.5, i < 3 ? 47 : 73, 42, 8, i < 3 ? -1.4 : 1.4) : d} fill={g('fringe')} ink={ink} hi={hi} w={0.7} o={0.7} />)}
          <Fur d={furStrokes(52, 34, 6, 4, n(hi, 9), 6, 2.5, r, 0.2) + furStrokes(68, 34, 6, 4, n(hi, 9), 6, 0.65, r, 0.2)} c="#a8723a" hi={hi} />
        </g>
        {/* cream beard and moustache */}
        <g filter={wc(id, hi)}>
          {beard.map((d, i) => <Inked key={i} d={d} fill={g('cream')} ink="#b8946a" hi={hi} w={0.6} o={0.6} />)}
          <Inked d={muzzle} fill={g('cream')} ink="#a88456" hi={hi} w={0.7} o={0.55} />
          {stache.map((d, i) => <path key={i} d={d} fill={g('cream')} />)}
          <Fur d={furStrokes(60, 64, 8, 6, n(hi, 14), 5, PI / 2, r, 0.2)} c="#c4a27a" hi={hi} />
        </g>
        {/* big glossy black nose, tongue tip */}
        <path d="M53.6 51 C53.6 48.2 66.4 48.2 66.4 51 C66.4 54.6 62.6 57 60 57 C57.4 57 53.6 54.6 53.6 51 Z" fill="#1a1416" />
        <ellipse cx="57.4" cy="50.3" rx="2.2" ry="1.05" fill="#fff" opacity="0.6" />
        <path d="M57.6 54.4 Q58.6 55 59.2 54.2 M60.8 54.2 Q61.4 55 62.4 54.4" stroke="#4a3a40" strokeWidth="0.6" fill="none" />
        {mood === 'curious' ? (
          <ellipse cx="60" cy="60.6" rx="1.3" ry="1.2" fill="#4a1e22" />
        ) : (
          <>
            <path d="M56.4 59.6 Q60 61.2 63.6 59.6" stroke="#3a1e1a" strokeWidth="0.9" fill="none" strokeLinecap="round" />
            <path d="M58.3 60.3 Q60 64.6 61.7 60.3 Z" fill="#ec7f93" stroke="#a8404e" strokeWidth="0.5" />
          </>
        )}
      </g>
      {wave && <g filter={wc(id, hi)} transform="rotate(140 51 87)">{leftLeg}</g>}
    </g>
  )
}

// =================================================================== BONCHITA
/** Bonchita: low, compact, wiry charcoal terrier with grey frosting and a cheeky grin. */
export function BonchitaArt({ id, mood, hi, wave }: DogArtProps): ReactNode {
  const r = rng(23)
  const ink = '#0e0c12'
  const frost = '#aaa7aa'
  const g = (k: string) => `url(#${id}-${k})`
  const [px, py] = HEAD_PIVOT.bonchita
  const head = spikyPath(60, 56, 25, 19.5, 44, 3.6, rng(5), -PI / 2)
  const cheeks = [lockPath(40, 54, 30.5, 66, 8, -1.5), lockPath(41, 60, 33.5, 71, 7, -1), lockPath(80, 54, 89.5, 66, 8, 1.5), lockPath(79, 60, 86.5, 71, 7, 1)]
  const body = spikyPath(60, 96.5, 25.5, 15, 34, 3.4, rng(8))
  const muzzle = spikyPath(60, 66.5, 14.5, 9.5, 22, 3.2, rng(9), 0.3)
  const legL = spikyPath(51, 104, 5, 7.5, 12, 1.8, rng(16), -PI / 2)
  const legR = spikyPath(69, 104, 5, 7.5, 12, 1.8, rng(17), -PI / 2)
  const wisps = [lockPath(56, 41, 50, 24, 4.2, -3), lockPath(61, 39.5, 63.5, 21, 3.4, 2), lockPath(66, 41, 75, 27.5, 4, 3), lockPath(52, 42, 43, 33, 3.6, -2), lockPath(69, 42, 79, 35, 3.4, 1.6)]
  const earL = spikyPath(mood === 'curious' ? 39.5 : 41, mood === 'curious' ? 37 : 38.5, 5, 4.4, 9, 1.6, rng(31))
  const earR = spikyPath(79, 38.5, 5, 4.4, 9, 1.6, rng(32))
  const beard = [lockPath(52, 72, 48.5, 83, 6, -1), lockPath(68, 72, 71.5, 83, 6, 1), lockPath(60, 74, 60, 86, 7.4, 0), lockPath(47, 69, 42, 78, 5, -1), lockPath(73, 69, 78, 78, 5, 1)]
  const browL = mood === 'curious' ? lockPath(57, 46, 42, 42, 5.4, 2.8) : lockPath(57, 47, 42.5, 45.6, 5.4, 2.6)
  const browR = lockPath(63, 47, 77.5, 45.6, 5.4, -2.6)
  const left = (
    <g>
      <Inked d={legL} fill={g('leg')} ink={ink} hi={hi} w={0.9} />
      <ellipse cx="51" cy="111" rx="5.2" ry="2.6" fill="#3a3842" stroke={ink} strokeWidth="0.8" />
    </g>
  )
  return (
    <g>
      <defs>
        <Lit id={`${id}-coat`} base="#302e36" light="#5e5d70" shade="#131117" cx={0.32} cy={0.26} />
        <Lit id={`${id}-coatU`} base="#302e36" light="#5e5d70" shade="#131117" cx={44} cy={86} r={36} user />
        <Lit id={`${id}-muz`} base="#9a979b" light="#e6e2dc" shade="#5e5c62" cy={0.2} />
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4c4b5e" />
          <stop offset="0.5" stopColor="#2c2a32" />
          <stop offset="1" stopColor="#18161c" />
        </linearGradient>
        <linearGradient id={`${id}-wisp`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2c2a32" />
          <stop offset="1" stopColor="#8a8890" />
        </linearGradient>
      </defs>
      <Ground w={33} />
      {/* short upright tail tuft */}
      <g filter={wc(id, hi)}>
        <Inked d={lockPath(83, 97, 90.5, 79, 7, 2.5)} fill={g('wisp')} ink={ink} hi={hi} w={0.9} />
      </g>
      {/* compact body, hind feet, short front legs */}
      <g filter={wc(id, hi)}>
        <ellipse cx="38" cy="110.8" rx="6.4" ry="3" fill="#2c2a32" stroke={ink} strokeWidth="0.9" />
        <ellipse cx="82" cy="110.8" rx="6.4" ry="3" fill="#2c2a32" stroke={ink} strokeWidth="0.9" />
        <Inked d={body} fill={g('coatU')} ink={ink} hi={hi} />
        <Fur d={furStrokes(60, 97, 20, 11, n(hi, 30), 6, (x) => PI / 2 + (x - 60) * 0.025, r, 0.4)} c={frost} hi={hi} w={0.6} o={0.55} />
        {!wave && left}
        <Inked d={legR} fill={g('leg')} ink={ink} hi={hi} w={0.9} />
        <ellipse cx="69" cy="111" rx="5.2" ry="2.6" fill="#3a3842" stroke={ink} strokeWidth="0.8" />
        <Fur d={furStrokes(51, 102, 3, 6, n(hi, 6), 4.5, PI / 2, r, 0.3) + furStrokes(69, 102, 3, 6, n(hi, 6), 4.5, PI / 2, r, 0.3)} c={frost} hi={hi} o={0.5} />
      </g>
      {/* pink-red harness */}
      <g filter={wc(id, hi)}>
        <path d="M37.6 86.4 Q60 97.6 82.4 86.4" stroke={ink} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M37.6 86.4 Q60 97.6 82.4 86.4" stroke="#d9506a" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M39 85.2 Q60 95.6 81 85.2" stroke="#f7a0b4" strokeWidth="1" fill="none" opacity="0.8" strokeLinecap="round" />
        <circle cx="60" cy="92.6" r="1.9" fill="none" stroke="#c8ccd2" strokeWidth="1.2" />
      </g>
      {/* head */}
      <g transform={`rotate(${HEAD_TILT.bonchita[mood]} ${px} ${py})`}>
        <g filter={wc(id, hi)}>
          {/* tiny ears, half hidden in the fur */}
          <Inked d={earL} fill={g('coat')} ink={ink} hi={hi} w={0.8} />
          <Inked d={earR} fill={g('coat')} ink={ink} hi={hi} w={0.8} />
          {/* wild wisps sticking up */}
          {wisps.map((d, i) => <Inked key={i} d={d} fill={g('wisp')} ink={ink} hi={hi} w={0.7} />)}
          {cheeks.map((d, i) => <Inked key={i} d={d} fill={g('coat')} ink={ink} hi={hi} w={0.7} />)}
          <Inked d={head} fill={g('coat')} ink={ink} hi={hi} />
          <Fur d={furStrokes(60, 54, 21, 16, n(hi, 40), 6, (x, y) => Math.atan2(y - 60, x - 60), r, 0.45)} c={frost} hi={hi} w={0.6} o={0.5} />
          <Fur d={furStrokes(50, 42, 9, 4, n(hi, 12), 5, -2.2, r, 0.4)} c="#d0ccc8" hi={hi} w={0.6} o={0.6} />
        </g>
        {/* eyes under bushy grey brows */}
        {mood === 'sleepy' ? (
          <path d="M46.6 53 Q50.5 55.6 54.4 53 M65.6 53 Q69.5 55.6 73.4 53" stroke="#0a090c" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        ) : (
          <>
            <circle cx="50.5" cy="52.4" r="4.4" fill="#4a3a36" opacity="0.6" />
            <circle cx="69.5" cy="52.4" r="4.4" fill="#4a3a36" opacity="0.6" />
            <circle cx={mood === 'curious' ? 51 : 50.5} cy="52.4" r="3.6" fill="#0d0b0e" />
            <circle cx={mood === 'curious' ? 70 : 69.5} cy="52.4" r="3.6" fill="#0d0b0e" />
            <Glints x={mood === 'curious' ? 51 : 50.5} y={52.4} r={3.4} />
            <Glints x={mood === 'curious' ? 70 : 69.5} y={52.4} r={3.4} />
          </>
        )}
        <g filter={wc(id, hi)}>
          <Inked d={browL} fill="#9c999c" ink={ink} hi={hi} w={0.6} o={0.6} />
          <Inked d={browR} fill="#9c999c" ink={ink} hi={hi} w={0.6} o={0.6} />
        </g>
        {/* grey-frosted muzzle and beard */}
        <g filter={wc(id, hi)}>
          {beard.map((d, i) => <Inked key={i} d={d} fill={g('muz')} ink={ink} hi={hi} w={0.6} o={0.55} />)}
          <Inked d={muzzle} fill={g('muz')} ink={ink} hi={hi} w={0.7} o={0.6} />
          <Fur d={furStrokes(60, 70, 11, 7, n(hi, 22), 4.5, PI / 2, r, 0.3)} c="#58565c" hi={hi} o={0.55} />
        </g>
        <path d="M54.6 58.8 C54.6 55.8 65.4 55.8 65.4 58.8 C65.4 62.2 62.4 63.8 60 63.8 C57.6 63.8 54.6 62.2 54.6 58.8 Z" fill="#0f0d11" />
        <ellipse cx="57.8" cy="58" rx="2" ry="1" fill="#fff" opacity="0.6" />
        {mood === 'happy' ? (
          <g>
            {/* wide open grin, tongue out, lower canines showing (underbite) */}
            <path d="M48.4 64.8 Q60 84.5 71.6 64.8 Q60 68.6 48.4 64.8 Z" fill="#3a1520" stroke={ink} strokeWidth="0.8" />
            <path d="M53.2 70.4 Q60 83.4 66.8 70.4 Q60 73 53.2 70.4 Z" fill="#ea7590" />
            <path d="M60 72.6 V79" stroke="#b84a62" strokeWidth="0.7" />
            <path d="M51.2 69.2 L52.4 65.8 L53.8 69 Z M66.2 69 L67.6 65.8 L68.8 69.2 Z" fill="#fffaf0" />
          </g>
        ) : mood === 'curious' ? (
          <g>
            <path d="M52.6 67 Q60 70.4 67.4 66" stroke="#141016" strokeWidth="1.1" fill="none" strokeLinecap="round" />
            <path d="M62.4 68.2 Q64.6 73 66.8 67.4 Z" fill="#ea7590" stroke="#b84a62" strokeWidth="0.5" />
          </g>
        ) : (
          <path d="M54 67.6 Q60 69.6 66 67.6" stroke="#141016" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        )}
      </g>
      {wave && <g filter={wc(id, hi)} transform="rotate(135 51 98)">{left}</g>}
    </g>
  )
}

// ======================================================================= LUNA
/** Luna: tall, leggy cream-apricot cavapoo, standing in three-quarter view and looking at you. */
export function LunaArt({ id, mood, hi, wave }: DogArtProps): ReactNode {
  const r = rng(37)
  const ink = '#7a5532'
  const curl = '#b88a58'
  const g = (k: string) => `url(#${id}-${k})`
  const [px, py] = HEAD_PIVOT.luna
  const body = fluffPath(43, 63.5, 28, 14, 20, 2.4, rng(6))
  const chest = fluffPath(67, 64, 12, 10, 12, 2, rng(5))
  const backFar = 'M23.6 67 C22.6 79 25 96 25.6 107.6 L31.6 107.6 C31.8 96 32.6 80 33.4 69 Z'
  const backNear = 'M31 68 C30.4 83 33.6 98 34.4 109.6 L41.6 109.6 C41.6 98 42.6 83 44.6 70 Z'
  const frontL = 'M56 69 C55.2 83 56.4 98 56.8 110 L64.6 110 C64.8 98 65.4 84 66 71 Z'
  const frontR = 'M68.2 69 C67.8 82 68.8 98 69.2 111 L76.4 111 C76.4 98 76.8 84 77.2 69 Z'
  const foot = (x: number, y: number, k: number) => fluffPath(x, y, 4.6, 2.6, 7, 1.2, rng(k))
  const head = fluffPath(66, 38.4, 18, 15.6, 18, 2.6, rng(3), -PI / 2)
  const muzzle = fluffPath(66, 48.6, 9.4, 7, 12, 1.8, rng(15))
  const earL = fluffPath(48.6, 49.5, 7.6, 18, 14, 2.6, rng(7))
  const earR = fluffPath(83.4, 49.5, 7.6, 18, 14, 2.6, rng(8))
  const earTf = (side: 'l' | 'r') => {
    const a = (side === 'l' ? 9 : -9) + (mood === 'curious' && side === 'l' ? -14 : 0) + (mood === 'sleepy' ? (side === 'l' ? 3 : -3) : 0)
    return `rotate(${a} ${side === 'l' ? 50 : 82} 32)`
  }
  const leftFront = (
    <g>
      <Inked d={frontL} fill={g('leg')} ink={ink} hi={hi} w={1} />
      <Inked d={foot(60.8, 110.4, 21)} fill={g('coat')} ink={ink} hi={hi} w={0.8} />
    </g>
  )
  return (
    <g>
      <defs>
        <Lit id={`${id}-coat`} base="#ecc897" light="#fdf0da" shade="#c99a62" />
        <Lit id={`${id}-coatU`} base="#ecc897" light="#fdf0da" shade="#c49260" cx={36} cy={54} r={40} user />
        <Lit id={`${id}-face`} base="#f5e5c9" light="#fffaf0" shade="#d8bb8e" cy={0.25} />
        <Lit id={`${id}-ear`} base="#e2b179" light="#f6d8ac" shade="#b27e48" cy={0.2} />
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fbecd2" />
          <stop offset="0.55" stopColor="#ecc897" />
          <stop offset="1" stopColor="#c99a62" />
        </linearGradient>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9b17e" />
          <stop offset="1" stopColor="#b98a56" />
        </linearGradient>
      </defs>
      <Ground w={38} cx={52} />
      {/* far legs, little pom of a tail */}
      <g filter={wc(id, hi)}>
        <Inked d={fluffPath(19.5, 52, 5.6, 5.6, 8, 2, rng(12))} fill={g('coat')} ink={ink} hi={hi} w={0.9} />
        <Inked d={backFar} fill={g('far')} ink={ink} hi={hi} w={1} />
        <Inked d={foot(28.6, 108, 22)} fill={g('far')} ink={ink} hi={hi} w={0.8} />
        <Inked d={frontR} fill={g('far')} ink={ink} hi={hi} w={1} />
        <Inked d={foot(72.6, 111, 23)} fill={g('far')} ink={ink} hi={hi} w={0.8} />
      </g>
      {/* near legs, then the curly body over their tops */}
      <g filter={wc(id, hi)}>
        <Inked d={backNear} fill={g('leg')} ink={ink} hi={hi} w={1} />
        <Inked d={foot(38, 110, 24)} fill={g('coat')} ink={ink} hi={hi} w={0.8} />
        {!wave && leftFront}
        <Fur d={curlStrokes(38, 92, 3, 14, n(hi, 10), 1.8, r) + curlStrokes(60.6, 92, 3, 14, n(hi, 10), 1.8, r)} c={curl} hi={hi} w={0.6} o={0.5} />
        <Inked d={body} fill={g('coatU')} ink={ink} hi={hi} />
        <Fur d={curlStrokes(43, 63, 23, 10, n(hi, 36), 2.2, r)} c={curl} hi={hi} w={0.7} o={0.55} />
        <Inked d={chest} fill={g('coat')} ink={ink} hi={hi} w={0.9} o={0.7} />
        <Fur d={curlStrokes(67, 65, 9, 7, n(hi, 12), 1.9, r)} c={curl} hi={hi} w={0.6} o={0.5} />
      </g>
      {/* blue collar and gold tag */}
      <g filter={wc(id, hi)}>
        <path d="M55.4 58.6 Q66 64.8 76.6 58.6" stroke={ink} strokeWidth="4.4" fill="none" strokeLinecap="round" />
        <path d="M55.4 58.6 Q66 64.8 76.6 58.6" stroke="#3460c9" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <circle cx="66" cy="65" r="2.7" fill="#e9a92e" stroke={ink} strokeWidth="0.7" />
        <circle cx="65.2" cy="64.2" r="0.8" fill="#fff4cf" />
      </g>
      {/* head */}
      <g transform={`rotate(${HEAD_TILT.luna[mood]} ${px} ${py})`}>
        {/* long wavy ear flaps */}
        <g filter={wc(id, hi)}>
          <g transform={earTf('l')}>
            <Inked d={earL} fill={g('ear')} ink={ink} hi={hi} />
            <Fur d={curlStrokes(49, 53, 5, 13, n(hi, 14), 2, r)} c="#a87444" hi={hi} w={0.7} o={0.5} />
          </g>
          <g transform={earTf('r')}>
            <Inked d={earR} fill={g('ear')} ink={ink} hi={hi} />
            <Fur d={curlStrokes(83, 53, 5, 13, n(hi, 14), 2, r)} c="#a87444" hi={hi} w={0.7} o={0.5} />
          </g>
        </g>
        <g filter={wc(id, hi)}>
          <Inked d={head} fill={g('face')} ink={ink} hi={hi} />
          <Fur d={curlStrokes(66, 30, 13, 6, n(hi, 16), 2, r)} c={curl} hi={hi} w={0.6} o={0.45} />
          <Inked d={muzzle} fill={g('face')} ink={ink} hi={hi} w={0.7} o={0.45} />
          <Fur d={curlStrokes(66, 50, 7, 4, n(hi, 8), 1.6, r)} c={curl} hi={hi} w={0.55} o={0.4} />
        </g>
        {/* big round dark eyes */}
        {mood === 'sleepy' ? (
          <path d="M54.6 41 Q58.8 44.4 63 41 M69 41 Q73.2 44.4 77.4 41" stroke="#2a1a14" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        ) : (
          <>
            {[58.8, 73.2].map((x) => (
              <g key={x}>
                <circle cx={x} cy="40.4" r="5.4" fill="#8a5a3a" opacity="0.35" />
                <circle cx={x} cy="40.4" r="4.6" fill="#24160f" />
                <path d={`M${x - 3.4} 42 A3.6 3.6 0 0 0 ${x + 3.4} 42`} stroke="#7a4a2a" strokeWidth="1.1" fill="none" />
                <Glints x={x + (mood === 'curious' ? 0.6 : 0)} y={40.2} r={4.6} />
              </g>
            ))}
            <path d="M53.4 35 Q58.6 32.4 63 34.6 M69 34.6 Q73.4 32.4 78.6 35" stroke="#c9a070" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.8" />
          </>
        )}
        {/* brown-black nose and soft mouth */}
        <path d="M62 46.4 C62 44.4 70 44.4 70 46.4 C70 49 67.6 50.8 66 50.8 C64.4 50.8 62 49 62 46.4 Z" fill="#3a2626" />
        <ellipse cx="64.6" cy="45.9" rx="1.5" ry="0.8" fill="#fff" opacity="0.55" />
        <path d="M66 50.8 v1.6" stroke="#5a3a2a" strokeWidth="0.8" />
        {mood === 'curious' ? (
          <ellipse cx="66" cy="54" rx="1.1" ry="1" fill="#5a2e2a" />
        ) : (
          <path d="M62.8 52.6 Q64.4 54.2 66 52.6 Q67.6 54.2 69.2 52.6" stroke="#5a3a2a" strokeWidth="0.85" fill="none" strokeLinecap="round" />
        )}
        {mood === 'happy' && <path d="M64.8 53.4 Q66 56.6 67.2 53.4 Z" fill="#ec7f93" />}
      </g>
      {wave && <g filter={wc(id, hi)} transform="translate(61 72) rotate(-38) scale(0.95 0.6) translate(-61 -72)">{leftFront}</g>}
    </g>
  )
}
