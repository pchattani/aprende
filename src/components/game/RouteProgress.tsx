/**
 * Lesson progress as a leg of the journey: a dotted route that fills with ink, a paper plane riding
 * it, a halfway post, and a pulse (with a word from the dogs) at halfway and at the last question.
 * Movement is transform-only (scaleX on the ink, translateX on the plane).
 */
import { useEffect, useRef, useState } from 'react'
import { ui } from '../../engine/loader'
import { TargetText } from '../ui/TargetText'
import { PaperPlane } from './PaperPlane'

type Milestone = 'halfway' | 'last'

export function RouteProgress({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)))
  const prev = useRef(value)
  const [milestone, setMilestone] = useState<{ kind: Milestone; at: number } | undefined>()
  useEffect(() => {
    const before = prev.current
    prev.current = value
    if (value <= before || max < 4) return
    const kind: Milestone | undefined = value === max - 1 ? 'last' : before < max / 2 && value >= max / 2 ? 'halfway' : undefined
    if (!kind) return
    setMilestone({ kind, at: value })
    const t = setTimeout(() => setMilestone(undefined), 1700)
    return () => clearTimeout(t)
  }, [value, max])
  const passedHalf = value >= max / 2
  const last = max > 1 && value === max - 1
  return (
    <div className="route relative h-7 flex-1" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dotted border-line" />
      <span className="route-ink absolute inset-x-0 top-1/2 -mt-[2px] h-1 origin-left rounded-full bg-ink" style={{ transform: `scaleX(${pct})` }} />
      {/* halfway post */}
      <span className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-300 ${passedHalf ? 'border-ink bg-sun' : 'border-line bg-paper'}`} aria-hidden="true" />
      {/* destination */}
      <span className={`absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-ink ${last ? 'bg-red' : 'bg-paper'}`} aria-hidden="true">
        {last && <span className="route-ping absolute -inset-[3px] rounded-full border-2 border-red" />}
      </span>
      <span className="route-rider pointer-events-none absolute inset-0" style={{ transform: `translateX(calc(${pct} * (100% - 1.75rem)))` }} aria-hidden="true">
        <span className="absolute left-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center">
          {milestone && <span key={milestone.at} className="route-ping absolute inset-0 rounded-full bg-red/40" />}
          <span key={value} className="route-plane flex h-7 w-7 items-center justify-center rounded-full bg-red text-white shadow-card">
            <PaperPlane size={16} />
          </span>
          {milestone && (
            <span key={`l${milestone.at}`} className="route-note absolute left-1/2 top-[calc(100%+3px)] whitespace-nowrap font-hand text-lg font-bold leading-none text-red">
              <TargetText text={milestone.kind === 'last' ? ui.game.lastOne : ui.game.halfway} />
            </span>
          )}
        </span>
      </span>
    </div>
  )
}
