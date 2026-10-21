/**
 * Writing characters with hanzi-writer: the stroke data comes from the course bundle (engine/strokes.ts),
 * colours from the theme's CSS variables (re-read when the theme changes), on a rice-paper grid.
 * StrokeOrder is the animated demo with a replay button; StrokeSequence the static stroke-order chart
 * shown beside it (and instead of the autoplay under reduced motion).
 */
import { useEffect, useRef, useState } from 'react'
import type HanziWriter from 'hanzi-writer'
import type { StrokeData } from '../../engine/strokes'
import { calmMotion } from '../game/motion'
import { IconReplay } from '../ui/icons'
import { useHanziWriter } from './useHanzi'

/** The faint 米 grid of practice paper, behind the writing box. */
export function RiceGrid({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="pointer-events-none absolute inset-0" aria-hidden="true">
      <rect x="1" y="1" width="98" height="98" rx="6" fill="none" style={{ stroke: 'var(--line-strong)' }} strokeWidth="1.2" />
      <path d="M50 2V98M2 50H98M3 3L97 97M97 3L3 97" fill="none" style={{ stroke: 'var(--line)' }} strokeWidth="0.8" strokeDasharray="3 3" />
    </svg>
  )
}

/** The stroke-order chart: the character built up stroke by stroke, the new stroke in red. */
export function StrokeSequence({ data, size = 38, label }: { data: StrokeData; size?: number; label?: string }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={label ?? `Stroke order, ${data.strokes.length} strokes`}>
      {data.strokes.map((_, i) => (
        <li key={i} className="relative rounded-md border border-line bg-card" style={{ width: size, height: size }}>
          <svg viewBox="0 0 1024 1024" width={size} height={size} aria-hidden="true">
            <g transform="translate(0, 900) scale(1, -1)">
              {data.strokes.slice(0, i + 1).map((d, k) => (
                <path key={k} d={d} style={{ fill: k === i ? 'var(--red)' : 'var(--ink)', opacity: k === i ? 1 : 0.55 }} />
              ))}
            </g>
          </svg>
          <span className="absolute bottom-0 right-0.5 font-mono text-[8px] leading-none text-ink-2">{i + 1}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The animated stroke-order demo with a replay button. It plays on its own unless the learner prefers
 * reduced motion (or the runner is calm): then the full character shows and plays only on request.
 */
export function StrokeOrder({ char, size = 200, autoPlay = true, onDone, className = '' }: { char: string; size?: number; autoPlay?: boolean; onDone?: () => void; className?: string }) {
  const small = size < 150
  const ref = useRef<HTMLDivElement>(null)
  const [calm] = useState(calmMotion)
  const play = autoPlay && !calm
  const writer = useHanziWriter(ref, char, size, { showCharacter: !play, showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 280 }, 'demo')
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  const [playing, setPlaying] = useState(play)
  const [played, setPlayed] = useState(play)
  const animate = (w: HanziWriter) =>
    void w.animateCharacter({
      onComplete: () => {
        setPlaying(false)
        done.current?.()
      },
    })
  useEffect(() => {
    if (writer && play) animate(writer)
  }, [writer, play])
  const replay = () => {
    if (!writer) return
    setPlaying(true)
    setPlayed(true)
    void writer.hideCharacter()
    animate(writer)
  }
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <RiceGrid size={size} />
        <div ref={ref} className="relative" data-writer="demo" aria-label={`How to write ${char}`} role="img" />
      </div>
      <button type="button" onClick={replay} disabled={!writer || playing} className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-card font-bold text-ink shadow-card transition active:scale-95 disabled:opacity-50 ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`} aria-label={`${played ? 'Replay' : 'Play'} the strokes of ${char}`}>
        <IconReplay width={small ? 14 : 16} height={small ? 14 : 16} /> {playing ? 'Watching…' : played ? 'Replay' : small ? 'Play' : 'Play the strokes'}
      </button>
    </div>
  )
}
