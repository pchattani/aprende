/**
 * Small drawings for the world map: node icons (paw, ticket, star), the checkpoint
 * travel chest, the border-control gate and roadside scenery. Inline SVG, colours from
 * the region ink (--lvl) so every region gets its own look.
 */
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const hidden = { 'aria-hidden': true as const, focusable: false as const }

/** A boarding ticket with a perforated stub (the current lesson). */
export function TicketIcon(p: P) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} {...hidden} {...p}>
      <g transform="rotate(-12 16 16)">
        <path d="M4 10a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6z" fill="currentColor" />
        <path d="M21 9.5v13" stroke="var(--wm-face, #fff)" strokeWidth="1.6" strokeDasharray="1.6 2" strokeLinecap="round" />
        <path d="M8.5 13.5h8M8.5 17h5.5" stroke="var(--wm-face, #fff)" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
      </g>
    </svg>
  )
}

/** A filled five-point star (a lesson that is solid). */
export function StarIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} {...hidden} {...p}>
      <path d="m12 2.6 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/** The checkpoint: a travel chest with leather straps in the region's ink; open once cleared. */
export function ChestArt({ open = false, size = 46 }: { open?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} {...hidden} overflow="visible">
      {open && (
        <g className="wm-chest-glow">
          <path d="M24 2v6M12 6l3 5M36 6l-3 5" stroke="#f2c15a" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}
      {/* body */}
      <rect x="5" y="21" width="38" height="22" rx="4" fill="#a8683a" />
      <rect x="5" y="34" width="38" height="9" rx="3" fill="#8d5530" />
      {open ? (
        <>
          <path d="M8 21 L11 9.5 Q11.6 7.5 13.6 7.5 H34.4 Q36.4 7.5 37 9.5 L40 21 Z" fill="#7a4628" />
          <path d="M9 21 H39 V24 H9 Z" fill="#3d2414" />
          <circle cx="18" cy="21" r="3.2" fill="#f2c15a" />
          <circle cx="24.5" cy="20" r="3.6" fill="#f6d27a" />
          <circle cx="31" cy="21.2" r="3" fill="#e9a92e" />
        </>
      ) : (
        <path d="M5 23 V17 Q5 10 12 10 H36 Q43 10 43 17 V23 Z" fill="#c4834c" />
      )}
      {/* straps in the region's ink */}
      <rect x="12" y={open ? 21 : 10} width="5" height={open ? 22 : 33} rx="1.2" fill="var(--lvl, #d4583f)" />
      <rect x="31" y={open ? 21 : 10} width="5" height={open ? 22 : 33} rx="1.2" fill="var(--lvl, #d4583f)" />
      {/* clasp */}
      <rect x="20.5" y={open ? 25 : 19} width="7" height="8" rx="2" fill="#f2c15a" stroke="#b98315" strokeWidth="1" />
      <circle cx="24" cy={open ? 28.5 : 22.5} r="1.2" fill="#6b4a12" />
      <path d="M7 40.5h34" stroke="#000" strokeOpacity="0.12" strokeWidth="1.2" />
    </svg>
  )
}

/** Border control: a stone arch with a striped barrier and the region's flag on top. */
export function GateArt({ open = false, size = 64 }: { open?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} {...hidden} overflow="visible">
      <path d="M32 9 V-3" stroke="#6b5a40" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M33 -3 L47 1 L33 5 Z" fill="var(--lvl, #d4583f)" />
      <path d="M7 60 V27 Q7 8 32 8 Q57 8 57 27 V60 H44 V31 Q44 21 32 21 Q20 21 20 31 V60 Z" fill="#efe3c8" stroke="#b9a57e" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 34h8M9.5 44h8M46.5 34h8M46.5 44h8M14 22l5 4M50 22l-5 4" stroke="#cdbb93" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 31 Q20 21 32 21 Q44 21 44 31 V60 H20 Z" fill="#3a3550" opacity="0.18" />
      <g transform={open ? 'rotate(-62 19 44)' : undefined} className="wm-gate-bar">
        <rect x="17" y="41.5" width="30" height="5" rx="2.5" fill="#fffaf0" stroke="#b9a57e" strokeWidth="1" />
        <path d="M23 41.5 l-3 5 M31 41.5 l-3 5 M39 41.5 l-3 5 M46 41.5 l-2.6 4.3" stroke="var(--lvl, #d4583f)" strokeWidth="2.6" />
      </g>
      <circle cx="19" cy="44" r="2.4" fill="#6b5a40" />
    </svg>
  )
}

export type SceneryKind = 'tree' | 'pine' | 'bush' | 'flowers' | 'rock' | 'sign' | 'hill'

/** Roadside scenery: simple shapes with a soft ground shadow, tinted by the region. */
export function Scenery({ kind, size = 40 }: { kind: SceneryKind; size?: number }) {
  const leaf = 'color-mix(in srgb, var(--lvl) 28%, #6f9a5a)'
  const leafDark = 'color-mix(in srgb, var(--lvl) 30%, #4f7a43)'
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} {...hidden} overflow="visible">
      <ellipse cx="20" cy="37" rx="13" ry="2.6" fill="#000" opacity="0.08" />
      {kind === 'tree' && (
        <>
          <rect x="18.2" y="24" width="3.6" height="13" rx="1.2" fill="#8a5a36" />
          <circle cx="20" cy="17" r="11" fill={leaf} />
          <circle cx="15" cy="20" r="6.5" fill={leafDark} opacity="0.55" />
          <circle cx="23.5" cy="12.5" r="3.4" fill="#fff" opacity="0.18" />
        </>
      )}
      {kind === 'pine' && (
        <>
          <rect x="18.4" y="29" width="3.2" height="8" rx="1" fill="#7a4e30" />
          <path d="M20 3 L30 17 H25 L32 27 H26 L33 31 H7 L14 27 H8 L15 17 H10 Z" fill={leafDark} />
          <path d="M20 3 L25 10 L20 9 Z" fill="#fff" opacity="0.2" />
        </>
      )}
      {kind === 'bush' && (
        <>
          <circle cx="13" cy="29" r="7" fill={leafDark} />
          <circle cx="22" cy="26" r="9" fill={leaf} />
          <circle cx="29" cy="31" r="5.5" fill={leafDark} />
          <circle cx="20" cy="22" r="1.6" fill="var(--lvl)" />
          <circle cx="26" cy="27" r="1.4" fill="var(--sun)" />
        </>
      )}
      {kind === 'flowers' && (
        <>
          {[[11, 30, 'var(--lvl)'], [20, 25, 'var(--sun)'], [28, 31, 'var(--lvl)'], [16, 34, '#fff']].map(([x, y, c], i) => (
            <g key={i}>
              <path d={`M${x} ${y} V37`} stroke={leafDark} strokeWidth="1.6" />
              <circle cx={x as number} cy={y as number} r="3.2" fill={c as string} />
              <circle cx={x as number} cy={y as number} r="1.1" fill="#fff6d8" />
            </g>
          ))}
        </>
      )}
      {kind === 'rock' && (
        <>
          <path d="M6 37 Q7 26 15 24 Q19 18 26 22 Q34 24 34 37 Z" fill="#b8ad98" />
          <path d="M15 24 Q19 18 26 22 Q22 24 20 30 Z" fill="#fff" opacity="0.25" />
        </>
      )}
      {kind === 'sign' && (
        <>
          <rect x="18.6" y="12" width="2.8" height="25" rx="1" fill="#8a5a36" />
          <path d="M8 10 H28 L32 14 L28 18 H8 Z" fill="var(--card)" stroke="var(--lvl)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 14 H24" stroke="var(--lvl)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 2" />
          <path d="M31 21 H13 L9 25 L13 29 H31 Z" fill="var(--card)" stroke="var(--ink-2)" strokeWidth="1.4" strokeLinejoin="round" opacity="0.9" />
        </>
      )}
      {kind === 'hill' && (
        <>
          <path d="M0 37 Q10 16 22 22 Q30 12 40 37 Z" fill={leaf} opacity="0.7" />
          <path d="M22 22 Q30 12 40 37 H30 Q28 26 22 22 Z" fill={leafDark} opacity="0.45" />
        </>
      )}
    </svg>
  )
}
