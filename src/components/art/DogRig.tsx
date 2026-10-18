/**
 * A dog as a puppet: its portrait cut into layers (body, head, two ears) that move on their own,
 * with drawn eyelids, an opening mouth and front paws. The act (dogPose.ts) picks the motion; all
 * animation is CSS (rg-* keyframes in index.css) on transform/opacity, so it stays smooth.
 *
 * Coordinates are the shared 120×120 box. The rig sits in its own nested <svg> with a 0 0 viewBox
 * so transform origins written in px are user units wherever the dog is placed.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Act } from './dogPose'
import { place, type PortraitDog } from './dogPortraits'
import RIG from './rig/rig.json'
import leoBody from './rig/leo-body.webp'
import leoHead from './rig/leo-head.webp'
import leoEarL from './rig/leo-earL.webp'
import leoEarR from './rig/leo-earR.webp'
import bonBody from './rig/bonchita-body.webp'
import bonHead from './rig/bonchita-head.webp'
import bonEarL from './rig/bonchita-earL.webp'
import bonEarR from './rig/bonchita-earR.webp'
import lunaBody from './rig/luna-body.webp'
import lunaHead from './rig/luna-head.webp'
import lunaEarL from './rig/luna-earL.webp'
import lunaEarR from './rig/luna-earR.webp'

const LAYERS: Record<PortraitDog, { body: string; head: string; earL: string; earR: string }> = {
  leo: { body: leoBody, head: leoHead, earL: leoEarL, earR: leoEarR },
  bonchita: { body: bonBody, head: bonHead, earL: bonEarL, earR: bonEarR },
  luna: { body: lunaBody, head: lunaHead, earL: lunaEarL, earR: lunaEarR },
}

type Pt = [number, number]
interface RigMeta {
  neck: Pt
  earLp: Pt
  earRp: Pt
  eyes: [number, number, number][]
  nose: Pt
  mouth: Pt[]
  lids: string[]
}

export interface DogRigProps {
  dog: PortraitDog
  act: Act
  /** Drawn on the body, under the head (scarves, ponchos). */
  bodyOverlay?: ReactNode
  /** Drawn on the head, moving with it (hats, glasses, things in the mouth). */
  headOverlay?: ReactNode
  /** Drawn in front of everything (items standing beside the dog). */
  frontOverlay?: ReactNode
}

const o = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x.toFixed(2)}px ${y.toFixed(2)}px` })

const CONFETTI = ['#e8553e', '#2f6fc0', '#f2b530', '#3f9a5f', '#e07aa6', '#7a55c2']
/** A little burst of confetti above the dog (celebrations). */
function Confetti({ cx, top, w }: { cx: number; top: number; w: number }) {
  const bits = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2
    const dx = Math.cos(a) * w * (0.45 + (i % 3) * 0.12)
    const dy = -Math.abs(Math.sin(a)) * w * 0.35 - 6
    return { dx, dy, c: CONFETTI[i % CONFETTI.length]!, r: (i * 47) % 180, d: (i % 5) * 0.08, round: i % 3 === 0 }
  })
  return (
    <g className="rg-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <g key={i} style={{ ['--dx' as string]: `${b.dx.toFixed(1)}px`, ['--dy' as string]: `${b.dy.toFixed(1)}px`, animationDelay: `${b.d}s`, transformOrigin: `${cx}px ${top + 10}px` }} className="rg-bit">
          {b.round ? <circle cx={cx} cy={top + 10} r="2.6" fill={b.c} /> : <rect x={cx - 2.4} y={top + 8.6} width="4.8" height="2.8" rx="0.6" fill={b.c} transform={`rotate(${b.r} ${cx} ${top + 10})`} />}
        </g>
      ))}
    </g>
  )
}

/** A wave greeting drawn beside the dog: motion lines and a sparkle. */
function Hello({ x, y }: { x: number; y: number }) {
  return (
    <g className="rg-hello" aria-hidden="true" style={{ transformOrigin: `${x}px ${y + 6}px` }}>
      <path d={`M${x} ${y} q4 -4 8 0 M${x + 2} ${y + 5} q4 -4 8 0`} stroke="#2f6fc0" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d={`M${x + 9} ${y - 7} l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z`} fill="#f2b530" />
    </g>
  )
}

export function DogRig({ dog, act, bodyOverlay, headOverlay, frontOverlay }: DogRigProps) {
  const m = (RIG as unknown as Record<string, RigMeta>)[dog]!
  const r = place(dog)
  const L = LAYERS[dog]
  const at = ([fx, fy]: Pt): Pt => [r.x + fx * r.w, r.y + fy * r.h]
  const [nx, ny] = at(m.neck)
  const [lx, ly] = at(m.earLp)
  const [rx, ry] = at(m.earRp)
  const bottom = r.y + r.h
  const cx = r.x + r.w / 2
  // each dog blinks on its own rhythm
  const [delay] = useState(() => `${(-Math.random() * 5).toFixed(2)}s`)
  const mouth = m.mouth.map(at)
  const mw = Math.abs(mouth[2]![0] - mouth[0]![0])
  const [mx, my] = mouth[1]!
  const img = (href: string) => <image href={href} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="none" />
  return (
    <svg x="0" y="0" width="120" height="120" viewBox="0 0 120 120" overflow="visible" className={`rg rg-${act}`} style={{ ['--rg-delay' as string]: delay }}>
      <ellipse className="rg-shadow" cx={cx} cy={bottom - 0.5} rx={r.w * 0.4} ry="3.2" fill="#3a2c2a" opacity="0.14" style={o(cx, bottom)} />
      <g className="rg-all" style={o(cx, bottom)}>
        <g className="rg-body" style={o(cx, bottom)}>
          {img(L.body)}
          {bodyOverlay}
        </g>
        <g className="rg-head" style={o(nx, ny)}>
          {img(L.head)}
          <g className="rg-earL" style={o(lx, ly)}>{img(L.earL)}</g>
          <g className="rg-earR" style={o(rx, ry)}>{img(L.earR)}</g>
          {m.eyes.map(([fx, fy, fr], i) => {
            const [ex, ey] = at([fx, fy])
            const er = fr * r.w
            const clip = `rgc-${dog}-${i}`
            return (
              <g key={i}>
                <clipPath id={clip}>
                  <ellipse cx={ex} cy={ey} rx={er * 1.12} ry={er * 0.98} />
                </clipPath>
                <g clipPath={`url(#${clip})`}>
                  <g className="rg-lid" style={o(ex, ey - er * 1.2)}>
                    <rect x={ex - er * 1.4} y={ey - er * 1.2} width={er * 2.8} height={er * 2.3} fill={m.lids[i]} />
                    <path d={`M${ex - er * 1.15} ${ey + er * 1.02} Q${ex} ${ey + er * 1.32} ${ex + er * 1.15} ${ey + er * 1.02}`} stroke="#2a1a12" strokeWidth={er * 0.22} fill="none" strokeLinecap="round" />
                  </g>
                  <g className="rg-lowlid" style={o(ex, ey + er * 1.2)}>
                    <rect x={ex - er * 1.4} y={ey - er * 0.2} width={er * 2.8} height={er * 1.45} fill={m.lids[i]} />
                    <path d={`M${ex - er * 1.1} ${ey - er * 0.12} Q${ex} ${ey - er * 0.42} ${ex + er * 1.1} ${ey - er * 0.12}`} stroke="#2a1a12" strokeWidth={er * 0.18} fill="none" strokeLinecap="round" />
                  </g>
                </g>
              </g>
            )
          })}
          <g className="rg-mouth" style={o(mx, my)}>
            <path d={`M${mx - mw * 0.36} ${my} Q${mx} ${my - mw * 0.06} ${mx + mw * 0.36} ${my} Q${mx + mw * 0.3} ${my + mw * 0.42} ${mx} ${my + mw * 0.46} Q${mx - mw * 0.3} ${my + mw * 0.42} ${mx - mw * 0.36} ${my} Z`} fill="#3a1418" />
            <path d={`M${mx - mw * 0.22} ${my + mw * 0.26} Q${mx} ${my + mw * 0.12} ${mx + mw * 0.22} ${my + mw * 0.26} Q${mx + mw * 0.2} ${my + mw * 0.44} ${mx} ${my + mw * 0.46} Q${mx - mw * 0.2} ${my + mw * 0.44} ${mx - mw * 0.22} ${my + mw * 0.26} Z`} fill="#e3707e" />
          </g>
          {headOverlay}
        </g>
        {frontOverlay}
        {act === 'cheer' && <Confetti cx={cx} top={r.y} w={r.w} />}
        {act === 'wave' && <Hello x={r.x + r.w * 0.92} y={r.y + r.h * 0.12} />}
        {act === 'sleepy' && (
          <text className="rg-zzz" x={r.x + r.w * 0.85} y={r.y + 4} fontSize="9" fontWeight="800" fill="#5b6aa8">
            z<tspan dx="1" dy="-4" fontSize="7">z</tspan>
          </text>
        )}
      </g>
    </svg>
  )
}
