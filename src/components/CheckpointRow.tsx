import { Link } from 'react-router'
import { useKvValue } from '../hooks/useProgress'
import type { CheckpointRecord } from '../engine/checkpoint'
import { IconCheck } from './ui/icons'

/**
 * The checkpoint quiz of a stop as one more leg on the itinerary, after the stop's lessons.
 * Styled like a lesson row: mono index column, title, small status.
 */
export function CheckpointRow({ unitId, stopName, lessonsDone, lessonsTotal }: { unitId: string; stopName: string; lessonsDone: number; lessonsTotal: number }) {
  const record = useKvValue<CheckpointRecord | undefined>(`checkpoint:${unitId}`, undefined)
  const cleared = Boolean(record && record.passes > 0)
  const ready = lessonsDone >= lessonsTotal
  const best = record ? `${Math.round(record.best * 100)}%` : ''
  const status = cleared ? `Cleared · ${best}` : ready ? (record ? `Ready · best ${best}` : 'Ready') : `Recommended after the ${lessonsTotal} lessons`
  return (
    <li id={`checkpoint-${unitId}`} className="relative mr-9 rounded-xl">
      <span className={`absolute -left-[1.86rem] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-2 ${cleared ? '' : 'bg-paper'}`} style={{ borderColor: 'var(--lvl)', background: cleared ? 'var(--lvl)' : undefined }} aria-hidden="true" />
      <Link to={`/checkpoint/${unitId}`} className="flex items-center gap-3 rounded-xl border border-dashed border-line px-2 py-2 transition hover:bg-card active:scale-[0.99]" aria-label={`Checkpoint · ${stopName}: ${status}`}>
        <span className="w-5 shrink-0 font-mono text-[10px] font-semibold tracking-wider" style={{ color: 'var(--lvl)' }}>CP</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${ready && !cleared ? 'font-semibold' : ''}`}>Checkpoint · {stopName}</span>
          <span className="mt-0.5 block text-[11px] text-ink-2">{status}</span>
        </span>
        {cleared ? <IconCheck width={16} height={16} className="text-ok-500" /> : <span className="text-ink-2" aria-hidden="true">›</span>}
      </Link>
    </li>
  )
}
