import { useMemo } from 'react'
import type { WordBankExercise } from '../../engine/types'
import { SpeakerButton } from '../ui/basics'
import { Instruction, Prompt, type ExerciseProps } from './shared'

export function WordBank({ exercise, value, onChange, checked }: ExerciseProps<WordBankExercise>) {
  const chosen = Array.isArray(value) ? (value as string[]) : []
  // tiles are identified by index so duplicates work
  const tiles = useMemo(() => exercise.tiles.map((t, i) => ({ t, i })), [exercise.tiles])
  const usedIdx = new Set<number>()
  const chosenIdx: number[] = []
  for (const w of chosen) {
    const t = tiles.find((x) => x.t === w && !usedIdx.has(x.i))
    if (t) {
      usedIdx.add(t.i)
      chosenIdx.push(t.i)
    }
  }
  const add = (i: number) => {
    if (checked || usedIdx.has(i)) return
    onChange([...chosen, tiles[i]!.t])
  }
  const remove = (pos: number) => {
    if (checked) return
    const next = [...chosen]
    next.splice(pos, 1)
    onChange(next.length ? next : undefined)
  }
  return (
    <div>
      <Instruction>{exercise.kind === 'order' ? 'Put the words in order' : 'Write this in Spanish'}</Instruction>
      <div className="mb-4 flex items-center gap-3">
        {exercise.kind === 'order' && exercise.answers[0] && <SpeakerButton text={exercise.answers[0]} size="sm" />}
        <Prompt lang={exercise.kind === 'order' ? 'es' : 'en'}>{exercise.kind === 'order' ? exercise.translation ?? '' : exercise.prompt}</Prompt>
      </div>
      <div className="mb-4 min-h-[3.5rem] rounded-2xl border-b-2 border-dashed border-line px-1 py-2" aria-label="Your answer" lang="es">
        <div className="flex flex-wrap gap-2">
          {chosen.map((w, pos) => (
            <button key={pos} type="button" onClick={() => remove(pos)} className="tile animate-pop px-3 py-2" disabled={checked}>
              {w}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2" lang="es">
        {tiles.map(({ t, i }) => (
          <button key={i} type="button" onClick={() => add(i)} disabled={checked || usedIdx.has(i)} className={`tile px-3 py-2 ${usedIdx.has(i) ? 'invisible' : ''}`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
