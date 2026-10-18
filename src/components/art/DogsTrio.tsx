/**
 * Leo, Bonchita and Luna together in a small composed scene: celebrating with
 * bunting and a football, waving goodbye, or asleep against the suitcase.
 */
import { DOG_ART, HI_DETAIL_PX, type DogId } from './dogRegistry'
import { place } from './dogPortraits'
import type { Mood } from './dogArt'
import { PaintFilters } from './paint'
import { useArtId, fluffPath, rng } from './brush'

export type TrioPose = 'celebrate' | 'wave' | 'sleep'

const WASH: Record<TrioPose, [string, string]> = {
  celebrate: ['#fbe6c4', '#f2b98a'],
  wave: ['#e2ecf7', '#a9c4e8'],
  sleep: ['#d9dcef', '#8d93c4'],
}

function Suitcase({ x, y, id, hi }: { x: number; y: number; id: string; hi: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} filter={hi ? `url(#${id}-wc)` : undefined}>
      <path d="M22 6 C22 1 26 -1 34 -1 C42 -1 46 1 46 6" stroke="#5b3a24" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <rect x="0" y="5" width="68" height="50" rx="7" fill={`url(#${id}-case)`} />
      <rect x="0" y="5" width="68" height="50" rx="7" fill="none" stroke="#6b4228" strokeWidth="1.2" opacity="0.6" />
      <path d="M14 5 V55 M54 5 V55" stroke="#7a4d2c" strokeWidth="4" opacity="0.75" />
      <rect x="11" y="27" width="6" height="5" rx="1" fill="#d9b25a" />
      <rect x="51" y="27" width="6" height="5" rx="1" fill="#d9b25a" />
      {/* travel stickers */}
      <circle cx="31" cy="20" r="7" fill="#f4ead6" />
      <circle cx="31" cy="20" r="5.2" fill="none" stroke="#d9473b" strokeWidth="1.2" />
      <path d="M27.6 20.6 l2.4 -3.6 l1.6 2.6 l1.2 -1.4 l2 2.4 z" fill="#2f6fc0" />
      <rect x="24" y="33" width="20" height="12" rx="1.5" fill="#2f6fc0" transform="rotate(-8 34 39)" />
      <path d="M27 40 h14 M27 37 h9" stroke="#f7efe0" strokeWidth="1.2" transform="rotate(-8 34 39)" />
      <rect x="40" y="12" width="11" height="8" rx="1" fill="#e9a92e" transform="rotate(10 45 16)" />
    </g>
  )
}

const SIZE: Record<DogId, number> = { leo: 116, bonchita: 104, luna: 112 }
/** Left edge (scene x) for each dog so the visible gaps Leo–Bonchita and Bonchita–Luna are equal. */
function spread(): Record<DogId, number> {
  const order: DogId[] = ['leo', 'bonchita', 'luna']
  const vis = order.map((d) => { const r = place(d); const k = SIZE[d] / 120; return { d, lo: r.x * k, w: r.w * k } })
  const gap = 4
  const total = vis.reduce((n, v) => n + v.w, 0) + gap * 2
  let x = 150 - total / 2
  const out = {} as Record<DogId, number>
  for (const v of vis) { out[v.d] = x - v.lo; x += v.w + gap }
  return out
}
const at = spread()

export function DogsTrio({ size = 300, pose = 'celebrate', className = '' }: { size?: number; pose?: TrioPose; className?: string }) {
  const id = useArtId('trio')
  const hi = size >= HI_DETAIL_PX * 2.4
  const mood: Mood = pose === 'sleep' ? 'sleepy' : 'happy'
  const [w1, w2] = WASH[pose]
  const r = rng(pose.length * 31)
  const Leo = DOG_ART.leo
  const Bon = DOG_ART.bonchita
  const Luna = DOG_ART.luna
  const lean = pose === 'sleep'
  const dog = (x: number, y: number, s: number, rot: number, node: React.ReactNode) => (
    <g transform={`translate(${x} ${y}) rotate(${rot} 60 110) scale(${s / 120})`}>{node}</g>
  )
  return (
    <svg width={size} height={Math.round(size * 0.62)} viewBox="0 0 300 186" role="img" aria-label="Leo, Bonchita and Luna" className={className} overflow="visible">
      <defs>
        {hi && (
          <>
            <PaintFilters id={id} seed={4} />
            <PaintFilters id={`${id}l`} seed={11} />
            <PaintFilters id={`${id}b`} seed={17} />
            <PaintFilters id={`${id}u`} seed={23} />
          </>
        )}
        <radialGradient id={`${id}-wash`} cx="0.42" cy="0.38" r="0.62">
          <stop offset="0" stopColor={w1} stopOpacity="0.95" />
          <stop offset="0.7" stopColor={w2} stopOpacity="0.55" />
          <stop offset="1" stopColor={w2} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-case`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#c98a52" />
          <stop offset="1" stopColor="#8e5530" />
        </linearGradient>
      </defs>
      {/* the painted wash behind them */}
      <path d={fluffPath(150, 98, 128, 78, 14, 9, r)} fill={`url(#${id}-wash)`} filter={hi ? `url(#${id}-soft)` : undefined} />
      {pose === 'sleep' && (
        <g>
          <path d="M238 30 a14 14 0 1 0 12 22 a11 11 0 1 1 -12 -22 z" fill="#f6e7b8" />
          {[[60, 26], [92, 14], [206, 18], [270, 64], [40, 60]].map(([cx, cy], i) => (
            <path key={i} d={`M${cx} ${cy! - 3} l0.9 2.1 l2.1 0.9 l-2.1 0.9 l-0.9 2.1 l-0.9 -2.1 l-2.1 -0.9 l2.1 -0.9 z`} fill="#f6e7b8" />
          ))}
        </g>
      )}
      {pose === 'celebrate' && (
        <g>
          <path d="M18 22 Q150 62 282 22" stroke="#7a5a44" strokeWidth="1" fill="none" />
          {Array.from({ length: 11 }, (_, i) => {
            const t = (i + 0.5) / 11
            const x = 18 + 264 * t
            const y = 22 + 160 * t * (1 - t) * 0.5 * 2
            const c = ['#d9473b', '#fbf3e2', '#2f5bd3'][i % 3]
            return <path key={i} d={`M${x - 7} ${y} L${x + 7} ${y + 1} L${x + 0.5} ${y + 15} Z`} fill={c} stroke="#7a5a44" strokeWidth="0.4" />
          })}
          {Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x={20 + r() * 260} y={40 + r() * 70} width="3.2" height="5" rx="0.8" fill={['#d9473b', '#2f5bd3', '#e9a92e', '#3f8f5f'][i % 4]} transform={`rotate(${r() * 180})`} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} opacity="0.85" />
          ))}
        </g>
      )}
      {pose === 'wave' && (
        <g>
          <path d="M40 46 C80 20 130 30 160 24" stroke="#5d6481" strokeWidth="1.2" fill="none" strokeDasharray="3 4" strokeLinecap="round" />
          <g transform="translate(166 18) rotate(-12)">
            <path d="M0 6 L16 4 L22 0 L24 2 L19 7 L24 12 L21 13 L15 9 L0 8 Z" fill="#fbf7ee" stroke="#2a2230" strokeWidth="0.9" strokeLinejoin="round" />
            <path d="M8 5.5 L4 0 L7 0 L13 5" fill="#d9473b" />
          </g>
        </g>
      )}
      {/* ground shadow */}
      <ellipse cx="150" cy="171" rx="122" ry="8" fill="#4a3428" opacity="0.14" />
      <Suitcase x={166} y={lean ? 112 : 96} id={id} hi={hi} />
      {pose === 'celebrate' && (
        <g transform="translate(222 84) rotate(12)">
          <rect x="0" y="0" width="34" height="24" fill="#fbf7ee" stroke="#cfc3ad" strokeWidth="0.6" />
          <rect x="2.5" y="2.5" width="29" height="19" fill="#9cc3e6" />
          <path d="M2.5 16 Q10 11 16 15 T31.5 13 V21.5 H2.5 Z" fill="#3f8f5f" />
          <circle cx="24" cy="8" r="3" fill="#f6d27a" />
        </g>
      )}
      {dog(at.luna, 58, SIZE.luna, lean ? -10 : 0, <Luna id={`${id}u`} mood={mood} hi={hi} wave={pose === 'wave'} />)}
      {dog(at.leo, 56, SIZE.leo, lean ? 9 : 0, <Leo id={`${id}l`} mood={mood} hi={hi} wave={pose === 'wave'} />)}
      {dog(at.bonchita, 70, SIZE.bonchita, lean ? 4 : 0, <Bon id={`${id}b`} mood={pose === 'wave' ? 'curious' : mood} hi={hi} />)}
      {pose === 'celebrate' && (
        <g transform="translate(26 158)" filter={hi ? `url(#${id}-soft)` : undefined}>
          <circle cx="0" cy="0" r="10" fill="#fbf7ee" stroke="#2a2230" strokeWidth="0.9" />
          <path d="M0 -4.2 L4 -1.3 L2.5 3.4 L-2.5 3.4 L-4 -1.3 Z" fill="#2a2230" />
          <path d="M0 -4.2 V-10 M4 -1.3 L9.5 -3 M2.5 3.4 L5.8 8 M-2.5 3.4 L-5.8 8 M-4 -1.3 L-9.5 -3" stroke="#2a2230" strokeWidth="0.8" />
        </g>
      )}
      {pose === 'sleep' && (
        <text x="232" y="96" fontFamily="var(--font-hand)" fontWeight="700" fontSize="22" fill="#5d6481">
          z<tspan fontSize="16" dy="-10">z</tspan><tspan fontSize="12" dy="-8">z</tspan>
        </text>
      )}
    </svg>
  )
}
