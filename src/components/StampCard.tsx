import { Link } from 'react-router'
import type { Region, Stop } from '../engine/journey'
import { Leo, Bonchita, Luna } from './ui/Dogs'
import { SpeakerButton } from './ui/basics'
import { TL } from '../engine/course'
import { ui } from '../engine/loader'
import { TargetText } from './ui/TargetText'
import { StopArt } from './StopArt'

/**
 * A stop's card: the stop, the dogs and a bilingual fact about the place. `earned` false shows the
 * same fact for a stop not stamped yet, with a link to its lessons.
 */
export function StampCard({ stop, region, compact = false, earned = true, onClose }: { stop: Stop; region: Region; compact?: boolean; earned?: boolean; onClose?: () => void }) {
  return (
    <div className={`lvl-${region.level} animate-pop rounded-2xl border border-line bg-card p-4 text-left shadow-card ${compact ? '' : 'w-full'}`} role="group" aria-label={`${earned ? 'Stamp earned' : 'Not stamped yet'}: ${stop.name}`}>
      <div className="flex items-center gap-3">
        <span className={`stamp w-16 shrink-0 rotate-[-6deg] ${earned ? '' : 'opacity-60 grayscale'}`} aria-hidden="true"><StopArt stop={stop} level={region.level} className="aspect-square w-full" /></span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow" style={{ color: 'var(--lvl)' }}>{earned ? `${ui.stampEarned} · Stamp earned` : 'Not stamped yet'}</p>
          <p className="font-display text-xl leading-tight">{stop.name}</p>
          <p className="text-xs font-semibold text-muted">{region.name} · {stop.es}</p>
        </div>
        <div className="flex shrink-0 -space-x-2" aria-hidden="true"><Leo size={32} mood="curious" /><Bonchita size={32} /><Luna size={32} /></div>
      </div>
      {stop.fact ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-line p-3">
          <SpeakerButton text={stop.fact.es} size="sm" className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold leading-snug" lang={TL}><TargetText text={stop.fact.es} /></p>
            <p className="mt-1 text-sm leading-snug text-muted" lang="en">{stop.fact.en}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{stop.en}</p>
      )}
      {!earned && (
        <Link to="/" state={{ from: `unit-${stop.unitId}` }} className="btn btn-primary mt-3 w-full py-2 text-sm">Go to this stop</Link>
      )}
      {onClose && (
        <button type="button" className="btn btn-ghost mt-3 w-full py-2 text-sm" onClick={onClose}>Close</button>
      )}
    </div>
  )
}
