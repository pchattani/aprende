/**
 * The tailwind combo: a meter in the lesson header that picks up speed as answers come in a row
 * (a breeze, then a gale with a paper plane, then a jet stream with a flaming trail), and a banner
 * that drops in at 3, 5 and 10 in a row.
 */
import { ui } from '../../engine/loader'
import { TargetText } from '../ui/TargetText'
import { IconWind } from '../ui/icons'
import { comboTier } from './reaction'
import { PaperPlane as Plane } from './PaperPlane'
import type { DogId } from '../art/dogRegistry'
import { Leo, Bonchita, Luna } from '../ui/Dogs'

const FIGURE = { leo: Leo, bonchita: Bonchita, luna: Luna } as const

/** Gust lines streaming past, faster with each tier, and a flaming trail at the top tier. */
function Gusts({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <span className="combo-gusts" style={{ '--gust-speed': `${tier === 3 ? 520 : tier === 2 ? 720 : 1000}ms` } as React.CSSProperties} aria-hidden="true">
      <i style={{ top: '22%', width: 12, animationDelay: '0ms' }} />
      <i style={{ top: '52%', width: 16, animationDelay: '-330ms' }} />
      {tier >= 2 && <i style={{ top: '78%', width: 10, animationDelay: '-640ms' }} />}
      {tier === 3 && (
        <span className="combo-flames">
          <b style={{ animationDelay: '0ms' }} />
          <b style={{ animationDelay: '-160ms' }} />
          <b style={{ animationDelay: '-80ms' }} />
        </span>
      )}
      <Plane className="combo-plane" />
    </span>
  )
}

export function ComboMeter({ streak }: { streak: number }) {
  const tier = comboTier(streak)
  return (
    <span className={`combo-meter combo-t${tier}`} aria-label={`Tailwind: ${streak} in a row`} title="Tailwind: answers in a row" role="img">
      {tier === 0 ? <IconWind width={17} height={17} aria-hidden="true" /> : <Gusts tier={tier} />}
      <span key={streak} className={`font-mono text-[0.82rem] font-bold tabular-nums ${streak > 0 ? 'animate-count' : ''}`} aria-hidden="true">
        ×{streak}
      </span>
    </span>
  )
}

/** The streak banner: a torn airmail ticket that drops in under the header and blows away. */
export function ComboBanner({ n, dog }: { n: number; dog?: DogId }) {
  const tier = comboTier(n)
  const Dog = dog ? FIGURE[dog] : undefined
  const title = ui.game.combo[tier >= 3 ? 2 : tier === 2 ? 1 : 0]!
  const count = ui.game.inARow.replace('{n}', String(n))
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(3.6rem+env(safe-area-inset-top))] z-30 flex justify-center px-4" aria-live="polite">
      <div className={`combo-banner combo-banner-t${tier} ${Dog ? 'flex items-center gap-2 !pl-2 text-left' : ''}`}>
        <span className="combo-banner-gust" style={{ top: '18%' }} aria-hidden="true" />
        <span className="combo-banner-gust" style={{ top: '64%', animationDelay: '120ms' }} aria-hidden="true" />
        <span className="combo-banner-plane" aria-hidden="true">
          <Plane className="h-5 w-5" />
        </span>
        {Dog && (
          <span className="combo-banner-dog relative -my-2 shrink-0" aria-hidden="true">
            <Dog size={62} act="cheer" />
          </span>
        )}
        <div className="relative">
          <p className="font-hand text-[2.1rem] font-bold leading-none">
            <TargetText text={title} />
          </p>
          <p className="combo-banner-count">
            <TargetText text={count} />
            <span className="sr-only"> ({n} in a row)</span>
          </p>
        </div>
      </div>
    </div>
  )
}
