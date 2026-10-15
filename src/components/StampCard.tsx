import type { Region, Stop } from '../engine/journey'
import { Leo, Bonchita, Luna } from './ui/Dogs'
import { SpeakerButton } from './ui/basics'
import { TL } from '../engine/course'
import { ui } from '../engine/loader'
import { TargetText } from './ui/TargetText'

/** "Stamp earned" card: the stop, the dogs and a bilingual fact about the place. */
export function StampCard({ stop, region, compact = false, onClose }: { stop: Stop; region: Region; compact?: boolean; onClose?: () => void }) {
  return (
    <div className={`animate-pop rounded-3xl bg-brand-100 p-4 text-left dark:bg-brand-500/15 ${compact ? '' : 'w-full'}`} role="group" aria-label={`Stamp earned: ${stop.name}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 rotate-[-6deg] items-center justify-center rounded-2xl border-[3px] border-brand-500 bg-white text-3xl shadow-sm dark:bg-black/20" aria-hidden="true">{stop.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand-600">{ui.stampEarned} · Stamp earned</p>
          <p className="text-lg font-extrabold leading-tight">{stop.name}</p>
          <p className="text-xs font-semibold text-muted">{region.name} · {stop.es}</p>
        </div>
        <div className="flex shrink-0 -space-x-2" aria-hidden="true"><Leo size={32} mood="curious" /><Bonchita size={32} /><Luna size={32} /></div>
      </div>
      {stop.fact ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white/80 p-3 dark:bg-black/20">
          <SpeakerButton text={stop.fact.es} size="sm" className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold leading-snug" lang={TL}><TargetText text={stop.fact.es} /></p>
            <p className="mt-1 text-sm leading-snug text-muted" lang="en">{stop.fact.en}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{stop.en}</p>
      )}
      {onClose && (
        <button type="button" className="btn btn-ghost mt-3 w-full py-2 text-sm" onClick={onClose}>Close</button>
      )}
    </div>
  )
}
