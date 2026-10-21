import { useEffect, useRef, useState } from 'react'
import type { WriteExercise } from '../../engine/types'
import type { StrokeAnswer } from '../../engine/grade'
import { SpeakerButton } from '../ui/basics'
import { Instruction, DogSays, type ExerciseProps } from './shared'
import { RiceGrid, StrokeOrder, StrokeSequence } from '../writing/hanzi'
import { useHanziWriter, useStrokeData } from '../writing/useHanzi'
import { calmMotion } from '../game/motion'

/** The writing box: as wide as a phone allows, up to 260px. */
function boxSize(): number {
  const w = typeof window !== 'undefined' ? window.innerWidth : 390
  return Math.max(200, Math.min(260, w - 120))
}

/**
 * Writing a character. Trace: watch the stroke order (replayable), then trace over a faint outline.
 * Write from memory (writeChar): hear it and read its meaning, then write it on an empty grid; after three
 * misses on a stroke the next stroke flashes as a hint. Submits by itself when the character is finished.
 */
export function Trace({ exercise, onChange, onSubmit, checked, result }: ExerciseProps<WriteExercise>) {
  const trace = exercise.kind === 'trace'
  const [phase, setPhase] = useState<'watch' | 'write'>(trace && !checked ? 'watch' : 'write')
  const [size] = useState(boxSize)
  const data = useStrokeData(exercise.char)
  const strokes = data?.strokes.length
  const finish = (value: StrokeAnswer) => {
    onChange(value)
    setTimeout(() => onSubmit(value), 450)
  }
  return (
    <div>
      <Instruction>{trace ? (phase === 'watch' ? 'Watch the stroke order' : 'Trace the character') : 'Write it from memory'}</Instruction>
      <DogSays
        seed={exercise.char}
        aside={
          <span className="flex flex-col gap-2">
            <SpeakerButton text={exercise.audio} size="sm" autoPlay={!trace} />
            <SpeakerButton text={exercise.audio} size="sm" slow />
          </span>
        }
      >
        <p className="text-[1.35rem] font-bold leading-snug" lang="en">{exercise.meaning || '…'}</p>
        <p className="mt-0.5 text-sm text-ink-2">
          {exercise.jp && <span className="font-mono font-semibold text-ink">{exercise.jp}</span>}
          {exercise.jp && strokes ? ' · ' : ''}
          {strokes ? `${strokes} stroke${strokes === 1 ? '' : 's'}` : ''}
        </p>
      </DogSays>
      {data === null ? (
        <p className="card text-center text-sm text-muted">No stroke data for {exercise.char}.</p>
      ) : phase === 'watch' ? (
        <div className="flex flex-col items-center gap-4">
          <StrokeOrder char={exercise.char} size={size} />
          {data && <StrokeSequence data={data} label={`Stroke order of ${exercise.char}`} />}
          <button type="button" className="btn btn-primary w-full" onClick={() => setPhase('write')}>
            Now trace it
          </button>
        </div>
      ) : (
        <WritingPad key={`${exercise.char}-${checked}`} exercise={exercise} size={size} strokes={strokes} checked={checked} wrong={result?.verdict === 'wrong'} onDone={finish} onWatch={trace && !checked ? () => setPhase('watch') : undefined} />
      )}
    </div>
  )
}

function WritingPad({ exercise, size, strokes, checked, wrong, onDone, onWatch }: { exercise: WriteExercise; size: number; strokes?: number; checked: boolean; wrong: boolean; onDone: (a: StrokeAnswer) => void; onWatch?: () => void }) {
  const trace = exercise.kind === 'trace'
  const ref = useRef<HTMLDivElement>(null)
  const padding = Math.round(size * 0.06)
  // after answering: the character in full (and, when it went wrong, its stroke order once more)
  const writer = useHanziWriter(ref, exercise.char, size, { showCharacter: checked && !wrong, showOutline: trace || checked, outlineWidth: 2 }, `pad-${checked}`)
  const [progress, setProgress] = useState({ done: 0, mistakes: 0, hints: 0 })
  const sent = useRef(false)
  const hints = useRef(0)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    if (!writer) return
    if (checked) {
      if (wrong && !calmMotion()) void writer.animateCharacter()
      else if (wrong) void writer.showCharacter()
      return
    }
    hints.current = 0
    void writer.quiz({
      showHintAfterMisses: 3,
      // never stuck: after enough misses the stroke is drawn for you (and counted as a hint)
      markStrokeCorrectAfterMisses: trace ? 5 : 6,
      leniency: trace ? 1.3 : 1.1,
      onMistake: (d) => setProgress((p) => ({ ...p, mistakes: d.totalMistakes })),
      onCorrectStroke: (d) => {
        if (d.mistakesOnStroke >= 3) hints.current++
        setProgress({ done: d.strokeNum + 1, mistakes: d.totalMistakes, hints: hints.current })
      },
      onComplete: ({ totalMistakes }) => {
        if (sent.current) return
        sent.current = true
        done.current({ mistakes: totalMistakes, hints: hints.current, strokes })
      },
    })
  }, [writer, checked, wrong, trace, strokes])
  const giveUp = () => {
    if (!writer || sent.current) return
    sent.current = true
    writer.cancelQuiz()
    const n = strokes ?? 1
    done.current({ mistakes: progress.mistakes, hints: n, strokes: n })
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative touch-none select-none rounded-lg bg-card shadow-card" style={{ width: size, height: size }}>
        <RiceGrid size={size} />
        <div ref={ref} className="relative" data-writer="pad" data-size={size} data-padding={padding} role="img" aria-label={checked ? `${exercise.char}, written` : trace ? `Trace ${exercise.char} here, stroke by stroke` : 'Write the character here, stroke by stroke'} />
      </div>
      {!checked && (
        <>
          <p className="text-sm text-ink-2" aria-live="polite">
            {strokes ? (
              <>
                Stroke <span className="font-mono font-semibold text-ink">{Math.min(progress.done + 1, strokes)}</span> of {strokes}
              </>
            ) : (
              'Write stroke by stroke'
            )}
            {progress.mistakes > 0 && <span> · {progress.mistakes} {progress.mistakes === 1 ? 'retry' : 'retries'}</span>}
          </p>
          {strokes && (
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: strokes }, (_, i) => (
                <span key={i} className={`h-1.5 w-5 rounded-full ${i < progress.done ? 'bg-ok-500' : 'bg-surface-2'}`} />
              ))}
            </div>
          )}
          <div className="flex gap-4 text-sm font-bold text-muted">
            {onWatch && (
              <button type="button" className="underline" onClick={onWatch}>
                Watch again
              </button>
            )}
            {!trace && (
              <button type="button" className="underline" onClick={giveUp}>
                I don't remember: show me
              </button>
            )}
          </div>
          {!trace && <p className="text-center text-xs text-muted">Stuck on a stroke? After three tries it lights up.</p>}
        </>
      )}
    </div>
  )
}
