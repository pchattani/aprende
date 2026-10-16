import type { ChoiceExercise } from '../../engine/types'
import { SpeakerButton } from '../ui/basics'
import { Instruction, Prompt, DogSays, type ExerciseProps } from './shared'
import { tlOf } from '../../engine/course'
import { LANGUAGE } from '../../engine/course'
import { TargetText } from '../ui/TargetText'

const TITLES: Record<ChoiceExercise['kind'], string> = {
  choiceEs: 'What does this mean?',
  choiceEn: `Which is the ${LANGUAGE}?`,
  listen: 'What did you hear?',
  fillBlank: 'Fill in the blank',
  reply: 'How would you reply?',
}

export function Choice({ exercise, value, onChange, checked, result }: ExerciseProps<ChoiceExercise>) {
  const selected = typeof value === 'number' ? value : undefined
  const isEs = exercise.kind === 'choiceEs' || exercise.kind === 'fillBlank' || exercise.kind === 'reply'
  return (
    <div>
      <Instruction>{TITLES[exercise.kind]}</Instruction>
      {exercise.kind === 'listen' ? (
        <div className="my-8 flex items-center justify-center gap-4">
          <SpeakerButton text={exercise.audio ?? exercise.prompt} size="lg" autoPlay />
          <SpeakerButton text={exercise.audio ?? exercise.prompt} slow />
        </div>
      ) : (
        <DogSays seed={exercise.prompt} aside={isEs && exercise.kind !== 'fillBlank' ? <SpeakerButton text={exercise.prompt} size="sm" /> : undefined}>
          <Prompt lang={isEs ? 'es' : 'en'}>{exercise.prompt}</Prompt>
        </DogSays>
      )}
      <div className="grid gap-3" role="radiogroup">
        {exercise.options.map((opt, i) => {
          let cls = ''
          if (checked) {
            if (i === exercise.answer) cls = 'correct'
            else if (i === selected) cls = 'wrong'
          } else if (i === selected) cls = 'selected'
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === selected}
              disabled={checked}
              onClick={() => onChange(i)}
              className={`tile flex items-center gap-3 ${cls}`}
              lang={tlOf(exercise.kind === 'fillBlank' || exercise.kind === 'reply' ? 'es' : isEs ? 'en' : 'es')}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current text-xs opacity-40">{i + 1}</span>
              <span>{exercise.kind === 'choiceEs' || exercise.kind === 'listen' ? opt : <TargetText text={opt} />}</span>
            </button>
          )
        })}
      </div>
      {checked && result && exercise.translation && (exercise.kind === 'fillBlank' || exercise.kind === 'reply') && <p className="mt-3 text-sm text-muted">{exercise.translation}</p>}
    </div>
  )
}
