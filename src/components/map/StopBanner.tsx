import type { Stop } from '../../engine/journey'
import type { LevelId } from '../../engine/schema'
import { StopArt } from '../StopArt'
import { Chip } from '../ui/basics'
import { ChunkyBar } from './LegBar'

/**
 * The sign at each stop on the road: the stop's painted postcard, its name and the
 * unit, and how many lessons are done. Tapping it opens the stop's passport stamp.
 * The heading is the unit title (stop names stay out of headings: some contain a region's name).
 */
export function StopBanner({ index, unitTitle, subtitle, stop, level, authored, lessonsDone, lessonsTotal, stamped, fade, highlight, onOpen }: {
  index: number
  unitTitle: string
  subtitle?: string
  stop?: Stop
  level: LevelId
  authored: boolean
  lessonsDone: number
  lessonsTotal: number
  stamped: boolean
  fade: number
  highlight: boolean
  onOpen?: () => void
}) {
  return (
    <div className={`wm-banner ${stamped ? 'is-done' : ''}`}>
      <div className={`wm-banner-card ${highlight ? 'wm-highlight' : ''}`}>
        {stop && onOpen && <button type="button" onClick={onOpen} className="absolute inset-0 z-[2] rounded-[20px]" aria-label={`Postcard from ${stop.name}${stamped ? ': stamped' : ''}`} />}
        <div className="pointer-events-none relative flex items-center gap-3.5 px-3.5 pb-3.5 pt-4">
          {stop && (
            <span className="wm-postcard" aria-hidden="true">
              <StopArt stop={stop} level={level} progress={authored ? lessonsDone / Math.max(1, lessonsTotal) : 0} fade={fade} className="aspect-[4/3] w-full rounded-[1px]" />
              {stamped && <span className="inkstamp absolute -bottom-2.5 -right-4 bg-card/0 px-1.5 py-0 text-[10px]" style={{ color: 'var(--lvl)' }}>Stamped</span>}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="eyebrow truncate" style={{ color: 'var(--lvl)' }}>Stop {index + 1} · {stop?.name ?? `Unit ${index + 1}`}</p>
            <h3 className="mt-0.5 font-display text-[1.15rem] leading-[1.15]">{unitTitle}</h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-ink-2">{subtitle}{stop ? <>{subtitle ? ' · ' : ''}<span className="font-hand text-[0.95rem]">{stop.es}</span></> : ''}</p>
            {authored ? (
              <div className="mt-2 flex items-center gap-2">
                <ChunkyBar value={lessonsDone} max={lessonsTotal} className="flex-1" />
                <span className="font-mono text-xs text-ink-2"><span className="text-ink">{lessonsDone}</span>/{lessonsTotal}</span>
              </div>
            ) : (
              <p className="mt-2"><Chip>Coming soon</Chip></p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
