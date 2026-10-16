/**
 * Leo, Bonchita and Luna, the three travelling dogs, painted in a gouache storybook
 * style (see components/art). Pure inline SVG so they work offline and scale crisply.
 */
import { useState, type SVGProps } from 'react'
import { souvenirById, type WearSlot } from '../../engine/journey'
import type { Outfit, DogName } from '../../hooks/useOutfits'
import { useSpeak } from '../../hooks/useSpeak'
import { DOG_NAMES, DOG_LINES } from '../../engine/dogs'
import { TL } from '../../engine/course'
import { DogFigure } from '../art/DogFigure'
import { DogsTrio } from '../art/DogsTrio'

export { DogStamp } from '../art/DogStamp'
export { DogsTrio } from '../art/DogsTrio'

type Mood = 'happy' | 'curious' | 'sleepy'
type P = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number; mood?: Mood; outfit?: Outfit }

/** Where each wearable sits on each dog, in the 120×120 viewBox. */
const ANCHORS: Record<DogName, Record<WearSlot, [number, number]>> = {
  leo: { hat: [60, 20], neck: [60, 80], mouth: [70, 63], paw: [84, 106] },
  bonchita: { hat: [60, 22], neck: [60, 84], mouth: [70, 64], paw: [84, 106] },
  luna: { hat: [60, 17], neck: [60, 76], mouth: [70, 62], paw: [46, 106] },
}
const WEAR_SIZE: Record<WearSlot, number> = { hat: 28, neck: 18, mouth: 18, paw: 20 }

/** Emoji overlays for an outfit; rendered last so they sit on top of the drawing. */
function Wearables({ dog, outfit }: { dog: DogName; outfit?: Outfit }) {
  if (!outfit) return null
  return (
    <>
      {(Object.keys(outfit) as WearSlot[]).map((slot) => {
        const sv = outfit[slot] ? souvenirById(outfit[slot]!) : undefined
        if (!sv) return null
        const [x, y] = ANCHORS[dog][slot]
        return (
          <text key={slot} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={WEAR_SIZE[slot]} data-wear={sv.id} aria-label={sv.es} style={{ filter: 'drop-shadow(0 1px 0.6px rgba(40,25,20,0.35))' }}>
            {sv.emoji}
          </text>
        )
      })}
    </>
  )
}

/** Leo: golden-tan Yorkie mix, long floppy ears with darker tips, fringe and beard, red harness with a blue tag. */
export function Leo({ size = 96, mood = 'happy', outfit, ...rest }: P) {
  return <DogFigure dog="leo" size={size} mood={mood} overlay={<Wearables dog="leo" outfit={outfit} />} {...rest} />
}

/** Bonchita: small black scruffy dog with wiry fur, grey-white muzzle, big eyes under bushy brows, red harness. */
export function Bonchita({ size = 96, mood = 'happy', outfit, ...rest }: P) {
  return <DogFigure dog="bonchita" size={size} mood={mood} overlay={<Wearables dog="bonchita" outfit={outfit} />} {...rest} />
}

/** Luna: cream curly powder-puff, dark button eyes, blue collar with a tag; she carries the map. */
export function Luna({ size = 96, mood = 'happy', outfit, ...rest }: P) {
  return <DogFigure dog="luna" size={size} mood={mood} overlay={<Wearables dog="luna" outfit={outfit} />} {...rest} />
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
