/**
 * "Leg N · lesson title": a boarding-pass card with the three dogs, shown for about a second as a
 * lesson starts. It never blocks: it ignores pointer events (the first exercise is already live
 * underneath), and any tap or key press sends it away early.
 */
import { useEffect, useState } from 'react'
import { ui } from '../../engine/loader'
import { Leo, Bonchita, Luna } from '../ui/Dogs'
import { TargetText } from '../ui/TargetText'

export function StartSplash({ leg, title, unit, onDone }: { leg?: number; title: string; unit?: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const away = () => setLeaving(true)
    const t = setTimeout(away, 1050)
    window.addEventListener('pointerdown', away, { capture: true, passive: true })
    window.addEventListener('keydown', away, { capture: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', away, { capture: true })
      window.removeEventListener('keydown', away, { capture: true })
    }
  }, [])
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(onDone, 300)
    return () => clearTimeout(t)
  }, [leaving, onDone])
  return (
    <div className={`splash pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-6 ${leaving ? 'splash-out' : ''}`} aria-hidden="true">
      <div className="splash-wash absolute inset-0" />
      <div className="splash-card relative w-full max-w-[19rem]">
        {/* the three dogs stand on the top edge of the pass and wave you aboard */}
        <div className="relative z-10 mx-auto -mb-5 flex items-end justify-center">
          <span className="splash-stamp" style={{ '--r': '-4deg', '--d': '60ms' } as React.CSSProperties}>
            <Leo size={82} act="wave" />
          </span>
          <span className="splash-stamp -mx-3" style={{ '--r': '0deg', '--d': '140ms' } as React.CSSProperties}>
            <Luna size={92} act="wave" />
          </span>
          <span className="splash-stamp" style={{ '--r': '4deg', '--d': '220ms' } as React.CSSProperties}>
            <Bonchita size={82} act="wave" />
          </span>
        </div>
        <div className="card airmail-edge relative overflow-hidden px-5 pb-4 pt-8 text-center">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.22em] text-red">{leg ? `Leg ${leg}` : 'Next leg'}</p>
          <p className="mt-1 font-display text-[1.6rem] leading-[1.08]">
            <TargetText text={title} />
          </p>
          {unit && (
            <p className="mt-1 truncate text-sm text-ink-2">
              <TargetText text={unit} />
            </p>
          )}
          <div className="mx-auto my-3 w-full border-t-2 border-dashed border-line" />
          <p className="splash-go font-hand text-[1.9rem] leading-none text-blue">
            <TargetText text={ui.game.letsGo} />
          </p>
        </div>
      </div>
    </div>
  )
}
