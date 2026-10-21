import type { CharChoiceExercise } from '../../engine/types'
import { languagePack } from '@lang'
import { SpeakerButton } from '../ui/basics'
import { Instruction, type ExerciseProps } from './shared'
import { TL } from '../../engine/course'
import { Pictogram } from '../art/Pictogram'
import { PICTOGRAMS } from '../../engine/pictograms'

/** Reading of a written option (Jyutping), shown once the answer is checked. */
const readingOf = (text: string) =>
  languagePack.romanize
    ?.(text)
    .map((s) => s.reading)
    .filter(Boolean)
    .join(' ')

/**
 * Pick a written character. Pictogram: from the picture it grew from and its ancient form (the modern
 * character appears once answered). hearChar: from its sound. Characters are big; readings stay hidden
 * until the answer is checked, so the choice is made on the characters alone.
 */
export function CharChoice({ exercise, value, onChange, checked }: ExerciseProps<CharChoiceExercise>) {
  const selected = typeof value === 'number' ? value : undefined
  const story = exercise.char ? PICTOGRAMS[exercise.char]?.story : undefined
  return (
    <div>
      <Instruction>{exercise.kind === 'pictogram' ? 'Which character grew from this picture?' : 'Which one did you hear?'}</Instruction>
      {exercise.kind === 'pictogram' && exercise.char ? (
        <div className="mb-5">
          <Pictogram char={exercise.char} reveal={checked} />
          {checked && story && <p className="mt-2 text-sm text-ink-2" lang="en">{story}</p>}
        </div>
      ) : (
        <div className="my-7 flex items-center justify-center gap-4">
          <SpeakerButton text={exercise.audio ?? exercise.options[exercise.answer]!} size="lg" autoPlay />
          <SpeakerButton text={exercise.audio ?? exercise.options[exercise.answer]!} slow />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Characters">
        {exercise.options.map((opt, i) => {
          let cls = ''
          if (checked) {
            if (i === exercise.answer) cls = 'correct'
            else if (i === selected) cls = 'wrong'
          } else if (i === selected) cls = 'selected'
          const reading = checked ? readingOf(opt) : undefined
          return (
            <button key={i} type="button" role="radio" aria-checked={i === selected} disabled={checked} onClick={() => onChange(i)} className={`tile flex min-h-[5.5rem] flex-col items-center justify-center gap-0.5 ${cls}`} data-tile={opt} aria-label={opt}>
              <span className={`${[...opt].length > 2 ? 'text-[1.9rem]' : 'text-[2.6rem]'} font-semibold leading-none`} lang={TL}>{opt}</span>
              {reading && <span className="font-mono text-xs font-semibold opacity-80">{reading}</span>}
            </button>
          )
        })}
      </div>
      {checked && exercise.translation && exercise.kind === 'hearChar' && <p className="mt-3 text-sm text-muted">{exercise.options[exercise.answer]} · {exercise.translation}</p>}
    </div>
  )
}
