/**
 * The watercolour/gouache SVG filters and the lit-from-the-top-left gradient
 * shared by the painted illustrations.
 */
import { lighten, darken } from './brush'

// ---------------------------------------------------------------- filters
/**
 * Watercolour/gouache filters, rendered once per <svg> under an id prefix.
 *  - `${id}-wc`   : wobbly pigment edges, granulation and edge darkening (parts of a character)
 *  - `${id}-soft` : wobbly edges only (cheap; small accents)
 *  - `${id}-ink`  : a slightly broken ink line
 */
export function PaintFilters({ id, seed = 3, wobble = 3.2, grain = true }: { id: string; seed?: number; wobble?: number; grain?: boolean }) {
  return (
    <>
      <filter id={`${id}-wc`} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed={seed} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={wobble} xChannelSelector="R" yChannelSelector="G" result="d" />
        {grain ? (
          <>
            <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed={seed + 11} result="g" />
            <feColorMatrix in="g" type="matrix" values="0.2 0 0 0 0.86  0.2 0 0 0 0.86  0.2 0 0 0 0.86  0 0 0 0 1" result="gm1" />
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={seed + 3} result="bl" />
            <feColorMatrix in="bl" type="matrix" values="0.32 0 0 0 0.8  0.3 0 0 0 0.82  0.26 0 0 0 0.84  0 0 0 0 1" result="gm2" />
            <feComposite in="gm1" in2="gm2" operator="arithmetic" k1="1.06" result="gm" />
            <feBlend in="d" in2="gm" mode="multiply" result="m0" />
            <feComposite in="m0" in2="d" operator="in" result="m" />
          </>
        ) : (
          <feOffset in="d" result="m" />
        )}
        {/* edge darkening: pigment pools where the wash dries */}
        <feGaussianBlur in="d" stdDeviation="1.4" result="b" />
        <feComposite in="d" in2="b" operator="arithmetic" k2="1" k3="-1" result="rim" />
        <feColorMatrix in="rim" type="matrix" values="0.6 0 0 0 0  0 0.55 0 0 0  0 0 0.6 0 0  0 0 0 0.5 0" result="rimd" />
        <feComposite in="rimd" in2="m" operator="over" />
      </filter>
      <filter id={`${id}-soft`} x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed={seed + 5} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={wobble * 0.8} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.6" />
      </filter>
      <filter id={`${id}-ink`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="2" seed={seed + 9} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </>
  )
}

/** A radial "lit from the top-left" gradient for one colour: highlight → base → shade. */
export function Lit({ id, base, light, shade, cx = 0.36, cy = 0.3, r = 0.85, user }: { id: string; base: string; light?: string; shade?: string; cx?: number; cy?: number; r?: number; user?: boolean }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r} fx={cx} fy={cy} gradientUnits={user ? 'userSpaceOnUse' : undefined}>
      <stop offset="0" stopColor={light ?? lighten(base, 0.35)} />
      <stop offset="0.55" stopColor={base} />
      <stop offset="1" stopColor={shade ?? darken(base, 0.3)} />
    </radialGradient>
  )
}
