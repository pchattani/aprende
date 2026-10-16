/**
 * Building blocks for the painted postcards: ridges, water, buildings, trees,
 * boats and clouds. Everything is drawn in a 300×200 box with the horizon around
 * y=120. Large background fills carry className "bg" so the pencil-sketch pass
 * (progress 0) can skip them; texture-only marks carry "nosk".
 */
import type { ReactNode } from 'react'
import { f, mix, darken, lighten, range, pick } from './brush'
import { W, H, wash, ridgePath, type Ctx } from './sceneUtils'

/** Rolling hills band. */
export function Hills({ c, y, amp, color, waves = 2.5, rough = 0.15 }: { c: Ctx; y: number; amp: number; color: string; waves?: number; rough?: number }) {
  return <path d={ridgePath(c.r, y, amp, waves, rough)} {...wash(color, 0.15)} />
}

/** Jagged mountains with optional snow caps. */
export function Mountains({ c, base, peaks, color, snow = true, snowLine = 0.35, x0 = -20, x1 = 320 }: { c: Ctx; base: number; peaks: { x: number; h: number; w: number }[]; color: string; snow?: boolean; snowLine?: number; x0?: number; x1?: number }) {
  const r = c.r
  const shapes: ReactNode[] = []
  peaks.forEach((pk, i) => {
    const top = base - pk.h
    // asymmetric slopes with a shoulder or two; the right face (away from the light) is shaded
    const lw = pk.w * (0.8 + r() * 0.4)
    const rw = pk.w * (0.8 + r() * 0.4)
    const l2 = pk.x - lw
    const r2 = pk.x + rw
    const side = (a: number, b: number, ya: number, yb: number, n: number) => {
      const pts: string[] = []
      const shoulder = 1 + Math.floor(r() * (n - 2))
      for (let k = 1; k <= n; k++) {
        const t = k / n
        const bump = k === shoulder ? pk.h * 0.12 * (r() > 0.5 ? 1 : -0.6) : 0
        pts.push(`${f(a + (b - a) * t + (r() - 0.5) * 4)} ${f(ya + (yb - ya) * t + (k < n ? (r() - 0.5) * pk.h * 0.1 - bump : 0))}`)
      }
      return pts
    }
    const left = side(l2, pk.x, base, top, 7)
    const right = side(pk.x, r2, top, base, 7)
    const d = `M${f(l2)} ${base} L${left.join(' L')} L${right.join(' L')} Z`
    const ridge = `L${f(pk.x + rw * 0.08)} ${f(top + pk.h * 0.35)} L${f(pk.x - rw * 0.05)} ${f(top + pk.h * 0.7)} L${f(pk.x + rw * 0.12)} ${base}`
    const shadow = `M${f(pk.x)} ${f(top)} L${right.join(' L')} ${ridge} Z`
    shapes.push(
      <g key={i}>
        <path d={d} {...wash(color, 0.18)} />
        <path d={shadow} fill={darken(color, 0.18)} opacity="0.55" />
        {snow && (
          <path
            d={`M${f(pk.x - pk.w * snowLine)} ${f(top + pk.h * snowLine)} L${f(pk.x)} ${f(top)} L${f(pk.x + pk.w * snowLine)} ${f(top + pk.h * snowLine)} L${f(pk.x + pk.w * snowLine * 0.55)} ${f(top + pk.h * snowLine * 0.7)} L${f(pk.x + pk.w * snowLine * 0.2)} ${f(top + pk.h * snowLine * 1.05)} L${f(pk.x - pk.w * snowLine * 0.15)} ${f(top + pk.h * snowLine * 0.75)} L${f(pk.x - pk.w * snowLine * 0.5)} ${f(top + pk.h * snowLine * 1.1)} Z`}
            fill="#fbf8f2"
            stroke="#c9d0e0"
            strokeWidth="0.5"
          />
        )}
        {snow && <path d={`M${f(pk.x)} ${f(top)} L${f(pk.x + pk.w * snowLine)} ${f(top + pk.h * snowLine)} L${f(pk.x + pk.w * snowLine * 0.2)} ${f(top + pk.h * snowLine * 1.05)} Z`} fill="#c7cfe4" opacity="0.6" />}
      </g>,
    )
  })
  void x0
  void x1
  const top = Math.min(...peaks.map((p) => base - p.h))
  const gid = `${c.id}-mist${Math.round(base)}`
  return (
    <g>
      {shapes}
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.haze} stopOpacity="0" />
          <stop offset="1" stopColor={c.haze} stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <rect className="nosk" x="-10" y={f(base - (base - top) * 0.45)} width={W + 20} height={f((base - top) * 0.45 + 1)} fill={`url(#${gid})`} />
    </g>
  )
}

/** Water from y down, lighter at the horizon, with ripple strokes and a sun glint. */
export function Water({ c, y, color, sunX, still = false }: { c: Ctx; y: number; color?: string; sunX?: number; still?: boolean }) {
  const r = c.r
  const col = color ?? c.p.water
  const gid = `${c.id}-w${Math.round(y)}`
  const lines: ReactNode[] = []
  const n = still ? 10 : 22
  for (let i = 0; i < n; i++) {
    const yy = y + 3 + Math.pow(r(), 1.4) * (H - y)
    const x = r() * W
    const len = 8 + r() * 30 * (yy / H)
    lines.push(<path key={i} d={`M${f(x)} ${f(yy)} q${f(len / 2)} ${f(-0.8)} ${f(len)} 0`} stroke={i % 3 ? lighten(col, 0.45) : darken(col, 0.25)} strokeWidth={0.5 + (yy - y) / 90} fill="none" opacity={0.55} strokeLinecap="round" />)
  }
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(col, c.haze, 0.45)} />
          <stop offset="1" stopColor={darken(col, 0.12)} />
        </linearGradient>
      </defs>
      <rect className="bg" x="-10" y={y} width={W + 20} height={H - y + 10} fill={`url(#${gid})`} />
      {lines}
      {sunX !== undefined && !c.night && (
        <g className="nosk" opacity="0.75">
          {Array.from({ length: 9 }, (_, i) => {
            const yy = y + 3 + i * i * 1.1
            const w = 4 + i * 2.2
            return <path key={i} d={`M${f(sunX - w / 2 + (i % 2) * 3)} ${f(yy)} h${f(w)}`} stroke="#fff3d0" strokeWidth={0.8 + i * 0.15} strokeLinecap="round" />
          })}
        </g>
      )}
      <path d={`M-10 ${f(y)} L310 ${f(y)}`} stroke={lighten(col, 0.5)} strokeWidth="0.8" opacity="0.7" />
    </g>
  )
}

/** Flat ground from y down with grass/brush strokes. */
export function Ground({ c, y, color, strokes = 30, curve = 0 }: { c: Ctx; y: number; color: string; strokes?: number; curve?: number }) {
  const r = c.r
  const marks: ReactNode[] = []
  for (let i = 0; i < strokes; i++) {
    const yy = y + 4 + r() * (H - y)
    const x = r() * W
    marks.push(<path key={i} className="nosk" d={`M${f(x)} ${f(yy)} l${f(2 + r() * 5)} ${f(-1 - r() * 2)}`} stroke={i % 2 ? darken(color, 0.25) : lighten(color, 0.25)} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />)
  }
  return (
    <g>
      <path className="bg" d={`M-10 ${f(y + curve)} Q150 ${f(y - curve)} 310 ${f(y + curve)} L310 ${H + 10} L-10 ${H + 10} Z`} {...wash(color, 0.1)} />
      {marks}
    </g>
  )
}

export type Roof = 'flat' | 'gable' | 'hip' | 'dome' | 'tiled' | 'mansard' | 'pagoda' | 'cone' | 'spire'

/** A building standing on y: wall, roof, a window grid (lit at night), optional balconies and door. */
export function Building({ c, x, y, w, h, wall, roof = 'flat', roofColor, windows = true, rows, cols, balcony = false, door = false, glass = false, shutters, slit = false }: {
  c: Ctx; x: number; y: number; w: number; h: number; wall: string; roof?: Roof; roofColor?: string; windows?: boolean; rows?: number; cols?: number; balcony?: boolean; door?: boolean; glass?: boolean; shutters?: string; slit?: boolean
}) {
  const top = y - h
  const rc = roofColor ?? darken(wall, 0.35)
  const nr = rows ?? Math.max(1, Math.floor(h / (glass ? 7 : 11)))
  const nc = cols ?? Math.max(1, Math.floor(w / (glass ? 5 : 8)))
  const win: ReactNode[] = []
  if (windows) {
    const gx = w / nc
    const gy = (h - (door ? 9 : 3)) / nr
    for (let i = 0; i < nr; i++)
      for (let j = 0; j < nc; j++) {
        const wx = x + j * gx + gx * 0.28
        const wy = top + 3 + i * gy + gy * 0.22
        const ww = slit ? Math.min(2, gx * 0.2) : gx * 0.44
        const wh = gy * (glass ? 0.5 : slit ? 0.5 : 0.56)
        const on = c.lit && c.r() > 0.45
        win.push(<rect key={`${i}-${j}`} x={f(slit ? x + j * gx + gx / 2 - ww / 2 : wx)} y={f(wy)} width={f(ww)} height={f(wh)} rx={slit ? f(ww / 2) : undefined} fill={on ? '#ffd98a' : glass ? lighten(c.p.water, 0.35) : darken(wall, 0.42)} opacity={on ? 0.95 : 0.8} />)
        if (shutters && !glass) win.push(<path key={`s${i}-${j}`} d={`M${f(wx - 1)} ${f(wy)} v${f(wh)} M${f(wx + ww + 1)} ${f(wy)} v${f(wh)}`} stroke={shutters} strokeWidth="1.4" />)
        if (balcony && i < nr - 1 && !glass) win.push(<path key={`b${i}-${j}`} d={`M${f(wx - 1.5)} ${f(wy + wh + 1)} h${f(ww + 3)} M${f(wx - 1.5)} ${f(wy + wh - 1.5)} h${f(ww + 3)}`} stroke={darken(wall, 0.55)} strokeWidth="0.7" />)
      }
  }
  let roofEl: ReactNode = null
  if (roof === 'gable') roofEl = <path d={`M${f(x - 2)} ${f(top)} L${f(x + w / 2)} ${f(top - w * 0.4)} L${f(x + w + 2)} ${f(top)} Z`} {...wash(rc)} />
  else if (roof === 'hip' || roof === 'tiled') roofEl = <path d={`M${f(x - 2)} ${f(top)} L${f(x + w * 0.2)} ${f(top - Math.min(9, w * 0.3))} L${f(x + w * 0.8)} ${f(top - Math.min(9, w * 0.3))} L${f(x + w + 2)} ${f(top)} Z`} {...wash(rc)} />
  else if (roof === 'mansard') roofEl = <path d={`M${f(x - 1)} ${f(top)} L${f(x + 3)} ${f(top - 8)} L${f(x + w - 3)} ${f(top - 8)} L${f(x + w + 1)} ${f(top)} Z`} {...wash('#7d8aa3')} />
  else if (roof === 'dome') roofEl = <path d={`M${f(x + w * 0.1)} ${f(top)} A${f(w * 0.4)} ${f(w * 0.42)} 0 0 1 ${f(x + w * 0.9)} ${f(top)} Z`} {...wash(rc)} />
  else if (roof === 'cone') roofEl = <path d={`M${f(x - 1.5)} ${f(top)} L${f(x + w / 2)} ${f(top - w * 1.1)} L${f(x + w + 1.5)} ${f(top)} Z`} {...wash(rc)} />
  else if (roof === 'spire') roofEl = <path d={`M${f(x + w * 0.2)} ${f(top)} L${f(x + w / 2)} ${f(top - w * 2.2)} L${f(x + w * 0.8)} ${f(top)} Z`} {...wash(rc)} />
  else if (roof === 'pagoda') roofEl = <path d={`M${f(x - 5)} ${f(top + 1)} Q${f(x + w / 2)} ${f(top - 4)} ${f(x + w + 5)} ${f(top + 1)} L${f(x + w * 0.8)} ${f(top - 6)} L${f(x + w * 0.2)} ${f(top - 6)} Z`} {...wash(rc)} />
  else roofEl = <rect x={f(x - 0.8)} y={f(top - 1.6)} width={f(w + 1.6)} height="1.8" fill={darken(wall, 0.3)} />
  return (
    <g>
      <rect x={f(x)} y={f(top)} width={f(w)} height={f(h)} {...wash(wall, 0.22)} />
      <rect className="nosk" x={f(x + w * 0.62)} y={f(top)} width={f(w * 0.38)} height={f(h)} fill={darken(wall, 0.5)} opacity="0.16" />
      {win}
      {door && <path d={`M${f(x + w / 2 - 3)} ${f(y)} v-6.5 a3 3 0 0 1 6 0 v6.5 Z`} fill={darken(wall, 0.5)} />}
      {roofEl}
    </g>
  )
}

/** A row of town houses filling [x0, x1] on baseline y. */
export function Row({ c, x0, x1, y, hMin, hMax, roof = 'tiled', colors, balcony = false, shutters, glass = false, wMin = 14, wMax = 24 }: { c: Ctx; x0: number; x1: number; y: number; hMin: number; hMax: number; roof?: Roof | 'mix'; colors: string[]; balcony?: boolean; shutters?: string; glass?: boolean; wMin?: number; wMax?: number }) {
  const out: ReactNode[] = []
  let x = x0
  let i = 0
  while (x < x1) {
    const w = range(c.r, wMin, wMax)
    const h = range(c.r, hMin, hMax)
    const rf: Roof = roof === 'mix' ? pick(c.r, ['tiled', 'gable', 'flat', 'tiled'] as const) : roof
    out.push(<Building key={i++} c={c} x={x} y={y} w={w} h={h} wall={pick(c.r, colors)} roof={rf} roofColor={rf === 'tiled' || rf === 'gable' ? pick(c.r, ['#b9583e', '#c46a4a', '#a7503a']) : undefined} balcony={balcony} shutters={shutters} glass={glass} door={c.r() > 0.4} />)
    x += w - 0.5
  }
  return <g>{out}</g>
}

export type TreeKind = 'round' | 'pine' | 'palm' | 'cypress' | 'bush' | 'willow'
/** A painted tree; s ≈ height. */
export function Tree({ c, x, y, s, kind = 'round', color }: { c: Ctx; x: number; y: number; s: number; kind?: TreeKind; color?: string }) {
  const col = color ?? c.p.foliage
  const r = c.r
  if (kind === 'pine') {
    return (
      <g>
        <rect x={f(x - s * 0.04)} y={f(y - s * 0.2)} width={f(s * 0.08)} height={f(s * 0.2)} fill="#5a4030" />
        <path d={`M${f(x)} ${f(y - s)} L${f(x + s * 0.2)} ${f(y - s * 0.62)} L${f(x + s * 0.12)} ${f(y - s * 0.62)} L${f(x + s * 0.3)} ${f(y - s * 0.22)} L${f(x - s * 0.3)} ${f(y - s * 0.22)} L${f(x - s * 0.12)} ${f(y - s * 0.62)} L${f(x - s * 0.2)} ${f(y - s * 0.62)} Z`} {...wash(darken(col, 0.15), 0.25)} />
        <path className="nosk" d={`M${f(x)} ${f(y - s)} L${f(x + s * 0.3)} ${f(y - s * 0.22)} L${f(x + s * 0.05)} ${f(y - s * 0.22)} Z`} fill={darken(col, 0.4)} opacity="0.4" />
      </g>
    )
  }
  if (kind === 'cypress') {
    return (
      <g>
        <path d={`M${f(x)} ${f(y - s)} C${f(x + s * 0.16)} ${f(y - s * 0.7)} ${f(x + s * 0.14)} ${f(y - s * 0.15)} ${f(x)} ${f(y)} C${f(x - s * 0.14)} ${f(y - s * 0.15)} ${f(x - s * 0.16)} ${f(y - s * 0.7)} ${f(x)} ${f(y - s)} Z`} {...wash(darken(col, 0.2), 0.3)} />
        <path className="nosk" d={`M${f(x)} ${f(y - s)} C${f(x + s * 0.16)} ${f(y - s * 0.7)} ${f(x + s * 0.14)} ${f(y - s * 0.15)} ${f(x)} ${f(y)} Z`} fill={darken(col, 0.45)} opacity="0.35" />
      </g>
    )
  }
  if (kind === 'palm') {
    const lean = (r() - 0.5) * s * 0.3
    const tx = x + lean
    const ty = y - s
    const fronds: ReactNode[] = []
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.5 + (r() - 0.5) * 0.2
      const l = s * (0.4 + r() * 0.14)
      const ex = tx + Math.cos(a) * l
      const ey = ty + Math.sin(a) * l * 0.55 + l * 0.4
      const mx = tx + Math.cos(a) * l * 0.55
      const my = ty + Math.sin(a) * l * 0.55 - s * 0.03
      const w = s * 0.075
      // a drooping leaf: upper and lower edges meeting at the tip
      fronds.push(<path key={i} d={`M${f(tx)} ${f(ty)} Q${f(mx)} ${f(my - w)} ${f(ex)} ${f(ey)} Q${f(mx)} ${f(my + w)} ${f(tx)} ${f(ty + 0.5)} Z`} {...wash(i % 2 ? darken(col, 0.12) : col, 0.3, 0.4)} />)
      fronds.push(<path key={`r${i}`} className="nosk" d={`M${f(tx)} ${f(ty)} Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`} stroke={darken(col, 0.35)} strokeWidth="0.4" fill="none" opacity="0.6" />)
    }
    return (
      <g>
        <path d={`M${f(x)} ${f(y)} Q${f(x + lean * 0.2)} ${f(y - s * 0.5)} ${f(tx)} ${f(ty)}`} stroke="#8a6a4a" strokeWidth={f(s * 0.05)} fill="none" strokeLinecap="round" />
        <path className="nosk" d={`M${f(x)} ${f(y)} Q${f(x + lean * 0.2)} ${f(y - s * 0.5)} ${f(tx)} ${f(ty)}`} stroke="#5a4232" strokeWidth={f(s * 0.05)} fill="none" strokeDasharray={`0.6 ${f(s * 0.05)}`} />
        {fronds}
        <circle cx={f(tx)} cy={f(ty + 1)} r={f(s * 0.03)} fill="#6a4a2a" />
      </g>
    )
  }
  if (kind === 'willow') {
    return (
      <g>
        <rect x={f(x - s * 0.04)} y={f(y - s * 0.5)} width={f(s * 0.08)} height={f(s * 0.5)} fill="#6a5040" />
        <path d={`M${f(x - s * 0.4)} ${f(y - s * 0.1)} Q${f(x - s * 0.45)} ${f(y - s)} ${f(x)} ${f(y - s)} Q${f(x + s * 0.45)} ${f(y - s)} ${f(x + s * 0.4)} ${f(y - s * 0.1)} Z`} {...wash(col, 0.2)} />
      </g>
    )
  }
  // round / bush: a cluster of three blobs, lit from the top left
  const k = kind === 'bush' ? 0.5 : 1
  const trunk = kind === 'bush' ? null : <rect x={f(x - s * 0.035)} y={f(y - s * 0.42)} width={f(s * 0.07)} height={f(s * 0.42)} fill="#6a4c38" />
  return (
    <g>
      {trunk}
      <circle cx={f(x + s * 0.12 * k)} cy={f(y - s * 0.55 * k)} r={f(s * 0.24 * k)} {...wash(darken(col, 0.15), 0.25)} />
      <circle cx={f(x - s * 0.13 * k)} cy={f(y - s * 0.58 * k)} r={f(s * 0.22 * k)} {...wash(col, 0.25)} />
      <circle cx={f(x)} cy={f(y - s * 0.76 * k)} r={f(s * 0.22 * k)} {...wash(lighten(col, 0.12), 0.25)} />
      <circle className="nosk" cx={f(x - s * 0.06 * k)} cy={f(y - s * 0.82 * k)} r={f(s * 0.09 * k)} fill={lighten(col, 0.35)} opacity="0.6" />
    </g>
  )
}

/** Soft cloud. */
export function Cloud({ x, y, s, color = '#fffaf2', o = 0.85, shade = '#c9c4d8' }: { x: number; y: number; s: number; color?: string; o?: number; shade?: string }) {
  return (
    <g opacity={o}>
      {/* wet-in-wet lobes over a soft grey belly */}
      <ellipse cx={f(x + s * 0.06)} cy={f(y + s * 0.02)} rx={f(s * 1.05)} ry={f(s * 0.24)} fill={shade} opacity="0.45" />
      <ellipse cx={f(x)} cy={f(y - s * 0.06)} rx={f(s * 0.98)} ry={f(s * 0.22)} fill={color} opacity="0.85" />
      <circle cx={f(x - s * 0.45)} cy={f(y - s * 0.16)} r={f(s * 0.26)} fill={color} opacity="0.8" />
      <circle cx={f(x - s * 0.1)} cy={f(y - s * 0.3)} r={f(s * 0.36)} fill={color} opacity="0.85" />
      <circle cx={f(x + s * 0.34)} cy={f(y - s * 0.22)} r={f(s * 0.3)} fill={color} opacity="0.8" />
      <ellipse className="nosk" cx={f(x + s * 0.1)} cy={f(y - s * 0.06)} rx={f(s * 0.7)} ry={f(s * 0.08)} fill={shade} opacity="0.25" />
    </g>
  )
}

export type BoatKind = 'sail' | 'row' | 'ferry' | 'junk' | 'fishing' | 'gondola'
/** A small boat sitting on the water line y; s ≈ length. */
export function Boat({ c, x, y, s, kind = 'sail', color }: { c: Ctx; x: number; y: number; s: number; kind?: BoatKind; color?: string }) {
  const hull = color ?? c.p.ink
  const hullPath = `M${f(x - s / 2)} ${f(y - s * 0.16)} L${f(x + s / 2)} ${f(y - s * 0.16)} L${f(x + s * 0.38)} ${f(y)} L${f(x - s * 0.4)} ${f(y)} Z`
  const refl = <path className="nosk" d={`M${f(x - s * 0.4)} ${f(y + 1)} h${f(s * 0.8)}`} stroke={darken(hull, 0.3)} strokeWidth="1" opacity="0.35" />
  if (kind === 'gondola')
    return (
      <g>
        <path d={`M${f(x - s / 2)} ${f(y - s * 0.12)} Q${f(x)} ${f(y + s * 0.06)} ${f(x + s / 2)} ${f(y - s * 0.16)} L${f(x + s * 0.44)} ${f(y - s * 0.06)} Q${f(x)} ${f(y + s * 0.03)} ${f(x - s * 0.46)} ${f(y - s * 0.04)} Z`} fill="#22202a" />
        <path d={`M${f(x + s * 0.18)} ${f(y - s * 0.06)} l${f(s * 0.12)} ${f(-s * 0.42)}`} stroke="#5a4636" strokeWidth="0.8" />
        <circle cx={f(x + s * 0.25)} cy={f(y - s * 0.3)} r={f(s * 0.05)} fill="#2a2230" />
        <path d={`M${f(x + s * 0.22)} ${f(y - s * 0.26)} h${f(s * 0.06)} v${f(s * 0.16)} h${f(-s * 0.06)} Z`} fill="#fbf7ee" stroke="#d9473b" strokeWidth="0.6" />
      </g>
    )
  if (kind === 'row') return <g><path d={hullPath} {...wash(hull)} />{refl}</g>
  if (kind === 'ferry')
    return (
      <g>
        <path d={hullPath} {...wash('#2f6b4f')} />
        <rect x={f(x - s * 0.36)} y={f(y - s * 0.3)} width={f(s * 0.72)} height={f(s * 0.14)} {...wash('#fbf7ee')} />
        <rect x={f(x - s * 0.24)} y={f(y - s * 0.4)} width={f(s * 0.48)} height={f(s * 0.1)} {...wash('#f2efe6')} />
        <path d={`M${f(x - s * 0.32)} ${f(y - s * 0.24)} h${f(s * 0.64)}`} stroke="#5d6481" strokeWidth="0.8" strokeDasharray="1.6 1.2" />
        {refl}
      </g>
    )
  if (kind === 'junk')
    return (
      <g>
        <path d={hullPath} {...wash('#7a4a2e')} />
        <path d={`M${f(x - s * 0.05)} ${f(y - s * 0.16)} L${f(x - s * 0.05)} ${f(y - s * 0.9)} Q${f(x + s * 0.3)} ${f(y - s * 0.6)} ${f(x + s * 0.32)} ${f(y - s * 0.2)} Z`} {...wash('#c8462f')} />
        <path d={`M${f(x - s * 0.05)} ${f(y - s * 0.7)} l${f(s * 0.3)} ${f(s * 0.05)} M${f(x - s * 0.05)} ${f(y - s * 0.5)} l${f(s * 0.35)} ${f(s * 0.06)} M${f(x - s * 0.05)} ${f(y - s * 0.32)} l${f(s * 0.36)} ${f(s * 0.04)}`} stroke="#7a2a1e" strokeWidth="0.6" />
        {refl}
      </g>
    )
  if (kind === 'fishing')
    return (
      <g>
        <path d={hullPath} {...wash(hull)} />
        <rect x={f(x - s * 0.1)} y={f(y - s * 0.36)} width={f(s * 0.26)} height={f(s * 0.2)} {...wash('#f5efe2')} />
        <path d={`M${f(x - s * 0.3)} ${f(y - s * 0.16)} l${f(s * 0.02)} ${f(-s * 0.5)}`} stroke="#4a3a30" strokeWidth="0.7" />
        {refl}
      </g>
    )
  return (
    <g>
      <path d={hullPath} {...wash(hull)} />
      <path d={`M${f(x)} ${f(y - s * 0.18)} L${f(x)} ${f(y - s * 0.95)} L${f(x + s * 0.36)} ${f(y - s * 0.22)} Z`} {...wash('#fbf7ee', 0.15)} />
      <path d={`M${f(x - s * 0.04)} ${f(y - s * 0.8)} L${f(x - s * 0.04)} ${f(y - s * 0.22)} L${f(x - s * 0.3)} ${f(y - s * 0.22)} Z`} {...wash('#f1e9d8', 0.15)} />
      {refl}
    </g>
  )
}

/** A few birds as ink ticks. */
export function Birds({ c, x, y, n = 3, s = 3 }: { c: Ctx; x: number; y: number; n?: number; s?: number }) {
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const bx = x + (c.r() - 0.3) * s * 8
    const by = y + (c.r() - 0.5) * s * 4
    const k = s * (0.7 + c.r() * 0.5)
    out.push(<path key={i} d={`M${f(bx - k)} ${f(by - k * 0.3)} Q${f(bx - k * 0.4)} ${f(by - k * 0.6)} ${f(bx)} ${f(by)} Q${f(bx + k * 0.4)} ${f(by - k * 0.6)} ${f(bx + k)} ${f(by - k * 0.3)}`} stroke="#3a3346" strokeWidth="0.7" fill="none" strokeLinecap="round" />)
  }
  return <g>{out}</g>
}

/** Lantern string: a sagging line with red paper lanterns. */
export function Lanterns({ x0, x1, y, sag = 8, n = 6, color = '#d9402e' }: { x0: number; x1: number; y: number; sag?: number; n?: number; color?: string }) {
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const x = x0 + (x1 - x0) * t
    const yy = y + sag * 4 * t * (1 - t)
    out.push(
      <g key={i}>
        <ellipse cx={f(x)} cy={f(yy + 4)} rx="2.8" ry="3.4" fill={color} />
        <ellipse className="nosk" cx={f(x - 0.8)} cy={f(yy + 3)} rx="1" ry="1.6" fill="#ffd1a0" opacity="0.6" />
        <path d={`M${f(x)} ${f(yy)} v1 M${f(x)} ${f(yy + 7.4)} v1.8`} stroke="#e9b949" strokeWidth="0.7" />
      </g>,
    )
  }
  return (
    <g>
      <path d={`M${f(x0)} ${f(y)} Q${f((x0 + x1) / 2)} ${f(y + sag * 2)} ${f(x1)} ${f(y)}`} stroke="#3a3346" strokeWidth="0.5" fill="none" />
      {out}
    </g>
  )
}

/** String lights: a sagging wire with warm bulbs. */
export function StringLights({ x0, x1, y, sag = 6, n = 12, lit }: { x0: number; x1: number; y: number; sag?: number; n?: number; lit: boolean }) {
  const out: ReactNode[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push(<circle key={i} cx={f(x0 + (x1 - x0) * t)} cy={f(y + sag * 4 * t * (1 - t) + 1)} r={lit ? 1.3 : 0.9} fill={lit ? '#ffe2a0' : '#f6efe0'} stroke="#7a6a50" strokeWidth="0.3" />)
  }
  return (
    <g>
      <path d={`M${f(x0)} ${f(y)} Q${f((x0 + x1) / 2)} ${f(y + sag * 2)} ${f(x1)} ${f(y)}`} stroke="#3a3346" strokeWidth="0.45" fill="none" />
      {out}
    </g>
  )
}

