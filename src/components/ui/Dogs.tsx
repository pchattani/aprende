/**
 * Leo, Bonchita and Luna, the three travelling dogs, painted in a gouache storybook
 * style (see components/art). Pure inline SVG so they work offline and scale crisply.
 */
import { useState, type ReactNode, type SVGProps } from 'react'
import { souvenirById } from '../../engine/journey'
import type { ArtKind, WearSlot } from '../../engine/artKinds'
import type { Outfit, DogName } from '../../hooks/useOutfits'
import { useSpeak } from '../../hooks/useSpeak'
import { DOG_NAMES, DOG_LINES } from '../../engine/dogs'
import { TL } from '../../engine/course'
import { DogFigure } from '../art/DogFigure'
import { DogsTrio } from '../art/DogsTrio'
import { PORTRAITS, place, at, headTilt } from '../art/dogPortraits'
import type { Act, Mood } from '../art/dogPose'
import { SouvenirShape } from '../art/SouvenirArt'
import { souvenirArt, parseWearId, HAT_FIT, EYE_FIT, NECK_FIT, BODY_KINDS, HIGH_KINDS, EAR_KINDS, MOUTH_TURN, PAW_SIZE } from '../art/souvenirKinds'

export { DogStamp } from '../art/DogStamp'
export { DogsTrio } from '../art/DogsTrio'

type P = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number; mood?: Mood; outfit?: Outfit; act?: Act }

/**
 * Where things are worn on each dog, in the 120×120 viewBox: the hat line (where a brim sits,
 * just above the brows) and the head's width there, the eyes, the mouth, the collar line,
 * the chest (pendants), the top of a garment, and the ground point beside the free paw.
 */
interface DogGeo {
  hat: { x: number; y: number; w: number }
  eyes: { x: number; y: number; gap: number }
  mouth: { x: number; y: number; w: number }
  neck: { x: number; y: number; w: number }
  chest: { x: number; y: number }
  /** Top of a draped garment (neck), shoulder width and how far it may hang. */
  body: { x: number; y: number; w: number; h: number }
  paw: { x: number; y: number; side: 1 | -1 }
  /** Behind the (viewer's) right ear: tucked flowers and feathers. */
  ear: { x: number; y: number }
}
/** Anchors read off each portrait (see art/dogPortraits.ts). */
function geoFor(dog: DogName): DogGeo {
  const p = PORTRAITS[dog]
  const r = place(dog)
  const [ex1, ey1] = at(dog, p.eyes[0])
  const [ex2, ey2] = at(dog, p.eyes[1])
  const pt = (f: [number, number]) => at(dog, f)
  const [hx, hy] = pt(p.hat)
  const [mx, my] = pt(p.mouth)
  const [nx, ny] = pt(p.neck)
  const [cx, cy] = pt(p.chest)
  const [px, py] = pt(p.paw)
  const [rx, ry] = pt(p.ear)
  return {
    hat: { x: hx, y: hy, w: p.hatW * r.w },
    eyes: { x: (ex1 + ex2) / 2, y: (ey1 + ey2) / 2, gap: ex2 - ex1 },
    mouth: { x: mx, y: my, w: (ex2 - ex1) * 1.1 },
    neck: { x: nx, y: ny, w: p.neckW * r.w },
    chest: { x: cx, y: cy },
    body: { x: nx, y: ny - 2, w: p.neckW * r.w * 1.35, h: (r.y + r.h - ny) * 0.95 },
    paw: { x: px, y: py, side: 1 },
    ear: { x: rx, y: ry },
  }
}
const GEO: Record<DogName, DogGeo> = { leo: geoFor('leo'), bonchita: geoFor('bonchita'), luna: geoFor('luna') }
/** Emoji fallback (souvenirs without `art` yet): anchor and font size per slot. */
const EMOJI_SIZE: Record<WearSlot, number> = { hat: 28, eyes: 16, neck: 18, mouth: 18, paw: 20 }
const emojiAnchor = (g: DogGeo, slot: WearSlot): [number, number] =>
  slot === 'hat' ? [g.hat.x, g.hat.y - 16] : slot === 'eyes' ? [g.eyes.x, g.eyes.y] : slot === 'neck' ? [g.neck.x, g.neck.y + 4] : slot === 'mouth' ? [g.mouth.x + 10, g.mouth.y] : [g.paw.x - 2 * g.paw.side, g.paw.y - 6]

/** The drawable item behind an outfit entry: a souvenir (with `art` once content is tagged) or a `wear-<kind>[-<colour>]` id. */
function wornItem(id: string): { kind?: ArtKind; color?: string; label: string; emoji?: string } | undefined {
  const sv = souvenirById(id)
  if (sv) return { ...souvenirArt(sv), label: sv.es, emoji: sv.emoji }
  const parsed = parseWearId(id)
  return parsed && { ...parsed, label: parsed.kind }
}

/** translate to an anchor, turn, scale (mirrored when flip=-1) and put the item's pivot (px,py in its 48-box) there. */
const fit = (ax: number, ay: number, s: number, px: number, py: number, rot = 0, flip = 1) => `translate(${ax} ${ay}) rotate(${rot}) scale(${s * flip} ${s}) translate(${-px} ${-py})`

/** One worn item, placed and scaled for this dog. Returns its layer (paint order) and drawing. */
function placeItem(dog: DogName, slot: WearSlot, kind: ArtKind, color: string | undefined): { layer: number; head: boolean; el: ReactNode } {
  const g = GEO[dog]
  const shape = (tf: string, worn = false) => (
    <g transform={tf}>
      <SouvenirShape kind={kind} color={color} worn={worn} />
    </g>
  )
  if (slot === 'hat') {
    const hf = HAT_FIT[kind]
    if (hf) return { layer: 5, head: true, el: shape(fit(g.hat.x, g.hat.y, g.hat.w / hf.w!, 24, hf.py, hf.rot)) }
    const ef = EYE_FIT[kind]
    // glasses or a mask pushed up on the head
    if (ef) return { layer: 5, head: true, el: shape(fit(g.hat.x, g.hat.y - 6, (g.eyes.gap / ef.gap!) * 0.92, 24, ef.py, -6)) }
    if (EAR_KINDS.has(kind)) return { layer: 5, head: true, el: shape(fit(g.ear.x, g.ear.y, (0.42 * g.hat.w) / 39, 24, 24, 28)) }
    return { layer: 5, head: true, el: shape(fit(g.hat.x, g.hat.y - 7, (0.62 * g.hat.w) / 36, 24, 42)) }
  }
  if (slot === 'eyes') {
    const ef = EYE_FIT[kind]
    if (ef) return { layer: 4, head: true, el: shape(fit(g.eyes.x, g.eyes.y, g.eyes.gap / ef.gap!, 24, ef.py)) }
    return { layer: 4, head: true, el: shape(fit(g.eyes.x, g.eyes.y, (g.eyes.gap * 1.5) / 36, 24, 24)) }
  }
  if (slot === 'mouth') return { layer: 3, head: true, el: shape(fit(g.mouth.x, g.mouth.y, g.mouth.w / 44, 24, 24, MOUTH_TURN[kind] ?? 0)) }
  if (slot === 'paw') {
    // held in the rig's front paws (DogRig draws the paws around it); tall things stand up from one paw
    const spread = g.neck.w * 0.32
    if (HIGH_KINDS.has(kind)) return { layer: 6, head: false, el: shape(fit(g.paw.x + spread, g.paw.y + 2, 1.7, 16, 44), true) }
    const s = (g.neck.w / 50) * (PAW_SIZE[kind] ?? 1)
    return { layer: 6, head: false, el: shape(fit(g.paw.x, g.paw.y - 4 * s, s, 24, 24)) }
  }
  // neck
  if (BODY_KINDS.has(kind)) return { layer: 0, head: false, el: shape(`translate(${g.body.x} ${g.body.y}) scale(${g.body.w / 40} ${g.body.h / 29}) translate(-24 -6)`, true) }
  const nf = NECK_FIT[kind]
  if (nf) return { layer: 1, head: false, el: shape(fit(g.neck.x, g.neck.y, g.neck.w / nf.w!, 24, nf.py), kind === 'lei') }
  if (kind === 'medal') return { layer: 1, head: false, el: shape(fit(g.neck.x, g.neck.y - 1, 0.5, 24, 3)) }
  // anything else hangs from a cord, like a camera round the neck
  const half = g.neck.w / 2 - 2
  const top = g.chest.y - 7
  return {
    layer: 1,
    head: false,
    el: (
      <g>
        <path d={`M${g.neck.x - half} ${g.neck.y - 1} Q${g.neck.x - half + 2} ${top + 2} ${g.neck.x - 3} ${top} M${g.neck.x + half} ${g.neck.y - 1} Q${g.neck.x + half - 2} ${top + 2} ${g.neck.x + 3} ${top}`} stroke="#5a3a2a" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {shape(fit(g.chest.x, g.chest.y, 0.42, 24, 24))}
      </g>
    ),
  }
}

/**
 * Drawn souvenirs worn in an outfit, fitted to the dog's head, eyes, neck, mouth and paw, split by
 * where they live in the rig: on the body (neck pieces), on the head (moving with it) or in front
 * (held in the paws).
 */
function wearParts(dog: DogName, outfit?: Outfit): { body?: ReactNode; head?: ReactNode; front?: ReactNode; holding?: boolean } | undefined {
  if (!outfit) return undefined
  const g = GEO[dog]
  // hats, glasses and mouth items follow the tilt of the painted head
  const t = headTilt(dog)
  const tiltTf = `rotate(${t.deg} ${t.cx} ${t.cy})`
  type Item = { slot: WearSlot; id: string; label: string; layer: number; head: boolean; el: ReactNode }
  const items = (Object.keys(outfit) as WearSlot[]).flatMap((slot): Item[] => {
    const id = outfit[slot as keyof Outfit]
    const it = id ? wornItem(id) : undefined
    if (!id || !it) return []
    if (!it.kind) {
      const [x, y] = emojiAnchor(g, slot)
      const el = (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={EMOJI_SIZE[slot]} style={{ filter: 'drop-shadow(0 1px 0.6px rgba(40,25,20,0.35))' }}>
          {it.emoji}
        </text>
      )
      return [{ slot, id, label: it.label, layer: 6, head: slot !== 'paw' && slot !== 'neck', el }]
    }
    return [{ slot, id, label: it.label, ...placeItem(dog, slot, it.kind, it.color) }]
  })
  items.sort((a, b) => a.layer - b.layer)
  const node = (list: Item[], tf?: string) =>
    list.length ? (
      <>
        {list.map((it) => (
          <g key={it.slot} data-wear={it.id} aria-label={it.label} transform={tf}>
            {it.el}
          </g>
        ))}
      </>
    ) : undefined
  return {
    body: node(items.filter((i) => i.slot === 'neck')),
    head: node(items.filter((i) => i.head && i.slot !== 'paw'), tiltTf),
    front: node(items.filter((i) => i.slot === 'paw')),
    holding: items.some((i) => i.slot === 'paw'),
  }
}

/** Leo: golden-tan Yorkie mix, long floppy ears with darker tips, fringe and beard, red harness with a blue tag. */
export function Leo({ size = 96, mood = 'happy', outfit, act, ...rest }: P) {
  return <DogFigure dog="leo" size={size} mood={mood} act={act} wear={wearParts('leo', outfit)} {...rest} />
}

/** Bonchita: small black scruffy dog with wiry fur, grey-white muzzle, big eyes under bushy brows, red harness. */
export function Bonchita({ size = 96, mood = 'happy', outfit, act, ...rest }: P) {
  return <DogFigure dog="bonchita" size={size} mood={mood} act={act} wear={wearParts('bonchita', outfit)} {...rest} />
}

/** Luna: cream curly powder-puff, dark button eyes, blue collar with a tag; she carries the map. */
export function Luna({ size = 96, mood = 'happy', outfit, act, ...rest }: P) {
  return <DogFigure dog="luna" size={size} mood={mood} act={act} wear={wearParts('luna', outfit)} {...rest} />
}

/** The three together, for welcome and celebration screens. */
export function DogsScene({ size = 220, mood = 'happy', className = '' }: { size?: number; mood?: Mood; className?: string }) {
  return (
    <div className={`relative mx-auto ${className}`} style={{ width: size }} aria-label="Leo, Bonchita and Luna" role="img">
      <DogsTrio size={size} pose={mood === 'sleepy' ? 'sleep' : mood === 'curious' ? 'wave' : 'celebrate'} />
    </div>
  )
}

const DOG_SVG: Record<DogName, (p: P) => React.ReactElement> = { leo: Leo, bonchita: Bonchita, luna: Luna }

/** A tappable dog: hops with joy and says a short line. Shows its outfit when given one. */
export function DogButton({ dog, size = 48, mood, act, outfit, className = '', onClick }: { dog: DogName; size?: number; mood?: Mood; act?: Act; outfit?: Outfit; className?: string; onClick?: () => void }) {
  const { say } = useSpeak()
  const [bounce, setBounce] = useState(false)
  const [line, setLine] = useState<string | undefined>()
  const Svg = DOG_SVG[dog]
  const tap = () => {
    const lines = DOG_LINES[dog]
    const l = lines[Math.floor(Math.random() * lines.length)]!
    setLine(l)
    setBounce(true)
    void say(l)
    setTimeout(() => setBounce(false), 1600)
    setTimeout(() => setLine(undefined), 1800)
    onClick?.()
  }
  return (
    <button type="button" onClick={tap} className={`relative inline-flex rounded-full ${className}`} aria-label={`${DOG_NAMES[dog]} says hello`}>
      <Svg size={size} mood={mood} outfit={outfit} act={bounce ? 'cheer' : act} />
      {line && (
        <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[10px] font-extrabold shadow-card" lang={TL} aria-live="polite">
          {line}
        </span>
      )}
    </button>
  )
}
