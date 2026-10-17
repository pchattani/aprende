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
import { HEAD_TILT, HEAD_PIVOT } from '../art/dogPose'
import { SouvenirShape } from '../art/SouvenirArt'
import { souvenirArt, parseWearId, HAT_FIT, EYE_FIT, NECK_FIT, BODY_KINDS, HIGH_KINDS, EAR_KINDS, MOUTH_TURN, PAW_SIZE } from '../art/souvenirKinds'

export { DogStamp } from '../art/DogStamp'
export { DogsTrio } from '../art/DogsTrio'

type Mood = 'happy' | 'curious' | 'sleepy'
type P = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number; mood?: Mood; outfit?: Outfit }

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
const GEO: Record<DogName, DogGeo> = {
  leo: { hat: { x: 60, y: 37, w: 36 }, eyes: { x: 60, y: 46.6, gap: 17.6 }, mouth: { x: 60, y: 63, w: 20 }, neck: { x: 60, y: 76, w: 36 }, chest: { x: 60, y: 93 }, body: { x: 60, y: 73, w: 46, h: 30 }, paw: { x: 94, y: 112, side: 1 }, ear: { x: 77, y: 31 } },
  bonchita: { hat: { x: 60, y: 43, w: 40 }, eyes: { x: 60, y: 52.4, gap: 19 }, mouth: { x: 60, y: 70, w: 24 }, neck: { x: 60, y: 84, w: 40 }, chest: { x: 60, y: 99 }, body: { x: 60, y: 83, w: 50, h: 24 }, paw: { x: 93, y: 112, side: 1 }, ear: { x: 79, y: 38 } },
  luna: { hat: { x: 66, y: 33, w: 37 }, eyes: { x: 66, y: 40.4, gap: 15.4 }, mouth: { x: 66, y: 54, w: 18 }, neck: { x: 66, y: 59, w: 27 }, chest: { x: 66, y: 71 }, body: { x: 65, y: 58, w: 38, h: 24 }, paw: { x: 90, y: 112, side: 1 }, ear: { x: 82, y: 26 } },
}
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
function placeItem(dog: DogName, slot: WearSlot, kind: ArtKind, color: string | undefined, mood: Mood): { layer: number; head: boolean; el: ReactNode } {
  const g = GEO[dog]
  const shape = (tf: string, worn = false) => (
    <g transform={tf}>
      <SouvenirShape kind={kind} color={color} worn={worn} />
    </g>
  )
  void mood
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
    if (HIGH_KINDS.has(kind)) return { layer: 2, head: false, el: shape(fit(g.paw.x - 2 * g.paw.side, g.paw.y - 8, 1.9, 16, 44, 0, g.paw.side), true) }
    return { layer: 2, head: false, el: shape(fit(g.paw.x, g.paw.y, 0.56 * (PAW_SIZE[kind] ?? 1), 24, 44)) }
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

/** Drawn souvenirs worn in an outfit, fitted to the dog's head, eyes, neck, mouth and paw. */
function Wearables({ dog, outfit, mood }: { dog: DogName; outfit?: Outfit; mood: Mood }) {
  if (!outfit) return null
  const g = GEO[dog]
  const [px, py] = HEAD_PIVOT[dog]
  const headTf = `rotate(${HEAD_TILT[dog][mood]} ${px} ${py})`
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
    return [{ slot, id, label: it.label, ...placeItem(dog, slot, it.kind, it.color, mood) }]
  })
  items.sort((a, b) => a.layer - b.layer)
  return (
    <>
      {items.map((it) => (
        <g key={it.slot} data-wear={it.id} aria-label={it.label} transform={it.head ? headTf : undefined}>
          {it.el}
        </g>
      ))}
    </>
  )
}

/** Leo: golden-tan Yorkie mix, long floppy ears with darker tips, fringe and beard, red harness with a blue tag. */
export function Leo({ size = 96, mood = 'happy', outfit, ...rest }: P) {
  return <DogFigure dog="leo" size={size} mood={mood} overlay={<Wearables dog="leo" outfit={outfit} mood={mood} />} {...rest} />
}

/** Bonchita: small black scruffy dog with wiry fur, grey-white muzzle, big eyes under bushy brows, red harness. */
export function Bonchita({ size = 96, mood = 'happy', outfit, ...rest }: P) {
  return <DogFigure dog="bonchita" size={size} mood={mood} overlay={<Wearables dog="bonchita" outfit={outfit} mood={mood} />} {...rest} />
}

/** Luna: cream curly powder-puff, dark button eyes, blue collar with a tag; she carries the map. */
export function Luna({ size = 96, mood = 'happy', outfit, ...rest }: P) {
  return <DogFigure dog="luna" size={size} mood={mood} overlay={<Wearables dog="luna" outfit={outfit} mood={mood} />} {...rest} />
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

/** A tappable dog: bounces and says a short line. Shows its outfit when given one. */
export function DogButton({ dog, size = 48, mood, outfit, className = '', onClick }: { dog: DogName; size?: number; mood?: Mood; outfit?: Outfit; className?: string; onClick?: () => void }) {
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
    setTimeout(() => setBounce(false), 450)
    setTimeout(() => setLine(undefined), 1800)
    onClick?.()
  }
  return (
    <button type="button" onClick={tap} className={`relative inline-flex rounded-full ${className}`} aria-label={`${DOG_NAMES[dog]} says hello`}>
      <Svg size={size} mood={mood} outfit={outfit} className={bounce ? 'animate-pop' : ''} />
      {line && (
        <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[10px] font-extrabold shadow-card" lang={TL} aria-live="polite">
          {line}
        </span>
      )}
    </button>
  )
}
