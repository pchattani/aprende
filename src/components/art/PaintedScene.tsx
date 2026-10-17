/**
 * A painted postcard scene (gouache/watercolour), deterministic from its SceneSpec.
 *
 *  progress 0..1  0 = a pencil sketch on paper; the paint washes in from the middle
 *                 as a watercolour-edged blob and the colour gets richer; 1 = painted.
 *  fade 0..1      memory fading: colours wash out toward the paper (cards due for review).
 *  quality        'full' (granulation, pigment blotches) or 'thumb' (wobble only).
 *  lazy           render only once scrolled into view (for long lists of thumbnails).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SceneSpec } from '../../engine/scenes'
import { MOTIF_PAINTERS, paintAccent } from './motifs'
import { Cloud } from './sceneKit'
import { TIME_SKY, W, H, type Ctx } from './sceneUtils'
import { rng, mix, range, useArtId, f } from './brush'

export const PAPER = '#f8f3e8'
const GRAPHITE = '#615b66'

export interface PaintedSceneProps {
  scene: SceneSpec
  progress?: number
  fade?: number
  quality?: 'thumb' | 'full'
  lazy?: boolean
  className?: string
  /** Accessible name (the place). */
  title?: string
  style?: React.CSSProperties
}

const SKETCH_CSS = `.pw-sketch *{fill:none!important;stroke:${GRAPHITE}!important;stroke-width:var(--pw-sk,.6px)!important;stroke-opacity:.85!important;stroke-dasharray:none!important}.pw-sketch .bg,.pw-sketch .nosk,.pw-sketch .pw-nosk{display:none}`

function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Everything the painter needs for one pass; a fresh RNG each pass keeps both passes identical. */
function makeCtx(scene: SceneSpec, id: string): Ctx {
  const t = TIME_SKY[scene.time]
  const haze = t.k ? mix(scene.palette.sky[1], t.hz, t.k) : scene.palette.sky[1]
  return {
    r: rng(scene.seed),
    p: scene.palette,
    time: scene.time,
    night: scene.time === 'night',
    lit: scene.time === 'night' || scene.time === 'dusk',
    variant: scene.variant,
    id,
    hz: 118 + (scene.seed % 7) - 3,
    haze,
  }
}

/** The landscape itself (motif + accent), returned as layers. */
function paintLayers(scene: SceneSpec, id: string) {
  const c = makeCtx(scene, id)
  const painted = MOTIF_PAINTERS[scene.motif](c)
  const acc = scene.accent ? paintAccent(c, scene.accent, painted) : {}
  return { c, painted, acc }
}

function Sky({ c, scene, id }: { c: Ctx; scene: SceneSpec; id: string }) {
  const t = TIME_SKY[scene.time]
  const top = t.k ? mix(scene.palette.sky[0], t.top, t.k) : scene.palette.sky[0]
  const r = rng(scene.seed ^ 0x5bd1e995)
  const sx = range(r, 50, 250)
  const sy = scene.time === 'golden' || scene.time === 'dusk' || scene.time === 'dawn' ? c.hz - range(r, 14, 26) : c.hz - range(r, 50, 75)
  const clouds: ReactNode[] = []
  const n = 2 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) clouds.push(<Cloud key={i} x={range(r, 20, 280)} y={range(r, 22, c.hz - 50)} s={range(r, 18, 34)} color={c.night ? '#4a5590' : scene.time === 'dusk' ? '#f6c4b4' : '#fffaf2'} o={c.night ? 0.5 : 0.8} shade={c.night ? '#2e3768' : mix(top, '#8a84a0', 0.45)} />)
  const sun = c.night ? '#f6ecc8' : scene.time === 'dusk' ? '#ffd2a0' : scene.palette.sun
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset={f(c.hz / H)} stopColor={c.haze} />
          <stop offset="1" stopColor={c.haze} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" stopColor={sun} stopOpacity="0.9" />
          <stop offset="0.25" stopColor={sun} stopOpacity="0.55" />
          <stop offset="1" stopColor={sun} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect className="bg" x="-10" y="-10" width={W + 20} height={H + 20} fill={`url(#${id}-sky)`} />
      <circle className="nosk" cx={f(sx)} cy={f(sy)} r={c.night ? 26 : 46} fill={`url(#${id}-sun)`} />
      {c.night ? (
        <path d={`M${f(sx + 7)} ${f(sy - 9)} a10 10 0 1 0 2 17 a8 8 0 1 1 -2 -17 z`} fill={sun} />
      ) : (
        <circle cx={f(sx)} cy={f(sy)} r={scene.time === 'day' ? 9 : 12} fill={sun} opacity="0.95" />
      )}
      {c.night && (
        <g className="nosk">
          {Array.from({ length: 24 }, (_, i) => (
            <circle key={i} cx={f(r() * 300)} cy={f(r() * (c.hz - 40))} r={f(0.4 + r() * 0.7)} fill="#fff8e0" opacity={f(0.4 + r() * 0.6)} />
          ))}
        </g>
      )}
      <g className="pw-nosk">{clouds}</g>
    </g>
  )
}

function useInView(enabled: boolean) {
  const ref = useRef<SVGSVGElement>(null)
  const [seen, setSeen] = useState(!enabled)
  useEffect(() => {
    if (!enabled || seen) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setSeen(true)
        io.disconnect()
      }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [enabled, seen])
  return { ref, seen }
}

export function PaintedScene({ scene, progress = 1, fade = 0, quality = 'full', lazy = false, className = '', title, style }: PaintedSceneProps) {
  const id = useArtId('ps')
  const { ref, seen } = useInView(lazy)
  const p = Math.max(0, Math.min(1, progress))
  const fd = Math.max(0, Math.min(1, fade))
  const thumb = quality === 'thumb'
  const svgProps = { ref, viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice', className, style, role: 'img' as const, 'aria-label': title ?? 'Painted postcard' }
  if (!seen) {
    return (
      <svg {...svgProps}>
        <rect width={W} height={H} fill={PAPER} />
      </svg>
    )
  }
  const paint = paintLayers(scene, id)
  const sketch = p < 1 ? paintLayers(scene, id) : null
  const t = TIME_SKY[scene.time]
  const [tr, tg, tb] = t.tint ? hexRgb(t.tint) : [1, 1, 1]
  const k = t.tintO
  const tint = `${f(1 - k * (1 - tr))} 0 0 0 0  0 ${f(1 - k * (1 - tg))} 0 0 0  0 0 ${f(1 - k * (1 - tb))} 0 0  0 0 0 1 0`
  // colour rises with progress and drains with fading
  const sat = (0.55 + 0.45 * p) * (1 - 0.75 * fd) * 1.28
  const rr = rng(scene.seed ^ 0x2c1b3c6d)
  const blobs = [
    { x: 150 + range(rr, -30, 30), y: 105 + range(rr, -15, 15), r: 18 + p * 200 },
    { x: range(rr, 40, 110), y: range(rr, 60, 150), r: Math.max(0, p - 0.15) * 110 },
    { x: range(rr, 190, 260), y: range(rr, 60, 150), r: Math.max(0, p - 0.25) * 110 },
  ]
  return (
    <svg {...svgProps}>
      <defs>
        <filter id={`${id}-paint`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={thumb ? 1 : 3} seed={scene.seed % 97} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={thumb ? 1 : 1.4} xChannelSelector="R" yChannelSelector="G" result="d0" />
          {/* pigment pools at the edges of each wash: a gentle unsharp mask */}
          <feGaussianBlur in="d0" stdDeviation={thumb ? 1 : 1.3} result="bl" />
          <feComposite in="d0" in2="bl" operator="arithmetic" k2={thumb ? 1.6 : 2.1} k3={thumb ? -0.6 : -1.1} result="d" />
          {thumb ? (
            <feColorMatrix in="d" type="saturate" values={f(sat)} />
          ) : (
            <>
              <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed={(scene.seed % 89) + 3} result="g" />
              <feColorMatrix in="g" type="matrix" values="0.05 0 0 0 0.97  0.05 0 0 0 0.97  0.05 0 0 0 0.97  0 0 0 0 1" result="g1" />
              <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed={(scene.seed % 83) + 7} result="b" />
              <feColorMatrix in="b" type="matrix" values="0.14 0 0 0 0.93  0.13 0 0 0 0.93  0.12 0 0 0 0.92  0 0 0 0 1" result="b1" />
              <feComposite in="g1" in2="b1" operator="arithmetic" k1="1.04" result="gm" />
              <feBlend in="d" in2="gm" mode="multiply" result="m" />
              <feComposite in="m" in2="d" operator="in" result="m2" />
              <feColorMatrix in="m2" type="saturate" values={f(sat)} />
            </>
          )}
        </filter>
        <filter id={`${id}-tint`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="matrix" values={tint} />
        </filter>
        <filter id={`${id}-edge`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed={scene.seed % 71} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <mask id={`${id}-paper`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect x="7" y="7" width={W - 14} height={H - 14} fill="#fff" filter={`url(#${id}-edge)`} />
        </mask>
        {p < 1 && (
          <>
            <filter id={`${id}-bloom`} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed={scene.seed % 61} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G" result="d" />
              <feGaussianBlur in="d" stdDeviation="1.2" />
            </filter>
            <mask id={`${id}-reveal`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <g filter={`url(#${id}-bloom)`}>
                {p > 0 && blobs.map((b, i) => (b.r > 0 ? <circle key={i} cx={f(b.x)} cy={f(b.y)} r={f(b.r)} fill="#fff" /> : null))}
              </g>
            </mask>
            <filter id={`${id}-pencil`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed={scene.seed % 53} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </>
        )}
      </defs>
      <rect width={W} height={H} fill={PAPER} />
      <g mask={`url(#${id}-paper)`}>
        {sketch && (
          <g>
            <style>{SKETCH_CSS}</style>
            <g className="pw-sketch" style={{ ['--pw-sk' as string]: thumb ? '1.1px' : '0.55px' }} filter={thumb ? undefined : `url(#${id}-pencil)`}>
              <Sky c={sketch.c} scene={scene} id={`${id}k`} />
              {sketch.painted.main}
              {sketch.acc.main}
            </g>
          </g>
        )}
        {p > 0 && (
          <g mask={p < 1 ? `url(#${id}-reveal)` : undefined}>
            <g filter={`url(#${id}-paint)`}>
              <Sky c={paint.c} scene={scene} id={id} />
              <g filter={k ? `url(#${id}-tint)` : undefined}>
                {paint.painted.main}
                {paint.acc.main}
              </g>
              {paint.painted.lights}
              {paint.acc.lights}
            </g>
          </g>
        )}
      </g>
      {fd > 0 && <rect width={W} height={H} fill={PAPER} opacity={f(fd * 0.6)} mask={`url(#${id}-paper)`} />}
    </svg>
  )
}
