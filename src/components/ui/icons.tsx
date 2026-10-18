import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...props,
})
export const IconSpeaker = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
)
export const IconTurtle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 13a6 6 0 0 1 12 0v2H4z" /><path d="M16 12h3l2 2v2h-5" /><path d="M6 15v3M14 15v3" /><circle cx="19" cy="13" r="0.5" /></svg>
)
export const IconMic = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4M8 21h8" /></svg>
)
export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
)
export const IconFlame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 22c4.4 0 7-2.9 7-6.5 0-3.3-2.3-5.3-3.5-7.5-.4 2-1.5 3-2.5 3.5 0-3-1.5-6.5-4.5-8.5.5 3.5-1 5.5-2.5 7.5S5 13.5 5 15.5C5 19.1 7.6 22 12 22z" /></svg>
)
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>
)
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
)
export const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
)
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
)
export const IconRepeat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
)
export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
)
export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)
export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
export const IconVerb = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 6h16M4 12h10M4 18h7" /><path d="m17 15 2 2 3-4" /></svg>
)
export const IconEar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 8.5a6 6 0 0 1 12 0c0 3-2 4-3 6s-1 4.5-4 4.5" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5" /></svg>
)
export const IconArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
)
export const IconTrophy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 21h8M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></svg>
)
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
)
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const IconLeaf = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 20c0-9 5-15 16-16-1 11-7 16-16 16z" /><path d="M4 20c4-5 8-8 12-10" /></svg>
)
export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></svg>
)
/** Journey: a dashed route between two pins. */
export const IconRoute = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="5" r="2.2" /><path d="M8 17.5c3-1 3.5-4.5 6.5-6.5 1.4-.9 2.3-2.4 2.8-3.8" strokeDasharray="2.2 2.6" /></svg>
)
/** A paw print (days on the road). */
export const IconPaw = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })}><ellipse cx="12" cy="16" rx="4.6" ry="3.8" /><ellipse cx="6" cy="10.5" rx="1.9" ry="2.4" transform="rotate(-18 6 10.5)" /><ellipse cx="9.6" cy="6.6" rx="1.9" ry="2.5" /><ellipse cx="14.4" cy="6.6" rx="1.9" ry="2.5" /><ellipse cx="18" cy="10.5" rx="1.9" ry="2.4" transform="rotate(18 18 10.5)" /></svg>
)
/** A postcard with a stamp corner (reviews: postcards that fade). */
export const IconPostcard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="2.5" y="5" width="19" height="14" rx="1.5" /><rect x="15" y="8" width="3.8" height="4.4" rx="0.5" /><path d="M12 8v8M5.5 10h4M5.5 13h4" /></svg>
)
/** Insights: a candlestick-like chart. */
export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 3v18h18" /><path d="M8 9v6M8 7v1M8 16v1" /><rect x="6.8" y="9" width="2.4" height="6" rx="0.4" /><rect x="12.3" y="6" width="2.4" height="5" rx="0.4" /><path d="M13.5 4v2M13.5 11v2" /><rect x="17.8" y="10" width="2.4" height="5" rx="0.4" /><path d="M19 8v2M19 15v2" /></svg>
)
/** Tailwind (combo): three gusts. */
export const IconWind = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5" /><path d="M3 12h15a2.5 2.5 0 1 1-2.5 2.5" /><path d="M3 16h7" /></svg>
)
/** A plane, for the boarding pass. */
export const IconPlane = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })}><path d="M21.5 13.2v-1.6L13.5 7V2.8a1.5 1.5 0 0 0-3 0V7l-8 4.6v1.6l8-2.1v5.2l-2.3 1.7v1.4l3.8-1 3.8 1v-1.4l-2.3-1.7v-5.2z" /></svg>
)
/** A globe with meridians (all languages / the hub). */
export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.8 3.8 5.8 3.8 9s-1.2 6.2-3.8 9c-2.6-2.8-3.8-5.8-3.8-9s1.2-6.2 3.8-9z" /></svg>
)
/** Passport control (level check). */
export const IconPassport = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="5" y="2.5" width="14" height="19" rx="1.8" /><circle cx="12" cy="10" r="3.4" /><path d="M8.6 10h6.8M12 6.6c1 1 1.4 2.1 1.4 3.4s-.4 2.4-1.4 3.4M9 17h6" /></svg>
)
/** Listening practice. */
export const IconHeadphones = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
)
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" /></svg>
)
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" /></svg>
)
export const IconSkipBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M19 20 9 12l10-8v16z" /><path d="M5 19V5" /></svg>
)
export const IconSkipForward = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m5 4 10 8-10 8V4z" /><path d="M19 5v14" /></svg>
)
/** Play the current line again. */
export const IconReplay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
)
