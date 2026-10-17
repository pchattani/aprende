/**
 * Souvenirs and wardrobe accessories as small painted objects (gouache storybook style):
 * light from the top left, soft radial gradients, a thin ink contour and a white glint.
 * Every ART_KIND is drawn in a 48×48 box; `color` recolours the main material, so the
 * wardrobe reads differently in each WARDROBE_COLOURS colour. Built to stay legible
 * at 28–48px and still look painted at 96px.
 */
import type { ReactNode } from 'react'
import type { ArtKind } from '../../engine/artKinds'
import { Lit, PaintFilters } from './paint'
import { f, lighten, darken, mix, useArtId } from './brush'
import { isArtKind, souvenirArt, type SouvenirLike } from './souvenirKinds'

const INK = '#3b2a2e'
/** Ink contour for main shapes. */
const K = { stroke: INK, strokeWidth: 1.1, strokeLinejoin: 'round', strokeLinecap: 'round' } as const
/** Thin detail line. */
const L = (w = 0.7, o = 0.55) => ({ stroke: INK, strokeWidth: w, fill: 'none', opacity: o, strokeLinejoin: 'round', strokeLinecap: 'round' }) as const
const WHITE = '#fffdf6'
const GOLD = '#e2b04a'
const SILVER = '#d9dde3'

// ---------------------------------------------------------------- geometry helpers
type Pt = [number, number]
const rad = (d: number) => (d * Math.PI) / 180
const polar = (cx: number, cy: number, r: number, deg: number): Pt => [cx + Math.cos(rad(deg)) * r, cy + Math.sin(rad(deg)) * r]
const poly = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + 'Z'
const ngon = (cx: number, cy: number, r: number, n: number, rot = -90) => poly(Array.from({ length: n }, (_, i) => polar(cx, cy, r, rot + (i * 360) / n)))
const starPath = (cx: number, cy: number, R: number, r: number, n = 5, rot = -90) => poly(Array.from({ length: n * 2 }, (_, i) => polar(cx, cy, i % 2 ? r : R, rot + (i * 180) / n)))
/** Scalloped arc from angle a0 to a1 (degrees, clockwise in screen space), as segments after a moveto at its start. */
function scallops(cx: number, cy: number, r: number, a0: number, a1: number, n: number, depth: number): string {
  let d = ''
  for (let i = 0; i < n; i++) {
    const am = a0 + ((i + 0.5) * (a1 - a0)) / n
    const [qx, qy] = polar(cx, cy, r + depth, am)
    const [ex, ey] = polar(cx, cy, r, a0 + ((i + 1) * (a1 - a0)) / n)
    d += ` Q${f(qx)} ${f(qy)} ${f(ex)} ${f(ey)}`
  }
  return d
}
/** Points along a quadratic curve. */
const quad = (a: Pt, c: Pt, b: Pt, t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// ---------------------------------------------------------------- paint context
/** Collects the gradients and clips one drawing needs, under a unique id prefix. */
class Paint {
  readonly defs: ReactNode[] = []
  private seen = new Set<string>()
  readonly id: string
  constructor(id: string) {
    this.id = id
  }
  private add(key: string, make: (gid: string) => ReactNode): string {
    const gid = `${this.id}-${key}`
    if (!this.seen.has(key)) {
      this.seen.add(key)
      this.defs.push(make(gid))
    }
    return `url(#${gid})`
  }
  /** Lit-from-the-top-left radial gradient. */
  lit(key: string, base: string, light?: string, shade?: string): string {
    return this.add(key, (gid) => <Lit key={gid} id={gid} base={base} light={light} shade={shade} />)
  }
  /** Linear gradient, top→bottom ('v'), left→right ('h') or diagonal ('d'). */
  lin(key: string, from: string, to: string, dir: 'v' | 'h' | 'd' = 'v'): string {
    return this.add(key, (gid) => (
      <linearGradient key={gid} id={gid} x1="0" y1="0" x2={dir === 'v' ? 0 : 1} y2={dir === 'h' ? 0 : 1}>
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    ))
  }
  clip(key: string, d: string): string {
    return this.add(key, (gid) => (
      <clipPath key={gid} id={gid}>
        <path d={d} />
      </clipPath>
    ))
  }
}

// ---------------------------------------------------------------- shared bits
function Shine({ x, y, rx, ry, r = -35, o = 0.6 }: { x: number; y: number; rx: number; ry?: number; r?: number; o?: number }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry ?? rx * 0.5} transform={`rotate(${r} ${x} ${y})`} fill={WHITE} opacity={o} />
}
/** An upright cylinder: side and top face. */
function Cyl({ cx = 24, top, bot, rx, ry, side, cap }: { cx?: number; top: number; bot: number; rx: number; ry: number; side: string; cap: string }) {
  return (
    <>
      <path d={`M${cx - rx} ${top} L${cx - rx} ${bot} A${rx} ${ry} 0 0 0 ${cx + rx} ${bot} L${cx + rx} ${top} Z`} fill={side} {...K} />
      <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={cap} {...K} />
    </>
  )
}
/** A small five-petal flower. */
function Blossom({ x, y, r, c, mid = '#f6c945', n = 5, rot = -90, line = 0.5 }: { x: number; y: number; r: number; c: string; mid?: string; n?: number; rot?: number; line?: number }) {
  return (
    <g>
      {range(n).map((i) => {
        const a = rot + (i * 360) / n
        const [px, py] = polar(x, y, r * 0.55, a)
        return <ellipse key={i} cx={px} cy={py} rx={r * 0.52} ry={r * 0.38} transform={`rotate(${a} ${px} ${py})`} fill={c} stroke={INK} strokeWidth={line} strokeOpacity={0.7} />
      })}
      <circle cx={x} cy={y} r={r * 0.3} fill={mid} />
    </g>
  )
}
/** Thick line with an ink edge (straws, sticks, handles). */
function Rod({ d, w, c, cap = 'round' }: { d: string; w: number; c: string; cap?: 'round' | 'butt' }) {
  return (
    <>
      <path d={d} stroke={INK} strokeWidth={w + 1.2} fill="none" strokeLinecap={cap} strokeLinejoin="round" />
      <path d={d} stroke={c} strokeWidth={w} fill="none" strokeLinecap={cap} strokeLinejoin="round" />
    </>
  )
}
/** A contrasting accent for recolourable items: cream on dark colours, deep ink on light ones. */
function accent(c: string): string {
  const n = parseInt(c.replace('#', ''), 16)
  const lum = (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255
  return lum > 0.62 ? darken(c, 0.55) : '#fbf1da'
}

type Draw = (p: Paint, c: string) => ReactNode

/** Main colour of each kind when no `color` is given. */
const DEFAULT: Partial<Record<ArtKind, string>> = {
  mate: '#8b5a34', cookie: '#d9a35c', coffee: '#f1ebdf', teacup: '#d4708c', gelato: '#f19bb0', candy: '#e07aa6', fish: '#5b8fc9', fruit: '#d4483c', jam: '#c8344a', chocolate: '#c8442f',
  guitar: '#d08a3e', accordion: '#2b2630', drum: '#a8562e', maracas: '#e0782e', violin: '#a8532a', flute: '#c9a46a', tambourine: '#c0392b',
  poncho: '#b8402f', 'football-shirt': '#2a4fa0', sombrero: '#d9a85a', fan: '#c0392b', flower: '#e0507a', lei: '#ec7a9a', necklace: '#2f9fb0', bracelet: '#d4483c', 'carnival-mask': '#7a55c2', gloves: '#d4483c',
  flag: '#74acdf', postcard: '#d4483c', book: '#2f5bd3', camera: '#8a5a3a', ticket: '#e9b92e', key: '#d9a93a', lantern: '#d63b2f', kite: '#e0507a', 'toy-boat': '#d4483c', shell: '#f2a88c', stone: '#9aa0a6',
  feather: '#4a90c8', compass: '#d4483c', keychain: '#e07aa6', figurine: '#2f5bd3', painting: '#d4a548', vase: '#2f6fc0', candle: '#f2e6cf', perfume: '#c77dbb', soap: '#a8c6a0', cactus: '#e9708f',
  leaf: '#5aa04a', star: '#f2c03a', medal: '#2f5bd3', tile: '#2f5bd3', chopsticks: '#b8322a', abacus: '#c0392b', bell: '#e0b040', scroll: '#3f6b8f', mirror: '#d4a548', puppet: '#d4483c', origami: '#e0507a', pinwheel: '#e0507a',
  pastry: '#6b3a1f', noodles: '#e7ddc8', coconut: '#e9708f', wine: '#2f5a3a', bun: '#d4483c',
  beret: '#d4483c', cap: '#2f5bd3', beanie: '#3f8f5f', sunhat: '#e9b92e', 'bucket-hat': '#e0782e', scarf: '#d4483c', bandana: '#2f5bd3', bowtie: '#7a55c2', sunglasses: '#2a2d3a', 'round-glasses': '#e0782e', umbrella: '#2f5bd3', balloon: '#d4483c',
}

// ======================================================================== drawings
const DRAW: Record<ArtKind | 'gift', Draw> = {
  // ------------------------------------------------------------ food and drink
  mate: (p, c) => (
    <>
      <path d="M12 27 C12 19 17 16 24 16 C31 16 36 19 36 27 C36 37 31 43 24 43 C17 43 12 37 12 27 Z" fill={p.lit('g', c)} {...K} />
      <path d="M14.5 30 Q19 33 24 30 Q29 33 33.5 30" {...L(0.8, 0.5)} />
      <path d="M15.5 34 Q19.5 36.6 24 34 Q28.5 36.6 32.5 34" {...L(0.7, 0.4)} />
      <ellipse cx="24" cy="17.5" rx="11.5" ry="3.8" fill={p.lin('rim', '#ffffff', '#9aa1aa')} {...K} />
      <ellipse cx="24" cy="17.3" rx="8.6" ry="2.4" fill="#86a640" />
      <Rod d="M25 17 L32.5 4.8 Q33.4 3.6 35.6 4" w={2} c={SILVER} />
      <Shine x={17} y={24} rx={3} />
    </>
  ),
  cookie: (p, c) => (
    <>
      <Cyl top={30} bot={34} rx={14.5} ry={5.5} side={p.lit('b', darken(c, 0.1))} cap={darken(c, 0.15)} />
      <Cyl top={26.5} bot={30} rx={13.8} ry={5} side="#9a5524" cap="#b8692e" />
      <Cyl top={21} bot={25.5} rx={14.5} ry={5.5} side={p.lit('t', darken(c, 0.12))} cap={p.lit('top', c)} />
      {([[18, 20], [24, 22.5], [29, 19.4], [22, 18.4], [31, 22.4], [16.4, 22.6]] as Pt[]).map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.6" ry="1" fill="#5a3218" />
      ))}
      <Shine x={17} y={18.4} rx={2.6} />
    </>
  ),
  empanada: (p) => {
    const rim = 'M7 33' + scallops(24, 33, 17, 180, 360, 11, 2.2) + ' Q24 38.5 7 33 Z'
    return (
      <>
        <path d={rim} fill={p.lit('e', '#e6a957', '#f8d899', '#b56f2c')} {...K} />
        <path d={'M10 32.4' + scallops(24, 33, 14, 188, 352, 10, 0)} {...L(0.6, 0.45)} />
        {range(10).map((i) => {
          const [x0, y0] = polar(24, 33, 14.4, 190 + i * 16.6)
          const [x1, y1] = polar(24, 33, 17.2, 196 + i * 16.6)
          return <path key={i} d={`M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)}`} {...L(0.7, 0.5)} />
        })}
        <ellipse cx="26" cy="27" rx="3" ry="1.6" fill="#b06a2a" opacity="0.35" />
        <Shine x={17} y={24} rx={3.2} />
      </>
    )
  },
  croissant: (p) => {
    const lobes: [number, number, number][] = [[205, 5, 4], [335, 5, 4], [232, 7, 5.4], [308, 7, 5.4], [270, 8.6, 6.6]]
    const fill = p.lit('c', '#e2a54f', '#f8d690', '#a8642a')
    return (
      <>
        {lobes.map(([a, rx, ry], i) => {
          const [x, y] = polar(24, 42, 17, a)
          return <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${a + 90} ${x} ${y})`} fill={fill} {...K} />
        })}
        <Shine x={21} y={22} rx={3} />
      </>
    )
  },
  baguette: (p) => (
    <g transform="rotate(-35 24 24)">
      <rect x="2" y="18.5" width="44" height="11" rx="5.5" fill={p.lit('b', '#d99a4c', '#f4cf8a', '#9c5e26')} {...K} />
      {[10, 18, 26, 34].map((x) => (
        <path key={x} d={`M${x} 26 Q${x + 3} 21.6 ${x + 6} 21`} stroke="#f6dca4" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ))}
      <Shine x={12} y={21} rx={3} r={0} />
    </g>
  ),
  pizza: (p) => (
    <>
      <path d="M8 13 Q24 7 40 13 L24 44 Z" fill={p.lit('ch', '#f3c75a', '#fbe7a0', '#d99a32')} {...K} />
      <path d="M6.6 13.2 Q24 5 41.4 13.2 L39.6 17.4 Q24 10.6 8.4 17.4 Z" fill={p.lit('cr', '#d48a3e', '#f0b971', '#9c5a24')} {...K} />
      {([[20, 21, 3], [29, 23, 2.6], [23, 31, 2.4]] as const).map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#c8442f" {...K} strokeWidth={0.6} />
      ))}
      <path d="M27 31 q2 -2 4 0 q-2 2 -4 0 Z M15 19 q1.6 -1.8 3.4 0 q-1.8 1.8 -3.4 0Z" fill="#4f9a4a" />
    </>
  ),
  gelato: (p, c) => {
    const cone = 'M14.6 24 L24 45 L33.4 24 Z'
    const scoop = (y: number, r: number) => `M${24 - r} ${y} Q${24 - r - 0.6} ${y - r * 1.3} 24 ${y - r * 1.3} Q${24 + r + 0.6} ${y - r * 1.3} ${24 + r} ${y} Q${24 + r * 0.6} ${y + 3} ${24 + r * 0.3} ${y + 0.8} Q24 ${y + 3.4} ${24 - r * 0.3} ${y + 0.8} Q${24 - r * 0.6} ${y + 3} ${24 - r} ${y} Z`
    return (
      <>
        <path d={cone} fill={p.lit('cn', '#e2a75c', '#f6d498', '#a96a2c')} {...K} />
        <g clipPath={p.clip('cc', cone)}>
          {[-8, -2, 4, 10].map((o) => <path key={o} d={`M${14 + o} 22 l14 24 M${34 - o} 22 l-14 24`} {...L(0.6, 0.45)} />)}
        </g>
        <path d={scoop(25, 10)} fill={p.lit('s1', '#fbefd2', '#ffffff', '#e2c58f')} {...K} />
        <path d={scoop(16, 8)} fill={p.lit('s2', c)} {...K} />
        <circle cx="24" cy="4.6" r="2.2" fill="#c8202f" {...K} strokeWidth={0.6} />
        <Shine x={20} y={9.6} rx={2.4} />
      </>
    )
  },
  coffee: (p, c) => (
    <>
      <ellipse cx="24" cy="39" rx="17.5" ry="4.6" fill={p.lit('sa', c)} {...K} />
      <path d="M35 23 C42 22 42.4 32 34.4 31.4" {...L(3.6, 1)} stroke={INK} />
      <path d="M35 23 C41 22.4 41.4 31.2 34.4 30.6" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M11 20 L13 35 Q24 40 35 35 L37 20 Z" fill={p.lit('cup', c)} {...K} />
      <path d="M11.6 25 Q24 29 36.4 25" stroke={accent(c) === '#fbf1da' ? '#fbf1da' : '#3f7bc4'} strokeWidth="1.6" fill="none" opacity="0.8" />
      <ellipse cx="24" cy="20" rx="13" ry="3.6" fill="#7a4a2a" {...K} />
      <path d="M21.4 19.6 q1.3 -1.6 2.6 0 q1.3 -1.6 2.6 0 l-2.6 2.2 Z" fill="#f1dcb8" />
      <path d="M19 15 q-2 -3 0 -5 t0 -5 M27 15 q-2 -3 0 -5 t0 -5" {...L(1, 0.4)} />
      <Shine x={15.6} y={27} rx={2.8} r={-70} />
    </>
  ),
  teacup: (p, c) => (
    <>
      <ellipse cx="24" cy="38.4" rx="18" ry="4.4" fill={p.lit('sa', '#fbf6ec', '#ffffff', '#cfc5b4')} {...K} />
      <path d="M38 24 C44 23 44 31.4 37 30.6" {...L(3.2, 1)} stroke={INK} />
      <path d="M38 24 C43 23.4 43 30.6 37 30" stroke="#fbf6ec" strokeWidth="1.8" fill="none" />
      <path d="M8.6 23 Q9.6 35 24 36 Q38.4 35 39.4 23 Z" fill={p.lit('cup', '#fbf6ec', '#ffffff', '#cfc5b4')} {...K} />
      <Blossom x={17} y={29.6} r={3.6} c={c} />
      <Blossom x={29.4} y={30.6} r={2.6} c={lighten(c, 0.3)} />
      <ellipse cx="24" cy="23" rx="15.4" ry="3.4" fill="#b8742e" {...K} />
      <path d="M31 23 Q33 12 35 9.4" {...L(0.7, 0.8)} />
      <rect x="33" y="5" width="5" height="5" rx="0.6" fill={c} {...K} strokeWidth={0.7} transform="rotate(12 35.5 7.5)" />
      <ellipse cx="24" cy="23" rx="15.4" ry="3.4" fill="none" stroke={c} strokeWidth="0.9" opacity="0.8" />
    </>
  ),
  wine: (p, c) => (
    <>
      <path d="M12 44 L12 23 Q12 18 15.2 16 L15.2 6 L19.8 6 L19.8 16 Q23 18 23 23 L23 44 Z" fill={p.lit('b', c)} {...K} />
      <rect x="15" y="5" width="5" height="6" fill="#8a1f2e" {...K} strokeWidth={0.7} />
      <rect x="12.6" y="27" width="9.8" height="10" fill="#f6ead0" {...K} strokeWidth={0.6} />
      <rect x="12.6" y="29.6" width="9.8" height="2.4" fill="#8a1f2e" />
      <path d="M30 18 Q30 31 36.6 31 Q43.2 31 43.2 18 Z" fill={p.lin('gl', '#ffffffcc', '#d5e6ef99')} {...K} />
      <path d="M30.5 23.5 Q31 30.4 36.6 30.4 Q42.2 30.4 42.7 23.5 Z" fill="#8a1f2e" />
      <path d="M36.6 31 V41 M32.4 42 Q36.6 40.4 40.8 42" {...K} fill="none" />
      <Shine x={14.4} y={22} rx={2.4} r={-70} />
    </>
  ),
  cheese: (p) => (
    <>
      <path d="M6 24 L41 16 L43 27 L8 36 Z" fill="#f8d769" {...K} />
      <path d="M8 36 L43 27 L43 38 L8 44 Z" fill={p.lit('fr', '#efc24a', '#f8dc80', '#c99a26')} {...K} />
      <path d="M6 24 L8 36 L8 44 L6 33 Z" fill="#e6a83a" {...K} />
      {([[17, 37, 2.2, 1.6], [29, 35.4, 3, 2.2], [37, 38, 1.6, 1.2], [22, 41, 1.4, 1], [24, 27, 2.2, 1], [33, 22.4, 1.8, 0.8]] as const).map(([x, y, rx, ry], i) => (
        <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="#c99426" opacity="0.85" />
      ))}
    </>
  ),
  dumpling: (p) => {
    const body = 'M6 33 Q7 21 24 19 Q41 21 42 33 Q24 39 6 33 Z'
    return (
      <>
        <path d={body} fill={p.lit('d', '#f4ecdc', '#ffffff', '#cdbb98')} {...K} />
        <path d={'M10 27' + scallops(24, 34, 15, 205, 335, 9, 2.8)} fill="#faf4e6" {...K} strokeWidth={0.8} />
        {range(7).map((i) => {
          const [x, y] = polar(24, 34, 16.4, 216 + i * 18)
          const [x2, y2] = polar(24, 34, 11.6, 222 + i * 16)
          return <path key={i} d={`M${f(x)} ${f(y)} Q${f((x + x2) / 2 + 1)} ${f((y + y2) / 2)} ${f(x2)} ${f(y2)}`} {...L(0.6, 0.45)} />
        })}
        <Shine x={14} y={29} rx={2.6} />
      </>
    )
  },
  bun: (p, c) => (
    <>
      <path d="M7 35 Q7 14 24 14 Q41 14 41 35 Q24 40 7 35 Z" fill={p.lit('b', '#fbf5e8', '#ffffff', '#d6c6a4')} {...K} />
      {range(8).map((i) => {
        const a = 200 + i * 20
        const [x0, y0] = polar(24, 18.6, 2.4, a)
        const [x1, y1] = polar(24, 18.6, 9 + (i % 2) * 2, a + 18)
        return <path key={i} d={`M${f(x0)} ${f(y0)} Q${f((x0 + x1) / 2)} ${f((y0 + y1) / 2 - 2)} ${f(x1)} ${f(y1)}`} {...L(0.7, 0.5)} />
      })}
      <circle cx="24" cy="18.4" r="1.8" fill={c} />
      <Shine x={15} y={24} rx={3} />
    </>
  ),
  noodles: (p, c) => (
    <>
      <path d="M9 24 Q12 14 24 14 Q36 14 39 24 Z" fill="#f3d58a" {...K} />
      {range(5).map((i) => <path key={i} d={`M${11 + i * 5.4} 23 q1.4 -3 0 -5 q-1.4 -2 0.6 -4`} {...L(0.8, 0.55)} />)}
      <circle cx="16" cy="18" r="3.2" fill={WHITE} {...K} strokeWidth={0.6} />
      <circle cx="16" cy="18" r="1.5" fill="#f2a92e" />
      <path d="M27 17 l2 -1 M31 19 l1.6 -1.4 M24 19.4 l1.8 -0.4" stroke="#4f9a4a" strokeWidth="1.4" strokeLinecap="round" />
      <Rod d="M29 20 L44 5" w={1.6} c="#b8322a" />
      <Rod d="M31.6 21 L45.6 8" w={1.6} c="#b8322a" />
      <path d="M5.6 23 L42.4 23 Q41.4 40.4 24 41.4 Q6.6 40.4 5.6 23 Z" fill={p.lit('bowl', c)} {...K} />
      <path d="M8 28.6 Q24 33 40 28.6" stroke={accent(c) === '#fbf1da' ? '#fbf1da' : '#2f5bd3'} strokeWidth="1.4" strokeDasharray="2.4 1.6" fill="none" opacity="0.8" />
      <Shine x={12} y={31} rx={2.6} r={-60} />
    </>
  ),
  mooncake: (p) => {
    const edge = (cy: number) => 'M8 ' + cy + scallops(24, cy, 16, 180, 540, 16, 1.6) + 'Z'
    return (
      <>
        <path d={edge(27)} fill="#9c5a24" {...K} />
        <path d={edge(24)} fill={p.lit('m', '#d9954a', '#f3c47e', '#9c5a24')} {...K} />
        <circle cx="24" cy="24" r="11" {...L(0.9, 0.5)} />
        <Blossom x={24} y={24} r={8} c="#c98238" mid="#b06a2a" n={6} line={0.7} />
        <circle cx="24" cy="24" r="2.6" fill="#e4a95c" {...K} strokeWidth={0.6} />
        <Shine x={15.6} y={16} rx={2.6} />
      </>
    )
  },
  eggtart: (p) => (
    <>
      <path d="M7.6 25 L11.6 36 Q24 41 36.4 36 L40.4 25 Z" fill={p.lit('cr', '#d99a4c', '#f4cf8a', '#9c5e26')} {...K} />
      {range(9).map((i) => <path key={i} d={`M${10.4 + i * 3.4} 27 L${12.4 + i * 2.9} 37`} {...L(0.6, 0.45)} />)}
      <ellipse cx="24" cy="25" rx="16.6" ry="6" fill="#e9b468" {...K} />
      <ellipse cx="24" cy="25" rx="13" ry="4.4" fill={p.lit('cu', '#f8cf45', '#fff0a8', '#e0a020')} {...K} strokeWidth={0.7} />
      {([[20, 24, 2.4], [27, 26, 1.8], [25, 23, 1.2]] as const).map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.6} fill="#b8621e" opacity="0.7" />
      ))}
      <Shine x={17} y={23.4} rx={2} />
    </>
  ),
  chocolate: (p, c) => (
    <g transform="rotate(-15 24 24)">
      <rect x="12" y="5" width="24" height="34" rx="2" fill={p.lit('ch', '#6b3a1f', '#9a5a32', '#41210f')} {...K} />
      {[0, 1].map((cx) => [0, 1].map((cy) => <rect key={`${cx}${cy}`} x={14 + cx * 10.4} y={7 + cy * 6.4} width="9" height="5" rx="0.8" fill="none" stroke="#a8683c" strokeWidth="0.8" />))}
      <path d="M11 22 l2.6 -2 l2.6 2 l2.6 -2 l2.6 2 l2.6 -2 l2.6 2 l2.6 -2 l2.6 2 l2.6 -2 V25 H11 Z" fill={SILVER} {...K} strokeWidth={0.6} />
      <rect x="11" y="23" width="26" height="20" rx="1.6" fill={p.lit('wr', c)} {...K} />
      <rect x="11" y="29" width="26" height="6" fill={accent(c)} opacity="0.9" />
      <path d="M15 32 h18" stroke={c} strokeWidth="1.2" strokeDasharray="3 1.4" />
    </g>
  ),
  candy: (p, c) => (
    <g transform="rotate(-20 24 24)">
      <path d="M15.6 24 L5 16 Q3 24 5 32 Z" fill={p.lit('l', lighten(c, 0.15))} {...K} />
      <path d="M32.4 24 L43 16 Q45 24 43 32 Z" fill={p.lit('l', lighten(c, 0.15))} {...K} />
      <path d="M7 19 L10 22 M7 29 L10 26 M41 19 L38 22 M41 29 L38 26" {...L(0.6, 0.5)} />
      <ellipse cx="24" cy="24" rx="10" ry="7.6" fill={p.lit('c', c)} {...K} />
      <g clipPath={p.clip('cl', 'M14 24 a10 7.6 0 1 0 20 0 a10 7.6 0 1 0 -20 0')}>
        {[-8, -2, 4].map((o) => <path key={o} d={`M${20 + o} 14 l8 20`} stroke={WHITE} strokeWidth="2.2" opacity="0.7" />)}
      </g>
      <Shine x={20} y={20.6} rx={2.4} />
    </g>
  ),
  sandwich: (p) => (
    <>
      <path d="M5 28 Q6 37.4 24 37.4 Q42 37.4 43 28 Z" fill={p.lit('bb', '#d99a4c', '#f0c27e', '#9c5e26')} {...K} />
      <rect x="3.6" y="21.4" width="40.8" height="8" rx="4" fill={p.lit('s', '#a8462e', '#d06a4a', '#6e2a1a')} {...K} />
      <path d="M7 23.6 q2.4 2.6 4.8 0 t4.8 0 t4.8 0 t4.8 0 t4.8 0 t4.8 0 t4.8 0" stroke="#5aa04a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M6 24 Q8 12 24 12 Q40 12 42 24 Q24 21 6 24 Z" fill={p.lit('tb', '#e2a454', '#f6d090', '#a8662c')} {...K} />
      {([[16, 16], [22, 14.6], [28, 15.4], [33, 17.4], [19, 19]] as Pt[]).map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="0.9" ry="0.5" fill="#fbf0d0" />)}
      <Shine x={13} y={16.4} rx={2.6} />
    </>
  ),
  grill: (p) => (
    <>
      <path d="M11 37 L8 45 M37 37 L40 45" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 28 L43 28 L39 38 L9 38 Z" fill={p.lit('box', '#4a4650', '#7a7682', '#2a2830')} {...K} />
      <ellipse cx="16" cy="29" rx="5" ry="1.6" fill="#f08a2e" opacity="0.9" />
      <ellipse cx="30" cy="29.4" rx="6" ry="1.6" fill="#f4b23e" opacity="0.9" />
      <path d="M8.6 15.6 Q7.6 23 10.8 26 Q16 28.6 22 26.4 Q26.6 24 25.4 17 Q24 11 16.6 11.4 Q10 12 8.6 15.6 Z" fill={p.lit('st', '#a4432c', '#d47456', '#6a2416')} {...K} />
      <path d="M10.4 14.6 Q16 10.6 23.4 13.6" stroke="#f6e2cc" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M12 17 l8 6 M14 15 l8 6 M11 21 l6 4.4" stroke="#4a1a10" strokeWidth="1" opacity="0.7" />
      <rect x="25" y="18" width="18" height="6.4" rx="3.2" fill={p.lit('ch', '#b5523a', '#de8466', '#7a2e1e')} {...K} transform="rotate(-8 34 21)" />
      <path d="M5 27 H43" stroke="#2a2830" strokeWidth="1.4" />
      {range(8).map((i) => <path key={i} d={`M${7 + i * 5} 26 v3`} stroke="#2a2830" strokeWidth="0.9" />)}
    </>
  ),
  fish: (p, c) => (
    <>
      <path d="M20 14 Q24 8 30 11 L28 16 Z" fill={darken(c, 0.15)} {...K} />
      <path d="M7 25 Q17 12 31 20 L43 12 L40 25 L43 38 L31 30 Q17 38 7 25 Z" fill={p.lit('f', c)} {...K} />
      <path d="M17 18.6 Q20 25 17 31.4" {...L(0.8, 0.5)} />
      {[22, 26].map((x) => [21, 25, 29].map((y) => <path key={`${x}${y}`} d={`M${x} ${y - 1.4} q1.6 1.4 0 2.8`} {...L(0.55, 0.4)} />))}
      <circle cx="12.4" cy="23.4" r="2" fill={WHITE} {...K} strokeWidth={0.5} />
      <circle cx="12.8" cy="23.4" r="1" fill="#1b1416" />
      <Shine x={17} y={19.4} rx={3} r={-20} />
    </>
  ),
  fruit: (p, c) => (
    <>
      <path d="M24 16 C18 11.6 8.6 14 8.6 25 C8.6 35.4 15.6 42.4 20.6 42.4 C22.6 42.4 23.4 41.6 24 41.6 C24.6 41.6 25.4 42.4 27.4 42.4 C32.4 42.4 39.4 35.4 39.4 25 C39.4 14 30 11.6 24 16 Z" fill={p.lit('a', c)} {...K} />
      <path d="M24 16 Q24.4 10 27 6.4" stroke="#6b3a1f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M26 10.6 Q31 5 37 7.6 Q32.4 13 26 10.6 Z" fill={p.lit('lf', '#5aa04a')} {...K} strokeWidth={0.8} />
      <Shine x={15} y={22} rx={3.4} r={-60} />
    </>
  ),
  coconut: (p, c) => (
    <>
      <Rod d="M27 23 L35 4" w={1.8} c="#f6e7d4" />
      <path d="M28.6 18.6 L30.4 14.4 M31.2 12.4 L33 8.2" stroke={c} strokeWidth="1.8" />
      <path d="M7 24 Q7 41.4 24 41.4 Q41 41.4 41 24 Z" fill={p.lit('sh', '#8a5a34', '#b07a4c', '#4a2a14')} {...K} />
      <path d="M11 30 l3 2 M17 35 l2.6 1.6 M29 36 l2.6 -1.6 M35 30 l-2.6 2" {...L(0.7, 0.5)} stroke="#2a160a" />
      <ellipse cx="24" cy="24" rx="17" ry="5" fill="#fbf6ea" {...K} />
      <ellipse cx="24" cy="24.2" rx="13.6" ry="3.4" fill="#ede3cd" />
      <Blossom x={11.4} y={21} r={5} c={c} />
    </>
  ),
  pastry: (p, c) => (
    <>
      <path d="M34 20 L42 14.6 L42 32.6 L34 38 Z" fill="#d9a35c" {...K} />
      <path d="M7 20 L34 20 L34 38 L7 38 Z" fill="#fbf0d6" {...K} />
      {[24.6, 30.6, 36].map((y) => <path key={y} d={`M7 ${y} q2.2 -1.4 4.5 0 t4.5 0 t4.5 0 t4.5 0 t4.5 0 t4.5 0 V${y + 2} H7 Z`} fill={p.lit('pf', '#e2ae63', '#f4d394', '#b07a3a')} />)}
      <path d="M7 20 L15 14.6 L42 14.6 L34 20 Z" fill={p.lit('ic', '#fffaf0', '#ffffff', '#e8dcc4')} {...K} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${11.6 + i * 6} 18.6 L${17 + i * 6} 15.4`} stroke={c} strokeWidth="1" />)}
      <path d="M12 16.4 L38 16.4" stroke={c} strokeWidth="0.5" opacity="0.6" />
      <path d="M7 20 L34 20 L34 38 L7 38 Z" fill="none" {...K} />
    </>
  ),
  jam: (p, c) => (
    <>
      <rect x="11.6" y="17" width="24.8" height="26" rx="5" fill={p.lit('j', c)} {...K} />
      <rect x="15.6" y="26" width="16.8" height="10" rx="1.6" fill="#fbf3e2" {...K} strokeWidth={0.7} />
      <circle cx="24" cy="31" r="2.6" fill={c} />
      <path d="M24 28.4 q1.4 -1.4 2.6 -0.6" stroke="#4f9a4a" strokeWidth="0.9" fill="none" />
      <path d="M9.6 17.6 Q24 9.6 38.4 17.6 L36.4 21.6 Q24 16.4 11.6 21.6 Z" fill="#fbf3e2" {...K} />
      <g clipPath={p.clip('lid', 'M9.6 17.6 Q24 9.6 38.4 17.6 L36.4 21.6 Q24 16.4 11.6 21.6 Z')} opacity="0.75">
        {range(8).map((i) => <rect key={i} x={9.6 + i * 3.8} y="10" width="1.9" height="12" fill={c} />)}
      </g>
      <path d="M11.6 19.6 Q24 15 36.4 19.6" stroke="#8a5a34" strokeWidth="1" fill="none" />
      <Shine x={14.8} y={22} rx={1.6} ry={3} r={0} o={0.5} />
    </>
  ),

  // ------------------------------------------------------------ music
  guitar: (p, c) => (
    <g transform="rotate(-38 24 24) translate(24 24) scale(0.86) translate(-24 -20)">
      <rect x="21.6" y="-9" width="4.8" height="7" rx="1" fill="#5a3218" {...K} />
      {[-7.6, -5, -2.6].map((y) => <path key={y} d={`M21.6 ${y} h-1.6 M26.4 ${y} h1.6`} stroke={INK} strokeWidth="1.2" strokeLinecap="round" />)}
      <rect x="22.4" y="-2.4" width="3.2" height="20" fill="#6b3a1f" {...K} strokeWidth={0.8} />
      <path d="M24 13.6 C29.6 13.6 31.6 17 31.1 20.5 C30.7 23.4 29.4 24.4 31.6 26.6 C34.8 29.6 34.6 34 33 37 C31 41 27.6 43 24 43 C20.4 43 17 41 15 37 C13.4 34 13.2 29.6 16.4 26.6 C18.6 24.4 17.3 23.4 16.9 20.5 C16.4 17 18.4 13.6 24 13.6 Z" fill={p.lit('g', c)} {...K} />
      <circle cx="24" cy="26.6" r="3.2" fill="#2a1a12" />
      <rect x="20" y="34" width="8" height="1.8" rx="0.6" fill="#5a3218" />
      <path d="M23 0 V34.6 M25 0 V34.6" stroke="#f4ead6" strokeWidth="0.4" />
      <Shine x={20} y={18.6} rx={1.8} />
    </g>
  ),
  accordion: (p, c) => {
    const folds = range(7).map((i) => 15.4 + i * 2.85)
    return (
      <>
        <path d={'M15 14 ' + folds.map((x, i) => `L${f(x + 1.4)} ${i % 2 ? 14.4 : 12}`).join(' ') + ' L33 14 L33 36 ' + [...folds].reverse().map((x, i) => `L${f(x + 1.4)} ${i % 2 ? 35.6 : 38}`).join(' ') + ' L15 36 Z'} fill={p.lit('bel', '#efe3cc', '#fffaf0', '#c4b293')} {...K} />
        {folds.map((x, i) => <path key={i} d={`M${f(x + 1.4)} ${i % 2 ? 14.4 : 12} V${i % 2 ? 35.6 : 38}`} stroke={i % 2 ? '#a8323a' : INK} strokeWidth={i % 2 ? 0.8 : 0.5} opacity="0.7" />)}
        {[4, 33].map((x) => (
          <g key={x}>
            <rect x={x} y="11" width="11" height="28" rx="2.6" fill={p.lit('box', c)} {...K} />
            <rect x={x + 1.4} y="12.6" width="8.2" height="24.8" rx="1.6" fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.9" />
            {range(4).map((r) => range(2).map((k) => <circle key={`${r}${k}`} cx={x + 3.6 + k * 3.8 + (r % 2) * 0.6} cy={16.6 + r * 5} r="1.15" fill="#f4efe4" />))}
          </g>
        ))}
        <Shine x={7} y={14} rx={1.8} />
      </>
    )
  },
  drum: (p, c) => (
    <>
      <Cyl top={18} bot={38} rx={14} ry={5} side={p.lit('sh', c)} cap={p.lit('hd', '#f3e6cc', '#fffaf0', '#d6c29c')} />
      <path d="M10 20 L10 23 A14 5 0 0 0 38 23 L38 20" fill="none" stroke={darken(c, 0.35)} strokeWidth="2" />
      <path d="M10 35 A14 5 0 0 0 38 35" fill="none" stroke={darken(c, 0.35)} strokeWidth="2" />
      <path d="M11 24 L15 34 L19 25 L23 35.4 L27 25.6 L31 35 L35 24.6 L37.4 32" fill="none" stroke="#f3e6cc" strokeWidth="0.9" />
      <Rod d="M12 6 L27 17" w={1.6} c="#c99a5a" />
      <Rod d="M36 5 L22 16" w={1.6} c="#c99a5a" />
      <circle cx="12" cy="6" r="2" fill="#f3e6cc" {...K} strokeWidth={0.7} />
      <circle cx="36" cy="5" r="2" fill="#f3e6cc" {...K} strokeWidth={0.7} />
    </>
  ),
  maracas: (p, c) => (
    <>
      {[{ x: 17, r: -24, col: c, k: 'a' }, { x: 31, r: 24, col: mix(c, '#3f8f5f', 0.6), k: 'b' }].map(({ x, r, col, k }) => (
        <g key={k} transform={`rotate(${r} ${x} 30)`}>
          <Rod d={`M${x} 24 V44`} w={2.6} c="#c99a5a" />
          <ellipse cx={x} cy="16" rx="7.6" ry="10" fill={p.lit(k, col)} {...K} />
          <path d={`M${x - 7} 17 l2.4 -2.4 l2.4 2.4 l2.4 -2.4 l2.4 2.4 l2.4 -2.4 l2.4 2.4`} stroke={WHITE} strokeWidth="1" fill="none" />
          {[-3.6, 0, 3.6].map((o) => <circle key={o} cx={x + o} cy="21" r="0.9" fill={WHITE} />)}
          <Shine x={x - 3} y={11} rx={2} />
        </g>
      ))}
    </>
  ),
  violin: (p, c) => (
    <>
      <Rod d="M8 40 L40 8" w={0.9} c="#7a4a2a" />
      <path d="M9.4 41.4 L41.4 9.4" stroke="#f4ead6" strokeWidth="0.5" />
      <g transform="rotate(35 24 24)">
        <circle cx="24" cy="2.6" r="2.2" fill="#5a3218" {...K} strokeWidth={0.7} />
        <rect x="22.8" y="3" width="2.4" height="12" fill="#2a1a12" {...K} strokeWidth={0.6} />
        <path d="M24 13 C29 13 30.4 15.6 30 18.6 C29.6 21 27.6 22 28 24.6 C28.4 26.8 31.6 27.6 31.6 32 C31.6 37.6 28 40.6 24 40.6 C20 40.6 16.4 37.6 16.4 32 C16.4 27.6 19.6 26.8 20 24.6 C20.4 22 18.4 21 18 18.6 C17.6 15.6 19 13 24 13 Z" fill={p.lit('v', c)} {...K} />
        <path d="M20.4 22.6 q-1 3 0 6 M27.6 22.6 q1 3 0 6" {...L(0.8, 0.8)} />
        <rect x="21.6" y="31" width="4.8" height="1.4" fill="#f0d8a8" {...K} strokeWidth={0.5} />
        <path d="M23.2 14 V31 M24.8 14 V31" stroke="#f4ead6" strokeWidth="0.35" />
        <Shine x={20.6} y={16.6} rx={1.6} />
      </g>
    </>
  ),
  flute: (p, c) => (
    <>
      <path d="M33 5 v8.4 a2 1.6 0 1 1 -1.4 -1.6 V5 l5 -1.4 v8 a2 1.6 0 1 1 -1.4 -1.6 V5" fill={INK} stroke={INK} strokeWidth="0.8" opacity="0.75" />
      <g transform="rotate(-32 24 26)">
        <rect x="2" y="23" width="44" height="6" rx="3" fill={p.lit('fl', c)} {...K} />
        <rect x="5" y="23" width="3" height="6" fill={darken(c, 0.25)} />
        <ellipse cx="11" cy="26" rx="1.4" ry="1" fill="#2a1a12" />
        {[20, 25, 30, 35, 40].map((x) => <circle key={x} cx={x} cy="26" r="1.05" fill="#2a1a12" />)}
        <path d="M5 24.4 H44" stroke={WHITE} strokeWidth="0.8" opacity="0.6" />
      </g>
    </>
  ),
  tambourine: (p, c) => (
    <>
      <path d="M20 38 Q17 43 19 47 M28 38 Q31 43 29 47" stroke="#f2c03a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="22" r="16.4" fill={p.lit('fr', c)} {...K} />
      <circle cx="24" cy="22" r="12.6" fill={p.lit('sk', '#f3e6cc', '#fffaf0', '#d6c29c')} {...K} />
      <path d={starPath(24, 22, 6, 2.6)} fill={c} opacity="0.75" />
      {range(6).map((i) => {
        const [x, y] = polar(24, 22, 14.5, -60 + i * 60)
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="2.6" ry="1.5" transform={`rotate(${i * 60 + 30} ${x} ${y})`} fill={p.lit('jg', GOLD)} {...K} strokeWidth={0.5} />
          </g>
        )
      })}
    </>
  ),

  // ------------------------------------------------------------ clothing
  poncho: (p, c) => (
    <>
      <path d="M16.6 8 L31.4 8 L45 30 L42 38 L6 38 L3 30 Z" fill={p.lit('pn', c)} {...K} />
      <g clipPath={p.clip('pc', 'M16.6 8 L31.4 8 L45 30 L42 38 L6 38 L3 30 Z')}>
        <rect x="0" y="27" width="48" height="2.4" fill="#2a2230" />
        <rect x="0" y="30.4" width="48" height="1.6" fill="#f2e2c0" />
        <rect x="0" y="33" width="48" height="2.4" fill="#2a2230" />
        <path d="M2 21 L46 21" stroke="#f2e2c0" strokeWidth="1" strokeDasharray="2 2" />
      </g>
      <path d="M20 8 Q24 15 28 8" fill="#2a2230" {...K} strokeWidth={0.8} />
      {range(13).map((i) => <path key={i} d={`M${7.4 + i * 2.8} 38.4 v4`} stroke={darken(c, 0.2)} strokeWidth="1" strokeLinecap="round" />)}
      <Shine x={13} y={20} rx={2.8} r={-55} />
    </>
  ),
  'football-shirt': (p, c) => {
    const shirt = 'M16 8 Q24 12 32 8 L43 14 L39.4 22 L35 20 L35 42 L13 42 L13 20 L8.6 22 L5 14 Z'
    const band = c === DEFAULT['football-shirt'] ? '#f1c232' : accent(c)
    return (
      <>
        <path d={shirt} fill={p.lit('s', c)} {...K} />
        <g clipPath={p.clip('sc', shirt)}>
          <rect x="0" y="20.6" width="48" height="7.4" fill={band} />
        </g>
        <path d="M18.6 9.6 Q24 15 29.4 9.6" stroke={band} strokeWidth="1.6" fill="none" />
        <text x="24" y="38.4" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontWeight="800" fontSize="8" fill={band}>10</text>
        <path d={shirt} fill="none" {...K} />
        <Shine x={16.6} y={16} rx={2.2} r={-50} />
      </>
    )
  },
  sombrero: (p, c) => (
    <>
      <ellipse cx="24" cy="31" rx="22" ry="6.4" fill={p.lit('br', c)} {...K} />
      <path d="M4 31 Q24 41 44 31" fill="none" stroke={darken(c, 0.25)} strokeWidth="1.4" strokeDasharray="1.6 1.6" />
      <path d="M14.6 30.4 Q14 12 24 10 Q34 12 33.4 30.4 Q24 33 14.6 30.4 Z" fill={p.lit('cr', c)} {...K} />
      <path d="M14.8 25.6 Q24 28.4 33.2 25.6 L33.4 29.6 Q24 32.4 14.6 29.6 Z" fill="#c0392b" {...K} strokeWidth={0.8} />
      <path d="M16 28 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2" stroke="#f6d36a" strokeWidth="0.8" fill="none" />
      <Shine x={19} y={16} rx={1.8} ry={3.6} r={10} />
    </>
  ),
  fan: (p, c) => {
    const n = 9
    const blades = range(n).map((i) => {
      const a0 = 196 + (i * 148) / n
      const a1 = 196 + ((i + 1) * 148) / n
      return { d: poly([polar(24, 40, 7, a0), polar(24, 40, 21, a0), polar(24, 40, 21, a1), polar(24, 40, 7, a1)]), i }
    })
    return (
      <>
        {range(n + 1).map((i) => {
          const [x, y] = polar(24, 40, 9, 196 + (i * 148) / n)
          return <path key={i} d={`M24 40 L${f(x)} ${f(y)}`} stroke="#8a5a34" strokeWidth="1.2" />
        })}
        {blades.map(({ d, i }) => <path key={i} d={d} fill={i % 2 ? p.lit('a', c) : p.lit('b', lighten(c, 0.25))} stroke={INK} strokeWidth="0.5" strokeOpacity="0.7" />)}
        <path d={'M' + polar(24, 40, 21, 196).map(f).join(' ') + scallops(24, 40, 21, 196, 344, 18, 1.2)} fill="none" stroke={WHITE} strokeWidth="0.9" />
        <path d={'M' + polar(24, 40, 21, 196).map(f).join(' ') + ' A21 21 0 0 1 ' + polar(24, 40, 21, 344).map(f).join(' ') + ' L' + polar(24, 40, 7, 344).map(f).join(' ') + ' A7 7 0 0 0 ' + polar(24, 40, 7, 196).map(f).join(' ') + ' Z'} fill="none" {...K} />
        <Blossom x={24} y={27} r={4} c={WHITE} mid={GOLD} />
        <circle cx="24" cy="40" r="1.6" fill={GOLD} {...K} strokeWidth={0.6} />
      </>
    )
  },
  flower: (p, c) => (
    <>
      <path d="M24 26 Q22 36 25 46" stroke="#4f8a3a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M23.6 36 Q15 33 12 38 Q18 41 23.6 36 Z M24.6 40 Q32 35 36 38.4 Q31 43 24.6 40 Z" fill={p.lit('lf', '#5aa04a')} {...K} strokeWidth={0.8} />
      {range(5).map((i) => {
        const a = -90 + i * 72
        const [x, y] = polar(24, 17, 6.6, a)
        return <ellipse key={i} cx={x} cy={y} rx="6.4" ry="5" transform={`rotate(${a} ${x} ${y})`} fill={p.lit('pt', c)} {...K} strokeWidth={0.8} />
      })}
      <circle cx="24" cy="17" r="3.4" fill="#f6c945" {...K} strokeWidth={0.6} />
      {range(5).map((i) => <circle key={i} cx={polar(24, 17, 1.6, i * 72)[0]} cy={polar(24, 17, 1.6, i * 72)[1]} r="0.5" fill="#b8741e" />)}
    </>
  ),
  lei: (_p, c) => {
    const cols = [c, '#f6c945', WHITE, lighten(c, 0.3)]
    return (
      <>
        {range(12).map((i) => {
          const [x, y] = polar(24, 24, 14.6, -90 + i * 30)
          return <Blossom key={i} x={x} y={y} r={5.2} c={cols[i % 4]!} rot={i * 17} />
        })}
        {range(12).map((i) => {
          const [x, y] = polar(24, 24, 14.6, -75 + i * 30)
          return <path key={i} d={`M${f(x)} ${f(y)} l1.6 -1.6 l1 2.2 Z`} fill="#4f9a4a" />
        })}
      </>
    )
  },
  necklace: (p, c) => {
    const a: Pt = [8, 10]
    const m: Pt = [24, 44]
    const b: Pt = [40, 10]
    return (
      <>
        <path d="M8 10 Q24 44 40 10" fill="none" stroke="#8a6a3a" strokeWidth="0.8" />
        {range(13).map((i) => {
          const [x, y] = quad(a, m, b, 0.04 + (i * 0.92) / 12)
          return <circle key={i} cx={x} cy={y} r={i % 2 ? 1.7 : 2.3} fill={i % 2 ? p.lit('g', GOLD) : p.lit('b', c)} {...K} strokeWidth={0.5} />
        })}
        <path d="M24 28.6 Q30 34 24 41 Q18 34 24 28.6 Z" fill={p.lit('pd', c)} {...K} />
        <circle cx="24" cy="28" r="1.6" fill={GOLD} {...K} strokeWidth={0.5} />
        <Shine x={22.4} y={33} rx={1.4} />
      </>
    )
  },
  bracelet: (p, c) => {
    const bead = (i: number, back: boolean) => {
      const a = (i / 16) * 360
      const [x, y] = [24 + Math.cos(rad(a)) * 14, 24 + Math.sin(rad(a)) * 8]
      if (back !== Math.sin(rad(a)) < 0) return null
      return <circle key={i} cx={x} cy={y} r={back ? 2.4 : 3} fill={i % 2 ? p.lit('g', '#f2d07a') : p.lit('b', c)} {...K} strokeWidth={0.6} opacity={back ? 0.8 : 1} />
    }
    return (
      <>
        {range(16).map((i) => bead(i, true))}
        {range(16).map((i) => bead(i, false))}
        <path d="M24 32 v4" stroke="#8a6a3a" strokeWidth="0.8" />
        <path d="M24 44 C20 41 18 39 18 37 C18 35 20.4 34.4 24 36.6 C27.6 34.4 30 35 30 37 C30 39 28 41 24 44 Z" fill={p.lit('h', GOLD)} {...K} strokeWidth={0.8} />
      </>
    )
  },
  'carnival-mask': (p, c) => (
    <>
      <path d="M12 16 Q4 4 8 1.6 Q13 6 15 15 Z" fill={p.lit('f1', lighten(c, 0.2))} {...K} strokeWidth={0.7} />
      <path d="M15 15 Q15 2 20 0.6 Q21 8 18.4 15.4 Z" fill={p.lit('f2', GOLD)} {...K} strokeWidth={0.7} />
      <path d="M4 20 Q8 14 16 16 Q24 18.6 32 16 Q40 14 44 20 Q44.4 30 34 32 Q28 33 24 28 Q20 33 14 32 Q3.6 30 4 20 Z" fill={p.lit('m', c)} {...K} />
      <ellipse cx="16" cy="23" rx="4.6" ry="3" fill="#2a1a22" stroke={GOLD} strokeWidth="1" />
      <ellipse cx="32" cy="23" rx="4.6" ry="3" fill="#2a1a22" stroke={GOLD} strokeWidth="1" />
      <path d="M6 19.4 Q9 15.4 16 17 Q24 19.6 32 17 Q39 15.4 42 19.4" stroke={GOLD} strokeWidth="1" fill="none" />
      {[10, 24, 38].map((x) => <circle key={x} cx={x} cy={x === 24 ? 21.4 : 27} r="1" fill={WHITE} />)}
    </>
  ),
  gloves: (p, c) => {
    const mitt = 'M-7 14 L-7 -1 Q-12 -3 -12.4 -8 Q-12.6 -12 -8.6 -11.4 L-6.6 -9 Q-7 -16 0 -16.4 Q7.4 -16.4 7 -6 L7 14 Z'
    return (
      <>
        {[{ x: 17, r: -14, s: 1, k: 'a' }, { x: 31, r: 14, s: -1, k: 'b' }].map(({ x, r, s, k }) => (
          <g key={k} transform={`translate(${x} 25) rotate(${r}) scale(${s} 1)`}>
            <path d={mitt} fill={p.lit(k, c)} {...K} />
            <rect x="-7.6" y="9" width="15.2" height="6" rx="1.6" fill="#fbf1da" {...K} strokeWidth={0.8} />
            {[-4.6, -1.6, 1.4, 4.4].map((o) => <path key={o} d={`M${o} 10 v4`} {...L(0.5, 0.4)} />)}
            <path d={starPath(0, -3, 3.6, 1.4, 6)} fill={accent(c)} opacity="0.85" />
          </g>
        ))}
      </>
    )
  },

  // ------------------------------------------------------------ objects
  football: (p) => {
    const clip = p.clip('ball', 'M9 24a15 15 0 1 0 30 0a15 15 0 1 0 -30 0Z')
    return (
      <>
        <circle cx="24" cy="24" r="15" fill={p.lit('w', '#fbfaf4', '#ffffff', '#bdb9b0')} {...K} />
        <g clipPath={clip}>
          <path d={ngon(24, 24, 5.4, 5)} fill="#2b2a30" />
          {range(5).map((i) => {
            const a = -90 + 36 + i * 72
            const [x, y] = polar(24, 24, 15.6, a)
            const [x0, y0] = polar(24, 24, 5.4, a - 36)
            const [x1, y1] = polar(24, 24, 12, a - 36)
            return (
              <g key={i}>
                <path d={ngon(x, y, 5.4, 5, a + 180)} fill="#2b2a30" />
                <path d={`M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)}`} {...L(0.7, 0.5)} />
              </g>
            )
          })}
        </g>
        <Shine x={17.4} y={16.4} rx={3} />
      </>
    )
  },
  flag: (p, c) => {
    const flag = 'M11 8 Q19 4 27 8 T43 8 L43 28 Q35 24 27 28 T11 28 Z'
    return (
      <>
        <Rod d="M10 6 V45" w={1.8} c="#8a5a34" />
        <circle cx="10" cy="5" r="2" fill={GOLD} {...K} strokeWidth={0.6} />
        <path d={flag} fill={p.lit('fl', c)} {...K} />
        <g clipPath={p.clip('fc', flag)}>
          <path d="M11 14.6 Q19 10.6 27 14.6 T43 14.6 L43 21.4 Q35 17.4 27 21.4 T11 21.4 Z" fill={WHITE} />
        </g>
        <circle cx="26" cy="17.6" r="2.4" fill="#f2b632" {...K} strokeWidth={0.5} />
        <path d={flag} fill="none" {...K} />
      </>
    )
  },
  map: (_p) => (
    <>
      <path d="M6 12 L18 9 L18 38 L6 41 Z" fill="#f6ead0" {...K} />
      <path d="M18 9 L30 12 L30 41 L18 38 Z" fill="#e6d3a8" {...K} />
      <path d="M30 12 L42 9 L42 38 L30 41 Z" fill="#f6ead0" {...K} />
      <path d="M8 18 Q12 15 16 19 Q14 24 9 23 Z M32 27 Q37 23 40 27 Q38 33 33 32 Z" fill="#9cc48a" opacity="0.9" />
      <path d="M6 30 Q14 27 20 32 T42 20" stroke="#5f8fd6" strokeWidth="1.2" fill="none" />
      <path d="M10 36 Q16 26 22 28 T36 16" stroke="#d9473b" strokeWidth="1.3" fill="none" strokeDasharray="2 1.6" />
      <path d="M34 13 l4 4 M38 13 l-4 4" stroke="#d9473b" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 9 L18 38" stroke={INK} strokeWidth="0.5" opacity="0.4" />
    </>
  ),
  postcard: (p, c) => (
    <g transform="rotate(-8 24 24)">
      <rect x="5" y="11" width="38" height="26" rx="1.6" fill={p.lit('pc', '#fbf6ea', '#ffffff', '#ddd0b6')} {...K} />
      <rect x="8" y="14" width="15" height="20" fill={p.lin('sky', '#9cc8ec', '#e9f2f7')} />
      <circle cx="18.6" cy="19" r="2.4" fill="#f6c945" />
      <path d="M8 34 L8 28 Q13 23 17 27 Q20 24 23 27 L23 34 Z" fill="#6aa864" />
      <rect x="8" y="14" width="15" height="20" fill="none" stroke={INK} strokeWidth="0.6" />
      <path d="M25.6 14 V34" stroke={INK} strokeWidth="0.5" opacity="0.5" />
      <rect x="33" y="14" width="7" height="8" fill={c} stroke={WHITE} strokeWidth="0.9" strokeDasharray="1 0.6" />
      <path d="M28 25 h12 M28 28.4 h12 M28 31.8 h9" stroke={INK} strokeWidth="0.6" opacity="0.5" />
    </g>
  ),
  book: (p, c) => (
    <>
      <path d="M34 7 L38.6 10 L38.6 43 L34 41 Z" fill="#f6ecd4" {...K} />
      <path d="M35.4 12 V41 M37 12 V42" stroke="#c9b48a" strokeWidth="0.5" />
      <path d="M11 9 L34 7 L34 41 L11 43 Z" fill={p.lit('cv', c)} {...K} />
      <path d="M14 9 L14 43" stroke={darken(c, 0.3)} strokeWidth="1.6" />
      <rect x="18" y="16" width="12" height="7" fill="none" stroke={GOLD} strokeWidth="1" transform="skewY(-5)" />
      <path d="M19.4 18.6 h9 M19.4 21 h6" stroke={GOLD} strokeWidth="0.8" transform="skewY(-5)" />
      <path d="M28 41.6 L28 46 L30 44.4 L32 46 L32 41.2" fill="#d4483c" {...K} strokeWidth={0.6} />
      <Shine x={17} y={13} rx={2} ry={1} r={-6} o={0.4} />
    </>
  ),
  camera: (p, c) => (
    <>
      <rect x="17" y="10" width="14" height="7" rx="1.6" fill={p.lit('vf', SILVER, '#ffffff', '#8e949c')} {...K} />
      <rect x="33" y="11.6" width="5" height="3.4" rx="0.8" fill="#d4483c" {...K} strokeWidth={0.7} />
      <rect x="5" y="15" width="38" height="25" rx="4" fill={p.lit('bd', c)} {...K} />
      <rect x="5" y="15" width="38" height="6.4" rx="3" fill={p.lit('top', SILVER, '#ffffff', '#8e949c')} {...K} strokeWidth={0.8} />
      <circle cx="24" cy="28.6" r="9.4" fill={p.lit('rim', SILVER, '#ffffff', '#6e747c')} {...K} />
      <circle cx="24" cy="28.6" r="6.4" fill={p.lit('ln', '#3a4a6a', '#8fb0e0', '#141a2a')} {...K} strokeWidth={0.8} />
      <circle cx="22" cy="26.6" r="1.8" fill={WHITE} opacity="0.8" />
      <circle cx="9.6" cy="18.2" r="1.4" fill="#2a2830" />
    </>
  ),
  ticket: (p, c) => {
    const t = 'M5 14 H43 V20 A4 4 0 0 0 43 28 V34 H5 V28 A4 4 0 0 0 5 20 Z'
    return (
      <g transform="rotate(-12 24 24)">
        <path d={t} fill={p.lit('t', c)} {...K} />
        <path d="M32 15 V33" stroke={INK} strokeWidth="0.9" strokeDasharray="1.4 1.4" opacity="0.6" />
        <path d={starPath(37.6, 24, 3.6, 1.5)} fill={accent(c)} />
        <rect x="9" y="17.6" width="19" height="12.8" rx="1" fill="none" stroke={accent(c)} strokeWidth="0.9" />
        <path d="M12 21.6 h13 M12 24.6 h10 M12 27.4 h12" stroke={accent(c)} strokeWidth="1" />
      </g>
    )
  },
  key: (p, c) => (
    <g transform="rotate(-25 24 24)">
      <circle cx="12" cy="24" r="6" fill="none" stroke={INK} strokeWidth="4.6" />
      <circle cx="12" cy="24" r="6" fill="none" stroke={p.lit('k', c)} strokeWidth="3" />
      <rect x="17.4" y="22.4" width="26" height="3.2" rx="1" fill={p.lit('k', c)} {...K} strokeWidth={0.8} />
      <path d="M36 25.4 v5 h3 v-3 h2 v4 h2.4 V25.4" fill={p.lit('k', c)} {...K} strokeWidth={0.8} />
      <path d="M7 19.6 Q2 14 6 11.4 Q9 13 8.6 18.4 Z M9 18.6 Q11 12 14.6 13.4 Q13.4 17 9 18.6 Z" fill="#d4483c" {...K} strokeWidth={0.6} />
      <circle cx="10" cy="20.6" r="0.8" fill={WHITE} opacity="0.8" />
    </g>
  ),
  lantern: (p, c) => (
    <>
      <path d="M24 2 V10" stroke={INK} strokeWidth="1" />
      <rect x="18" y="9.4" width="12" height="3.4" rx="1" fill={p.lit('gd', GOLD)} {...K} strokeWidth={0.8} />
      <ellipse cx="24" cy="24.6" rx="14.4" ry="12.4" fill={p.lit('l', c)} {...K} />
      {[-9, -4.4, 0, 4.4, 9].map((o) => <path key={o} d={`M${24 + o * 0.6} 12.6 Q${24 + o * 1.7} 24.6 ${24 + o * 0.6} 36.6`} {...L(0.7, 0.45)} />)}
      <rect x="18" y="36" width="12" height="3.4" rx="1" fill={p.lit('gd', GOLD)} {...K} strokeWidth={0.8} />
      {[-2.4, -0.8, 0.8, 2.4].map((o) => <path key={o} d={`M${24 + o} 39.6 V46`} stroke={o % 1.6 ? '#f2b632' : c} strokeWidth="1" />)}
      <Shine x={16.4} y={19} rx={2.4} ry={4} r={20} o={0.45} />
    </>
  ),
  kite: (p, c) => (
    <>
      <path d="M24 36 Q20 41 14 40 Q8 39 5 46" stroke={INK} strokeWidth="0.8" fill="none" />
      {([[17, 40], [9, 40.6]] as Pt[]).map(([x, y], i) => <path key={i} d={`M${x} ${y} l-2.4 -2 v4 Z M${x} ${y} l2.4 -2 v4 Z`} fill={i ? c : '#f6c945'} {...K} strokeWidth={0.5} />)}
      <path d="M24 4 L38 18 L24 36 Z" fill={p.lit('a', c)} {...K} />
      <path d="M24 4 L10 18 L24 36 Z" fill={p.lit('b', lighten(c, 0.4))} {...K} />
      <path d="M10 18 L38 18" stroke={INK} strokeWidth="0.8" />
      <path d="M24 18 L38 18 L24 36 Z" fill={darken(c, 0.2)} opacity="0.35" />
    </>
  ),
  'toy-boat': (p, c) => (
    <>
      <path d="M24.6 7 L24.6 28 L39 28 Z" fill={p.lit('s1', '#fbf6ea', '#ffffff', '#d6cbb4')} {...K} />
      <path d="M23.4 9 L23.4 28 L11 28 Z" fill={p.lit('s2', lighten(c, 0.55))} {...K} />
      <path d="M24 30 V5" stroke="#6b3a1f" strokeWidth="1.4" />
      <path d="M24 5 L30 6.6 L24 8.4 Z" fill={c} />
      <path d="M5 29 L43 29 L37 38 L11 38 Z" fill={p.lit('h', c)} {...K} />
      <path d="M7.4 32 L40.6 32" stroke={WHITE} strokeWidth="1.4" />
      <path d="M4 42 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0" stroke="#5f9ad8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
  shell: (p, c) => (
    <>
      <path d="M18 36 L30 36 L28.4 42 L19.6 42 Z" fill={p.lit('e', darken(c, 0.1))} {...K} />
      <path d={'M24 40 L' + polar(24, 40, 19, 200).map(f).join(' ') + scallops(24, 40, 19, 200, 340, 9, 2.2) + ' Z'} fill={p.lit('s', c)} {...K} />
      {range(8).map((i) => {
        const [x, y] = polar(24, 40, 19.4, 207.8 + i * 15.6 + 7.8)
        return <path key={i} d={`M24 40 L${f(x)} ${f(y)}`} {...L(0.8, 0.45)} />
      })}
      <Shine x={17.6} y={27} rx={2.6} />
    </>
  ),
  stone: (p, c) => (
    <>
      <ellipse cx="24" cy="37" rx="15.6" ry="6.4" fill={p.lit('a', darken(c, 0.1))} {...K} />
      <ellipse cx="23" cy="27.4" rx="11.4" ry="5" fill={p.lit('b', c)} {...K} />
      <ellipse cx="25" cy="19.4" rx="7.4" ry="4" fill={p.lit('c', lighten(c, 0.15))} {...K} />
      <path d="M12 37 Q24 33 36 38" stroke={WHITE} strokeWidth="1" fill="none" opacity="0.55" />
      <Shine x={20} y={17.6} rx={2} />
      <Shine x={16} y={25.4} rx={2.4} o={0.45} />
    </>
  ),
  feather: (p, c) => (
    <g transform="rotate(-35 24 24)">
      <path d="M24 3 Q33.6 14 31.4 30 Q29 38 24 41 Q19 38 16.6 30 Q14.4 14 24 3 Z" fill={p.lit('f', c)} {...K} />
      <path d="M31 22 L27 25 L31 28 Z M17 16 L21 19 L16.4 21 Z" fill={WHITE} />
      {range(7).map((i) => <path key={i} d={`M24 ${10 + i * 4} L${18 + (i > 4 ? 1.6 : 0)} ${6 + i * 4.4} M24 ${10 + i * 4} L${30 - (i > 4 ? 1.6 : 0)} ${6 + i * 4.4}`} {...L(0.55, 0.4)} />)}
      <path d="M24 6 V46" stroke="#f4ead6" strokeWidth="1.2" />
      <path d="M24 6 V46" stroke={INK} strokeWidth="0.4" opacity="0.5" />
    </g>
  ),
  compass: (p, c) => (
    <>
      <circle cx="24" cy="6.4" r="3" fill="none" stroke={INK} strokeWidth="3" />
      <circle cx="24" cy="6.4" r="3" fill="none" stroke={GOLD} strokeWidth="1.8" />
      <circle cx="24" cy="25" r="16" fill={p.lit('b', '#d6a54a', '#f6dc96', '#946a1e')} {...K} />
      <circle cx="24" cy="25" r="12.4" fill="#fbf4e2" {...K} strokeWidth={0.8} />
      {range(8).map((i) => {
        const [x0, y0] = polar(24, 25, 10.4, i * 45)
        const [x1, y1] = polar(24, 25, 12, i * 45)
        return <path key={i} d={`M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)}`} stroke={INK} strokeWidth={i % 2 ? 0.5 : 1} />
      })}
      <path d="M24 15 L27 25 L21 25 Z" fill={c} {...K} strokeWidth={0.6} />
      <path d="M24 35 L27 25 L21 25 Z" fill="#5a5e6a" {...K} strokeWidth={0.6} />
      <circle cx="24" cy="25" r="1.4" fill={GOLD} {...K} strokeWidth={0.5} />
    </>
  ),
  keychain: (p, c) => (
    <>
      <circle cx="16" cy="11" r="6.4" fill="none" stroke={INK} strokeWidth="3.6" />
      <circle cx="16" cy="11" r="6.4" fill="none" stroke={SILVER} strokeWidth="2.2" />
      <ellipse cx="20.6" cy="19.4" rx="1.8" ry="2.8" fill="none" stroke={INK} strokeWidth="1.2" transform="rotate(-30 20.6 19.4)" />
      <ellipse cx="23.4" cy="23.4" rx="1.8" ry="2.8" fill="none" stroke={INK} strokeWidth="1.2" transform="rotate(20 23.4 23.4)" />
      <g transform="rotate(14 29 33)">
        <rect x="18" y="25" width="22" height="18" rx="5" fill={p.lit('t', c)} {...K} />
        <circle cx="29" cy="36" r="3.6" fill={accent(c)} />
        {[-4.4, -1.6, 1.6, 4.4].map((o, i) => <ellipse key={o} cx={29 + o} cy={i % 3 ? 30 : 31.6} rx="1.4" ry="1.8" fill={accent(c)} />)}
      </g>
    </>
  ),
  snowglobe: (p) => (
    <>
      <circle cx="24" cy="21" r="15" fill={p.lit('g', '#d8ecf7', '#ffffff', '#9cc0d8')} {...K} />
      <path d="M10 26 Q24 22 38 26 A15 15 0 0 1 10 26 Z" fill={WHITE} />
      <path d="M18 26 V20 L22 16.6 L26 20 V26 Z" fill="#d4483c" {...K} strokeWidth={0.6} />
      <path d="M17 20.4 L22 15.6 L27 20.4" fill="none" stroke={WHITE} strokeWidth="1.2" />
      <path d="M30.6 26 L30.6 22 M27.4 23 L30.6 14 L33.8 23 Z" fill="#3f8f5f" stroke="#3f8f5f" strokeWidth="0.8" />
      {([[15, 12], [21, 9], [30, 11], [33, 17], [14, 18], [26, 13]] as Pt[]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.9" fill={WHITE} />)}
      <path d="M13 13 A13 13 0 0 1 21 8" stroke={WHITE} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d="M11 35 L37 35 L40 44 L8 44 Z" fill={p.lit('base', '#9a6a3e', '#c4945e', '#5a3818')} {...K} />
      <path d="M10 38.6 H38" stroke={GOLD} strokeWidth="1.2" />
    </>
  ),
  figurine: (p, c) => (
    <>
      <Cyl top={38} bot={42} rx={11} ry={3} side="#c9b48a" cap="#e6d6b0" />
      <path d="M31 26 Q38 14 34 6 Q30 14 27 20 Z" fill={p.lit('tl', c)} {...K} strokeWidth={0.8} />
      <path d="M14 30 Q14 20 22 19 Q31 19 33 28 Q32 36 24 38 Q15 37 14 30 Z" fill={p.lit('bd', '#f6f1e6', '#ffffff', '#d2c6ae')} {...K} />
      <path d="M17 29 Q24 24 30 29 Q24 33 17 29 Z" fill={c} opacity="0.85" />
      <circle cx="17" cy="16" r="5.4" fill={p.lit('bd', '#f6f1e6', '#ffffff', '#d2c6ae')} {...K} />
      <path d="M15 11.4 Q16 8 17.4 10.6 Q18.4 7.6 19.6 11" fill="#d4483c" {...K} strokeWidth={0.6} />
      <path d="M11.8 16 L8.6 17.4 L11.8 18.4 Z" fill="#f2b632" {...K} strokeWidth={0.5} />
      <circle cx="15.6" cy="15.4" r="0.9" fill="#1b1416" />
      <path d="M21 33 l1.4 1.4 l1.4 -1.4 M25 33 l1.4 1.4 l1.4 -1.4" stroke={c} strokeWidth="0.8" fill="none" />
    </>
  ),
  painting: (p, c) => (
    <>
      <path d="M14 36 L10 46 M34 36 L38 46 M24 36 V45" stroke="#8a5a34" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="6" y="6" width="36" height="30" rx="1" fill={p.lit('fr', c)} {...K} />
      <rect x="10" y="10" width="28" height="22" fill={p.lin('sky', '#a8d0f0', '#f6efd8')} {...K} strokeWidth={0.7} />
      <circle cx="31" cy="15.6" r="2.8" fill="#f6c945" />
      <path d="M10 32 L10 25 Q16 19 22 24 Q28 18 38 24 L38 32 Z" fill="#6aa864" />
      <path d="M15 30 Q15 23 16.4 20 Q17.8 23 17.6 30 Z" fill="#2f6a3a" />
      <path d="M8 8 h32" stroke={WHITE} strokeWidth="0.8" opacity="0.6" />
    </>
  ),
  vase: (p, c) => (
    <>
      <path d="M17 13 Q10 13 12 19 M31 13 Q38 13 36 19" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M17 13 Q11 13 12.6 18.6 M31 13 Q37 13 35.4 18.6" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M18 6 L30 6 L29 11 Q38 17 37 29 Q36 39 30 43 L18 43 Q12 39 11 29 Q10 17 19 11 Z" fill={p.lit('v', c)} {...K} />
      <ellipse cx="24" cy="6" rx="6.4" ry="1.6" fill={darken(c, 0.3)} {...K} strokeWidth={0.8} />
      <path d="M12.6 22 Q24 26 35.4 22 M11.6 32 Q24 36 36.4 32" stroke={accent(c)} strokeWidth="1.2" fill="none" />
      <path d="M13 27 l2.6 -2 l2.6 2 l2.6 -2 l2.6 2 l2.6 -2 l2.6 2 l2.6 -2 l2.6 2" stroke={accent(c)} strokeWidth="0.9" fill="none" />
      <Shine x={16} y={20} rx={1.8} ry={4} r={15} o={0.45} />
    </>
  ),
  candle: (p, c) => (
    <>
      <ellipse cx="24" cy="40" rx="13.6" ry="3.6" fill={p.lit('dish', GOLD)} {...K} />
      <circle cx="24" cy="10" r="7" fill="#ffd36a" opacity="0.25" />
      <Cyl top={18} bot={39} rx={7.4} ry={2.4} side={p.lit('w', c)} cap={lighten(c, 0.3)} />
      <path d="M17.6 18.6 Q17 24 18.6 25 Q19.6 21 20 19.6 M27 19.4 Q28.4 22 29.6 21" stroke={lighten(c, 0.3)} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M24 17.6 V14" stroke={INK} strokeWidth="0.9" />
      <path d="M24 4 Q28.4 9.4 26.4 12.6 Q24 15.4 21.6 12.6 Q19.6 9.4 24 4 Z" fill={p.lit('fl', '#f6b13a', '#fff6c4', '#e2702a')} {...K} strokeWidth={0.6} />
      <Shine x={19.6} y={28} rx={1.2} ry={4} r={0} o={0.5} />
    </>
  ),
  perfume: (p, c) => (
    <>
      <path d="M27 14 Q34 8 38 10" stroke={INK} strokeWidth="1" fill="none" />
      <circle cx="40" cy="11.6" r="3.6" fill={p.lit('bulb', '#d4483c')} {...K} strokeWidth={0.8} />
      <rect x="20.6" y="11" width="6.8" height="7" rx="1" fill={p.lit('cap', GOLD)} {...K} strokeWidth={0.8} />
      <path d="M12 25 Q12 18 18 18 L30 18 Q36 18 36 25 L36 38 Q36 43 31 43 L17 43 Q12 43 12 38 Z" fill={p.lin('gl', '#ffffffdd', '#e8eef4cc')} {...K} />
      <path d="M13 27 Q24 30 35 27 L35 38 Q35 42 31 42 L17 42 Q13 42 13 38 Z" fill={p.lit('lq', c)} opacity="0.9" />
      <path d="M14 20 Q13 25 14 32" stroke={WHITE} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
    </>
  ),
  soap: (p, c) => (
    <>
      <circle cx="35" cy="10" r="4" fill="#ffffff80" {...K} strokeWidth={0.6} />
      <circle cx="28" cy="7" r="2.4" fill="#ffffff80" {...K} strokeWidth={0.5} />
      <circle cx="40" cy="17" r="1.8" fill="#ffffff80" {...K} strokeWidth={0.5} />
      <path d="M30 26 L42 19 L42 28 L30 35.6 Z" fill={darken(c, 0.2)} {...K} />
      <path d="M6 22 L30 26 L30 35.6 L6 31 Z" fill={p.lit('fr', darken(c, 0.05))} {...K} />
      <path d="M6 22 L19 15.6 L42 19 L30 26 Z" fill={p.lit('top', lighten(c, 0.15))} {...K} />
      <ellipse cx="24" cy="20.6" rx="7" ry="2.8" fill="none" stroke={darken(c, 0.3)} strokeWidth="0.8" />
      <path d="M20.6 20.6 h6.8" stroke={darken(c, 0.3)} strokeWidth="0.8" />
    </>
  ),
  cactus: (p, c) => (
    <>
      <path d="M19 26 Q12 26 12 19 L12 15" stroke={INK} strokeWidth="7.2" fill="none" strokeLinecap="round" />
      <path d="M29 22 Q36 22 36 16 L36 13" stroke={INK} strokeWidth="7.2" fill="none" strokeLinecap="round" />
      <path d="M19 26 Q12 26 12 19 L12 15" stroke="#5aa04a" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M29 22 Q36 22 36 16 L36 13" stroke="#5aa04a" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="18.6" y="8" width="10.8" height="28" rx="5.4" fill={p.lit('c', '#5aa04a')} {...K} />
      <path d="M24 10 V35 M21.4 12 V35" {...L(0.6, 0.4)} />
      <Blossom x={24} y={8} r={4.4} c={c} />
      <path d="M13 34 L35 34 L32 45 L16 45 Z" fill={p.lit('pot', '#d0703e', '#eea070', '#8a3a1a')} {...K} />
      <rect x="11.4" y="31.6" width="25.2" height="4.4" rx="1" fill="#c0642e" {...K} />
    </>
  ),
  leaf: (p, c) => (
    <g transform="rotate(25 24 24)">
      <path d="M24 46 V36" stroke={darken(c, 0.3)} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24 37 Q8 32 9 18 Q12 7 24 3 Q36 7 39 18 Q40 32 24 37 Z" fill={p.lit('l', c)} {...K} />
      <path d="M24 36 V6" stroke={lighten(c, 0.4)} strokeWidth="1" />
      {range(4).map((i) => <path key={i} d={`M24 ${30 - i * 6} Q${18 - i} ${27 - i * 6} ${14 + i * 1.4} ${22 - i * 6.4} M24 ${30 - i * 6} Q${30 + i} ${27 - i * 6} ${34 - i * 1.4} ${22 - i * 6.4}`} stroke={lighten(c, 0.35)} strokeWidth="0.7" fill="none" />)}
    </g>
  ),
  star: (p, c) => (
    <>
      <path d={starPath(24, 25, 18, 8)} fill={p.lit('s', c)} {...K} strokeWidth={1.3} />
      <path d={starPath(24, 25, 11, 5)} fill={lighten(c, 0.25)} opacity="0.5" />
      <path d="M40 6 v5 M37.5 8.5 h5 M8 36 v4 M6 38 h4" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <Shine x={18} y={18} rx={2.2} />
    </>
  ),
  medal: (p, c) => (
    <>
      <path d="M13 3 L21 3 L27.6 21 L21.4 23 Z" fill={p.lit('r1', c)} {...K} strokeWidth={0.8} />
      <path d="M35 3 L27 3 L20.4 21 L26.6 23 Z" fill={p.lit('r2', darken(c, 0.1))} {...K} strokeWidth={0.8} />
      <path d="M16.8 3 L23.4 21.6 M31.2 3 L24.6 21.6" stroke={accent(c)} strokeWidth="1" />
      <circle cx="24" cy="32" r="10.4" fill={p.lit('m', GOLD, '#fff0b0', '#a8741a')} {...K} />
      <circle cx="24" cy="32" r="7.6" fill="none" stroke="#a8741a" strokeWidth="0.8" />
      <path d={starPath(24, 32.4, 4.6, 2)} fill="#c8902a" />
      <Shine x={19.6} y={27.6} rx={2} />
    </>
  ),
  tile: (p, c) => (
    <>
      <rect x="8.6" y="8.6" width="34" height="34" rx="2" fill={darken(c, 0.25)} opacity="0.5" />
      <rect x="6" y="6" width="34" height="34" rx="2" fill={p.lit('t', '#f8f5ec', '#ffffff', '#ddd6c6')} {...K} />
      <g fill={c}>
        <path d="M6 14 A8 8 0 0 0 14 6 L6 6 Z M40 14 A8 8 0 0 1 32 6 L40 6 Z M6 32 A8 8 0 0 1 14 40 L6 40 Z M40 32 A8 8 0 0 0 32 40 L40 40 Z" />
        {range(4).map((i) => <ellipse key={i} cx={polar(23, 23, 5, i * 90)[0]} cy={polar(23, 23, 5, i * 90)[1]} rx="4.6" ry="2.6" transform={`rotate(${i * 90} ${polar(23, 23, 5, i * 90)[0]} ${polar(23, 23, 5, i * 90)[1]})`} />)}
      </g>
      <path d={ngon(23, 23, 13, 4, 0)} fill="none" stroke={c} strokeWidth="1" />
      <circle cx="23" cy="23" r="2" fill="#f2c03a" />
    </>
  ),
  chopsticks: (p, c) => (
    <>
      <ellipse cx="16" cy="38" rx="6" ry="2.6" fill={p.lit('rest', '#f4efe4', '#ffffff', '#c9c0ae')} {...K} />
      <path d="M8 41.6 L42 6" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M8 41.6 L42 6" stroke={p.lin('s', lighten(c, 0.2), darken(c, 0.2), 'd')} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13 44 L44 11" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M13 44 L44 11" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M36.4 12 L38.4 13.8 M38.4 17 L40.4 18.8" stroke={GOLD} strokeWidth="2.4" />
    </>
  ),
  abacus: (p, c) => (
    <>
      <rect x="5" y="8" width="38" height="32" rx="2" fill="none" stroke={INK} strokeWidth="5.4" />
      <rect x="5" y="8" width="38" height="32" rx="2" fill="none" stroke={p.lit('w', '#9a6a3e', '#c4945e', '#5a3818')} strokeWidth="3.8" />
      <rect x="6" y="9" width="36" height="30" fill="#fbf3e2" opacity="0.6" />
      <path d="M7 18 H41" stroke="#7a4a2a" strokeWidth="2" />
      {range(5).map((i) => {
        const x = 10.6 + i * 6.7
        const ups = i % 2 ? 1 : 0
        return (
          <g key={i}>
            <path d={`M${x} 10 V38`} stroke="#8a6a3a" strokeWidth="0.7" />
            {[0, 1].map((k) => <ellipse key={k} cx={x} cy={k === 0 ? 12.6 : 15.4 - (ups ? 0 : 2.8)} rx="2.8" ry="1.4" fill={p.lit('b', c)} {...K} strokeWidth={0.5} opacity={k === 1 && !ups ? 0 : 1} />)}
            {range(4).map((k) => <ellipse key={k} cx={x} cy={(i % 3 === 0 ? 21.6 : 25) + k * 3.2} rx="2.8" ry="1.4" fill={k % 2 ? p.lit('d', '#3a3640') : p.lit('b', c)} {...K} strokeWidth={0.5} />)}
          </g>
        )
      })}
    </>
  ),
  bell: (p, c) => (
    <>
      <circle cx="24" cy="6" r="2.6" fill="none" stroke={INK} strokeWidth="2.6" />
      <circle cx="24" cy="6" r="2.6" fill="none" stroke={c} strokeWidth="1.4" />
      <circle cx="24" cy="39" r="3.4" fill={p.lit('cl', darken(c, 0.1))} {...K} strokeWidth={0.8} />
      <path d="M24 8.4 Q13.6 8.6 13 24 Q12.6 32 7.4 35 L40.6 35 Q35.4 32 35 24 Q34.4 8.6 24 8.4 Z" fill={p.lit('b', c)} {...K} />
      <rect x="6.6" y="33.6" width="34.8" height="3.6" rx="1.8" fill={darken(c, 0.15)} {...K} strokeWidth={0.8} />
      <path d="M15.4 28 Q24 31 32.6 28" stroke={darken(c, 0.25)} strokeWidth="0.9" fill="none" />
      <path d="M24 11 L16 6 Q14.6 10 17 12 Z M24 11 L32 6 Q33.4 10 31 12 Z" fill="#d4483c" {...K} strokeWidth={0.6} />
      <Shine x={18.4} y={18} rx={1.6} ry={4} r={10} />
    </>
  ),
  scroll: (p, c) => (
    <>
      <path d="M17 6 L24 1.6 L31 6" stroke={INK} strokeWidth="0.8" fill="none" />
      <rect x="12" y="7" width="24" height="33" fill={c} {...K} />
      <rect x="15" y="10" width="18" height="27" fill={p.lit('pa', '#f6ead0', '#fffaf0', '#dcc89c')} {...K} strokeWidth={0.6} />
      {[27.4, 21.6].map((x) => <path key={x} d={`M${x} 13 h2 M${x + 1} 15.4 v3 M${x - 0.4} 20 h2.8 M${x + 1} 22 l-1.4 2.4 M${x + 1} 22 l1.4 2.4 M${x} 27 h2 v2`} stroke="#2a2230" strokeWidth="1.1" strokeLinecap="round" fill="none" />)}
      <rect x="17" y="30" width="3.4" height="3.4" fill="#d4483c" />
      {[6.4, 40.6].map((y) => (
        <g key={y}>
          <rect x="9" y={y - 1.6} width="30" height="3.2" rx="1.6" fill={p.lit('rod', '#8a5a34', '#c49060', '#4a2a14')} {...K} strokeWidth={0.8} />
          <circle cx="8.6" cy={y} r="2" fill={GOLD} {...K} strokeWidth={0.5} />
          <circle cx="39.4" cy={y} r="2" fill={GOLD} {...K} strokeWidth={0.5} />
        </g>
      ))}
    </>
  ),
  mirror: (p, c) => (
    <g transform="rotate(18 24 24)">
      <rect x="21.6" y="30" width="4.8" height="15" rx="2.4" fill={p.lit('h', c)} {...K} />
      <ellipse cx="24" cy="18" rx="12.6" ry="14.4" fill={p.lit('fr', c)} {...K} />
      <ellipse cx="24" cy="18" rx="9.4" ry="11.2" fill={p.lit('gl', '#dfeef6', '#ffffff', '#8fb2c8')} {...K} strokeWidth={0.8} />
      <path d="M18 14 L23 9 M18.6 19 L27 10.6" stroke={WHITE} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      {range(8).map((i) => <circle key={i} cx={24 + Math.cos(rad(i * 45)) * 11} cy={18 + Math.sin(rad(i * 45)) * 12.8} r="0.7" fill={WHITE} opacity="0.8" />)}
    </g>
  ),
  puppet: (p, c) => (
    <>
      <path d="M10 6 H38 M24 2 V10" stroke="#8a5a34" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 6 L14 27 M38 6 L34 27 M24 10 V14 M17 6 L20 41 M31 6 L28 41" stroke={INK} strokeWidth="0.5" opacity="0.7" />
      <path d="M18 22 L14 27 M30 22 L34 27" stroke="#f0c8a0" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 34 L20 41 M27 34 L28 41" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24 20 L32 35 L16 35 Z" fill={p.lit('d', c)} {...K} />
      <path d="M18 31 h12" stroke={accent(c)} strokeWidth="1" />
      <circle cx="24" cy="16.6" r="4.6" fill={p.lit('hd', '#f6d2ae', '#fff0de', '#d4a07a')} {...K} />
      <path d="M19 14.6 Q24 7 29 14.6 Z" fill={darken(c, 0.2)} {...K} strokeWidth={0.7} />
      <circle cx="22.4" cy="17" r="0.7" fill={INK} />
      <circle cx="25.6" cy="17" r="0.7" fill={INK} />
      <circle cx="21" cy="18.6" r="1" fill="#f19a8e" opacity="0.6" />
    </>
  ),
  origami: (p, c) => (
    <>
      <path d="M4 12 L19 31 L23 31 Z" fill={p.lit('t', lighten(c, 0.15))} {...K} strokeWidth={0.8} />
      <path d="M44 10 L29 31 L25 31 Z" fill={p.lit('n', c)} {...K} strokeWidth={0.8} />
      <path d="M44 10 L39 10.6 L41.6 14.6 Z" fill={darken(c, 0.2)} {...K} strokeWidth={0.6} />
      <path d="M15 31 L24 40 L33 31 Z" fill={darken(c, 0.15)} {...K} />
      <path d="M17 31 L27 5 L31 31 Z" fill={p.lit('w', lighten(c, 0.3))} {...K} />
      <path d="M24 31 L27 5" stroke={darken(c, 0.25)} strokeWidth="0.6" />
      <path d="M15 31 H33" stroke={INK} strokeWidth="0.8" />
    </>
  ),
  pinwheel: (p, c) => (
    <>
      <Rod d="M24 24 L29 46" w={1.8} c="#c99a5a" />
      {range(4).map((i) => {
        const a = -90 + i * 90
        const [tx, ty] = polar(24, 22, 17, a)
        const [bx, by] = polar(24, 22, 9, a + 90)
        const [qx, qy] = polar(24, 22, 15, a + 50)
        return <path key={i} d={`M24 22 L${f(tx)} ${f(ty)} Q${f(qx)} ${f(qy)} ${f(bx)} ${f(by)} Z`} fill={i % 2 ? p.lit('a', c) : p.lit('b', lighten(c, 0.5))} {...K} strokeWidth={0.8} />
      })}
      <circle cx="24" cy="22" r="2" fill={GOLD} {...K} strokeWidth={0.6} />
    </>
  ),

  // ------------------------------------------------------------ wardrobe
  beret: (p, c) => (
    <>
      <path d="M5 30 Q2 20 17 16.6 Q30 14 40 19.4 Q47 24 43 30.6 Q37 35 24 34.4 Q11 34.4 5 30 Z" fill={p.lit('b', c)} {...K} />
      <path d="M10.6 30.6 Q24 36.6 38.6 30.6 L38.4 33.6 Q24 39 10.8 33.6 Z" fill={darken(c, 0.25)} {...K} strokeWidth={0.9} />
      <path d="M24 16 Q24.4 12.6 26.4 11.6" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M24 16 Q24.4 12.6 26.4 11.6" stroke={darken(c, 0.15)} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M12 24 Q20 20 30 21" {...L(0.7, 0.35)} />
      <Shine x={14} y={21} rx={3.4} r={-15} o={0.45} />
    </>
  ),
  cap: (p, c) => (
    <>
      <path d="M10 32 Q9 14 24 13.6 Q39 14 38 32 Z" fill={p.lit('d', c)} {...K} />
      <path d="M24 14 V32 M17 15.6 Q15 23 15.6 32 M31 15.6 Q33 23 32.4 32" {...L(0.7, 0.4)} />
      <circle cx="24" cy="13.6" r="1.6" fill={darken(c, 0.2)} {...K} strokeWidth={0.6} />
      <circle cx="24" cy="24.6" r="3.4" fill={accent(c)} />
      <path d="M8.6 31 Q24 35.4 39.4 31 Q41.6 35.6 37 38.6 Q24 41.6 11 38.6 Q6.4 35.6 8.6 31 Z" fill={p.lit('br', darken(c, 0.12))} {...K} />
      <Shine x={16} y={19} rx={2.6} r={-40} o={0.45} />
    </>
  ),
  beanie: (p, c) => (
    <>
      <path d="M9 31 Q8 13 24 12.6 Q40 13 39 31 Z" fill={p.lit('d', c)} {...K} />
      {range(6).map((i) => <path key={i} d={`M${12.6 + i * 4.6} 29 l1.6 -2.4 l1.6 2.4 M${12.6 + i * 4.6} 24 l1.6 -2.4 l1.6 2.4`} stroke={darken(c, 0.2)} strokeWidth="0.7" fill="none" />)}
      <path d="M7.6 29 L40.4 29 L40.4 36 Q24 39 7.6 36 Z" fill={p.lit('cf', lighten(c, 0.12))} {...K} />
      {range(11).map((i) => <path key={i} d={`M${10.4 + i * 2.8} 30 V${36.4 + (i > 2 && i < 8 ? 0.8 : 0)}`} stroke={darken(c, 0.25)} strokeWidth="0.6" />)}
      <circle cx="24" cy="10" r="5.4" fill={p.lit('pom', lighten(c, 0.45))} {...K} />
      <Shine x={15} y={18} rx={2.6} r={-40} o={0.45} />
    </>
  ),
  sunhat: (p, c) => (
    <>
      <path d="M2 31 Q4 25 14 25 L34 25 Q44 25 46 31 Q44 37 34 37.4 Q24 39 14 37.4 Q4 37 2 31 Z" fill={p.lit('br', c)} {...K} />
      <path d="M13.6 28 Q13 15 24 15 Q35 15 34.4 28 Q24 31 13.6 28 Z" fill={p.lit('cr', c)} {...K} />
      <path d="M13.8 24 Q24 27.6 34.2 24 L34.4 28 Q24 31.4 13.6 28 Z" fill={accent(c)} {...K} strokeWidth={0.8} />
      <path d="M34 26 q4 -3 6 -0.4 q-2 2.4 -6 0.4 Z M34 26 q3 1.4 4 4.4" fill={accent(c)} stroke={INK} strokeWidth="0.6" />
      <path d="M6 32 Q24 37 42 32" {...L(0.6, 0.35)} />
      <Shine x={18.6} y={19.6} rx={2.4} r={-30} o={0.45} />
    </>
  ),
  'bucket-hat': (p, c) => (
    <>
      <path d="M14 28 L16 15 Q24 12 32 15 L34 28 Z" fill={p.lit('cr', c)} {...K} />
      <path d="M14.6 28 L33.4 28 L41.6 34.6 Q24 40.6 6.4 34.6 Z" fill={p.lit('br', darken(c, 0.1))} {...K} />
      <path d="M10.4 34 Q24 38.4 37.6 34" stroke={lighten(c, 0.4)} strokeWidth="0.7" strokeDasharray="1.4 1.2" fill="none" />
      <path d="M15.6 22 Q24 24 32.4 22" stroke={lighten(c, 0.4)} strokeWidth="0.7" strokeDasharray="1.4 1.2" fill="none" />
      <Shine x={19} y={18} rx={2.2} r={-30} o={0.45} />
    </>
  ),
  scarf: (p, c) => {
    const stripe = accent(c)
    return (
      <>
        <path d="M27 21 L34 19.4 L37 36 L30 38 Z" fill={p.lit('t2', darken(c, 0.08))} {...K} />
        <path d="M30.6 33.4 L36.2 31.8 M29.6 28 L35.2 26.4" stroke={stripe} strokeWidth="1.6" />
        {range(4).map((i) => <path key={i} d={`M${30.6 + i * 1.8} ${38 - i * 0.5} v3`} stroke={c} strokeWidth="0.9" strokeLinecap="round" />)}
        <path d="M8 13 Q24 23 40 13 L40 21 Q24 31 8 21 Z" fill={p.lit('band', c)} {...K} />
        <path d="M13 22 L20 23.6 L18.6 42 L11 41 Z" fill={p.lit('t1', c)} {...K} />
        <path d="M12 36 L19 37 M12.4 31 L19.4 32" stroke={stripe} strokeWidth="1.6" />
        {range(4).map((i) => <path key={i} d={`M${11.6 + i * 2.2} ${41.2 + i * 0.2} v3.2`} stroke={c} strokeWidth="0.9" strokeLinecap="round" />)}
        <path d="M10 15.6 Q24 24.6 38 15.6" stroke={stripe} strokeWidth="1.2" fill="none" opacity="0.8" />
        <Shine x={14} y={17.6} rx={2.4} r={25} o={0.45} />
      </>
    )
  },
  bandana: (p, c) => (
    <>
      <path d="M8 15 Q24 22 40 15 L24 40 Z" fill={p.lit('t', c)} {...K} />
      {([[17, 21], [24, 24], [31, 21], [21, 29], [27, 29], [24, 34.4]] as Pt[]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill={accent(c)} />)}
      <path d="M6 12 Q24 19.6 42 12 L41 16.4 Q24 24 7 16.4 Z" fill={p.lit('band', darken(c, 0.1))} {...K} />
      <path d="M8 14 Q24 21 40 14" stroke={accent(c)} strokeWidth="0.7" strokeDasharray="1.2 1.4" fill="none" />
    </>
  ),
  bowtie: (p, c) => (
    <>
      <path d="M24 24 L8.6 15.4 Q5 24 8.6 32.6 Z" fill={p.lit('l', c)} {...K} />
      <path d="M24 24 L39.4 15.4 Q43 24 39.4 32.6 Z" fill={p.lit('l', c)} {...K} />
      <path d="M11.6 20 Q14 24 11.6 28 M36.4 20 Q34 24 36.4 28" {...L(0.7, 0.4)} />
      {([[13.6, 18.6], [15.6, 27.6], [34.4, 18.6], [32.4, 27.6]] as Pt[]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill={accent(c)} />)}
      <rect x="20.6" y="19.6" width="6.8" height="8.8" rx="2" fill={p.lit('k', darken(c, 0.12))} {...K} />
      <Shine x={12} y={19.6} rx={1.8} />
    </>
  ),
  sunglasses: (p, c) => (
    <>
      <path d="M6 22 L1.6 20 M42 22 L46.4 20" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6 22 L1.6 20 M42 22 L46.4 20" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M19.6 21.6 Q24 19 28.4 21.6" stroke={INK} strokeWidth="3" fill="none" />
      <path d="M19.6 21.6 Q24 19 28.4 21.6" stroke={c} strokeWidth="1.6" fill="none" />
      {[14, 34].map((x) => (
        <g key={x}>
          <path d={`M${x - 8} 19.4 Q${x - 8} 18 ${x - 6.4} 18 L${x + 6.4} 18 Q${x + 8} 18 ${x + 8} 19.4 L${x + 7.4} 25 Q${x + 6.4} 30.6 ${x} 30.6 Q${x - 6.4} 30.6 ${x - 7.4} 25 Z`} fill={p.lit('fr', c)} {...K} />
          <path d={`M${x - 6.2} 20 L${x + 6.2} 20 L${x + 5.8} 24.8 Q${x + 5} 28.8 ${x} 28.8 Q${x - 5} 28.8 ${x - 5.8} 24.8 Z`} fill={p.lin('ln', mix(c, '#1d1a2a', 0.55), '#141220')} />
          <path d={`M${x - 4} 21.4 L${x - 1} 21.4 L${x - 4} 25.6 Z`} fill={WHITE} opacity="0.55" />
        </g>
      ))}
    </>
  ),
  'round-glasses': (p, c) => (
    <>
      <path d="M7 22 L1.6 20 M41 22 L46.4 20" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 22 L1.6 20 M41 22 L46.4 20" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20.6 23 Q24 19.6 27.4 23" stroke={INK} strokeWidth="2.6" fill="none" />
      <path d="M20.6 23 Q24 19.6 27.4 23" stroke={c} strokeWidth="1.3" fill="none" />
      {[14, 34].map((x) => (
        <g key={x}>
          <circle cx={x} cy="24" r="7.4" fill={p.lin('gl', '#ffffff55', '#cfe4f255')} />
          <circle cx={x} cy="24" r="7.4" fill="none" stroke={INK} strokeWidth="3.2" />
          <circle cx={x} cy="24" r="7.4" fill="none" stroke={p.lit('fr', c)} strokeWidth="2" />
          <path d={`M${x - 4.6} 22 A5 5 0 0 1 ${x - 1} 18.6`} stroke={WHITE} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.85" />
        </g>
      ))}
    </>
  ),
  umbrella: (p, c) => {
    const ribs = [4, 14, 24, 34, 44]
    return (
      <>
        <Rod d="M24 22 V40 Q24 45 20 45 Q16.6 45 16.6 41.6" w={1.8} c="#8a5a34" />
        {range(4).map((i) => {
          const x0 = ribs[i]!
          const x1 = ribs[i + 1]!
          return <path key={i} d={`M24 6 Q${(x0 + x1) / 2 - (i < 2 ? 4 : -4)} ${i === 0 || i === 3 ? 9 : 6} ${x0} 24 Q${(x0 + x1) / 2} 20.6 ${x1} 24 Z`} fill={i % 2 ? p.lit('a', c) : p.lit('b', lighten(c, 0.35))} {...K} strokeWidth={0.8} />
        })}
        <path d="M4 24 Q4 6 24 6 Q44 6 44 24" fill="none" {...K} />
        <path d="M24 6 V3" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      </>
    )
  },
  balloon: (p, c) => (
    <>
      <path d="M24 31 Q20 36 24 40 T22 47" stroke={INK} strokeWidth="0.8" fill="none" />
      <path d="M22 33.4 L24 30 L26 33.4 Z" fill={darken(c, 0.15)} {...K} strokeWidth={0.6} />
      <path d="M24 31 C14 30 12 22 12 17 C12 9.6 17.6 4 24 4 C30.4 4 36 9.6 36 17 C36 22 34 30 24 31 Z" fill={p.lit('b', c)} {...K} />
      <Shine x={18.6} y={12} rx={2.6} ry={4.2} r={25} o={0.65} />
    </>
  ),

  // ------------------------------------------------------------ fallback
  gift: (p, c) => (
    <>
      <rect x="9" y="18" width="30" height="24" rx="2" fill={p.lit('b', c)} {...K} />
      <rect x="7" y="13" width="34" height="7" rx="1.6" fill={p.lit('l', lighten(c, 0.1))} {...K} />
      <rect x="21.6" y="13" width="4.8" height="29" fill="#f6c945" {...K} strokeWidth={0.7} />
      <path d="M24 13 Q16 4 13 9.6 Q14 13 24 13 Q32 4 35 9.6 Q34 13 24 13 Z" fill="#f6c945" {...K} strokeWidth={0.8} />
    </>
  ),
}

/** Alternate drawings for worn items (in the same 48×48 box, see souvenirKinds for the fit). */
const WORN: Partial<Record<ArtKind, Draw>> = {
  // a garland hanging round the neck: collar line at y≈9, 36 wide
  lei: (_p, c) => {
    const a: Pt = [6, 8]
    const m: Pt = [24, 40]
    const b: Pt = [42, 8]
    const cols = [c, '#f6c945', WHITE, lighten(c, 0.3)]
    return (
      <>
        {range(11).map((i) => {
          const [x, y] = quad(a, m, b, i / 10)
          return <Blossom key={i} x={x} y={y} r={5.4} c={cols[i % 4]!} rot={i * 23} />
        })}
      </>
    )
  },
  // ponchos and shirts drape over the body: neck at (24,6), shoulders 40 wide, hem at y≈34
  poncho: (p, c) => {
    const shape = 'M17 5 Q24 9 31 5 L45 22 Q46 30 43 34 L5 34 Q2 30 3 22 Z'
    return (
      <>
        <path d={shape} fill={p.lit('pn', c)} {...K} />
        <g clipPath={p.clip('pc', shape)}>
          <rect x="0" y="24" width="48" height="2.4" fill="#2a2230" />
          <rect x="0" y="27.4" width="48" height="1.6" fill="#f2e2c0" />
          <rect x="0" y="30" width="48" height="2.4" fill="#2a2230" />
          <path d="M2 16 L46 16" stroke="#f2e2c0" strokeWidth="1" strokeDasharray="2 2" />
        </g>
        {range(14).map((i) => <path key={i} d={`M${6 + i * 2.8} 34.4 v3.4`} stroke={darken(c, 0.2)} strokeWidth="1" strokeLinecap="round" />)}
        <Shine x={12} y={16} rx={2.6} r={-50} o={0.4} />
      </>
    )
  },
  'football-shirt': (p, c) => {
    const shirt = 'M16 5 Q24 9.6 32 5 L44 11 L41 20 L36 18.4 L36 34 L12 34 L12 18.4 L7 20 L4 11 Z'
    const band = c === DEFAULT['football-shirt'] ? '#f1c232' : accent(c)
    return (
      <>
        <path d={shirt} fill={p.lit('s', c)} {...K} />
        <g clipPath={p.clip('sc', shirt)}>
          <rect x="0" y="17" width="48" height="7" fill={band} />
        </g>
        <path d="M18 6.4 Q24 12 30 6.4" stroke={band} strokeWidth="1.6" fill="none" />
        <path d={shirt} fill="none" {...K} />
      </>
    )
  },
  // held up from the paw: handle at (16,44)
  umbrella: (p, c) => (
    <>
      <Rod d="M24 14 L17 40 Q16 45 13 44 Q10.6 43 11.4 40.4" w={1.6} c="#8a5a34" />
      <g transform="rotate(14 24 12)">
        {range(4).map((i) => {
          const x0 = 8 + i * 8
          const x1 = x0 + 8
          return <path key={i} d={`M24 2 Q${(x0 + x1) / 2 - (i < 2 ? 3 : -3)} ${i === 0 || i === 3 ? 5 : 3} ${x0} 15 Q${(x0 + x1) / 2} 12.4 ${x1} 15 Z`} fill={i % 2 ? p.lit('a', c) : p.lit('b', lighten(c, 0.35))} {...K} strokeWidth={0.8} />
        })}
        <path d="M8 15 Q8 2 24 2 Q40 2 40 15" fill="none" {...K} />
      </g>
    </>
  ),
  // balloon on a long string: string end at (16,44)
  balloon: (p, c) => (
    <>
      <path d="M26 17 Q22 24 25 30 T17 44" stroke={INK} strokeWidth="0.7" fill="none" />
      <path d="M24.4 18.6 L26 16 L27.6 18.6 Z" fill={darken(c, 0.15)} {...K} strokeWidth={0.5} />
      <path d="M26 16.6 C19 16 17.6 10.6 17.6 7 C17.6 2 21.4 -1.6 26 -1.6 C30.6 -1.6 34.4 2 34.4 7 C34.4 10.6 33 16 26 16.6 Z" fill={p.lit('b', c)} {...K} />
      <Shine x={22.4} y={3.4} rx={1.8} ry={3} r={25} o={0.65} />
    </>
  ),
}

// ======================================================================== components
/** The drawing as an SVG group in its 48×48 box (for embedding in another SVG, e.g. worn by a dog). */
export function SouvenirShape({ kind, color, worn = false, paint = false }: { kind: ArtKind | string; color?: string; worn?: boolean; paint?: boolean }) {
  const id = useArtId('sv')
  const k: ArtKind | 'gift' = isArtKind(kind) ? kind : 'gift'
  const c = color ?? (k === 'gift' ? '#d4483c' : DEFAULT[k]) ?? '#d4483c'
  const p = new Paint(id)
  const draw = (worn && k !== 'gift' && WORN[k]) || DRAW[k]
  const body = draw(p, c)
  return (
    <g data-art={k}>
      <defs>
        {p.defs}
        {paint && <PaintFilters id={id} seed={kind.length * 3} wobble={0.9} grain />}
      </defs>
      <g filter={paint ? `url(#${id}-wc)` : undefined}>{body}</g>
    </g>
  )
}

export interface SouvenirArtProps {
  kind: ArtKind | string
  color?: string
  size?: number
  /** Accessible name; without it the drawing is decorative (aria-hidden). */
  title?: string
  className?: string
}

/** A souvenir or wardrobe item as a standalone, square <svg>. */
export function SouvenirArt({ kind, color, size = 48, title, className }: SouvenirArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} overflow="visible" style={{ display: 'inline-block', flexShrink: 0 }}>
      {title && <title>{title}</title>}
      <ellipse cx="24" cy="45" rx="13" ry="2" fill="#3a2c2a" opacity="0.13" />
      <SouvenirShape kind={kind} color={color} paint={size >= 72} />
    </svg>
  )
}

/** A souvenir's drawing (from its `art` and `color`), or its emoji until it has one. */
export function SouvenirIcon({ souvenir, size = 32, title, className = '' }: { souvenir: SouvenirLike | { emoji: string }; size?: number; title?: string; className?: string }) {
  const art = souvenirArt(souvenir)
  if (art) return <SouvenirArt kind={art.kind} color={art.color} size={size} title={title} className={className} />
  return (
    <span role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.78) }}>
      {souvenir.emoji}
    </span>
  )
}
