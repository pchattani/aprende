import { Link } from 'react-router'
import type { Region } from '../../engine/journey'
import type { LevelMeta } from '../../engine/schema'
import { StopArt } from '../StopArt'
import { IconPaw } from '../ui/icons'
import { ChunkyBar } from './LegBar'

/**
 * A region's title card, like a game chapter: the painted landmark, the region name,
 * the CEFR level as a badge, the stamps collected and the region quiz.
 * The h2 is exactly the region name (e2e and screen readers rely on it).
 */
export function RegionChapter({ chapter, level, region, flag, recommended, doneCount, lessonTotal, stamps, quizOpen, quizBest, quizPass }: {
  chapter: number
  level: LevelMeta
  region?: Region
  flag: string
  recommended: boolean
  doneCount: number
  lessonTotal: number
  stamps: boolean[]
  quizOpen: boolean
  quizBest?: number
  quizPass: number
}) {
  const cover = region?.stops[0]
  const stamped = stamps.filter(Boolean).length
  const needed = Math.ceil(level.units.length / 2)
  return (
    <header className="wm-chapter">
      <div className="wm-chapter-art">
        {cover ? <StopArt stop={cover} level={level.id} progress={lessonTotal ? Math.max(0.2, doneCount / lessonTotal) : 0.2} quality="full" className="absolute inset-0 h-full w-full" /> : <div className="absolute inset-0" style={{ background: 'var(--lvl)' }} />}
        <span className="absolute left-3 top-3 z-[1] rounded-full bg-card/95 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink shadow-card">Chapter {chapter}</span>
        <span className="absolute right-3 top-2.5 z-[1] flex h-9 w-9 items-center justify-center rounded-full bg-card/95 text-[1.3rem] shadow-card" aria-hidden="true">{flag}</span>
        <div className="absolute inset-x-0 bottom-0 z-[1] flex items-end gap-3 px-4 pb-3.5 text-white">
          <span className="wm-level-badge shrink-0">
            <span className="font-mono text-[9px] font-bold tracking-[0.18em] opacity-80">LEVEL</span>
            <span className="font-display text-[1.6rem] leading-none">{level.title}</span>
          </span>
          <div className="min-w-0 pb-0.5">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-white/85">{level.name}</p>
            <h2 className="text-[1.9rem] leading-none text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.35)]">{region?.name ?? level.title}</h2>
            {region && <p className="font-hand text-xl leading-tight text-white/90">{region.es}</p>}
          </div>
        </div>
      </div>
      <div className="relative p-4">
        {recommended && <span className="inkstamp absolute -top-4 right-3 z-[2] bg-card px-2.5 py-0.5 text-[11px]" style={{ color: 'var(--lvl)' }}>Recommended start</span>}
        <p className={`text-sm leading-snug text-ink-2 ${recommended ? 'pt-2' : ''}`}>{level.description}</p>
        {lessonTotal > 0 && (
          <>
            <div className="mt-3.5 flex items-center justify-between">
              <p className="eyebrow">Stamps</p>
              <span className="font-mono text-xs text-ink-2"><span className="text-ink">{stamped}</span>/{stamps.length}</span>
            </div>
            <div className="mt-1.5 flex justify-between gap-1" aria-label={`${stamped} of ${stamps.length} stamps`} role="img">
              {stamps.map((on, i) => (
                <span key={i} className={`wm-stampslot ${on ? 'is-on' : ''}`}>{on && <IconPaw width={12} height={12} />}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <ChunkyBar value={doneCount} max={lessonTotal} className="flex-1" label="Lessons done in this region" />
              <span className="font-mono text-xs text-ink-2"><span className="text-ink">{doneCount}</span>/{lessonTotal} lessons</span>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
              {quizOpen ? (
                <Link to={`/quiz/${level.id}`} className="g-btn is-ghost px-3.5 py-2 text-xs">Region quiz</Link>
              ) : (
                <span className="rounded-full border border-dashed border-line px-3 py-1 text-ink-2">Region quiz opens at <span className="font-mono">{needed}</span> stamps · <span className="font-mono">{stamped}</span> so far</span>
              )}
              {quizBest !== undefined && <span className="text-ink-2">Best <span className="font-mono text-ink">{Math.round(quizBest * 100)}%</span>{quizBest >= quizPass ? ' · badge earned' : ''}</span>}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
