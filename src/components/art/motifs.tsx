/**
 * The motif library for the painted postcards. Each motif paints the middle and
 * near ground of a 300×200 scene (the sky is painted by PaintedScene) and reports
 * where its water and ground are, so accents (boats, penguins, a tram) can be placed.
 */
import type { ReactNode } from 'react'
import type { Motif, Accent } from '../../engine/scenes'
import { f, mix, darken, lighten, range, pick } from './brush'
import { Hills, Mountains, Water, Ground, Building, Row, Tree, Boat, Birds, Lanterns, StringLights } from './sceneKit'
import { W, H, wash, far, ridgePath, type Ctx } from './sceneUtils'

export interface Painted {
  main: ReactNode
  /** Drawn after the time-of-day tint, so it glows (windows, lamps, lanterns). */
  lights?: ReactNode
  waterY?: number
  groundY?: number
}

const STONE = '#e8dcc4'
const WHITE = '#f7f2e8'
const TERRA = '#c4673f'

// ------------------------------------------------------------------ helpers
function farHills(c: Ctx, y = c.hz, amp = 10, t = 0.55): ReactNode {
  return <Hills c={c} y={y} amp={amp} color={far(c, c.p.far, t)} waves={2} rough={0.2} />
}
function farCity(c: Ctx, y: number, x0 = -5, x1 = 305, hMax = 26, t = 0.6): ReactNode {
  const out: ReactNode[] = []
  let x = x0
  let i = 0
  while (x < x1) {
    const w = range(c.r, 6, 14)
    const h = range(c.r, 6, hMax)
    out.push(<rect key={i++} x={f(x)} y={f(y - h)} width={f(w)} height={f(h + 2)} fill={far(c, pick(c.r, c.p.buildings), t)} />)
    x += w + range(c.r, -2, 1)
  }
  return <g opacity="0.95">{out}</g>
}
function cobbles(c: Ctx, y: number, color: string): ReactNode {
  const out: ReactNode[] = []
  for (let i = 0; i < 70; i++) {
    const yy = y + 2 + Math.pow(c.r(), 0.8) * (H - y)
    const s = 1 + (yy - y) / 14
    out.push(<ellipse key={i} className="nosk" cx={f(c.r() * W)} cy={f(yy)} rx={f(s * 1.6)} ry={f(s * 0.7)} fill="none" stroke={darken(color, 0.25)} strokeWidth="0.5" opacity="0.6" />)
  }
  return <g>{out}</g>
}
function lamp(c: Ctx, x: number, y: number, h = 30): { main: ReactNode; light: ReactNode } {
  return {
    main: (
      <g>
        <path d={`M${x} ${y} V${y - h}`} stroke="#2e2a36" strokeWidth="1.2" />
        <path d={`M${x - 2.6} ${y - h} h5.2 l-1 -4.6 h-3.2 Z`} fill="#2e2a36" />
      </g>
    ),
    light: c.lit ? <circle cx={x} cy={y - h - 2.3} r="5" fill="#ffd98a" opacity="0.45" /> : null,
  }
}
function hillTown(c: Ctx, cx: number, base: number, w: number, h: number, towers = 1): ReactNode {
  const out: ReactNode[] = []
  const hill = `M${f(cx - w)} ${f(base)} Q${f(cx - w * 0.5)} ${f(base - h * 0.75)} ${f(cx)} ${f(base - h)} Q${f(cx + w * 0.5)} ${f(base - h * 0.75)} ${f(cx + w)} ${f(base)} Z`
  out.push(<path key="h" d={hill} {...wash(mix(c.p.mid, c.p.foliage, 0.4), 0.2)} />)
  const n = Math.round(w / 6)
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const x = cx - w * 0.62 + w * 1.24 * t
    const ground = base - h * (1 - Math.pow((x - cx) / w, 2)) * 0.92
    const bw = range(c.r, 6, 10)
    const bh = range(c.r, 6, 12)
    out.push(<Building key={i} c={c} x={x - bw / 2} y={ground + 4} w={bw} h={bh} wall={pick(c.r, [STONE, '#e9cfa6', '#d9b48a', WHITE])} roof="tiled" roofColor={TERRA} rows={1} cols={1} />)
  }
  for (let k = 0; k < towers; k++) {
    const x = cx - 12 + k * 14 + range(c.r, -3, 3)
    out.push(<Building key={`t${k}`} c={c} x={x} y={base - h * 0.82} w={6} h={range(c.r, 22, 34)} wall="#d9b48a" roof={k === 0 && towers === 1 ? 'tiled' : 'flat'} rows={3} cols={1} />)
  }
  return <g>{out}</g>
}
function churchFront(c: Ctx, x: number, y: number, w: number, h: number, wall: string, kind: 'twin' | 'dome' | 'gothic' | 'single' = 'twin'): ReactNode {
  const tw = w * 0.24
  return (
    <g>
      {kind === 'dome' && (
        <g>
          <rect x={f(x + w * 0.3)} y={f(y - h - w * 0.18)} width={f(w * 0.4)} height={f(w * 0.2)} {...wash(wall)} />
          <path d={`M${f(x + w * 0.26)} ${f(y - h - w * 0.18)} A${f(w * 0.24)} ${f(w * 0.3)} 0 0 1 ${f(x + w * 0.74)} ${f(y - h - w * 0.18)} Z`} {...wash('#8fa9b8')} />
          <path d={`M${f(x + w / 2)} ${f(y - h - w * 0.48)} v-6`} stroke="#5d6481" strokeWidth="1" />
          <path className="nosk" d={`M${f(x + w * 0.36)} ${f(y - h - w * 0.2)} Q${f(x + w * 0.4)} ${f(y - h - w * 0.4)} ${f(x + w / 2)} ${f(y - h - w * 0.46)}`} stroke={lighten('#8fa9b8', 0.5)} strokeWidth="1.2" fill="none" opacity="0.7" />
        </g>
      )}
      <rect x={f(x)} y={f(y - h)} width={f(w)} height={f(h)} {...wash(wall)} />
      <path d={`M${f(x + w * 0.2)} ${f(y - h)} L${f(x + w / 2)} ${f(y - h - w * 0.2)} L${f(x + w * 0.8)} ${f(y - h)} Z`} {...wash(lighten(wall, 0.1))} />
      {(kind === 'twin' || kind === 'gothic') &&
        [x - tw * 0.2, x + w - tw * 0.8].map((tx, i) => (
          <g key={i}>
            <rect x={f(tx)} y={f(y - h * 1.45)} width={f(tw)} height={f(h * 1.45)} {...wash(wall)} />
            {kind === 'gothic' ? <path d={`M${f(tx)} ${f(y - h * 1.45)} L${f(tx + tw / 2)} ${f(y - h * 1.45 - tw * 2.2)} L${f(tx + tw)} ${f(y - h * 1.45)} Z`} {...wash(darken(wall, 0.25))} /> : <path d={`M${f(tx - 1)} ${f(y - h * 1.45)} Q${f(tx + tw / 2)} ${f(y - h * 1.45 - tw * 1.1)} ${f(tx + tw + 1)} ${f(y - h * 1.45)} Z`} {...wash('#8fa9b8')} />}
            <rect x={f(tx + tw * 0.3)} y={f(y - h * 1.3)} width={f(tw * 0.4)} height={f(tw * 0.7)} rx={f(tw * 0.2)} fill={darken(wall, 0.45)} />
          </g>
        ))}
      {kind === 'single' && (
        <g>
          <rect x={f(x + w / 2 - tw / 2)} y={f(y - h * 1.6)} width={f(tw)} height={f(h * 0.6)} {...wash(wall)} />
          <path d={`M${f(x + w / 2 - tw / 2)} ${f(y - h * 1.6)} L${f(x + w / 2)} ${f(y - h * 1.6 - tw)} L${f(x + w / 2 + tw / 2)} ${f(y - h * 1.6)} Z`} {...wash(TERRA)} />
        </g>
      )}
      <circle cx={f(x + w / 2)} cy={f(y - h * 0.68)} r={f(w * 0.09)} fill={darken(wall, 0.35)} />
      <circle className="nosk" cx={f(x + w / 2)} cy={f(y - h * 0.68)} r={f(w * 0.06)} fill={c.lit ? '#ffcf7a' : '#7d8fb0'} opacity="0.8" />
      <path d={`M${f(x + w / 2 - w * 0.09)} ${f(y)} v${f(-h * 0.32)} a${f(w * 0.09)} ${f(w * 0.09)} 0 0 1 ${f(w * 0.18)} 0 v${f(h * 0.32)} Z`} fill={darken(wall, 0.5)} />
      {[0.12, 0.3, 0.7, 0.88].map((t) => <path key={t} d={`M${f(x + w * t)} ${f(y)} v${f(-h * 0.85)}`} stroke={darken(wall, 0.18)} strokeWidth="1" opacity="0.7" />)}
    </g>
  )
}
function columns(c: Ctx, x: number, y: number, w: number, h: number, n: number, color: string, broken = 0, intact = 0): ReactNode {
  const out: ReactNode[] = []
  const cw = Math.max(5.2, Math.min(12, h * 0.11))
  for (let i = 0; i < n; i++) {
    const cx = x + (w / (n - 1)) * i
    const hh = broken && i >= intact && c.r() < broken ? h * range(c.r, 0.35, 0.8) : h
    out.push(
      <g key={i}>
        <rect x={f(cx - cw / 2)} y={f(y - hh)} width={f(cw)} height={f(hh)} {...wash(color, 0.2)} />
        <rect className="nosk" x={f(cx + cw * 0.12)} y={f(y - hh)} width={f(cw * 0.38)} height={f(hh)} fill={darken(color, 0.3)} opacity="0.3" />
        <path className="nosk" d={`M${f(cx - cw * 0.2)} ${f(y - hh + 2)} V${f(y - 2)} M${f(cx + cw * 0.05)} ${f(y - hh + 2)} V${f(y - 2)}`} stroke={darken(color, 0.2)} strokeWidth="0.5" />
        {hh === h ? <rect x={f(cx - cw * 0.7)} y={f(y - hh - 2.4)} width={f(cw * 1.4)} height="2.6" {...wash(darken(color, 0.05))} /> : <path d={`M${f(cx - cw / 2)} ${f(y - hh)} l${f(cw * 0.3)} -2 l${f(cw * 0.3)} 1.4 l${f(cw * 0.4)} -1`} stroke={darken(color, 0.3)} strokeWidth="0.6" fill="none" />}
      </g>,
    )
  }
  return <g>{out}</g>
}
function waves(c: Ctx, y: number, n = 6): ReactNode {
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const yy = y + i * 4 + c.r() * 2
    out.push(<path key={i} className="nosk" d={`M${f(-10 + c.r() * 20)} ${f(yy)} q20 -3 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0`} stroke="#fbf8f0" strokeWidth={0.8 + i * 0.25} fill="none" opacity={0.7 - i * 0.06} />)
  }
  return <g>{out}</g>
}
function umbrellas(c: Ctx, y: number, n = 5): ReactNode {
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const x = 30 + (240 / n) * i + range(c.r, -8, 8)
    const yy = y + range(c.r, 4, 26)
    const s = 9 + (yy - y) / 3.5
    const col = pick(c.r, [c.p.ink, '#f2c879', '#2f6fc0', '#e88b6a'])
    out.push(
      <g key={i}>
        <path d={`M${f(x)} ${f(yy)} v${f(-s * 1.3)}`} stroke="#6a5a4a" strokeWidth="0.7" />
        <path d={`M${f(x - s)} ${f(yy - s * 1.1)} Q${f(x)} ${f(yy - s * 2)} ${f(x + s)} ${f(yy - s * 1.1)} Z`} fill={col} />
        <path className="nosk" d={`M${f(x - s * 0.33)} ${f(yy - s * 1.15)} Q${f(x - s * 0.1)} ${f(yy - s * 1.8)} ${f(x)} ${f(yy - s * 1.65)} Q${f(x + s * 0.1)} ${f(yy - s * 1.8)} ${f(x + s * 0.33)} ${f(yy - s * 1.15)} Z`} fill="#fbf7ee" opacity="0.9" />
      </g>,
    )
  }
  return <g>{out}</g>
}
function quay(x0: number, x1: number, y: number, color = '#b7a58a'): ReactNode {
  return (
    <g>
      <path d={`M${x0} ${y} L${x1} ${y} L${x1} ${y + 7} L${x0} ${y + 7} Z`} {...wash(color)} />
      {Array.from({ length: Math.floor((x1 - x0) / 14) }, (_, i) => <rect key={i} x={x0 + 6 + i * 14} y={y - 3} width="2.4" height="3" fill="#3a3346" />)}
    </g>
  )
}
function crane(c: Ctx, x: number, y: number, h: number, color = c.p.ink): ReactNode {
  return (
    <g stroke={darken(color, 0.1)} strokeWidth="1.3" fill="none">
      <path d={`M${x - 4} ${y} L${x} ${y - h} L${x + 4} ${y} M${x - 3} ${y - h * 0.3} L${x + 3} ${y - h * 0.3} M${x - 2} ${y - h * 0.62} L${x + 2} ${y - h * 0.62}`} />
      <path d={`M${x - 10} ${y - h} L${x + 26} ${y - h} M${x} ${y - h} L${x + 6} ${y - h - 6} L${x + 26} ${y - h}`} />
      <path d={`M${x + 20} ${y - h} v${h * 0.45}`} strokeWidth="0.5" />
    </g>
  )
}
function fountain(c: Ctx, x: number, y: number, s: number): ReactNode {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={s} ry={s * 0.22} {...wash(STONE)} />
      <ellipse cx={x} cy={y - 1} rx={s * 0.82} ry={s * 0.15} fill={lighten(c.p.water, 0.2)} />
      <rect x={x - s * 0.08} y={y - s * 0.55} width={s * 0.16} height={s * 0.55} {...wash(STONE)} />
      <ellipse cx={x} cy={y - s * 0.55} rx={s * 0.35} ry={s * 0.09} {...wash(STONE)} />
      <path className="nosk" d={`M${x} ${y - s * 0.6} q${-s * 0.25} ${-s * 0.3} ${-s * 0.45} ${s * 0.05} M${x} ${y - s * 0.6} q${s * 0.25} ${-s * 0.3} ${s * 0.45} ${s * 0.05} M${x} ${y - s * 0.6} v${-s * 0.3}`} stroke="#eaf4fb" strokeWidth="1.2" fill="none" opacity="0.9" />
    </g>
  )
}
function pagodaRoof(x: number, y: number, w: number, color: string, ridge = '#e9b949'): ReactNode {
  return (
    <g>
      <path d={`M${f(x - w * 0.62)} ${f(y + 2)} Q${f(x - w * 0.5)} ${f(y - 1)} ${f(x - w * 0.36)} ${f(y - w * 0.18)} L${f(x + w * 0.36)} ${f(y - w * 0.18)} Q${f(x + w * 0.5)} ${f(y - 1)} ${f(x + w * 0.62)} ${f(y + 2)} Z`} {...wash(color, 0.3)} />
      <path d={`M${f(x - w * 0.4)} ${f(y - w * 0.18)} L${f(x + w * 0.4)} ${f(y - w * 0.18)}`} stroke={ridge} strokeWidth="1.4" />
      <path d={`M${f(x - w * 0.4)} ${f(y - w * 0.18)} q-3 -3 -4 -6 M${f(x + w * 0.4)} ${f(y - w * 0.18)} q3 -3 4 -6`} stroke={ridge} strokeWidth="1.2" fill="none" />
      <path className="nosk" d={`M${f(x - w * 0.5)} ${f(y)} L${f(x + w * 0.5)} ${f(y)}`} stroke={darken(color, 0.4)} strokeWidth="0.6" strokeDasharray="1.2 1.2" />
    </g>
  )
}
function rowsField(y0: number, y1: number, color: string, stripe: string, curve = 6, n = 12): ReactNode {
  const out: ReactNode[] = [<path key="b" className="bg" d={`M-10 ${y0} Q150 ${y0 - curve} 310 ${y0} L310 ${y1} L-10 ${y1} Z`} {...wash(color, 0.1)} />]
  for (let i = 0; i < n; i++) {
    const t = i / n
    const y = y0 + (y1 - y0) * Math.pow(t, 1.5) + 2
    out.push(<path key={i} d={`M-10 ${f(y + curve * 0.3)} Q150 ${f(y - curve * (1 - t))} 310 ${f(y + curve * 0.3)}`} stroke={stripe} strokeWidth={0.8 + t * 3.4} fill="none" opacity="0.85" strokeLinecap="round" strokeDasharray={t > 0.5 ? `${2 + t * 4} ${1 + t * 2}` : undefined} />)
  }
  return <g>{out}</g>
}
function animalDots(c: Ctx, kind: 'cow' | 'horse' | 'sheep', x: number, y: number, n: number, s = 1): ReactNode {
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const ax = x + range(c.r, -40, 40)
    const ay = y + range(c.r, -4, 8)
    const k = s * (0.8 + (ay - y) / 30)
    const col = kind === 'cow' ? pick(c.r, ['#f4efe6', '#3a3030', '#8a5a3a']) : kind === 'horse' ? pick(c.r, ['#7a4a2e', '#3a2a24', '#c9a27a']) : '#f4efe6'
    out.push(
      <g key={i} transform={`translate(${f(ax)} ${f(ay)}) scale(${f(k)}) scale(${c.r() > 0.5 ? -1 : 1} 1)`}>
        <ellipse cx="0" cy="-4" rx="5" ry="2.6" fill={col} stroke={darken(col, 0.3)} strokeWidth="0.3" />
        <path d={`M-3.6 -2 v3 M-2 -2 v3 M2.2 -2 v3 M3.6 -2 v3`} stroke={darken(col, 0.3)} strokeWidth="0.8" />
        <path d={kind === 'horse' ? 'M4 -5 l2.6 -3.6 l1.6 0.6 l-1 3 Z' : 'M4.2 -5 l2.4 -1 l0.6 2 l-2.4 0.6 Z'} fill={col} stroke={darken(col, 0.3)} strokeWidth="0.3" />
      </g>,
    )
  }
  return <g>{out}</g>
}

// ------------------------------------------------------------------ motifs
type MotifFn = (c: Ctx) => Painted

const skyline: MotifFn = (c) => {
  const v = c.variant
  const water = v === 'harbour' || v === 'docks' || v === 'river' || v === 'casino' || v === 'snow'
  const base = water ? 150 : 158
  const towers: ReactNode[] = []
  const lights: ReactNode[] = []
  const n = 13
  for (let i = 0; i < n; i++) {
    const x = 10 + i * 22 + range(c.r, -5, 5)
    const mid = 1 - Math.abs(i - n / 2) / (n / 2)
    const h = range(c.r, 30, 50) + mid * range(c.r, 25, 60)
    const w = range(c.r, 14, 22)
    const wall = v === 'casino' ? pick(c.r, ['#e9b949', '#d98fa8', '#f2d49c', '#c9a8d0']) : pick(c.r, [mix(c.p.buildings[0]!, '#9fb4cf', 0.5), '#b9c7d8', '#d7dce4', mix(c.p.buildings[1]!, '#c9d4e2', 0.4), '#8fa3bf'])
    towers.push(<Building key={i} c={c} x={x} y={base} w={w} h={h} wall={wall} glass roof={c.r() > 0.8 ? 'spire' : 'flat'} />)
    if (c.lit) lights.push(<rect key={i} x={x + w * 0.3} y={base - h + 4} width="1.6" height="1.6" fill="#ff8a7a" opacity="0.8" />)
  }
  const extra: ReactNode[] = []
  if (v === 'obelisk') extra.push(<g key="ob"><path d="M146 160 L148 70 L150 64 L152 70 L154 160 Z" {...wash(WHITE, 0.15)} /></g>)
  if (v === 'brasilia') extra.push(<g key="br"><rect x="140" y="80" width="7" height="72" {...wash('#e9e4da')} /><rect x="152" y="80" width="7" height="72" {...wash('#e9e4da')} /><path d="M96 152 A22 12 0 0 1 140 152 Z" {...wash(WHITE)} /><path d="M164 140 A20 12 0 0 0 204 140 L200 152 L168 152 Z" {...wash(WHITE)} /></g>)
  if (v === 'tube') extra.push(<g key="tb"><path d="M60 170 h180 a14 14 0 0 0 0 -24 h-180 a14 14 0 0 0 0 24 Z" fill="#cfe2ea" opacity="0.85" stroke="#7d9aa8" strokeWidth="0.8" /><path d="M70 170 v-24 M110 170 v-24 M150 170 v-24 M190 170 v-24 M230 170 v-24" stroke="#7d9aa8" strokeWidth="0.6" /></g>)
  return {
    main: (
      <g>
        {v === 'hills' ? <Hills c={c} y={c.hz - 6} amp={18} color={far(c, c.p.mid, 0.35)} /> : farHills(c, c.hz, 8, 0.6)}
        {farCity(c, base - 20, -5, 305, 40, 0.5)}
        {towers}
        {v === 'snow' && <path d={`M0 ${base} h300`} stroke="#fbf8f2" strokeWidth="3" />}
        {water ? <Water c={c} y={base} sunX={200} /> : <Ground c={c} y={base} color={mix(c.p.ground, '#b9b4ac', 0.5)} strokes={10} />}
        {v === 'docks' && <g>{crane(c, 40, base, 46, c.p.ink)}{crane(c, 250, base, 38, c.p.ink)}<path d="M120 150 Q150 138 180 150" stroke="#f4efe6" strokeWidth="1.6" fill="none" /></g>}
        {!water && [20, 70, 230, 280].map((x) => <Tree key={x} c={c} x={x} y={base + 22} s={30} kind="round" />)}
        {extra}
      </g>
    ),
    lights: <g>{lights}</g>,
    waterY: water ? base : undefined,
    groundY: water ? undefined : base,
  }
}

const oldtown: MotifFn = (c) => {
  const v = c.variant ?? 'balconies'
  const y = 164
  const colors = v === 'colourful' || v === 'carnival' ? ['#e05a4a', '#f2c84b', '#3f8fc0', '#6fb57a', '#e88b6a', '#9cc6e8', '#f2a0b8'] : v === 'colonial' || v === 'sassi' || v === 'trulli' ? [WHITE, '#f1e6cf', '#eadcc0', '#f4ead4'] : c.p.buildings
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  if (v === 'alpine') main.push(<Mountains key="m" c={c} base={c.hz + 6} color={far(c, c.p.far, 0.3)} peaks={[{ x: 60, h: 60, w: 60 }, { x: 170, h: 78, w: 70 }, { x: 260, h: 55, w: 55 }]} />)
  else if (v === 'hill' || v === 'hilltown' || v === 'butte') main.push(<Hills key="h" c={c} y={c.hz} amp={14} color={far(c, c.p.mid, 0.4)} />)
  else main.push(<g key="fh">{farHills(c, c.hz, 6, 0.6)}</g>)
  if (v === 'butte') {
    main.push(<g key="sc"><path d="M30 130 Q150 46 270 130 Z" {...wash(mix(c.p.foliage, c.p.far, 0.3))} /><Row c={c} x0={70} x1={230} y={116} hMin={10} hMax={18} roof="tiled" colors={c.p.buildings} wMin={8} wMax={12} /><g transform="translate(0 30)"><rect x="124" y="58" width="52" height="24" {...wash(WHITE)} /><path d="M132 58 A18 20 0 0 1 168 58 Z" {...wash(WHITE)} /><path d="M150 38 v-8" stroke="#9aa" strokeWidth="1.2" /><path d="M118 62 A7 9 0 0 1 132 62 Z M168 62 A7 9 0 0 1 182 62 Z" {...wash(WHITE)} /><rect x="178" y="40" width="8" height="22" {...wash(WHITE)} /><path d="M178 40 L182 30 L186 40 Z" {...wash(WHITE)} /></g></g>)
  }
  if (v === 'hilltown') main.push(<g key="ht">{hillTown(c, 150, 128, 90, 40, 2)}</g>)
  if (v === 'sassi') {
    const out: ReactNode[] = []
    for (let row = 0; row < 5; row++) for (let i = 0; i < 9; i++) {
      const x = 10 + i * 32 + row * 6 + range(c.r, -4, 4)
      const yy = 70 + row * 18
      out.push(<Building key={`${row}-${i}`} c={c} x={x} y={yy + 14} w={range(c.r, 14, 22)} h={range(c.r, 10, 15)} wall={pick(c.r, ['#e2cfa8', '#d9c09a', '#ead9b8'])} roof="flat" rows={1} cols={2} />)
    }
    main.push(<g key="ss"><path className="bg" d="M-10 60 Q150 40 310 70 L310 210 L-10 210 Z" {...wash('#cdb58c')} />{out}</g>)
    return { main: <g>{main}</g>, groundY: 170 }
  }
  if (v === 'trulli') {
    const out: ReactNode[] = []
    for (let i = 0; i < 9; i++) {
      const x = -6 + i * 38 + range(c.r, -4, 4)
      const yy = 150 + (i % 2) * 14
      out.push(<g key={i}><rect x={x} y={yy - 24} width="32" height="24" {...wash(WHITE)} /><path d={`M${x - 1.5} ${yy - 24} Q${x + 4} ${yy - 46} ${x + 16} ${yy - 66} Q${x + 28} ${yy - 46} ${x + 33.5} ${yy - 24} Z`} {...wash('#8a8890', 0.3)} /><path className="nosk" d={`M${x + 4} ${yy - 32} h24 M${x + 7} ${yy - 41} h18 M${x + 10} ${yy - 50} h12`} stroke="#6a6870" strokeWidth="0.6" /><circle cx={x + 16} cy={yy - 68} r="2.6" fill={WHITE} /><path d={`M${x + 12} ${yy} v-11 a4 4 0 0 1 8 0 v11 Z`} fill="#5a4a40" /></g>)
    }
    main.push(<Ground key="g" c={c} y={140} color={c.p.ground} strokes={12} />)
    main.push(<g key="tr">{out}</g>)
    return { main: <g>{main}</g>, groundY: 176 }
  }
  if (v === 'walled') {
    main.push(<g key="w"><rect x="20" y="100" width="260" height="50" {...wash('#9a9aa3')} /><path d="M20 100 h260" stroke="#6a6a75" strokeWidth="2" /><rect x="135" y="112" width="30" height="38" {...wash('#7a7a85')} /><path d="M138 150 v-26 a12 12 0 0 1 24 0 v26 Z" fill="#3a3346" />{[40, 90, 200, 250].map((x) => <g key={x}>{pagodaRoof(x, 100, 30, '#5a6a6a', '#8a9a90')}</g>)}<rect x="10" y="90" width="18" height="60" {...wash('#8a8a95')} /><rect x="272" y="90" width="18" height="60" {...wash('#8a8a95')} /></g>)
    main.push(<Ground key="g" c={c} y={150} color={c.p.ground} strokes={14} />)
    return { main: <g>{main}</g>, groundY: 160 }
  }
  const timber = v === 'timbered' || v === 'alpine'
  const roof = v === 'alpine' || v === 'timbered' ? 'gable' : v === 'colonial' ? 'tiled' : v === 'tiled-roofs' ? 'tiled' : 'mix'
  const hMin = v === 'hill' ? 24 : v === 'butte' ? 30 : 48
  const hMax = v === 'hill' ? 38 : v === 'butte' ? 46 : 84
  if (v === 'hill') {
    // houses stacked up a slope
    for (let row = 0; row < 3; row++) main.push(<Row key={`r${row}`} c={c} x0={-5 + row * 30} x1={305 - row * 20} y={y - 48 + row * 16} hMin={hMin} hMax={hMax} roof="tiled" colors={['#f2d49c', '#ebb5a0', WHITE, '#9cc6e8', '#f3cd8e']} />)
  }
  main.push(<Row key="row" c={c} x0={-5} x1={305} y={y} hMin={hMin} hMax={hMax} roof={roof} colors={colors} balcony={v === 'balconies' || v === 'colonial'} shutters={v === 'balconies' ? '#4f7f6a' : v === 'colonial' ? '#3f6fa0' : undefined} wMin={v === 'colourful' ? 16 : 18} wMax={v === 'colourful' ? 24 : 30} />)
  if (timber) {
    const t: ReactNode[] = []
    for (let i = 0; i < 16; i++) {
      const x = i * 20 + range(c.r, 0, 6)
      t.push(<path key={i} className="nosk" d={`M${f(x)} ${f(y - 30)} l8 -12 M${f(x + 8)} ${f(y - 42)} l8 12 M${f(x)} ${f(y - 24)} h18 M${f(x + 9)} ${f(y - 42)} v40`} stroke="#5a3a2a" strokeWidth="1.1" opacity="0.6" />)
    }
    main.push(<g key="tm">{t}</g>)
  }
  if (v === 'porticoes') main.push(<g key="pt">{Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${i * 20} ${y} v-12 a10 10 0 0 1 20 0 v12`} fill={darken('#c97a52', 0.4)} opacity="0.55" />)}</g>)
  if (v === 'chapel') main.push(<g key="ch">{churchFront(c, 120, y, 60, 36, '#f2d49c', 'single')}</g>)
  if (v === 'carnival') main.push(<g key="cv"><StringLights x0={0} x1={300} y={92} sag={5} n={16} lit={c.lit} /><path d="M0 100 Q150 120 300 100" stroke="#3a3346" strokeWidth="0.5" fill="none" />{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 25 + 6} ${102 + 8 * Math.sin((i / 12) * Math.PI)} l6 0 l-3 8 Z`} fill={['#d9473b', '#2f5bd3', '#e9b949', '#3f8f5f'][i % 4]} />)}</g>)
  // street
  main.push(<g key="st"><path className="bg" d={`M-10 ${y} L310 ${y} L310 210 L-10 210 Z`} {...wash(v === 'colonial' ? '#d9c6a6' : '#c9b8a0', 0.1)} />{cobbles(c, y, '#c9b8a0')}</g>)
  const l1 = lamp(c, 40, 194, 40)
  const l2 = lamp(c, 250, 194, 40)
  main.push(<g key="l">{l1.main}{l2.main}</g>)
  lights.push(<g key="ll">{l1.light}{l2.light}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 178 }
}

const harbour: MotifFn = (c) => {
  const v = c.variant
  const wy = 140
  const main: ReactNode[] = []
  if (v === 'mountains') main.push(<Mountains key="m" c={c} base={wy - 14} color={far(c, c.p.far, 0.25)} peaks={[{ x: 50, h: 56, w: 55 }, { x: 140, h: 70, w: 60 }, { x: 240, h: 62, w: 60 }]} />)
  else if (v === 'vesuvius') main.push(<path key="v" d="M60 126 L150 62 Q160 56 170 62 L260 126 Z" {...wash(far(c, c.p.far, 0.35))} />)
  else if (v === 'skyline') main.push(<g key="sk"><Hills c={c} y={c.hz - 14} amp={16} color={far(c, c.p.foliage, 0.45)} />{farCity(c, wy - 6, 20, 280, 60, 0.35)}</g>)
  else if (v === 'riviera' || v === 'citadel' || v === 'island-town') main.push(<g key="rv"><Hills c={c} y={c.hz - 4} amp={20} color={far(c, c.p.mid, 0.4)} /></g>)
  else main.push(<g key="fh">{farHills(c, c.hz + 4, 8, 0.6)}</g>)
  // town along the quay
  const townColors = v === 'colourful' ? ['#f2c84b', '#e88b6a', '#9cc6e8', '#f2a0b8', '#f6e9cd'] : v === 'african' ? ['#e8c29a', '#d98a5a', WHITE, '#f2d49c'] : c.p.buildings
  if (v === 'stilts') {
    const out: ReactNode[] = []
    for (let i = 0; i < 9; i++) {
      const x = i * 34 + range(c.r, -4, 4)
      out.push(<g key={i}><path d={`M${x + 3} ${wy + 8} v-14 M${x + 13} ${wy + 8} v-14 M${x + 23} ${wy + 8} v-14`} stroke="#5a4636" strokeWidth="1.2" /><rect x={x} y={wy - 22} width="27" height="16" {...wash(pick(c.r, ['#9a8a7a', '#b9a68a', '#7d8a9a']))} /><path d={`M${x - 2} ${wy - 22} L${x + 13.5} ${wy - 30} L${x + 29} ${wy - 22} Z`} {...wash('#5d6481')} /></g>)
    }
    main.push(<Water key="w" c={c} y={wy - 6} sunX={210} />)
    main.push(<g key="st">{out}</g>)
    return { main: <g>{main}</g>, waterY: wy + 14 }
  }
  if (v === 'market') main.push(<g key="mk"><rect x="40" y="100" width="120" height="34" {...wash('#9cb4c9')} /><rect x="38" y="80" width="10" height="54" {...wash('#9cb4c9')} /><rect x="152" y="80" width="10" height="54" {...wash('#9cb4c9')} />{[48, 152].map((x) => <path key={x} d={`M${x - 11} 80 L${x - 5} 68 L${x + 1} 80 Z`} {...wash('#5d7d9a')} />)}</g>)
  if (v !== 'skyline') main.push(<Row key="row" c={c} x0={v === 'market' ? 170 : -5} x1={v === 'riviera' ? 305 : 215} y={wy - 4} hMin={26} hMax={v === 'riviera' ? 56 : 48} roof="mix" colors={townColors} wMin={14} wMax={22} balcony shutters="#4f7f6a" />)
  if (v === 'riviera' || v === 'citadel' || v === 'island-town') main.push(<Row key="row2" c={c} x0={20} x1={280} y={wy - 30} hMin={14} hMax={30} roof="tiled" colors={townColors} wMin={10} wMax={18} />)
  main.push(<g key="q">{quay(-10, 215, wy - 4)}</g>)
  if (!v || v === 'docks') main.push(<g key="cr">{crane(c, 240, wy - 4, 50, c.p.ink)}{crane(c, 270, wy - 4, 42, darken(c.p.ink, 0.2))}</g>)
  main.push(<Water key="w" c={c} y={wy + 3} sunX={220} />)
  const boats: ReactNode[] = []
  const kinds = v === 'african' ? (['row', 'row', 'row'] as const) : v === 'village' ? (['fishing', 'row', 'fishing'] as const) : (['fishing', 'sail', 'row'] as const)
  kinds.forEach((k, i) => boats.push(<Boat key={i} c={c} x={60 + i * 85 + range(c.r, -10, 10)} y={wy + 22 + i * 12} s={30 + i * 9} kind={k} color={pick(c.r, [c.p.ink, '#2f6fc0', '#e9b949', '#3f8f5f'])} />))
  main.push(<g key="b">{boats}</g>)
  return { main: <g>{main}</g>, waterY: wy + 3 }
}

const beach: MotifFn = (c) => {
  const v = c.variant
  const sy = v === 'promenade' ? 150 : 140
  const turquoise = v === 'tropical' || v === 'emerald' || v === 'river-beach' || v === 'bay'
  const sea = turquoise ? mix(c.p.water, '#3fb7b0', 0.55) : c.p.water
  const main: ReactNode[] = []
  if (v === 'twin-peaks') main.push(<path key="tp" d={`M150 ${c.hz + 2} Q190 70 205 62 Q214 58 222 66 Q232 56 242 52 Q254 50 264 74 Q280 100 310 ${c.hz} Z`} {...wash(far(c, c.p.foliage, 0.35))} />)
  else if (v === 'rock') main.push(<g key="rk"><path d={`M150 ${c.hz} Q170 60 220 56 Q262 58 280 ${c.hz} Z`} {...wash(far(c, '#b9a68a', 0.2))} /><Row c={c} x0={150} x1={290} y={c.hz + 8} hMin={10} hMax={18} roof="tiled" colors={[STONE, '#e9cfa6']} wMin={8} wMax={12} />{churchFront(c, 196, c.hz + 4, 26, 16, STONE, 'twin')}</g>)
  else main.push(<g key="fh">{farHills(c, c.hz, 6, 0.65)}</g>)
  main.push(<Water key="w" c={c} y={c.hz} color={sea} sunX={180} />)
  if (v === 'promenade') {
    main.push(<Row key="hotel" c={c} x0={180} x1={310} y={c.hz + 2} hMin={20} hMax={44} roof="flat" colors={[WHITE, '#f2e2c8', '#e9eef2']} wMin={12} wMax={18} />)
  }
  if (v === 'village') main.push(<Row key="vil" c={c} x0={200} x1={310} y={c.hz + 6} hMin={14} hMax={24} roof="tiled" colors={c.p.buildings} wMin={10} wMax={16} />)
  if (v === 'memorial') main.push(<g key="mm"><rect x="200" y={c.hz - 30} width="6" height="34" fill="#c9c4bb" /><path d={`M188 ${c.hz} l6 -18 l6 18 Z`} fill="#c9c4bb" /></g>)
  main.push(<g key="wv">{waves(c, sy - 10, 3)}</g>)
  // sand
  main.push(<path key="sand" className="bg" d={`M-10 ${sy} Q120 ${sy - 8} 310 ${sy + 4} L310 210 L-10 210 Z`} {...wash(v === 'memorial' ? '#d9ccb0' : lighten(c.p.ground, 0.2), 0.12)} />)
  main.push(<path key="foam" className="nosk" d={`M-10 ${sy + 1} Q120 ${sy - 7} 310 ${sy + 5}`} stroke="#fbf8f0" strokeWidth="2.2" fill="none" opacity="0.9" />)
  if (v === 'promenade') main.push(<g key="pr"><path d={`M-10 182 L310 178 L310 210 L-10 210 Z`} fill="#f4efe6" />{Array.from({ length: 12 }, (_, i) => <path key={i} className="nosk" d={`M${i * 28 - 10} 192 q7 -6 14 0 t14 0`} stroke="#2a2a30" strokeWidth="2" fill="none" />)}</g>)
  if (v === 'rocky' || v === 'emerald') main.push(<g key="rk">{[40, 90, 250].map((x, i) => <path key={i} d={`M${x - 22} ${sy + 12} Q${x - 14} ${sy - 12} ${x} ${sy - 14} Q${x + 18} ${sy - 8} ${x + 24} ${sy + 12} Z`} {...wash(v === 'emerald' ? '#d9c8b0' : '#8a7f78')} />)}</g>)
  if (v !== 'memorial' && v !== 'rocky' && v !== 'river-beach') main.push(<g key="u">{umbrellas(c, sy, 4)}</g>)
  if (v === 'tropical' || v === 'twin-peaks' || v === 'jangada' || v === 'promenade' || v === 'bay' || !v) main.push(<g key="pa"><Tree c={c} x={22} y={204} s={104} kind="palm" /><Tree c={c} x={44} y={200} s={70} kind="palm" /><Tree c={c} x={280} y={200} s={86} kind="palm" /></g>)
  return { main: <g>{main}</g>, waterY: c.hz, groundY: 176 }
}

const cliffs: MotifFn = (c) => {
  const v = c.variant
  const chalk = v === 'arch' || v === 'cove' || v === 'faraglioni' ? '#ece6da' : v === 'columns' ? '#7d7a82' : v === 'village' ? '#a98a6a' : '#b7a088'
  const sea = v === 'cove' ? mix(c.p.water, '#3fb7b0', 0.5) : c.p.water
  const main: ReactNode[] = []
  main.push(<Water key="w" c={c} y={c.hz} color={sea} sunX={110} />)
  // far headland
  main.push(<path key="fh" d={`M-10 ${c.hz} L-10 ${c.hz - 26} Q40 ${c.hz - 30} 70 ${c.hz - 12} L90 ${c.hz} Z`} {...wash(far(c, chalk, 0.4))} />)
  // main cliff on the right
  const cliff = `M150 210 L156 ${c.hz + 30} Q160 ${c.hz - 20} 176 ${c.hz - 50} Q200 ${c.hz - 70} 240 ${c.hz - 74} L310 ${c.hz - 80} L310 210 Z`
  main.push(<path key="cl" d={cliff} {...wash(chalk, 0.2)} />)
  main.push(<path key="cls" className="nosk" d={`M168 ${c.hz + 40} Q172 ${c.hz} 186 ${c.hz - 40} M196 ${c.hz + 50} Q200 ${c.hz - 10} 214 ${c.hz - 56} M232 ${c.hz + 60} Q236 ${c.hz} 250 ${c.hz - 60}`} stroke={darken(chalk, 0.3)} strokeWidth="1" fill="none" opacity="0.5" />)
  main.push(<path key="top" d={`M176 ${c.hz - 50} Q200 ${c.hz - 72} 240 ${c.hz - 76} L310 ${c.hz - 82} L310 ${c.hz - 70} L240 ${c.hz - 66} Q204 ${c.hz - 60} 180 ${c.hz - 44} Z`} {...wash(c.p.foliage, 0.2)} />)
  if (v === 'arch') main.push(<g key="ar"><path d={`M100 ${c.hz + 30} L104 ${c.hz - 30} Q120 ${c.hz - 50} 150 ${c.hz - 40} L156 ${c.hz + 30} L144 ${c.hz + 30} Q140 ${c.hz - 10} 126 ${c.hz - 12} Q112 ${c.hz - 10} 112 ${c.hz + 30} Z`} {...wash(chalk, 0.2)} /><path d={`M70 ${c.hz + 20} L74 ${c.hz - 26} L82 ${c.hz - 28} L86 ${c.hz + 20} Z`} {...wash(chalk, 0.2)} /></g>)
  if (v === 'faraglioni' || v === 'rocks') main.push(<g key="fa">{[[70, 52], [104, 40], [128, 30]].map(([x, h], i) => <path key={i} d={`M${x! - 12} ${c.hz + 14} L${x! - 8} ${c.hz - h!} Q${x} ${c.hz - h! - 6} ${x! + 8} ${c.hz - h! + 4} L${x! + 12} ${c.hz + 14} Z`} {...wash(i === 1 ? darken(chalk, 0.1) : chalk, 0.2)} />)}</g>)
  if (v === 'columns') main.push(<g key="co">{Array.from({ length: 14 }, (_, i) => <rect key={i} x={160 + i * 9} y={c.hz - 60 + (i % 3) * 6} width="8" height="120" fill={i % 2 ? darken(chalk, 0.1) : lighten(chalk, 0.1)} stroke={darken(chalk, 0.4)} strokeWidth="0.5" />)}</g>)
  if (v === 'village') {
    const out: ReactNode[] = []
    for (let row = 0; row < 5; row++)
      for (let i = 0; i < 6; i++) {
        const x = 168 + i * 22 + row * 4 + range(c.r, -3, 3)
        const yy = c.hz + 40 - row * 22
        out.push(<Building key={`${row}${i}`} c={c} x={x} y={yy} w={range(c.r, 14, 20)} h={range(c.r, 14, 22)} wall={pick(c.r, ['#f2c84b', '#e88b6a', '#9cc6e8', '#f2a0b8', '#f6e9cd', '#e05a4a'])} roof={c.r() > 0.5 ? 'tiled' : 'flat'} rows={2} cols={2} shutters="#3f7f5a" />)
      }
    main.push(<g key="vl">{out}</g>)
  }
  if (v === 'cove' || v === 'bay') main.push(<path key="cv" d={`M-10 210 L-10 ${c.hz + 20} Q20 ${c.hz + 4} 50 ${c.hz + 30} L70 210 Z`} {...wash(chalk, 0.2)} />)
  main.push(<g key="wv">{waves(c, c.hz + 50, 4)}</g>)
  return { main: <g>{main}</g>, waterY: c.hz }
}

const lighthouse: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  main.push(<Water key="w" c={c} y={c.hz} sunX={90} />)
  let lx = 210
  let ly = c.hz - 18
  if (v === 'islet') {
    main.push(<Mountains key="m" c={c} base={c.hz} color={far(c, c.p.far, 0.4)} peaks={[{ x: 60, h: 40, w: 60 }, { x: 150, h: 54, w: 60 }, { x: 250, h: 42, w: 60 }]} />)
    main.push(<Water key="w2" c={c} y={c.hz} sunX={90} />)
    main.push(<path key="is" d={`M150 ${c.hz + 36} Q160 ${c.hz + 16} 190 ${c.hz + 14} Q222 ${c.hz + 16} 236 ${c.hz + 36} Z`} {...wash('#6a5a52')} />)
    lx = 193
    ly = c.hz + 18
  } else if (v === 'hill') {
    main.push(<path key="hl" d={`M100 210 Q150 ${c.hz - 30} 210 ${c.hz - 40} Q260 ${c.hz - 30} 310 ${c.hz + 10} L310 210 Z`} {...wash(c.p.foliage, 0.2)} />)
    main.push(<g key="ch">{churchFront(c, 236, c.hz - 26, 22, 16, WHITE, 'single')}</g>)
    ly = c.hz - 38
  } else {
    main.push(<path key="hd" d={`M120 210 L130 ${c.hz + 10} Q160 ${c.hz - 16} 220 ${c.hz - 20} Q270 ${c.hz - 20} 310 ${c.hz - 26} L310 210 Z`} {...wash(v === 'cape' ? '#b7a088' : '#8f7f72', 0.2)} />)
    main.push(<path key="gr" d={`M150 ${c.hz - 6} Q190 ${c.hz - 22} 230 ${c.hz - 22} Q270 ${c.hz - 22} 310 ${c.hz - 28} L310 ${c.hz - 14} Q240 ${c.hz - 10} 150 ${c.hz} Z`} {...wash(c.p.foliage)} />)
    if (v === 'cape') main.push(<rect key="fw" x="250" y={c.hz - 34} width="50" height="12" {...wash(STONE)} />)
  }
  const th = 52
  main.push(
    <g key="lh">
      <path d={`M${lx - 7} ${ly} L${lx - 4.5} ${ly - th} L${lx + 4.5} ${ly - th} L${lx + 7} ${ly} Z`} {...wash(WHITE, 0.2)} />
      {[0.2, 0.5].map((t) => <path key={t} d={`M${f(lx - 6.6 + t * 2)} ${f(ly - th * t - 6)} L${f(lx + 6.6 - t * 2)} ${f(ly - th * t - 6)} L${f(lx + 6.4 - t * 2.3)} ${f(ly - th * t - 13)} L${f(lx - 6.4 + t * 2.3)} ${f(ly - th * t - 13)} Z`} fill="#d24438" />)}
      <rect x={lx - 5.5} y={ly - th - 2} width="11" height="2.4" fill="#3a3346" />
      <rect x={lx - 3.6} y={ly - th - 10} width="7.2" height="8" fill={c.lit ? '#ffe2a0' : '#f6efe0'} stroke="#3a3346" strokeWidth="0.8" />
      <path d={`M${lx - 4.6} ${ly - th - 10} L${lx} ${ly - th - 15} L${lx + 4.6} ${ly - th - 10} Z`} fill="#d24438" />
      <rect x={lx + 6} y={ly - 8} width="14" height="8" {...wash(WHITE)} />
      <path d={`M${lx + 5} ${ly - 8} L${lx + 13} ${ly - 13} L${lx + 21} ${ly - 8} Z`} fill="#d24438" />
    </g>,
  )
  if (c.lit) lights.push(<path key="beam" d={`M${lx} ${ly - th - 6} L${lx - 120} ${ly - th - 26} L${lx - 120} ${ly - th + 10} Z`} fill="#fff0c0" opacity="0.35" />)
  main.push(<g key="wv">{waves(c, c.hz + 48, 3)}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, waterY: c.hz }
}

const mountains: MotifFn = (c) => {
  const v = c.variant
  const green = v === 'green' || v === 'peak' || v === 'lionrock' || v === 'corcovado'
  const andes = v === 'andes' || v === 'mesa' || v === 'arch'
  const col = green ? mix(c.p.foliage, c.p.far, 0.25) : andes ? '#b98a6a' : v === 'dolomites' ? '#d9b0a8' : mix(c.p.far, '#8d93b4', 0.4)
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  // far range
  main.push(<Mountains key="far" c={c} base={c.hz + 6} color={far(c, col, 0.55)} snow={!green && !andes} peaks={[{ x: 30, h: 50, w: 50 }, { x: 120, h: 40, w: 50 }, { x: 280, h: 46, w: 50 }]} />)
  if (v === 'dolomites') {
    const sp: ReactNode[] = []
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 22 + range(c.r, -6, 6)
      const h = range(c.r, 50, 90)
      sp.push(<path key={i} d={`M${f(x - 10)} ${c.hz + 10} L${f(x - 6)} ${f(c.hz - h)} L${f(x + 1)} ${f(c.hz - h - 6)} L${f(x + 7)} ${f(c.hz - h + 4)} L${f(x + 11)} ${c.hz + 10} Z`} {...wash(i % 2 ? '#e6b6a8' : '#d99f96', 0.2)} />)
    }
    main.push(<g key="sp">{sp}</g>)
  } else if (v === 'mesa') {
    main.push(<path key="me" d={`M20 ${c.hz + 10} L40 ${c.hz - 46} L140 ${c.hz - 50} L160 ${c.hz + 10} Z M170 ${c.hz + 10} L184 ${c.hz - 36} L260 ${c.hz - 38} L280 ${c.hz + 10} Z`} {...wash('#c99068', 0.25)} />)
  } else if (v === 'lionrock') {
    main.push(<path key="lr" d={`M20 ${c.hz + 20} Q60 ${c.hz - 20} 110 ${c.hz - 34} Q130 ${c.hz - 70} 160 ${c.hz - 64} Q178 ${c.hz - 60} 182 ${c.hz - 40} Q230 ${c.hz - 40} 300 ${c.hz + 20} Z`} {...wash(col, 0.2)} />)
    main.push(<path key="lrr" d={`M128 ${c.hz - 56} Q150 ${c.hz - 74} 176 ${c.hz - 54} Q160 ${c.hz - 48} 140 ${c.hz - 46} Z`} fill="#9a8f86" />)
  } else {
    main.push(<Mountains key="near" c={c} base={c.hz + 38} color={col} snow={!green && !andes} snowLine={0.32} peaks={v === 'corcovado' ? [{ x: 160, h: 84, w: 40 }] : [{ x: 70, h: 82, w: 62 }, { x: 165, h: 108, w: 66 }, { x: 255, h: 76, w: 58 }]} />)
  }
  if (v === 'corcovado') main.push(<g key="cr"><path d={`M146 ${c.hz - 48} Q150 ${c.hz - 66} 160 ${c.hz - 64} Q170 ${c.hz - 66} 174 ${c.hz - 48} Z`} {...wash(mix(col, '#7a8a6a', 0.3))} /><path d={`M156 ${c.hz - 62} h8 v-4 h-8 Z`} fill={STONE} /><path d={`M157 ${c.hz - 66} l1 -20 h4 l1 20 Z`} fill={WHITE} /><path d={`M146 ${c.hz - 82} h28`} stroke={WHITE} strokeWidth="3.4" strokeLinecap="round" /><circle cx="160" cy={c.hz - 89} r="2.6" fill={WHITE} /></g>)
  if (v === 'arch') main.push(<g key="ar"><path d={`M80 ${c.hz + 46} Q150 ${c.hz} 220 ${c.hz + 46} L210 ${c.hz + 46} Q150 ${c.hz + 14} 90 ${c.hz + 46} Z`} {...wash('#d9a85a', 0.3)} /><path d={`M80 ${c.hz + 46} Q150 ${c.hz} 220 ${c.hz + 46}`} stroke="#c9763a" strokeWidth="3" fill="none" opacity="0.6" /></g>)
  if (v === 'observatory') main.push(<g key="ob"><rect x="158" y={c.hz - 92} width="16" height="10" {...wash(WHITE)} /><path d={`M156 ${c.hz - 92} A10 9 0 0 1 176 ${c.hz - 92} Z`} {...wash(WHITE)} /></g>)
  if (v === 'peak') {
    main.push(<g key="city">{farCity(c, c.hz + 40, -5, 305, 50, 0.25)}</g>)
  }
  // valley floor
  const gy = c.hz + 34
  main.push(<Ground key="g" c={c} y={gy} color={andes ? '#c9a77a' : v === 'valley' ? c.p.foliage : mix(c.p.foliage, c.p.ground, 0.4)} strokes={24} curve={4} />)
  if (v === 'valley') main.push(<path key="rv" d={`M120 210 Q140 180 150 ${gy + 6} Q160 ${gy + 2} 200 ${gy}`} stroke={lighten(c.p.water, 0.2)} strokeWidth="5" fill="none" />)
  if (!andes) [20, 38, 262, 284].forEach((x, i) => main.push(<Tree key={`p${i}`} c={c} x={x} y={gy + 26 + (i % 2) * 6} s={34 + (i % 2) * 8} kind={green ? 'round' : 'pine'} />))
  if (v === 'andes') [40, 260].forEach((x, i) => main.push(<g key={`ca${i}`}><path d={`M${x} ${gy + 30} v-22 M${x} ${gy + 18} h-6 v-8 M${x} ${gy + 14} h6 v-10`} stroke="#5f8a4a" strokeWidth="4" strokeLinecap="round" fill="none" /></g>))
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: gy + 10 }
}

const glacier: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  if (v !== 'antarctic') main.push(<Mountains key="m" c={c} base={c.hz - 10} color={far(c, '#8d93b4', 0.35)} peaks={[{ x: 50, h: 54, w: 60 }, { x: 160, h: 70, w: 70 }, { x: 260, h: 58, w: 60 }]} />)
  const ice = '#dfeef7'
  const iy = v === 'shore' ? c.hz - 4 : c.hz + 6
  const wallH = v === 'antarctic' ? 12 : 34
  // a jagged wall of seracs
  let top = ''
  for (let x = -10; x <= 310; x += 7) top += ` L${f(x)} ${f(iy - wallH + Math.sin(x / 37) * 5 - c.r() * 9)}`
  const front = `M-10 ${iy + 12}${top} L310 ${iy + 12} Z`
  main.push(<path key="ice" d={front} {...wash(ice, 0.25)} />)
  const cracks: ReactNode[] = []
  for (let i = 0; i < 22; i++) {
    const x = range(c.r, -5, 300)
    const w = range(c.r, 3, 9)
    const h = range(c.r, wallH * 0.5, wallH + 4)
    cracks.push(<path key={i} className="nosk" d={`M${f(x)} ${f(iy + 12)} L${f(x + w * 0.4)} ${f(iy + 12 - h)} L${f(x + w)} ${f(iy + 12)} Z`} fill={i % 3 ? '#a9d2ea' : '#6fa9d2'} opacity="0.7" />)
  }
  main.push(<g key="cr">{cracks}</g>)
  main.push(<rect key="wl" className="nosk" x="-10" y={iy + 8} width={W + 20} height="4" fill="#5f8fb8" opacity="0.5" />)
  main.push(<Water key="w" c={c} y={iy + 12} color={mix(c.p.water, '#6fa8c8', 0.5)} still />)
  const bergs: ReactNode[] = []
  for (let i = 0; i < 6; i++) {
    const x = range(c.r, 10, 290)
    const y = iy + 22 + i * 9
    const s = 6 + i * 2.4
    bergs.push(<path key={i} d={`M${f(x - s)} ${f(y)} L${f(x - s * 0.6)} ${f(y - s * 0.6)} L${f(x + s * 0.2)} ${f(y - s * 0.8)} L${f(x + s)} ${f(y)} Z`} {...wash(i % 2 ? '#f2f8fb' : '#cfe6f2', 0.2)} />)
  }
  main.push(<g key="bg">{bergs}</g>)
  if (v === 'shore') main.push(<path key="sh" d={`M-10 210 L-10 172 Q80 160 160 170 Q240 178 310 168 L310 210 Z`} {...wash('#6a625e', 0.2)} />)
  return { main: <g>{main}</g>, waterY: iy + 12, groundY: v === 'shore' ? 180 : undefined }
}

const lake: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const ly = c.hz + 10
  if (v === 'alpine' || v === 'jet' || v === 'orchard' || !v) main.push(<Mountains key="m" c={c} base={ly} color={far(c, mix(c.p.far, '#8d93b4', 0.3), 0.35)} peaks={[{ x: 50, h: 60, w: 64 }, { x: 150, h: 80, w: 70 }, { x: 250, h: 66, w: 64 }]} />)
  else main.push(<Hills key="h" c={c} y={ly - 2} amp={10} color={far(c, c.p.foliage, 0.45)} />)
  if (v === 'wetland') main.push(<g key="fc">{farCity(c, ly, 40, 260, 34, 0.55)}</g>)
  if (v === 'villa') main.push(<g key="vl"><Building c={c} x={190} y={ly} w={44} h={22} wall="#f2d49c" roof="tiled" roofColor={TERRA} rows={2} cols={5} />{[180, 240, 250].map((x) => <Tree key={x} c={c} x={x} y={ly + 2} s={28} kind="cypress" />)}</g>)
  // shore trees mirrored
  main.push(<Hills key="shore" c={c} y={ly + 2} amp={3} color={mix(c.p.foliage, c.p.near, 0.4)} waves={4} />)
  main.push(<Water key="w" c={c} y={ly + 4} color={v === 'lagoon' ? mix(c.p.water, '#f2c8c0', 0.25) : v === 'clear' ? mix(c.p.water, '#3fb7b0', 0.5) : c.p.water} still sunX={130} />)
  // reflection of the mountains
  main.push(<path key="rf" className="nosk" d={`M0 ${ly + 6} L60 ${ly + 34} L120 ${ly + 8} L150 ${ly + 46} L200 ${ly + 8} L250 ${ly + 36} L300 ${ly + 6} Z`} fill={far(c, c.p.far, 0.5)} opacity="0.25" />)
  if (v === 'jet') main.push(<path key="jt" d={`M200 ${ly + 4} Q198 ${ly - 50} 200 ${ly - 66} Q204 ${ly - 50} 202 ${ly + 4} Z`} fill="#f4f8fb" opacity="0.9" />)
  if (v === 'springs') main.push(<g key="sp">{[70, 150, 230].map((x) => <path key={x} className="nosk" d={`M${x} ${ly + 20} q-6 -10 0 -18 q6 -8 0 -18`} stroke="#fbf8f2" strokeWidth="3" fill="none" opacity="0.6" />)}</g>)
  // near bank with reeds
  main.push(<path key="bank" d={`M-10 210 L-10 180 Q60 172 120 186 Q200 196 310 182 L310 210 Z`} {...wash(c.p.near, 0.2)} />)
  if (v === 'wetland' || v === 'lagoon') main.push(<g key="rd">{Array.from({ length: 30 }, (_, i) => <path key={i} className="nosk" d={`M${i * 10 + c.r() * 6} 196 q${c.r() * 3} -12 ${c.r() * 6 - 3} -20`} stroke={darken(c.p.foliage, 0.2)} strokeWidth="1" fill="none" />)}</g>)
  if (v === 'orchard') main.push(<g key="or">{[30, 60, 250, 280].map((x) => <Tree key={x} c={c} x={x} y={190} s={30} kind="round" color="#6f9a46" />)}</g>)
  else main.push(<g key="tr"><Tree c={c} x={20} y={192} s={60} kind={v === 'alpine' ? 'pine' : 'round'} /><Tree c={c} x={44} y={188} s={44} kind={v === 'alpine' ? 'pine' : 'willow'} /></g>)
  return { main: <g>{main}</g>, waterY: ly + 4, groundY: 190 }
}

const forest: MotifFn = (c) => {
  const main: ReactNode[] = []
  for (let layer = 0; layer < 4; layer++) {
    const t = 0.65 - layer * 0.2
    const y = c.hz - 10 + layer * 22
    const out: ReactNode[] = []
    for (let i = 0; i < 12 - layer * 2; i++) {
      const x = range(c.r, -10, 310)
      out.push(<Tree key={i} c={c} x={x} y={y + range(c.r, 0, 10)} s={36 + layer * 22} kind={layer % 2 ? 'pine' : c.r() > 0.5 ? 'round' : 'pine'} color={far(c, mix(c.p.foliage, '#b98a5a', layer === 1 ? 0.3 : 0), Math.max(0, t))} />)
    }
    main.push(<g key={layer}>{out}</g>)
    if (layer === 1) main.push(<Ground key="g" c={c} y={c.hz + 30} color={mix(c.p.foliage, c.p.ground, 0.5)} strokes={30} />)
  }
  main.push(<path key="path" d={`M120 210 Q140 180 150 ${c.hz + 34} Q160 180 200 210 Z`} fill={lighten(c.p.ground, 0.15)} opacity="0.85" />)
  main.push(<path key="rays" className="nosk" d="M60 0 L120 210 L150 210 L90 0 Z M170 0 L210 210 L226 210 L186 0 Z" fill="#fff6d8" opacity="0.18" />)
  return { main: <g>{main}</g>, groundY: 186 }
}

const vineyard: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  main.push(<Hills key="h0" c={c} y={c.hz - 6} amp={12} color={far(c, c.p.mid, 0.5)} />)
  if (v === 'hilltown') main.push(<g key="ht">{hillTown(c, 200, c.hz + 2, 70, 30, 1)}</g>)
  main.push(<Hills key="h1" c={c} y={c.hz + 10} amp={10} color={far(c, c.p.foliage, 0.3)} />)
  if (v === 'village') main.push(<Row key="v" c={c} x0={90} x1={220} y={c.hz + 14} hMin={14} hMax={22} roof="gable" colors={['#f2d49c', '#e88b6a', '#9cc6e8', WHITE]} wMin={10} wMax={14} />)
  if (v === 'terraces') {
    main.push(<path key="vl" d={`M-10 ${c.hz + 6} Q80 ${c.hz - 30} 150 ${c.hz + 30} Q220 ${c.hz - 34} 310 ${c.hz} L310 210 L-10 210 Z`} {...wash(mix(c.p.foliage, c.p.ground, 0.3))} />)
    main.push(<g key="tr">{Array.from({ length: 9 }, (_, i) => <path key={i} className="nosk" d={`M-10 ${c.hz + 14 + i * 10} Q70 ${c.hz - 16 + i * 12} 140 ${c.hz + 40 + i * 6}`} stroke={darken(c.p.foliage, 0.25)} strokeWidth="1.6" fill="none" strokeDasharray="3 2" />)}{Array.from({ length: 9 }, (_, i) => <path key={`r${i}`} className="nosk" d={`M160 ${c.hz + 40 + i * 6} Q230 ${c.hz - 18 + i * 12} 310 ${c.hz + 10 + i * 10}`} stroke={darken(c.p.foliage, 0.25)} strokeWidth="1.6" fill="none" strokeDasharray="3 2" />)}</g>)
    main.push(<path key="rv" d={`M110 210 Q140 ${c.hz + 60} 150 ${c.hz + 34} Q160 ${c.hz + 60} 200 210 Z`} fill={c.p.water} />)
    main.push(<Boat key="rb" c={c} x={150} y={196} s={26} kind="sail" color="#7a4a2e" />)
    return { main: <g>{main}</g>, waterY: c.hz + 50, groundY: 180 }
  }
  main.push(<g key="rows">{rowsField(c.hz + 24, 210, mix(c.p.ground, c.p.foliage, 0.35), darken(c.p.foliage, 0.15), 10, 14)}</g>)
  main.push(<g key="cy">{[30, 44, 58, 236, 250].map((x, i) => <Tree key={i} c={c} x={x} y={c.hz + 40} s={52} kind="cypress" />)}</g>)
  if (!v || v === 'terraces') main.push(<Building key="farm" c={c} x={110} y={c.hz + 36} w={56} h={26} wall={STONE} roof="tiled" roofColor={TERRA} rows={1} cols={3} />)
  main.push(<g key="gr">{Array.from({ length: 6 }, (_, i) => <circle key={i} className="nosk" cx={30 + i * 50 + c.r() * 10} cy={190 + c.r() * 8} r="3" fill="#6a3a6a" opacity="0.8" />)}</g>)
  return { main: <g>{main}</g>, groundY: 180 }
}

const desert: MotifFn = (c) => {
  const v = c.variant ?? 'mesa'
  const main: ReactNode[] = []
  const sand = v === 'salt' ? '#f4f2ee' : v === 'moon' ? '#c9c2b8' : v === 'dunes' || v === 'lagoons' ? (v === 'lagoons' ? '#f6f0e2' : '#ecc98e') : '#d9a06a'
  if (v === 'rainbow') {
    const bands = ['#c9563a', '#e9a24a', '#8a9a5a', '#d97a5a', '#b9a0c0', '#e8c08a']
    for (let i = 0; i < 6; i++) main.push(<path key={i} d={ridgePath(c.r, c.hz - 40 + i * 12, 16 - i, 2, 0.2)} {...wash(bands[i]!, 0.15)} />)
  } else if (v === 'salt') {
    main.push(<Mountains key="m" c={c} base={c.hz} color={far(c, '#a98aa0', 0.45)} snow peaks={[{ x: 60, h: 34, w: 60 }, { x: 200, h: 44, w: 70 }]} />)
  } else if (v === 'dunes' || v === 'lagoons') {
    if (v === 'dunes') main.push(<g key="sea"><Water c={c} y={c.hz - 6} /><Hills c={c} y={c.hz + 2} amp={4} color={far(c, '#4f7a4a', 0.2)} waves={5} /></g>)
    main.push(<Ground key="g0" c={c} y={c.hz + 16} color={sand} strokes={14} />)
    for (let i = 0; i < 4; i++) {
      const y0 = c.hz - 4 + i * 20
      const cx = 60 + c.r() * 180
      const w = 120 + i * 30
      const h = 28 - i * 4
      main.push(
        <g key={i}>
          <path d={`M${f(cx - w)} ${f(y0 + 24)} Q${f(cx - w * 0.3)} ${f(y0 - h * 0.6)} ${f(cx)} ${f(y0 - h)} Q${f(cx + w * 0.4)} ${f(y0 - h * 0.2)} ${f(cx + w)} ${f(y0 + 24)} Z`} {...wash(i % 2 ? lighten(sand, 0.12) : sand, 0.12)} />
          <path className="nosk" d={`M${f(cx)} ${f(y0 - h)} Q${f(cx + w * 0.4)} ${f(y0 - h * 0.2)} ${f(cx + w)} ${f(y0 + 24)} L${f(cx + w * 0.2)} ${f(y0 + 24)} Z`} fill={darken(sand, 0.25)} opacity="0.35" />
          <path d={`M${f(cx - w * 0.6)} ${f(y0 + 4)} Q${f(cx - w * 0.3)} ${f(y0 - h * 0.6)} ${f(cx)} ${f(y0 - h)}`} stroke={lighten(sand, 0.5)} strokeWidth="1" fill="none" opacity="0.7" />
        </g>,
      )
    }
  } else {
    // mesas and canyon walls
    main.push(<path key="m1" d={`M-10 ${c.hz} L10 ${c.hz - 40} L80 ${c.hz - 44} L96 ${c.hz} Z`} {...wash(far(c, '#c9785a', 0.35))} />)
    main.push(<path key="m2" d={`M180 ${c.hz} L196 ${c.hz - 56} L280 ${c.hz - 60} L300 ${c.hz} Z`} {...wash(far(c, '#b9603e', 0.25))} />)
    main.push(<path key="st" className="nosk" d={`M190 ${c.hz - 30} h100 M186 ${c.hz - 16} h110 M8 ${c.hz - 20} h80`} stroke="#8a4a32" strokeWidth="1" opacity="0.4" />)
    if (v === 'canyon') main.push(<g key="cw"><path d={`M-10 210 L-10 70 Q30 60 70 74 L100 210 Z`} {...wash('#b9603e', 0.25)} /><path d={`M310 210 L310 60 Q270 56 236 76 L210 210 Z`} {...wash('#a9553a', 0.25)} /><path d="M100 210 Q140 170 150 150 Q170 170 210 210 Z" fill={c.p.water} opacity="0.8" /></g>)
    if (v === 'moon') main.push(<g key="mn">{[[90, 30], [150, 22], [230, 36]].map(([x, h], i) => <path key={i} d={`M${x! - 10} ${c.hz + 10} Q${x! - 12} ${c.hz - h!} ${x} ${c.hz - h! - 6} Q${x! + 12} ${c.hz - h!} ${x! + 8} ${c.hz + 10} Z`} {...wash('#b9b0a8')} />)}</g>)
  }
  if (v !== 'dunes' && v !== 'lagoons') main.push(<Ground key="g" c={c} y={c.hz + 10} color={sand} strokes={v === 'salt' ? 0 : 20} />)
  if (v === 'salt') main.push(<g key="hx">{Array.from({ length: 40 }, (_, i) => { const x = (i % 10) * 34 - 10 + (Math.floor(i / 10) % 2) * 17; const y = c.hz + 22 + Math.floor(i / 10) * 18; const s = 6 + Math.floor(i / 10) * 3; return <path key={i} d={`M${x - s} ${y} l${s / 2} ${-s / 3} h${s} l${s / 2} ${s / 3} l${-s / 2} ${s / 3} h${-s} Z`} fill="none" stroke="#d9d4cc" strokeWidth="0.8" /> })}</g>)
  if (v === 'lagoons') main.push(<g key="lg">{[[70, 170, 40], [200, 150, 30], [250, 184, 34]].map(([x, y, s], i) => <ellipse key={i} cx={x} cy={y} rx={s} ry={s! / 4} fill={mix(c.p.water, '#3fb7b0', 0.55)} stroke="#2f8fa0" strokeWidth="0.5" />)}</g>)
  if (v === 'mesa' || v === 'canyon' || v === 'rainbow') {
    ;[[50, 190, 30], [240, 196, 40], [270, 182, 24]].forEach(([x, y, s], i) =>
      main.push(<path key={`c${i}`} d={`M${x} ${y} v${-s!} M${x} ${y! - s! * 0.55} h${-s! * 0.25} v${-s! * 0.3} M${x} ${y! - s! * 0.4} h${s! * 0.25} v${-s! * 0.35}`} stroke="#5f8a4a" strokeWidth={s! / 7} strokeLinecap="round" fill="none" />),
    )
  }
  if (v === 'mesa') main.push(<path key="arch" d={`M110 ${c.hz + 30} L114 ${c.hz - 10} Q140 ${c.hz - 30} 166 ${c.hz - 10} L170 ${c.hz + 30} L158 ${c.hz + 30} Q156 ${c.hz} 140 ${c.hz} Q124 ${c.hz} 122 ${c.hz + 30} Z`} {...wash('#c9683e', 0.25)} />)
  return { main: <g>{main}</g>, groundY: 180 }
}

const waterfall: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const rock = v === 'canyon' ? '#b98a6a' : '#7d6a5a'
  const top = 70
  main.push(<Hills key="h" c={c} y={top} amp={8} color={far(c, c.p.foliage, 0.4)} />)
  main.push(<path key="cl" d={`M-10 210 L-10 ${top + 10} Q150 ${top - 4} 310 ${top + 10} L310 210 Z`} {...wash(rock, 0.2)} />)
  main.push(<path key="gr" d={`M-10 ${top + 14} Q150 ${top} 310 ${top + 14} L310 ${top + 4} Q150 ${top - 10} -10 ${top + 4} Z`} {...wash(c.p.foliage)} />)
  const falls: ReactNode[] = []
  const xs = v === 'highland' ? [150] : [40, 90, 150, 200, 255]
  xs.forEach((x, i) => {
    const w = v === 'highland' ? 26 : range(c.r, 12, 24)
    falls.push(<path key={i} d={`M${x - w / 2} ${top + 4} Q${x} ${top} ${x + w / 2} ${top + 4} Q${x + w / 2 + 3} ${top + 14} ${x + w / 2 + 2} ${top + 30} L${x + w / 2 + 6} 150 L${x - w / 2 - 6} 150 L${x - w / 2 - 2} ${top + 30} Q${x - w / 2 - 3} ${top + 14} ${x - w / 2} ${top + 4} Z`} fill="#eef6fa" />)
    falls.push(<path key={`s${i}`} className="nosk" d={`M${x + w / 2 - 2} ${top + 8} L${x + w / 2 + 4} 150 L${x + w / 2 - 3} 150 Z`} fill="#b9d6e6" opacity="0.6" />)
    for (let k = 0; k < 5; k++) falls.push(<path key={`${i}-${k}`} className="nosk" d={`M${f(x - w / 2 + (w / 5) * k + 2)} ${top + 8} q1 40 ${f((k - 2) * 2)} 80`} stroke="#a9cfe2" strokeWidth="0.8" fill="none" />)
  })
  main.push(<g key="ld">{Array.from({ length: 7 }, (_, i) => <path key={i} className="nosk" d={`M${-10 + i * 48} ${top + 30 + (i % 3) * 14} q20 -4 40 2`} stroke={darken(rock, 0.3)} strokeWidth="1.4" fill="none" opacity="0.6" />)}</g>)
  main.push(<g key="f">{falls}</g>)
  main.push(<Water key="w" c={c} y={150} color={mix(c.p.water, '#8ab8a0', 0.3)} />)
  main.push(<ellipse key="mist" className="nosk" cx="150" cy="152" rx="170" ry="16" fill="#fbfdfe" opacity="0.7" />)
  main.push(<g key="jg">{[10, 34, 270, 292].map((x, i) => <Tree key={i} c={c} x={x} y={200} s={50} kind={i % 2 ? 'palm' : 'round'} />)}</g>)
  return { main: <g>{main}</g>, waterY: 160 }
}

const bridge: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  const wy = 146
  if (v === 'hilltown') {
    main.push(<path key="vl" d={`M-10 210 L-10 ${c.hz + 20} Q150 ${c.hz + 60} 310 ${c.hz + 20} L310 210 Z`} {...wash(mix(c.p.foliage, c.p.far, 0.4))} />)
    main.push(<g key="ht"><path d={`M120 ${c.hz + 30} Q130 ${c.hz - 20} 190 ${c.hz - 26} Q240 ${c.hz - 20} 250 ${c.hz + 30} Z`} {...wash('#c9a77a', 0.25)} />{hillTown(c, 186, c.hz - 18, 46, 4, 1)}</g>)
    main.push(<path key="br" d={`M-10 ${c.hz + 50} L140 ${c.hz - 4}`} stroke="#8a7a6a" strokeWidth="5" />)
    main.push(<path key="brs" d={`M10 ${c.hz + 46} v20 M50 ${c.hz + 32} v26 M90 ${c.hz + 18} v28`} stroke="#8a7a6a" strokeWidth="3" />)
    return { main: <g>{main}</g>, groundY: 190 }
  }
  if (v === 'aqueduct') {
    main.push(<g key="bk">{farCity(c, c.hz + 10, -5, 305, 40, 0.5)}</g>)
    main.push(<Ground key="g" c={c} y={176} color="#c9b8a0" strokes={6} />)
    const sky = mix(c.haze, c.p.sky[0], 0.4)
    main.push(
      <g key="aq">
        <rect x="-10" y="70" width="320" height="106" {...wash(WHITE, 0.18)} />
        <rect x="-10" y="70" width="320" height="6" fill={darken(WHITE, 0.08)} />
        {Array.from({ length: 12 }, (_, i) => <path key={`u${i}`} d={`M${i * 28 - 4} 112 v-22 a9 10 0 0 1 18 0 v22 Z`} fill={sky} />)}
        {Array.from({ length: 12 }, (_, i) => <path key={`l${i}`} d={`M${i * 28 - 6} 176 v-40 a11 12 0 0 1 22 0 v40 Z`} fill={sky} />)}
        <path className="nosk" d="M-10 114 H310" stroke={darken(WHITE, 0.2)} strokeWidth="1.2" />
      </g>,
    )
    main.push(<g key="tr"><rect x="120" y="58" width="44" height="12" rx="2" {...wash('#f2c84b')} /><path d="M126 62 h6 M136 62 h6 M146 62 h6" stroke="#5a4636" strokeWidth="2" /><path d="M142 58 l-4 -10 M138 48 h8" stroke="#3a3346" strokeWidth="0.8" /></g>)
    return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 186 }
  }
  main.push(<g key="fc">{v === 'shops' || v === 'river' || !v ? farCity(c, c.hz + 6, -5, 305, 30, 0.55) : farHills(c, c.hz, 8, 0.55)}</g>)
  if (v === 'iron') main.push(<g key="hs"><Hills c={c} y={c.hz + 4} amp={18} color={far(c, c.p.mid, 0.3)} /><Row c={c} x0={-5} x1={120} y={c.hz + 10} hMin={14} hMax={26} roof="tiled" colors={c.p.buildings} wMin={10} wMax={14} /></g>)
  main.push(<Row key="bank" c={c} x0={-5} x1={305} y={wy - 6} hMin={16} hMax={30} roof={v === 'river' ? 'mansard' : 'tiled'} colors={c.p.buildings} wMin={14} wMax={22} />)
  main.push(<Water key="w" c={c} y={wy} sunX={150} />)
  const by = wy + 8
  if (v === 'iron') {
    main.push(<g key="ir"><path d={`M40 ${by + 30} Q150 ${by - 70} 260 ${by + 30}`} stroke="#3a3a46" strokeWidth="4" fill="none" /><path d={`M30 ${by - 40} H270`} stroke="#3a3a46" strokeWidth="3" />{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${60 + i * 20} ${by - 40} v${30 - Math.abs(i - 4.5) * 8}`} stroke="#3a3a46" strokeWidth="0.8" />)}</g>)
  } else if (v === 'suspension' || v === 'cable') {
    main.push(<g key="sb"><path d={`M-10 ${by - 8} H310`} stroke={WHITE} strokeWidth="4" /><rect x="96" y={by - 70} width="6" height="62" fill={WHITE} /><rect x="196" y={by - 70} width="6" height="62" fill={WHITE} />{v === 'cable' ? Array.from({ length: 8 }, (_, i) => <path key={i} d={`M99 ${by - 66} L${40 + i * 15} ${by - 8} M199 ${by - 66} L${150 + i * 15} ${by - 8}`} stroke="#e8e2d6" strokeWidth="0.6" />) : <path d={`M-10 ${by - 60} Q50 ${by - 10} 99 ${by - 70} Q150 ${by - 16} 199 ${by - 70} Q250 ${by - 10} 310 ${by - 60}`} stroke="#e8e2d6" strokeWidth="1.2" fill="none" />}</g>)
  } else {
    // stone arches
    const n = v === 'broken' ? 4 : 5
    const x0 = v === 'broken' ? -10 : 10
    const span = v === 'broken' ? 44 : 56
    const stone = v === 'shops' ? '#d9b07a' : STONE
    main.push(<rect key="deck" x={x0} y={by - 12} width={span * n} height="10" {...wash(stone)} />)
    main.push(<g key="ar">{Array.from({ length: n }, (_, i) => <path key={i} d={`M${x0 + i * span} ${by - 2} h${span} v18 h-6 a${span / 2 - 6} ${span / 2.6} 0 0 0 ${-(span - 12)} 0 h-6 Z`} {...wash(stone)} />)}</g>)
    if (v === 'shops') main.push(<g key="sh"><Row c={c} x0={60} x1={240} y={by - 12} hMin={10} hMax={18} roof="tiled" colors={['#e9a85c', '#f2d49c', '#d98a5a']} wMin={8} wMax={14} /></g>)
    if (v === 'broken') main.push(<rect key="ch" x="60" y={by - 22} width="12" height="10" {...wash(STONE)} />)
  }
  if (c.lit) for (let i = 0; i < 6; i++) lights.push(<circle key={i} cx={30 + i * 48} cy={by - 18} r="2" fill="#ffe2a0" opacity="0.9" />)
  main.push(<g key="trees">{[16, 284].map((x) => <Tree key={x} c={c} x={x} y={200} s={46} kind="round" />)}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, waterY: wy + 20 }
}

const plaza: MotifFn = (c) => {
  const v = c.variant ?? 'cathedral'
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  const y = 150
  if (v === 'hill-basilica') {
    main.push(<path key="h" d={`M40 ${c.hz + 30} Q150 ${c.hz - 40} 260 ${c.hz + 30} Z`} {...wash(c.p.foliage)} />)
    main.push(<g key="ch">{churchFront(c, 132, c.hz - 18, 36, 26, STONE, 'single')}</g>)
    main.push(<Row key="r" c={c} x0={-5} x1={305} y={y} hMin={20} hMax={34} roof="tiled" colors={c.p.buildings} />)
  } else {
    main.push(<g key="fh">{farHills(c, c.hz, 6, 0.65)}</g>)
    main.push(<Row key="r" c={c} x0={-5} x1={305} y={y - 6} hMin={22} hMax={40} roof={v === 'grand' || v === 'gothic' ? 'gable' : 'tiled'} colors={v === 'grand' ? ['#e9c68a', '#d9b07a', '#f2d49c'] : c.p.buildings} balcony />)
  }
  const wall = v === 'colonial' ? WHITE : v === 'gothic' ? '#d8cfc0' : v === 'baroque' ? '#e9c68a' : v === 'grand' ? '#e2b968' : STONE
  if (v === 'cathedral' || v === 'colonial' || v === 'gothic' || v === 'baroque' || v === 'basilica' || v === 'senado' || v === 'grand') main.push(<g key="cf">{churchFront(c, 110, y, 80, 46, wall, v === 'gothic' || v === 'grand' ? 'gothic' : v === 'colonial' || v === 'senado' ? 'single' : 'twin')}</g>)
  if (v === 'dome' || v === 'college') main.push(<g key="dm">{churchFront(c, 105, y, 90, 42, v === 'college' ? '#f2e2c8' : STONE, 'dome')}</g>)
  if (v === 'theatre') {
    main.push(<g key="th"><rect x="80" y={y - 56} width="140" height="56" {...wash('#f2e2c8')} /><path d={`M74 ${y - 56} h152 l-8 -10 h-136 Z`} {...wash('#e2cfaa')} />{columns(c, 92, y - 4, 116, 46, 8, '#fbf3e3')}<path d={`M120 ${y - 66} A30 20 0 0 1 180 ${y - 66} Z`} {...wash('#8fb0a0')} /></g>)
    if (c.lit) lights.push(<g key="tl">{Array.from({ length: 7 }, (_, i) => <rect key={i} x={96 + i * 16.6} y={y - 40} width="6" height="14" fill="#ffd98a" opacity="0.85" />)}</g>)
  }
  if (v === 'pyramid') main.push(<g key="py"><Row c={c} x0={-5} x1={305} y={y - 2} hMin={30} hMax={34} roof="mansard" colors={['#eadcc0']} wMin={30} wMax={36} /><path d={`M110 ${y + 8} L150 ${y - 40} L190 ${y + 8} Z`} fill="#bfd6e6" opacity="0.85" stroke="#7d9aa8" strokeWidth="0.8" /><path d={`M130 ${y - 16} L170 ${y - 16} M120 ${y - 4} L180 ${y - 4} M150 ${y - 40} V${y + 8}`} stroke="#7d9aa8" strokeWidth="0.5" /></g>)
  if (v === 'arch') main.push(<g key="ac"><rect x="116" y={y - 70} width="68" height="70" {...wash(STONE)} /><path d={`M136 ${y} v-34 a14 16 0 0 1 28 0 v34 Z`} fill={c.lit ? '#3a3a5a' : '#8a8090'} /><rect x="112" y={y - 76} width="76" height="8" {...wash(STONE)} /></g>)
  if (v === 'steps') main.push(<g key="sp">{churchFront(c, 110, 104, 80, 30, '#f2d4c0', 'twin')}{Array.from({ length: 9 }, (_, i) => <rect key={i} x={70 - i * 4} y={104 + i * 6} width={160 + i * 8} height="6" {...wash(i % 2 ? STONE : '#efe4cf', 0.12)} />)}<g>{Array.from({ length: 14 }, (_, i) => <circle key={i} cx={74 + i * 12} cy={112 + (i % 4) * 9} r="2" fill="#e88ba0" />)}</g></g>)
  if (v === 'campo') main.push(<g key="cp"><rect x="140" y={y - 110} width="14" height="104" {...wash('#c9763a')} /><rect x="137" y={y - 118} width="20" height="10" {...wash(STONE)} /><Building c={c} x={100} y={y} w={96} h={40} wall="#c9763a" roof="flat" rows={2} cols={8} /></g>)
  if (v === 'statues') main.push(<g key="stt">{[80, 150, 220].map((x) => <g key={x}><rect x={x - 6} y={y + 10} width="12" height="14" {...wash(STONE)} /><path d={`M${x - 3} ${y + 10} v-14 a3 3 0 0 1 6 0 v14 Z`} {...wash('#9aa0a8')} /><circle cx={x} cy={y - 8} r="3" fill="#9aa0a8" /></g>)}</g>)
  // pavement
  main.push(<path key="pv" className="bg" d={`M-10 ${y} L310 ${y} L310 210 L-10 210 Z`} {...wash(v === 'senado' ? '#efe8da' : '#d9ccb4', 0.1)} />)
  if (v === 'senado') main.push(<g key="wv">{Array.from({ length: 6 }, (_, i) => <path key={i} d={`M-10 ${y + 8 + i * 9} q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0`} stroke="#2f2c38" strokeWidth={1 + i * 0.3} fill="none" opacity="0.8" />)}</g>)
  else main.push(<g key="cb">{cobbles(c, y, '#d9ccb4')}</g>)
  if (v === 'fountain' || v === 'cathedral' || v === 'basilica') main.push(<g key="ft">{v === 'fountain' && <g>{churchFront(c, 100, y, 100, 40, '#efe4cf', 'single')}{columns(c, 106, y, 88, 36, 6, '#f6eedf')}</g>}{fountain(c, v === 'fountain' ? 150 : 60, v === 'fountain' ? 182 : 178, v === 'fountain' ? 56 : 18)}</g>)
  if (v === 'cathedral' || v === 'colonial' || v === 'college') main.push(<g key="pl">{[24, 276].map((x) => <Tree key={x} c={c} x={x} y={196} s={50} kind={v === 'colonial' ? 'palm' : 'round'} />)}</g>)
  const lp = lamp(c, 250, 194, 34)
  main.push(<g key="lp">{lp.main}</g>)
  lights.push(<g key="lpl">{lp.light}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 186 }
}

const ruins: MotifFn = (c) => {
  const v = c.variant ?? 'columns'
  const main: ReactNode[] = []
  const stone = v === 'mission' ? '#c98a6a' : '#e8d6b4'
  main.push(<Hills key="h" c={c} y={c.hz} amp={10} color={far(c, c.p.foliage, 0.45)} />)
  main.push(<Ground key="g" c={c} y={c.hz + 26} color={mix(c.p.ground, c.p.foliage, 0.35)} strokes={30} />)
  const y = c.hz + 48
  if (v === 'amphitheatre') {
    main.push(<g key="am"><path d={`M40 ${y} L40 ${y - 70} Q150 ${y - 92} 260 ${y - 74} L260 ${y} Z`} {...wash(stone, 0.2)} /><path d={`M200 ${y - 80} Q240 ${y - 76} 260 ${y - 74} L260 ${y - 40} Q230 ${y - 54} 200 ${y - 56} Z`} fill={c.p.sky[1]} opacity="0.9" />{[0, 1, 2].map((row) => Array.from({ length: 9 }, (_, i) => <path key={`${row}${i}`} d={`M${52 + i * 24} ${y - 6 - row * 22} v-12 a6 7 0 0 1 12 0 v12 Z`} fill={darken(stone, 0.45)} opacity="0.75" />))}</g>)
  } else if (v === 'facade') {
    main.push(<g key="fa">{Array.from({ length: 6 }, (_, i) => <rect key={i} x={70 - i * 6} y={y + i * 4} width={160 + i * 12} height="4" {...wash(STONE, 0.12)} />)}<path d={`M100 ${y} V${y - 74} H200 V${y} Z`} {...wash('#d9c09a', 0.2)} /><path d={`M120 ${y - 74} L150 ${y - 100} L180 ${y - 74} Z`} {...wash('#d9c09a', 0.2)} />{[0, 1, 2].map((row) => [112, 142, 172].map((x) => <path key={`${row}${x}`} d={`M${x} ${y - 4 - row * 24} v-12 a8 8 0 0 1 16 0 v12 Z`} fill={c.p.sky[1]} />))}</g>)
  } else if (v === 'temple') {
    main.push(<g key="tp"><rect x="60" y={y - 6} width="180" height="8" {...wash(stone)} />{columns(c, 70, y - 6, 160, 50, 8, stone)}<rect x="62" y={y - 64} width="176" height="8" {...wash(stone)} /><path d={`M60 ${y - 64} L150 ${y - 84} L240 ${y - 64} Z`} {...wash(stone)} /></g>)
  } else if (v === 'stones') {
    const out: ReactNode[] = []
    for (let row = 0; row < 4; row++) for (let i = 0; i < 12; i++) {
      const x = 10 + i * 25 + row * 6
      const yy = c.hz + 34 + row * 14
      const h = 10 + row * 6 + c.r() * 6
      out.push(<path key={`${row}${i}`} d={`M${x - 3 - row} ${yy} L${x - 2} ${yy - h} Q${x + 1} ${yy - h - 2} ${x + 3} ${yy - h + 1} L${x + 3 + row} ${yy} Z`} {...wash('#9a948a', 0.2)} />)
    }
    main.push(<g key="st">{out}</g>)
  } else if (v === 'abbey' || v === 'mission') {
    main.push(<g key="ab"><path d={`M60 ${y} V${y - 60} H240 V${y} Z`} {...wash(stone, 0.2)} />{Array.from({ length: 4 }, (_, i) => <path key={i} d={`M${78 + i * 40} ${y} v-34 a12 14 0 0 1 24 0 v34 Z`} fill={c.p.sky[1]} />)}<path d={`M60 ${y - 60} l20 -8 l30 6 l40 -10 l30 8 l30 -4 l30 8`} stroke={darken(stone, 0.3)} strokeWidth="1" fill="none" />{v === 'mission' && [40, 260].map((x) => <Tree key={x} c={c} x={x} y={y + 10} s={60} kind="round" />)}</g>)
  } else {
    main.push(<g key="co"><rect x="30" y={y + 2} width="240" height="10" {...wash(stone)} />{columns(c, 44, y + 2, 212, 92, 7, stone, 0.6, 3)}<rect x="36" y={y - 98} width="110" height="10" {...wash(stone)} /><path d={`M36 ${y - 98} L36 ${y - 106} L146 ${y - 106} L146 ${y - 98} Z`} {...wash(darken(stone, 0.08))} /></g>)
    main.push(<g key="fr">{[[70, y + 30], [190, y + 36]].map(([x, yy], i) => <rect key={i} x={x} y={yy} width="34" height="10" rx="4" {...wash(stone)} transform={`rotate(${i * 16 - 8} ${x} ${yy})`} />)}</g>)
  }
  main.push(<g key="cy">{[20, 280].map((x) => <Tree key={x} c={c} x={x} y={196} s={v === 'mission' ? 30 : 64} kind={v === 'mission' ? 'round' : 'cypress'} />)}</g>)
  return { main: <g>{main}</g>, groundY: 186 }
}

const castle: MotifFn = (c) => {
  const v = c.variant ?? 'fortress'
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  const stone = v === 'chateau' || v === 'chateau-frontenac' ? '#f1e8d6' : v === 'palace' ? '#e9b08a' : '#d9c6a6'
  if (v === 'abbey-island') {
    main.push(<Water key="w" c={c} y={c.hz + 8} color={mix(c.p.water, '#c9c0a8', 0.4)} still sunX={80} />)
    main.push(<path key="is" d={`M70 ${c.hz + 14} Q100 ${c.hz - 20} 150 ${c.hz - 50} Q200 ${c.hz - 20} 230 ${c.hz + 14} Z`} {...wash('#a99a86', 0.2)} />)
    main.push(<Row key="r" c={c} x0={86} x1={214} y={c.hz + 12} hMin={10} hMax={18} roof="gable" colors={[STONE, '#d9c6a6']} wMin={8} wMax={12} />)
    main.push(<g key="ab"><rect x="128" y={c.hz - 66} width="44" height="22" {...wash(STONE)} /><path d={`M146 ${c.hz - 66} L150 ${c.hz - 112} L154 ${c.hz - 66} Z`} {...wash('#8a8a95')} /><path d={`M150 ${c.hz - 112} v-4`} stroke="#e9b949" strokeWidth="1.4" /></g>)
    main.push(<path key="sand" className="bg" d={`M-10 ${c.hz + 30} Q150 ${c.hz + 22} 310 ${c.hz + 34} L310 210 L-10 210 Z`} {...wash('#d9ccb0', 0.1)} />)
    return { main: <g>{main}</g>, waterY: c.hz + 8, groundY: 186 }
  }
  const onHill = v === 'palace' || v === 'hilltown' || v === 'fortress' || v === 'walls' || v === 'chateau-frontenac'
  if (v === 'seawall' || v === 'chateau-frontenac') main.push(<Water key="w" c={c} y={c.hz + 30} sunX={60} />)
  else main.push(<Hills key="h0" c={c} y={c.hz} amp={10} color={far(c, c.p.foliage, 0.45)} />)
  if (v === 'palace') main.push(<ellipse key="mist" className="nosk" cx="150" cy={c.hz} rx="200" ry="22" fill="#fbf8f4" opacity="0.6" />)
  const base = onHill ? c.hz + 10 : c.hz + 30
  if (onHill) main.push(<path key="hill" d={`M-10 210 L-10 ${base + 30} Q60 ${base} 150 ${base - 6} Q240 ${base} 310 ${base + 30} L310 210 Z`} {...wash(c.p.foliage, 0.2)} />)
  const towers = v === 'towers' ? 7 : v === 'chateau' || v === 'chateau-frontenac' ? 4 : 3
  const xs = Array.from({ length: towers }, (_, i) => 70 + (160 / (towers - 1)) * i)
  // curtain wall
  if (v !== 'towers') main.push(<rect key="cw" x="66" y={base - 34} width="168" height="34" {...wash(stone, 0.22)} />)
  if (v === 'walls' || v === 'fortress' || v === 'seawall') main.push(<path key="cr" d={`M66 ${base - 34} ${Array.from({ length: 21 }, (_, i) => `h4 v${i % 2 ? 4 : -4}`).join(' ')}`} stroke={darken(stone, 0.25)} strokeWidth="1" fill="none" />)
  const hs = xs.map(() => (v === 'towers' ? range(c.r, 50, 90) : range(c.r, 46, 62)))
  xs.forEach((x, i) => {
    const h = hs[i]!
    const w = v === 'towers' ? 13 : 20
    const roof = v === 'chateau' || v === 'chateau-frontenac' ? 'cone' : v === 'palace' && i === 1 ? 'dome' : v === 'towers' ? 'flat' : v === 'hilltown' ? 'tiled' : 'flat'
    main.push(<Building key={i} c={c} x={x - w / 2} y={base} w={w} h={h} wall={v === 'palace' ? pick(c.r, ['#e9b08a', '#f2d49c', '#d98a8a']) : stone} roof={roof} roofColor={roof === 'cone' ? '#6a7a94' : TERRA} rows={3} cols={1} slit={v !== 'palace' && v !== 'chateau' && v !== 'chateau-frontenac'} />)
    if (roof === 'flat' && v !== 'towers') main.push(<path key={`b${i}`} d={`M${x - w / 2} ${base - h - 1.6} ${Array.from({ length: 5 }, () => `h${w / 10} v-3 h${w / 10} v3`).join(' ')}`} {...wash(stone)} />)
  })
  main.push(<path key="gate" d={`M141 ${base} v-14 a9 9 0 0 1 18 0 v14 Z`} fill="#3a3040" />)
  if (onHill) main.push(<path key="path" className="nosk" d={`M150 ${base} Q120 ${base + 20} 160 ${base + 36} Q200 ${base + 54} 150 210`} stroke={lighten(c.p.ground, 0.3)} strokeWidth="7" fill="none" opacity="0.8" />)
  const fh = base - hs[1]! - (v === 'chateau' || v === 'chateau-frontenac' ? 20 : 4)
  main.push(<g key="flag"><path d={`M${xs[1]!} ${fh} v-14`} stroke="#3a3346" strokeWidth="0.8" /><path d={`M${xs[1]!} ${fh - 14} l12 3 l-12 4 Z`} fill={c.p.ink} /></g>)
  if (v === 'chateau' || v === 'chateau-frontenac') main.push(<path key="mr" d={`M66 ${base - 34} L76 ${base - 50} L224 ${base - 50} L234 ${base - 34} Z`} {...wash('#6a7a94')} />)
  if (v === 'fortress') main.push(<g key="cn">{[100, 200].map((x) => <rect key={x} x={x} y={base - 30} width="14" height="3" rx="1.5" fill="#2e2a36" />)}</g>)
  if (v === 'seawall') main.push(<rect key="sw" x="-10" y={c.hz + 24} width="320" height="10" {...wash(stone)} />)
  if (!onHill && v !== 'seawall') main.push(<Ground key="g" c={c} y={base} color={mix(c.p.foliage, c.p.ground, 0.3)} strokes={20} />)
  if (v === 'chateau') main.push(<Water key="moat" c={c} y={base + 6} still />)
  if (c.lit) xs.forEach((x, i) => lights.push(<rect key={i} x={x - 1.5} y={base - 26} width="3" height="5" fill="#ffd98a" />))
  main.push(<g key="tr">{[18, 282].map((x) => <Tree key={x} c={c} x={x} y={198} s={54} kind={v === 'hilltown' || v === 'towers' ? 'cypress' : 'round'} />)}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 190, waterY: v === 'seawall' ? c.hz + 34 : undefined }
}

const market: MotifFn = (c) => {
  const v = c.variant
  const neon = v === 'neon' || v === 'night'
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  const y = 160
  main.push(<Row key="r" c={c} x0={-5} x1={305} y={y - 30} hMin={neon ? 60 : 44} hMax={neon ? 100 : 70} roof={neon ? 'flat' : 'tiled'} colors={neon ? ['#c9c4bb', '#b9b4c4', '#d7cfc0', '#a9b4c0'] : c.p.buildings} balcony={!neon} />)
  if (v === 'hall') main.push(<g key="hall"><rect x="40" y={y - 76} width="220" height="50" {...wash('#d9c6a6')} /><path d={`M40 ${y - 76} Q150 ${y - 110} 260 ${y - 76} Z`} {...wash('#a9c4b0')} />{Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${60 + i * 40} ${y - 30} v-28 a10 12 0 0 1 20 0 v28 Z`} fill={['#e05a4a', '#f2c84b', '#3f8fc0', '#6fb57a', '#e88b6a'][i]} opacity="0.8" />)}</g>)
  if (neon) {
    const signs: ReactNode[] = []
    for (let i = 0; i < 8; i++) {
      const x = 10 + i * 38 + range(c.r, -6, 6)
      const yy = range(c.r, 50, 110)
      const col = pick(c.r, ['#ff5f6d', '#ffd166', '#5fd3ff', '#9b7bff', '#5fe08a'])
      signs.push(<g key={i}><rect x={x} y={yy} width="12" height={range(c.r, 20, 36)} fill="#2a2632" stroke={col} strokeWidth="1.4" /><path d={`M${x + 3} ${yy + 6} h6 M${x + 3} ${yy + 12} h6 M${x + 3} ${yy + 18} h6`} stroke={col} strokeWidth="1.4" /></g>)
    }
    if (c.lit) lights.push(<g key="sg" opacity="0.95">{signs}</g>)
    else main.push(<g key="sg">{signs}</g>)
  }
  // stalls with awnings
  const stalls: ReactNode[] = []
  for (let i = 0; i < 5; i++) {
    const x = -4 + i * 62
    const col = pick(c.r, [c.p.ink, '#2f6fc0', '#3f8f5f', '#e9a92e', '#d9473b'])
    stalls.push(
      <g key={i}>
        <rect x={x + 4} y={y - 8} width="52" height="22" {...wash('#a8835e')} />
        <path d={`M${x} ${y - 30} h60 l4 14 h-68 Z`} fill={col} />
        {Array.from({ length: 6 }, (_, k) => <path key={k} d={`M${x + 4 + k * 10} ${y - 30} h5 l1 14 h-5.6 Z`} fill="#fbf7ee" opacity="0.92" />)}
        <path d={`M${x - 4} ${y - 16} q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0`} fill={col} />
        {Array.from({ length: 7 }, (_, k) => <circle key={k} cx={x + 10 + k * 6.4} cy={y - 10 + (k % 2) * 2} r="2.6" fill={pick(c.r, ['#e05a4a', '#f2a03a', '#f2d24b', '#7bbf4a', '#b9406f'])} />)}
        <path d={`M${x + 4} ${y + 14} v-22 M${x + 56} ${y + 14} v-22`} stroke="#5a4636" strokeWidth="1.2" />
      </g>,
    )
  }
  main.push(<path key="g" className="bg" d={`M-10 ${y + 14} L310 ${y + 14} L310 210 L-10 210 Z`} {...wash('#c9b8a0', 0.1)} />)
  main.push(<g key="cb">{cobbles(c, y + 14, '#c9b8a0')}</g>)
  main.push(<g key="st" transform={`translate(150 ${y + 24}) scale(1.3) translate(-150 ${-(y + 14)})`}>{stalls}</g>)
  if (v === 'cafe' || v === 'trattoria') main.push(<g key="tb">{[40, 120, 200, 270].map((x) => <g key={x}><ellipse cx={x} cy={188} rx="12" ry="3" fill="#f7f2e8" stroke="#8a7a6a" strokeWidth="0.6" /><path d={`M${x} 188 v10 M${x - 16} 186 v12 M${x + 16} 186 v12`} stroke="#3a3346" strokeWidth="1" /></g>)}</g>)
  const lit = c.lit || c.time === 'golden'
  if (v === 'lanterns' || !neon) lights.push(<g key="sl">{v === 'lanterns' || c.r() > 0.5 ? <Lanterns x0={-5} x1={305} y={66} sag={8} n={9} /> : <StringLights x0={-5} x1={305} y={70} sag={6} n={18} lit={lit} />}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 190 }
}

const temple: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  const y = 150
  if (v === 'buddha') {
    main.push(<Mountains key="m" c={c} base={c.hz + 10} color={far(c, c.p.foliage, 0.4)} snow={false} peaks={[{ x: 60, h: 50, w: 70 }, { x: 240, h: 60, w: 70 }]} />)
    main.push(<g key="bd"><path d={`M120 ${c.hz + 10} Q122 ${c.hz - 40} 150 ${c.hz - 44} Q178 ${c.hz - 40} 180 ${c.hz + 10} Z`} {...wash('#b9a07a', 0.25)} /><circle cx="150" cy={c.hz - 52} r="10" {...wash('#b9a07a', 0.25)} /><path d={`M110 ${c.hz + 10} h80 v8 h-80 Z`} {...wash(STONE)} />{Array.from({ length: 8 }, (_, i) => <rect key={i} x={110 - i * 6} y={c.hz + 18 + i * 5} width={80 + i * 12} height="5" {...wash(STONE, 0.12)} />)}</g>)
    main.push(<Ground key="g" c={c} y={c.hz + 58} color={c.p.foliage} strokes={14} />)
    return { main: <g>{main}</g>, groundY: 190 }
  }
  if (v === 'monastery') main.push(<Hills key="h" c={c} y={c.hz} amp={22} color={far(c, c.p.foliage, 0.3)} />)
  else main.push(<g key="fc">{farCity(c, c.hz + 10, -5, 305, 70, 0.55)}</g>)
  const red = '#b8342a'
  const roof = v === 'hall' ? '#5a6a6a' : '#3f7f5f'
  main.push(
    <g key="tm">
      <rect x="70" y={y - 6} width="160" height="10" {...wash(STONE)} />
      <rect x="84" y={y - 50} width="132" height="44" {...wash('#d9c6a6')} />
      {columns(c, 90, y - 6, 120, 44, 6, red)}
      <path d={`M120 ${y - 6} v-26 h60 v26 Z`} fill="#3a2a24" />
      {pagodaRoof(150, y - 50, 180, roof)}
      {v !== 'hall' && <g><rect x="120" y={y - 92} width="60" height="18" {...wash('#d9c6a6')} />{pagodaRoof(150, y - 92, 100, roof)}</g>}
      <rect x="136" y={y - 46} width="28" height="10" fill="#1d2a4a" stroke="#e9b949" strokeWidth="1" />
    </g>,
  )
  if (v === 'windmill') main.push(<g key="wm" transform={`translate(250 ${y - 40})`}>{[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M0 0 L22 -4 L22 4 Z" fill={['#e05a4a', '#f2c84b', '#3f8fc0'][a % 3]} transform={`rotate(${a})`} />)}<circle r="3" fill="#e9b949" /><path d="M0 0 v40" stroke="#5a4636" strokeWidth="2" /></g>)
  if (v === 'incense' || !v) main.push(<g key="in">{[60, 240].map((x) => <g key={x}><path d={`M${x - 10} ${y + 18} h20 l-3 -12 h-14 Z`} {...wash('#8a6a3a')} /><path className="nosk" d={`M${x} ${y + 6} q-8 -16 2 -30 q10 -14 -2 -30`} stroke="#e8e4f0" strokeWidth="3" fill="none" opacity="0.7" /></g>)}</g>)
  main.push(<path key="g" className="bg" d={`M-10 ${y + 4} L310 ${y + 4} L310 210 L-10 210 Z`} {...wash('#d9ccb4', 0.1)} />)
  main.push(<g key="cb">{cobbles(c, y + 4, '#d9ccb4')}</g>)
  lights.push(<g key="ln"><Lanterns x0={60} x1={240} y={y - 44} sag={4} n={6} />{c.lit && <rect x="120" y={y - 32} width="60" height="26" fill="#ffb35a" opacity="0.45" />}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 190 }
}

const towercity: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  main.push(<Hills key="h" c={c} y={c.hz - 30} amp={20} color={far(c, c.p.foliage, 0.45)} />)
  const y = 160
  const cols = ['#e9c6c0', '#c9d6c0', '#f2e2c8', '#c0cfe0', '#e2d0e6', '#f0d8b0', '#d6d0c8']
  const out: ReactNode[] = []
  if (v === 'monster') {
    for (let i = 0; i < 6; i++) out.push(<Building key={i} c={c} x={-10 + i * 54} y={y} w={52} h={i === 2 || i === 3 ? 120 : 150} wall={pick(c.r, cols)} rows={i === 2 || i === 3 ? 16 : 20} cols={9} />)
    for (let k = 0; k < 60; k++) out.push(<rect key={`ac${k}`} className="nosk" x={f(range(c.r, -5, 300))} y={f(range(c.r, 20, 150))} width="3" height="2.2" fill="#e9e6df" stroke="#8a8a90" strokeWidth="0.3" />)
    for (let k = 0; k < 8; k++) out.push(<path key={`ln${k}`} className="nosk" d={`M${f(range(c.r, 0, 290))} ${f(range(c.r, 30, 140))} h12`} stroke={pick(c.r, ['#d9473b', '#2f6fc0', '#e9b949'])} strokeWidth="1.2" strokeDasharray="2 1.5" />)
  } else {
    for (let layer = 0; layer < 2; layer++) {
      let x = -10 + layer * 8
      let i = 0
      while (x < 310) {
        const w = range(c.r, 18, 26)
        out.push(<Building key={`${layer}-${i++}`} c={c} x={x} y={y - (1 - layer) * 10} w={w} h={range(c.r, 70, 140) - layer * 20} wall={layer ? pick(c.r, cols) : far(c, pick(c.r, cols), 0.4)} rows={layer ? 12 : 8} cols={3} />)
        x += w + (layer ? 2 : 1)
      }
    }
  }
  main.push(<g key="t">{out}</g>)
  // signs hanging over the street
  if (v !== 'monster') for (let i = 0; i < 5; i++) {
    const x = 20 + i * 60 + range(c.r, -6, 6)
    const col = pick(c.r, ['#d9473b', '#e9b949', '#2f6fc0', '#3f8f5f'])
    const sign = <g key={i}><rect x={x} y={100 + (i % 2) * 14} width="10" height="26" fill={col} stroke="#3a3346" strokeWidth="0.5" /><path d={`M${x + 3} ${106 + (i % 2) * 14} h4 M${x + 3} ${112 + (i % 2) * 14} h4 M${x + 3} ${118 + (i % 2) * 14} h4`} stroke="#fbf7ee" strokeWidth="1.2" /></g>
    if (c.lit) lights.push(sign)
    else main.push(sign)
  }
  main.push(<path key="g" className="bg" d={`M-10 ${y} L310 ${y} L310 210 L-10 210 Z`} {...wash('#a9a49c', 0.1)} />)
  main.push(<path key="tr" d={`M-10 182 H310 M-10 188 H310`} stroke="#6a6a70" strokeWidth="1" />)
  main.push(<path key="wire" d={`M-10 120 H310`} stroke="#3a3346" strokeWidth="0.5" />)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 186 }
}

const farm: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const flat = v === 'pampa' || v === 'steppe' || v === 'estancia'
  main.push(<Hills key="h0" c={c} y={c.hz} amp={flat ? 2 : 12} color={far(c, c.p.foliage, 0.5)} />)
  if (v === 'cypress') main.push(<Hills key="h1" c={c} y={c.hz + 16} amp={14} color={far(c, '#c9b06a', 0.15)} waves={2} />)
  const fieldCol = v === 'lavender' ? '#d9c8a0' : v === 'sunflowers' ? '#7d9a3e' : v === 'steppe' ? '#d9c08a' : v === 'pampa' || v === 'estancia' ? '#b9c27a' : v === 'tea' ? '#6f9a46' : mix(c.p.foliage, c.p.ground, 0.3)
  const stripe = v === 'lavender' ? '#8a6ac0' : v === 'sunflowers' ? '#f2c43b' : v === 'tea' ? '#3f6f3a' : v === 'flowers' ? '#e88ba8' : darken(fieldCol, 0.12)
  if (v === 'lavender' || v === 'sunflowers' || v === 'tea' || v === 'flowers' || v === 'orchard') main.push(<g key="rows">{rowsField(c.hz + 22, 210, fieldCol, stripe, 8, 14)}</g>)
  else main.push(<Ground key="g" c={c} y={c.hz + 20} color={fieldCol} strokes={40} curve={3} />)
  if (v === 'cypress') main.push(<g key="cy">{Array.from({ length: 7 }, (_, i) => <Tree key={i} c={c} x={110 + i * 14} y={c.hz + 22 - i * 2} s={30} kind="cypress" />)}</g>)
  // farmhouse
  const fx = v === 'lavender' ? 176 : 172
  const fy = c.hz + 40
  if (v === 'chapel') main.push(<g key="cp">{churchFront(c, 180, fy, 34, 22, '#efe6d6', 'single')}</g>)
  else if (v === 'village') main.push(<g key="vl"><Building c={c} x={150} y={fy} w={50} h={20} wall="#c9c4bb" roof="pagoda" roofColor="#5a6a6a" rows={1} cols={4} />{pagodaRoof(175, fy - 20, 60, '#5a6a6a')}</g>)
  else if (v !== 'steppe') main.push(<g key="fh"><Building c={c} x={fx} y={fy} w={70} h={30} wall={v === 'lavender' ? STONE : WHITE} roof="tiled" roofColor={v === 'pampa' || v === 'estancia' ? '#b9583e' : TERRA} rows={1} cols={4} door /><Building c={c} x={fx + 72} y={fy} w={26} h={38} wall={v === 'pasture' ? '#b9583e' : STONE} roof="gable" roofColor={darken(TERRA, 0.2)} rows={1} cols={1} /></g>)
  main.push(<g key="tr">{(v === 'steppe' ? [60, 240] : [40, 150, 286]).map((x, i) => <Tree key={i} c={c} x={x} y={c.hz + 42 + i * 4} s={v === 'steppe' ? 34 : 58} kind={v === 'pampa' || v === 'estancia' ? 'round' : v === 'cypress' ? 'cypress' : 'round'} />)}</g>)
  if (v === 'orchard') main.push(<g key="or">{Array.from({ length: 8 }, (_, i) => <Tree key={i} c={c} x={20 + i * 38} y={186 + (i % 2) * 6} s={30} kind="round" color="#5f8f3e" />)}</g>)
  if (v === 'pasture' || v === 'pampa' || v === 'estancia' || v === 'steppe') {
    main.push(<path key="fn" d={`M-10 176 H310 M-10 184 H310`} stroke="#7a6248" strokeWidth="0.9" />)
    main.push(<g key="fp">{Array.from({ length: 12 }, (_, i) => <rect key={i} x={i * 28} y="172" width="2" height="16" fill="#7a6248" />)}</g>)
  }
  if (v === 'sunflowers') main.push(<g key="sf">{Array.from({ length: 14 }, (_, i) => <g key={i}><circle cx={10 + i * 22} cy={186 + (i % 2) * 6} r="5" fill="#f2c43b" /><circle cx={10 + i * 22} cy={186 + (i % 2) * 6} r="2" fill="#6a4a2a" /></g>)}</g>)
  if (v === 'steppe') {
    main.push(<g key="wm" transform={`translate(214 ${c.hz + 34})`}><path d="M-6 0 L0 -40 L6 0 M-4 -14 h8 M-2 -28 h4" stroke="#5a5a62" strokeWidth="1" fill="none" />{Array.from({ length: 12 }, (_, i) => <path key={i} d="M0 -40 l9 -2 l0 4 Z" fill="#8a8a95" transform={`rotate(${i * 30} 0 -40)`} />)}<path d="M0 -40 l-14 0 l-2 -3 l0 6 l2 -3" fill="#8a8a95" /></g>)
    main.push(<g key="sh">{animalDots(c, 'sheep', 110, c.hz + 52, 6, 1.1)}</g>)
  }
  if (v === 'steppe') main.push(<g key="wd">{Array.from({ length: 5 }, (_, i) => <path key={i} className="nosk" d={`M${20 + i * 60} ${60 + i * 8} q30 -6 60 0`} stroke="#fbf8f2" strokeWidth="1.2" fill="none" opacity="0.8" />)}</g>)
  return { main: <g>{main}</g>, groundY: 178 }
}

const airport: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  main.push(<g key="fh">{farHills(c, c.hz, 8, 0.6)}</g>)
  if (v === 'runway-park') {
    main.push(<g key="fc">{farCity(c, c.hz + 6, -5, 305, 50, 0.45)}</g>)
    main.push(<Water key="w" c={c} y={c.hz + 10} />)
    main.push(<path key="rp" d={`M-10 ${c.hz + 30} L310 ${c.hz + 22} L310 ${c.hz + 36} L-10 ${c.hz + 46} Z`} {...wash(c.p.foliage)} />)
    main.push(<g key="ct"><path d={`M180 ${c.hz + 26} Q220 ${c.hz + 4} 270 ${c.hz + 22} Z`} {...wash(WHITE)} /></g>)
  } else {
    // terminal and tower
    main.push(<g key="tm"><path d={`M30 ${c.hz + 8} h180 v14 h-180 Z`} {...wash('#d9dfe6')} /><path d={`M30 ${c.hz + 8} Q120 ${c.hz - 8} 210 ${c.hz + 8} Z`} {...wash(lighten(c.p.water, 0.3))} /><path d={`M40 ${c.hz + 14} h160`} stroke={c.lit ? '#ffd98a' : '#7d8fa8'} strokeWidth="3" strokeDasharray="6 2" /></g>)
    main.push(<g key="tw"><rect x="246" y={c.hz - 36} width="8" height="56" {...wash('#d9dfe6')} /><path d={`M238 ${c.hz - 36} h24 l-4 -12 h-16 Z`} {...wash(lighten(c.p.water, 0.2))} /><path d={`M236 ${c.hz - 36} h28`} stroke="#3a3346" strokeWidth="1" /></g>)
    main.push(<Ground key="g" c={c} y={c.hz + 22} color={mix(c.p.foliage, c.p.ground, 0.45)} strokes={20} />)
    main.push(<path key="rw" d={`M-10 196 L310 168 L310 186 L-10 214 Z`} fill="#6a6a72" />)
    main.push(<path key="rwm" d={`M0 204 L300 178`} stroke="#fbf8f0" strokeWidth="1.4" strokeDasharray="10 7" />)
    if (c.lit) lights.push(<g key="rl">{Array.from({ length: 12 }, (_, i) => <circle key={i} cx={i * 26} cy={196 - i * 2.4} r="1.3" fill="#ffd98a" />)}</g>)
    main.push(<g key="ws"><path d="M30 186 v-26" stroke="#5a5a62" strokeWidth="1" /><path d="M30 160 l14 3 l-1 5 l-13 -2 Z" fill="#e8743a" /></g>)
  }
  // the plane climbing out
  main.push(
    <g key="pl" transform="translate(150 70) rotate(-14)">
      <path d="M-40 0 Q-40 -5 -30 -6 L34 -6 Q44 -6 46 0 Q44 5 34 5 L-30 5 Q-40 5 -40 0 Z" {...wash('#fbf8f2', 0.25)} />
      <path d="M-4 -2 L-20 -26 L-12 -26 L12 -2 Z" {...wash(c.p.ink, 0.2)} />
      <path d="M-4 3 L-14 18 L-8 18 L10 3 Z" {...wash(darken(c.p.ink, 0.15), 0.2)} />
      <path d="M-36 -4 L-46 -18 L-40 -18 L-28 -5 Z" {...wash(c.p.ink, 0.2)} />
      <path d={`M-26 -2 ${Array.from({ length: 9 }, (_, i) => `M${-22 + i * 6} -2 h3`).join(' ')}`} stroke="#5d6481" strokeWidth="1.6" />
      <path d="M38 -3 q4 0 5 3" stroke="#5d6481" strokeWidth="1.2" fill="none" />
    </g>,
  )
  main.push(<path key="trail" className="nosk" d="M108 88 Q60 104 0 112" stroke="#fbf8f2" strokeWidth="2" fill="none" opacity="0.6" strokeDasharray="4 4" />)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 176, waterY: v === 'runway-park' ? c.hz + 10 : undefined }
}

function train(c: Ctx, x: number, y: number, n: number, steam: boolean, color = c.p.ink): ReactNode {
  const cars: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const cx = x + i * 34
    cars.push(
      <g key={i}>
        <rect x={cx} y={y - 18} width="31" height="16" rx="2" {...wash(i === 0 && steam ? '#2e2a36' : color, 0.25)} />
        {!(i === 0 && steam) && Array.from({ length: 4 }, (_, k) => <rect key={k} x={cx + 3 + k * 7} y={y - 15} width="5" height="5" fill={c.lit ? '#ffd98a' : '#f6efe0'} />)}
        <circle cx={cx + 7} cy={y} r="3" fill="#2e2a36" />
        <circle cx={cx + 24} cy={y} r="3" fill="#2e2a36" />
      </g>,
    )
  }
  return (
    <g>
      {cars}
      {steam && <g><rect x={x + 4} y={y - 28} width="6" height="10" fill="#2e2a36" /><path className="nosk" d={`M${x + 7} ${y - 30} q-10 -10 -24 -8 q-12 -12 -28 -6`} stroke="#fbf8f2" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8" /></g>}
    </g>
  )
}
const railway: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  if (v === 'metro') {
    main.push(<Row key="r" c={c} x0={-5} x1={305} y={140} hMin={50} hMax={60} roof="mansard" colors={['#eadcc0', '#e6d6b8']} balcony wMin={30} wMax={40} />)
    main.push(<path key="g" className="bg" d="M-10 140 H310 V210 H-10 Z" {...wash('#c9bba4', 0.1)} />)
    main.push(<g key="m"><path d="M110 200 V120 Q110 100 130 96 M190 200 V120 Q190 100 170 96" stroke="#3f6a4a" strokeWidth="3" fill="none" /><path d="M126 96 Q150 82 174 96" stroke="#3f6a4a" strokeWidth="3" fill="none" /><rect x="120" y="102" width="60" height="9" fill="#e9c66a" stroke="#3f6a4a" strokeWidth="1" /><circle cx="110" cy="120" r="4" fill="#d9473b" /><circle cx="190" cy="120" r="4" fill="#d9473b" /><path d="M118 200 L130 150 H170 L182 200 Z" fill="#2e2a36" opacity="0.8" /></g>)
    return { main: <g>{main}</g>, groundY: 196 }
  }
  if (v === 'mountain' || v === 'steam' || !v) main.push(<Mountains key="m" c={c} base={c.hz + 10} color={far(c, mix(c.p.far, '#8d93b4', 0.3), 0.3)} peaks={[{ x: 60, h: 60, w: 64 }, { x: 170, h: 78, w: 70 }, { x: 270, h: 56, w: 60 }]} snow={c.p.sky[0] !== ''} />)
  else main.push(<g key="fh">{farHills(c, c.hz, 10, 0.5)}</g>)
  main.push(<Ground key="g" c={c} y={c.hz + 20} color={mix(c.p.foliage, c.p.ground, 0.4)} strokes={30} />)
  if (v === 'station') main.push(<g key="st"><Building c={c} x={60} y={c.hz + 40} w={90} h={26} wall="#f2e2c8" roof="hip" roofColor="#b9583e" rows={1} cols={6} door /><rect x="150" y={c.hz + 26} width="80" height="4" fill="#7a5a44" /><path d={`M156 ${c.hz + 30} v10 M222 ${c.hz + 30} v10`} stroke="#7a5a44" strokeWidth="1.5" /></g>)
  const ty = c.hz + 54
  main.push(<path key="tk" d={`M-10 ${ty + 3} H310`} stroke="#5a4636" strokeWidth="1.6" />)
  main.push(<g key="sl">{Array.from({ length: 32 }, (_, i) => <path key={i} d={`M${i * 10 - 6} ${ty + 1} v5`} stroke="#7a6248" strokeWidth="1.6" />)}</g>)
  main.push(<g key="tr">{train(c, 40, ty, v === 'station' ? 3 : 4, v !== 'station', v === 'station' ? '#3f6f5a' : c.p.ink)}</g>)
  main.push(<g key="pn">{[20, 270, 290].map((x, i) => <Tree key={i} c={c} x={x} y={196} s={40} kind="pine" />)}</g>)
  return { main: <g>{main}</g>, groundY: 190 }
}

const island: MotifFn = (c) => {
  const v = c.variant
  const sea = v === 'mediterranean' || v === 'sugarloaf' ? c.p.water : mix(c.p.water, '#3fb7b0', 0.45)
  const main: ReactNode[] = []
  main.push(<Water key="w" c={c} y={c.hz} color={sea} sunX={240} />)
  if (v === 'sugarloaf') {
    main.push(<path key="sl" d={`M150 ${c.hz + 4} Q160 ${c.hz - 70} 196 ${c.hz - 78} Q222 ${c.hz - 70} 230 ${c.hz + 4} Z`} {...wash('#7d7a82', 0.2)} />)
    main.push(<path key="sl2" d={`M90 ${c.hz + 4} Q100 ${c.hz - 30} 126 ${c.hz - 32} Q146 ${c.hz - 26} 150 ${c.hz + 4} Z`} {...wash('#6a7d6a', 0.2)} />)
    main.push(<path key="vg" d={`M150 ${c.hz + 4} Q156 ${c.hz - 30} 170 ${c.hz - 40} L180 ${c.hz + 4} Z`} fill={c.p.foliage} opacity="0.7" />)
    main.push(<path key="cb" d={`M126 ${c.hz - 32} L196 ${c.hz - 78}`} stroke="#3a3346" strokeWidth="0.6" />)
    main.push(<rect key="cc" x="158" y={c.hz - 58} width="8" height="6" fill="#e9b949" stroke="#3a3346" strokeWidth="0.5" />)
  } else if (v === 'bridge') {
    main.push(<Hills key="h" c={c} y={c.hz - 4} amp={14} color={far(c, c.p.foliage, 0.3)} />)
    main.push(<Water key="w2" c={c} y={c.hz + 4} color={sea} />)
    main.push(<g key="br"><path d={`M-10 ${c.hz + 20} H310`} stroke="#d9473b" strokeWidth="3" /><path d={`M60 ${c.hz + 20} Q150 ${c.hz - 50} 240 ${c.hz + 20}`} stroke="#d9473b" strokeWidth="2" fill="none" /><rect x="100" y={c.hz - 30} width="5" height="50" fill="#d9473b" /><rect x="195" y={c.hz - 30} width="5" height="50" fill="#d9473b" /></g>)
  } else {
    const isl = (cx: number, w: number, h: number, col: string) => <path d={`M${cx - w} ${c.hz + 6} Q${cx - w * 0.5} ${c.hz - h} ${cx} ${c.hz - h * 1.1} Q${cx + w * 0.6} ${c.hz - h} ${cx + w} ${c.hz + 6} Z`} {...wash(col, 0.2)} />
    main.push(<g key="i1">{isl(236, 80, 40, far(c, c.p.foliage, 0.45))}</g>)
    main.push(<g key="i2">{isl(116, 120, v === 'rocks' ? 30 : 62, v === 'rocks' ? '#b9a07a' : c.p.foliage)}</g>)
    if (v === 'rocks') main.push(<g key="rk">{[[80, 18], [126, 22], [160, 14]].map(([x, s], i) => <ellipse key={i} cx={x} cy={c.hz - 6} rx={s} ry={s! * 0.7} {...wash('#c9a77a', 0.25)} />)}</g>)
    if (v === 'village') main.push(<Row key="vl" c={c} x0={40} x1={170} y={c.hz + 6} hMin={10} hMax={18} roof="tiled" colors={c.p.buildings} wMin={8} wMax={12} />)
    if (v === 'mediterranean') main.push(<Row key="vl" c={c} x0={60} x1={150} y={c.hz + 6} hMin={10} hMax={16} roof="tiled" colors={[WHITE, '#f2d49c', '#e88b6a']} wMin={8} wMax={12} />)
    if (v !== 'rocks' && v !== 'mediterranean' && v !== 'village') main.push(<g key="pl">{[60, 84, 140, 160].map((x, i) => <Tree key={i} c={c} x={x} y={c.hz + 4} s={36 + (i % 2) * 8} kind="palm" />)}</g>)
  }
  main.push(<path key="sand" d={`M-10 210 L-10 186 Q80 176 160 188 Q240 196 310 184 L310 210 Z`} {...wash(lighten(c.p.ground, 0.25), 0.12)} />)
  main.push(<g key="np"><Tree c={c} x={270} y={204} s={96} kind="palm" /><Tree c={c} x={290} y={202} s={66} kind="palm" /></g>)
  return { main: <g>{main}</g>, waterY: c.hz + 10, groundY: 194 }
}

const stadium: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  if (v === 'racecourse') main.push(<g key="tc">{farCity(c, c.hz + 4, -5, 305, 90, 0.35)}</g>)
  else main.push(<g key="fh">{farHills(c, c.hz, 14, 0.4)}</g>)
  const y = c.hz + 30
  if (v === 'racecourse') {
    main.push(<path key="gr" d={`M-10 ${y - 4} H310 V210 H-10 Z`} {...wash(c.p.foliage, 0.12)} />)
    main.push(<ellipse key="tr" cx="150" cy={y + 30} rx="170" ry="34" fill="none" stroke="#c9a77a" strokeWidth="10" />)
    main.push(<path key="rl" d={`M-10 ${y + 6} Q150 ${y - 12} 310 ${y + 6}`} stroke="#fbf8f2" strokeWidth="1.4" fill="none" />)
    main.push(<g key="h">{animalDots(c, 'horse', 150, y + 26, 5, 1.4)}</g>)
  } else {
    main.push(<path key="bowl" d={`M30 ${y + 20} Q30 ${y - 30} 150 ${y - 36} Q270 ${y - 30} 270 ${y + 20} Z`} {...wash(v === 'arena' ? '#e9c68a' : '#e2e2e6', 0.25)} />)
    main.push(<path key="roof" d={`M30 ${y - 8} Q30 ${y - 40} 150 ${y - 44} Q270 ${y - 40} 270 ${y - 8} Q270 ${y - 30} 150 ${y - 34} Q30 ${y - 30} 30 ${y - 8} Z`} {...wash('#f7f4ee')} />)
    main.push(<g key="crowd">{Array.from({ length: 80 }, (_, i) => <circle key={i} className="nosk" cx={40 + c.r() * 220} cy={y - 20 + c.r() * 30} r="1" fill={pick(c.r, ['#d9473b', '#2f6fc0', '#e9b949', '#3f8f5f', '#fbf7ee'])} />)}</g>)
    main.push(<Ground key="g" c={c} y={y + 20} color={c.p.foliage} strokes={20} />)
    main.push(<g key="pitch"><path d={`M40 ${y + 40} H260 M150 ${y + 24} V${y + 60}`} stroke="#fbf8f2" strokeWidth="1" opacity="0.8" /><circle cx="150" cy={y + 40} r="8" fill="none" stroke="#fbf8f2" strokeWidth="1" opacity="0.8" /></g>)
    main.push(<g key="ball"><circle cx="210" cy="186" r="6" fill="#fbf8f2" stroke="#2a2230" strokeWidth="0.6" /><path d="M210 183.4 l2.4 1.8 l-0.9 2.8 h-3 l-0.9 -2.8 Z" fill="#2a2230" /></g>)
  }
  ;[20, 280].forEach((x, i) => {
    main.push(<g key={`fl${i}`}><path d={`M${x} ${y + 20} V${y - 70}`} stroke="#5a5a62" strokeWidth="1.6" /><rect x={x - 8} y={y - 80} width="16" height="10" fill="#d9dfe6" stroke="#5a5a62" strokeWidth="0.8" /></g>)
    if (c.lit) lights.push(<path key={`b${i}`} d={`M${x - 8} ${y - 70} L${x + (i ? -90 : 90)} ${y + 40} L${x + (i ? -40 : 40)} ${y + 50} Z`} fill="#fff4cf" opacity="0.25" />)
  })
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 190 }
}

const tower: MotifFn = (c) => {
  const v = c.variant ?? 'needle'
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  const y = 160
  main.push(<g key="fh">{farHills(c, c.hz, 6, 0.6)}</g>)
  if (v !== 'pagoda' && v !== 'belem') main.push(<g key="fc">{farCity(c, y - 10, -5, 305, v === 'canton' ? 60 : 30, 0.45)}</g>)
  if (v === 'lattice') {
    main.push(
      <g key="t">
        <path d={`M110 ${y} Q138 ${y - 50} 146 ${y - 110} L148 ${y - 140} L152 ${y - 140} L154 ${y - 110} Q162 ${y - 50} 190 ${y} L176 ${y} Q160 ${y - 30} 150 ${y - 32} Q140 ${y - 30} 124 ${y} Z`} {...wash('#8a6a52', 0.3)} />
        <path d={`M124 ${y - 44} H176 M134 ${y - 80} H166`} stroke="#6a4a3a" strokeWidth="2.2" />
        <path className="nosk" d={`M126 ${y - 6} L170 ${y - 44} M174 ${y - 6} L130 ${y - 44} M136 ${y - 48} L162 ${y - 80} M164 ${y - 48} L138 ${y - 80}`} stroke="#6a4a3a" strokeWidth="0.6" />
        <path d={`M150 ${y - 140} v-10`} stroke="#6a4a3a" strokeWidth="1" />
      </g>,
    )
    if (c.lit) lights.push(<path key="tl" d={`M114 ${y} Q138 ${y - 50} 146 ${y - 110} L150 ${y - 142} L154 ${y - 110} Q162 ${y - 50} 186 ${y}`} stroke="#ffcf6a" strokeWidth="1.2" fill="none" opacity="0.8" />)
  } else if (v === 'leaning') {
    main.push(<g key="t" transform={`rotate(5 150 ${y})`}>{Array.from({ length: 7 }, (_, i) => <g key={i}><rect x="132" y={y - 14 - i * 14} width="36" height="14" {...wash('#f4ede0', 0.2)} />{columns(c, 135, y - i * 14, 30, 12, 5, '#efe6d6')}</g>)}<rect x="138" y={y - 112} width="24" height="12" {...wash('#f4ede0')} /></g>)
    main.push(<g key="d">{churchFront(c, 30, y, 70, 30, '#f4ede0', 'dome')}</g>)
  } else if (v === 'pagoda') {
    main.push(<Ground key="g0" c={c} y={y - 10} color={mix(c.p.foliage, c.p.ground, 0.4)} strokes={10} />)
    main.push(<g key="t">{[0, 1, 2].map((i) => <g key={i}><rect x={134 + i * 4} y={y - 28 - i * 24} width={32 - i * 8} height="24" {...wash('#c9b8a0')} /><path d={`M${130 + i * 4} ${y - 28 - i * 24} h${40 - i * 8}`} stroke="#8a7a6a" strokeWidth="2" /></g>)}<path d={`M144 ${y - 76} L150 ${y - 90} L156 ${y - 76} Z`} fill="#8a7a6a" /></g>)
  } else if (v === 'canton') {
    main.push(<g key="t"><path d={`M136 ${y} Q154 ${y - 70} 140 ${y - 150} L160 ${y - 150} Q146 ${y - 70} 164 ${y} Z`} {...wash('#c9d6e6', 0.3)} /><path className="nosk" d={`M138 ${y - 10} L162 ${y - 30} M140 ${y - 40} L156 ${y - 60} M144 ${y - 70} L152 ${y - 90} M140 ${y - 110} L158 ${y - 130}`} stroke="#7d8fa8" strokeWidth="0.6" /><path d={`M150 ${y - 150} v-20`} stroke="#7d8fa8" strokeWidth="1.4" /></g>)
    if (c.lit) lights.push(<path key="tl" d={`M136 ${y} Q154 ${y - 70} 140 ${y - 150} L160 ${y - 150} Q146 ${y - 70} 164 ${y}`} stroke="#ff7ab0" strokeWidth="1.6" fill="none" opacity="0.85" />)
  } else if (v === 'saucer') {
    main.push(<Water key="w" c={c} y={y - 8} />)
    main.push(<g key="t"><path d={`M146 ${y} L144 ${y - 30} L156 ${y - 30} L154 ${y} Z`} {...wash(WHITE)} /><path d={`M110 ${y - 34} Q150 ${y - 26} 190 ${y - 34} L174 ${y - 54} Q150 ${y - 60} 126 ${y - 54} Z`} {...wash(WHITE, 0.2)} /><path d={`M120 ${y - 44} H180`} stroke="#3a3346" strokeWidth="2" opacity="0.8" /><path d={`M80 ${y + 4} Q120 ${y - 14} 150 ${y - 30}`} stroke="#d9473b" strokeWidth="2.4" fill="none" /></g>)
  } else if (v === 'mole') {
    main.push(<Mountains key="alps" c={c} base={y - 20} color={far(c, '#8d93b4', 0.4)} peaks={[{ x: 60, h: 40, w: 60 }, { x: 240, h: 50, w: 60 }]} />)
    main.push(<g key="t"><rect x="126" y={y - 40} width="48" height="40" {...wash('#d9c6a6')} /><path d={`M126 ${y - 40} Q150 ${y - 60} 150 ${y - 120} Q150 ${y - 60} 174 ${y - 40} Z`} {...wash('#b9b4c0', 0.25)} /><path d={`M150 ${y - 120} v-30`} stroke="#8a8a95" strokeWidth="2" /></g>)
  } else if (v === 'belem') {
    main.push(<Water key="w" c={c} y={y - 16} />)
    main.push(<g key="t" transform={`translate(150 ${y - 6}) scale(1.45) translate(-150 ${-(y - 6)})`}><rect x="124" y={y - 16} width="52" height="10" {...wash('#d9ccb0')} /><rect x="128" y={y - 50} width="44" height="40" {...wash('#efe4cf')} /><rect x="136" y={y - 96} width="28" height="46" {...wash('#efe4cf')} /><path d={`M136 ${y - 96} ${Array.from({ length: 4 }, () => 'h3.5 v-4 h3.5 v4').join(' ')}`} {...wash('#efe4cf')} />{[130, 166].map((x) => <path key={x} d={`M${x - 4} ${y - 52} a4 6 0 0 1 8 0 Z`} {...wash('#efe4cf')} />)}<path d={`M142 ${y - 70} h16 v8 h-16 Z`} fill="#5a4a40" /><path d={`M146 ${y - 38} v-8 a4 4 0 0 1 8 0 v8 Z`} fill="#5a4a40" /></g>)
    main.push(<g key="cv"><Boat c={c} x={60} y={y + 18} s={40} kind="junk" color="#7a4a2e" /></g>)
  } else {
    // needle (Macau tower and friends)
    main.push(<g key="t"><path d={`M144 ${y} L147 ${y - 120} L153 ${y - 120} L156 ${y} Z`} {...wash('#d9dfe6', 0.25)} /><ellipse cx="150" cy={y - 122} rx="16" ry="6" {...wash('#d9dfe6')} /><rect x="138" y={y - 134} width="24" height="10" {...wash(lighten(c.p.water, 0.3))} /><path d={`M150 ${y - 134} v-26`} stroke="#8a8a95" strokeWidth="1.4" /></g>)
  }
  main.push(<Ground key="g" c={c} y={y} color={mix(c.p.foliage, c.p.ground, 0.3)} strokes={20} />)
  main.push(<g key="tr">{[24, 60, 250, 284].map((x, i) => <Tree key={i} c={c} x={x} y={196 - (i % 2) * 6} s={40} kind={v === 'leaning' ? 'cypress' : 'round'} />)}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 190 }
}

const canal: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  const wy = 148
  const river = v === 'river' || v === 'delta'
  if (river) {
    main.push(<g key="fh">{farHills(c, c.hz, 6, 0.6)}</g>)
    main.push(<Hills key="bank" c={c} y={c.hz + 22} amp={4} color={mix(c.p.foliage, c.p.near, 0.2)} waves={5} />)
    main.push(<g key="tr">{Array.from({ length: 9 }, (_, i) => <Tree key={i} c={c} x={10 + i * 36} y={c.hz + 26} s={range(c.r, 28, 44)} kind={v === 'delta' ? 'willow' : 'round'} />)}</g>)
    if (v === 'delta') main.push(<g key="hs">{[60, 200].map((x) => <g key={x}><path d={`M${x} ${c.hz + 30} v10 M${x + 24} ${c.hz + 30} v10`} stroke="#5a4636" strokeWidth="1.2" /><Building c={c} x={x - 2} y={c.hz + 30} w={28} h={16} wall={pick(c.r, ['#e88b6a', '#9cc6e8', '#f2d49c'])} roof="gable" roofColor={TERRA} rows={1} cols={2} /></g>)}</g>)
    else main.push(<Row key="r" c={c} x0={110} x1={220} y={c.hz + 24} hMin={12} hMax={22} roof="tiled" colors={c.p.buildings} wMin={10} wMax={14} />)
    main.push(<Water key="w" c={c} y={c.hz + 28} sunX={150} />)
  } else {
    const colors = v === 'colourful' ? ['#e05a4a', '#f2c84b', '#3f8fc0', '#6fb57a', '#f2a0b8', '#9b7bff'] : v === 'venice' ? ['#e9b08a', '#f2d49c', '#d98a6a', '#efe0c8'] : c.p.buildings
    main.push(<g key="fh">{farHills(c, c.hz, 6, 0.65)}</g>)
    if (v === 'venice') main.push(<g key="cp"><rect x="230" y="40" width="12" height="70" {...wash('#c9763a')} /><path d="M228 40 L236 26 L244 40 Z" {...wash('#5f8a7a')} /></g>)
    main.push(<Row key="r" c={c} x0={-5} x1={305} y={wy} hMin={34} hMax={58} roof={v === 'timbered' ? 'gable' : v === 'water-town' ? 'pagoda' : 'tiled'} colors={v === 'water-town' ? [WHITE, '#efe6d6'] : colors} shutters={v === 'colourful' ? undefined : '#4f7f6a'} balcony={v === 'venice'} />)
    if (v === 'timbered') main.push(<g key="tm">{Array.from({ length: 16 }, (_, i) => <path key={i} className="nosk" d={`M${i * 20} ${wy - 34} l8 -10 l8 10 M${i * 20} ${wy - 22} h18`} stroke="#5a3a2a" strokeWidth="1" opacity="0.6" />)}</g>)
    if (v === 'water-town') main.push(<g key="br"><path d={`M90 ${wy + 20} Q150 ${wy - 20} 210 ${wy + 20}`} {...wash(STONE)} strokeWidth="6" fill="none" stroke={STONE} /><path d={`M110 ${wy + 20} Q150 ${wy - 4} 190 ${wy + 20}`} fill={c.p.water} /></g>)
    main.push(<Water key="w" c={c} y={wy} still />)
    main.push(<g key="poles">{[30, 50, 230, 260].map((x, i) => <g key={i}><rect x={x} y={wy - 8} width="2.6" height="34" fill={i % 2 ? '#d9473b' : '#2f6fc0'} /><path d={`M${x} ${wy - 2} h2.6 M${x} ${wy + 6} h2.6`} stroke="#fbf7ee" strokeWidth="2" /></g>)}</g>)
    // reflections of the house colours
    main.push(<g key="rf" opacity="0.25">{Array.from({ length: 14 }, (_, i) => <rect key={i} className="nosk" x={i * 22} y={wy + 2} width="18" height={range(c.r, 10, 26)} fill={pick(c.r, colors)} />)}</g>)
  }
  if (c.lit) lights.push(<g key="l">{[40, 140, 240].map((x) => <circle key={x} cx={x} cy={wy - 30} r="2.2" fill="#ffd98a" />)}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, waterY: river ? c.hz + 34 : wy + 6 }
}

const garden: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  main.push(<g key="fh">{farHills(c, c.hz, 6, 0.6)}</g>)
  if (v === 'park' || v === 'palms' || v === 'sculpture' || !v) main.push(<g key="fc">{farCity(c, c.hz + 6, -5, 305, 30, 0.6)}</g>)
  main.push(<g key="bt">{Array.from({ length: 10 }, (_, i) => <Tree key={i} c={c} x={i * 34 + range(c.r, -6, 6)} y={c.hz + 20} s={range(c.r, 34, 50)} kind={v === 'palms' ? 'palm' : 'round'} color={far(c, c.p.foliage, 0.3)} />)}</g>)
  main.push(<Ground key="g" c={c} y={c.hz + 16} color={mix(c.p.foliage, '#a9c46a', 0.3)} strokes={40} />)
  if (v === 'pond' || v === 'pavilion' || v === 'park') {
    main.push(<ellipse key="pd" cx="150" cy="168" rx="120" ry="20" fill={mix(c.p.water, '#6fa89a', 0.3)} stroke={darken(c.p.water, 0.2)} strokeWidth="0.6" />)
    main.push(<g key="lp">{Array.from({ length: 12 }, (_, i) => <g key={i}><ellipse cx={50 + c.r() * 200} cy={160 + c.r() * 16} rx="4" ry="1.6" fill="#6f9a46" />{c.r() > 0.6 && <circle cx={50 + c.r() * 200} cy={162 + c.r() * 12} r="1.4" fill="#f2a0b8" />}</g>)}</g>)
    if (v === 'pond') main.push(<path key="jb" d="M90 170 Q150 130 210 170" stroke="#3f7f5a" strokeWidth="3" fill="none" />)
  }
  if (v === 'pavilion') main.push(<g key="pv"><rect x="196" y="128" width="40" height="18" {...wash('#c9763a')} />{pagodaRoof(216, 128, 56, '#c9a24a', '#8a6a2a')}<path d="M196 146 v14 M236 146 v14" stroke="#b8342a" strokeWidth="2" /></g>)
  if (v === 'wishing') main.push(<g key="wt"><Tree c={c} x={150} y={176} s={100} kind="round" /><g>{Array.from({ length: 16 }, (_, i) => <rect key={i} x={110 + c.r() * 80} y={110 + c.r() * 30} width="3" height="6" fill={pick(c.r, ['#d9473b', '#e9b949'])} />)}</g></g>)
  if (v === 'sculpture') main.push(<g key="sc"><path d="M120 170 Q150 110 180 170" stroke="#d9473b" strokeWidth="6" fill="none" /></g>)
  if (!v) main.push(<g key="fl"><path d="M110 210 L140 150 H160 L190 210 Z" fill="#e2d4b8" />{[[60, 176], [240, 176]].map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx="44" ry="9" fill="#e88ba8" stroke="#3f7f4a" strokeWidth="3" />)}{fountain(c, 150, 166, 26)}</g>)
  main.push(<g key="fb">{Array.from({ length: 30 }, (_, i) => <circle key={i} className="nosk" cx={c.r() * 300} cy={182 + c.r() * 18} r="1.6" fill={pick(c.r, ['#f2a0b8', '#f2c84b', '#fbf7ee', '#e05a4a'])} />)}</g>)
  main.push(<g key="ft"><Tree c={c} x={22} y={198} s={60} kind={v === 'palms' ? 'palm' : 'round'} /><Tree c={c} x={278} y={196} s={54} kind={v === 'palms' ? 'palm' : v === 'pond' ? 'willow' : 'round'} /></g>)
  return { main: <g>{main}</g>, groundY: 190, waterY: v === 'pond' || v === 'park' || v === 'pavilion' ? 168 : undefined }
}

const volcano: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const lights: ReactNode[] = []
  const col = v === 'tropical' ? mix(c.p.foliage, '#6a7a5a', 0.3) : '#7d6a6a'
  main.push(<path key="v" d={`M10 ${c.hz + 20} Q90 ${c.hz - 20} 128 ${c.hz - 70} L172 ${c.hz - 70} Q210 ${c.hz - 20} 290 ${c.hz + 20} Z`} {...wash(col, 0.25)} />)
  main.push(<path key="vs" className="nosk" d={`M150 ${c.hz - 70} L172 ${c.hz - 70} Q210 ${c.hz - 20} 290 ${c.hz + 20} L200 ${c.hz + 20} Z`} fill={darken(col, 0.25)} opacity="0.4" />)
  if (v === 'snow') main.push(<path key="sn" d={`M120 ${c.hz - 56} L128 ${c.hz - 70} L172 ${c.hz - 70} L180 ${c.hz - 56} L168 ${c.hz - 50} L156 ${c.hz - 58} L144 ${c.hz - 48} L132 ${c.hz - 56} Z`} fill="#fbf8f2" />)
  main.push(<path key="sm" className="nosk" d={`M150 ${c.hz - 72} q-14 -16 0 -28 q-18 -12 -2 -28 q20 -6 34 -20`} stroke="#d9d4d0" strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.75" />)
  if (c.lit && v !== 'tropical') lights.push(<path key="lava" d={`M146 ${c.hz - 70} q4 20 -6 40 q-4 10 4 24`} stroke="#ff7a3a" strokeWidth="2.4" fill="none" opacity="0.85" />)
  if (v === 'tropical') {
    main.push(<Water key="w" c={c} y={c.hz + 20} color={mix(c.p.water, '#3fb7b0', 0.4)} />)
    main.push(<Row key="r" c={c} x0={40} x1={200} y={c.hz + 26} hMin={10} hMax={18} roof="tiled" colors={['#f2c84b', '#e88b6a', WHITE, '#9cc6e8']} wMin={8} wMax={12} />)
    main.push(<g key="pl">{[20, 250, 280].map((x) => <Tree key={x} c={c} x={x} y={196} s={60} kind="palm" />)}</g>)
    return { main: <g>{main}</g>, lights: <g>{lights}</g>, waterY: c.hz + 26 }
  }
  main.push(<Ground key="g" c={c} y={c.hz + 22} color={mix(c.p.foliage, '#8a7a5a', 0.3)} strokes={30} />)
  main.push(<g key="tr">{[30, 60, 240, 270].map((x, i) => <Tree key={i} c={c} x={x} y={190 + (i % 2) * 4} s={40} kind={v === 'snow' ? 'round' : 'pine'} />)}</g>)
  return { main: <g>{main}</g>, lights: <g>{lights}</g>, groundY: 186 }
}

const rainforest: MotifFn = (c) => {
  const v = c.variant
  const main: ReactNode[] = []
  const wy = c.hz + 24
  if (v === 'hills') main.push(<Hills key="h" c={c} y={c.hz} amp={24} color={far(c, c.p.foliage, 0.35)} />)
  if (v === 'city') main.push(<g key="fc">{farCity(c, c.hz + 18, 60, 260, 50, 0.4)}<path d={`M150 ${c.hz - 20} A18 14 0 0 1 186 ${c.hz - 20} Z`} {...wash('#e9b949')} /></g>)
  main.push(<g key="canopy">{Array.from({ length: 16 }, (_, i) => <Tree key={i} c={c} x={i * 20 + range(c.r, -6, 6)} y={wy} s={range(c.r, 30, 52)} kind={i % 5 === 0 ? 'palm' : v === 'bayou' ? 'willow' : 'round'} color={far(c, mix(c.p.foliage, '#2f6a3a', 0.4), 0.2)} />)}</g>)
  if (v === 'wetland' || v === 'bayou') main.push(<Water key="w" c={c} y={wy} color={mix(c.p.water, '#6a8a5a', 0.4)} still />)
  else if (v === 'meeting') {
    main.push(<Water key="w" c={c} y={wy} color="#6a5a3a" still />)
    main.push(<path key="w2" d={`M-10 ${wy} L310 ${wy} L310 210 L160 210 Q140 160 -10 ${wy + 30} Z`} fill="#c9a06a" opacity="0.9" />)
  } else main.push(<Water key="w" c={c} y={wy} color={mix(c.p.water, '#8a7a5a', 0.35)} sunX={150} />)
  if (v === 'islands') main.push(<g key="is">{[[80, 160], [200, 170], [130, 186]].map(([x, y], i) => <g key={i}><ellipse cx={x} cy={y} rx="40" ry="6" fill={darken(c.p.foliage, 0.1)} />{[x! - 20, x, x! + 20].map((tx) => <Tree key={tx} c={c} x={tx!} y={y! + 2} s={22} kind="round" />)}</g>)}</g>)
  main.push(<g key="fg">{[0, 22, 270, 296].map((x, i) => <Tree key={i} c={c} x={x} y={204} s={74} kind={i % 2 ? 'palm' : 'round'} color={darken(c.p.foliage, 0.15)} />)}</g>)
  main.push(<g key="ln">{Array.from({ length: 6 }, (_, i) => <path key={i} className="nosk" d={`M${-4 + i * 8} 40 q6 40 -2 80`} stroke={darken(c.p.foliage, 0.3)} strokeWidth="1" fill="none" />)}</g>)
  return { main: <g>{main}</g>, waterY: wy + 6 }
}

export const MOTIF_PAINTERS: Record<Motif, MotifFn> = {
  skyline, oldtown, harbour, beach, cliffs, lighthouse, mountains, glacier, lake, forest,
  vineyard, desert, waterfall, bridge, plaza, ruins, castle, market, temple, towercity,
  farm, airport, railway, island, stadium, tower, canal, garden, volcano, rainforest,
}

// ------------------------------------------------------------------ accents
export function paintAccent(c: Ctx, accent: Accent, at: { waterY?: number; groundY?: number }): { main?: ReactNode; lights?: ReactNode } {
  const r = c.r
  const wy = at.waterY ?? 160
  const gy = at.groundY ?? 186
  switch (accent) {
    case 'boats':
      return { main: <g>{[0, 1].map((i) => <Boat key={i} c={c} x={70 + i * 120 + range(r, -20, 20)} y={Math.min(196, wy + 14 + i * 10)} s={20 + i * 6} kind={c.variant === 'village' || c.p.ink === '#d4583f' ? 'junk' : 'row'} />)}</g> }
    case 'sailboats':
      return { main: <g>{[0, 1, 2].map((i) => <Boat key={i} c={c} x={50 + i * 90 + range(r, -10, 10)} y={Math.min(194, wy + 8 + i * 8)} s={16 + i * 5} kind="sail" />)}</g> }
    case 'ferry':
      return { main: <Boat c={c} x={150} y={Math.min(190, wy + 22)} s={60} kind="ferry" /> }
    case 'gondola':
      return { main: <Boat c={c} x={140} y={Math.min(194, wy + 26)} s={56} kind="gondola" /> }
    case 'whale':
      return { main: <g transform={`translate(110 ${wy + 26})`}><path d="M0 0 Q-4 -14 -16 -20 Q-6 -20 0 -12 Q6 -20 16 -20 Q4 -14 0 0 Z" fill="#3a4050" /><path d="M-20 4 q20 -6 40 0" stroke="#fbf8f2" strokeWidth="1.4" fill="none" /></g> }
    case 'dolphins':
      return { main: <g>{[0, 1].map((i) => <path key={i} d={`M${120 + i * 30} ${wy + 24 - i * 4} q10 -14 22 -2 l-4 0 q-8 -8 -16 2 Z`} fill="#c98ba0" />)}</g> }
    case 'penguins':
      return { main: <g>{Array.from({ length: 6 }, (_, i) => { const x = 40 + i * 22 + range(r, -6, 6); const y = gy + range(r, -2, 8); return <g key={i} transform={`translate(${f(x)} ${f(y)})`}><ellipse cx="0" cy="-7" rx="4" ry="7" fill="#22202a" /><ellipse cx="0.8" cy="-6" rx="2.6" ry="5.2" fill="#fbf8f2" /><circle cx="0" cy="-14" r="2.8" fill="#22202a" /><path d="M2 -14 l2 0.6 l-2 0.6" fill="#e9a92e" /></g> })}</g> }
    case 'seals':
      return { main: <g>{[0, 1, 2].map((i) => <path key={i} d={`M${60 + i * 50} ${gy + 4} q14 -12 30 -2 q6 4 -4 6 Z`} fill="#6a5a52" />)}</g> }
    case 'flamingos':
      return { main: <g>{Array.from({ length: 5 }, (_, i) => { const x = 60 + i * 34 + range(r, -6, 6); const y = Math.min(196, wy + 26 + (i % 2) * 6); return <g key={i}><path d={`M${f(x)} ${f(y)} v-12`} stroke="#e8768a" strokeWidth="0.8" /><ellipse cx={f(x + 1)} cy={f(y - 14)} rx="5" ry="3" fill="#f29aa8" /><path d={`M${f(x + 5)} ${f(y - 15)} q3 -6 0 -10 q-2 -2 -3 0`} stroke="#f29aa8" strokeWidth="1.2" fill="none" /></g> })}</g> }
    case 'birds':
      return { main: <Birds c={c} x={180} y={60} n={5} s={3} /> }
    case 'horses':
      return { main: animalDots(c, 'horse', 120, gy - 4, 3, 1.4) }
    case 'cows':
      return { main: animalDots(c, 'cow', 120, gy - 4, 4, 1.3) }
    case 'llamas':
      return { main: <g>{[0, 1, 2].map((i) => { const x = 90 + i * 40; const y = gy + (i % 2) * 6; return <g key={i} transform={`translate(${x} ${y})`}><ellipse cx="0" cy="-8" rx="7" ry="4" fill={['#f4efe6', '#b98a5a', '#6a4a3a'][i]} /><path d="M5 -10 v-10 l3 -1 v2" stroke={['#f4efe6', '#b98a5a', '#6a4a3a'][i]} strokeWidth="3" fill="none" /><path d="M-4 -5 v5 M-1 -5 v5 M3 -5 v5 M5 -5 v5" stroke="#5a4636" strokeWidth="1" /><path d="M-3 -10 h6" stroke="#d9473b" strokeWidth="1.2" /></g> })}</g> }
    case 'fireworks': {
      const bursts = [[70, 46, '#ffd166'], [160, 30, '#ff7ab0'], [240, 52, '#7ad3ff']] as const
      return { lights: <g>{bursts.map(([x, y, col], i) => <g key={i}>{Array.from({ length: 14 }, (_, k) => { const a = (k / 14) * Math.PI * 2; return <path key={k} d={`M${f(x + Math.cos(a) * 4)} ${f(y + Math.sin(a) * 4)} L${f(x + Math.cos(a) * 18)} ${f(y + Math.sin(a) * 18)}`} stroke={col} strokeWidth="1.2" strokeLinecap="round" /> })}<circle cx={x} cy={y} r="2" fill="#fff" /></g>)}</g> }
    }
    case 'lanterns':
      return { lights: <Lanterns x0={10} x1={290} y={40} sag={10} n={9} /> }
    case 'tram':
      return { main: <g transform={`translate(${f(range(r, 70, 150))} ${gy - 2})`}><rect x="0" y="-30" width="58" height="28" rx="3" {...wash('#3f8f5f')} /><rect x="0" y="-46" width="58" height="16" rx="3" {...wash('#3f8f5f')} />{[0, 1].map((row) => Array.from({ length: 5 }, (_, k) => <rect key={`${row}${k}`} x={4 + k * 11} y={-42 + row * 16} width="8" height="7" fill={c.lit ? '#ffd98a' : '#f6efe0'} />))}<path d="M29 -46 l-4 -12 M29 -58 h-10" stroke="#3a3346" strokeWidth="0.8" /><rect x="0" y="-16" width="58" height="3" fill="#e9b949" /></g> }
    case 'cablecar':
      return { main: <g><path d="M-10 40 L310 110" stroke="#3a3346" strokeWidth="0.7" /><g transform="translate(150 74)"><path d="M0 -6 v6" stroke="#3a3346" strokeWidth="0.8" /><rect x="-9" y="0" width="18" height="14" rx="3" fill={c.p.ink} /><rect x="-6" y="3" width="12" height="5" fill="#f6efe0" /></g></g> }
    case 'stars':
      return { lights: <g>{Array.from({ length: 30 }, (_, i) => <circle key={i} cx={f(r() * 300)} cy={f(r() * 80)} r={f(0.4 + r() * 0.9)} fill="#fff8e0" opacity={f(0.5 + r() * 0.5)} />)}</g> }
    case 'balloons':
      return { main: <g>{[0, 1, 2].map((i) => <g key={i} transform={`translate(${60 + i * 80} ${40 + (i % 2) * 16})`}><ellipse cx="0" cy="0" rx="10" ry="13" fill={['#d9473b', '#e9b949', '#2f6fc0'][i]} /><path d="M-4 12 l-2 8 h12 l-2 -8" stroke="#5a4636" strokeWidth="0.6" fill="none" /></g>)}</g> }
    case 'bikes':
      return { main: <g transform={`translate(140 ${gy})`}><circle cx="-8" cy="0" r="5" fill="none" stroke="#2a2230" strokeWidth="1" /><circle cx="8" cy="0" r="5" fill="none" stroke="#2a2230" strokeWidth="1" /><path d="M-8 0 L-2 -8 L6 -8 L8 0 M-2 -8 L0 0 L6 -8 M-3 -10 h3 M6 -8 l1 -3" stroke={c.p.ink} strokeWidth="1.2" fill="none" /></g> }
  }
  return {}
}
