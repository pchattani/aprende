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
      <Instruction>{exercise.passage ? 'Read and answer' : TITLES[exercise.kind]}</Instruction>
      {exercise.passage ? (
        <>
          <PassageCard passage={exercise.passage} revealed={checked} />
          <p className="mb-4 text-lg font-bold leading-snug" lang="en">{exercise.prompt}</p>
        </>
      ) : exercise.kind === 'listen' ? (
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

/** A reading passage on a sheet of paper: target-language lines, the English revealed once the answer is checked. */
function PassageCard({ passage, revealed }: { passage: NonNullable<ChoiceExercise['passage']>; revealed: boolean }) {
  const all = passage.lines.map((l) => l.text).join(' ')
  return (
    <figure className="card mb-5 !p-0" aria-label="Reading passage">
      <div className="airmail h-1 w-full rounded-t-2xl" aria-hidden="true" />
      <div className="px-4 pb-4 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <p className="eyebrow min-w-0 flex-1 truncate">{passage.title ? <TargetText text={passage.title} /> : 'Read'}</p>
          <SpeakerButton text={all} size="sm" />
        </div>
        <ol className="space-y-1.5 font-reading text-[1.02rem] leading-snug">
          {passage.lines.map((l, i) => {
            const focus = passage.focus === i
            return (
              <li key={i} className={`rounded-lg px-2 py-1 ${focus ? 'border-l-4 border-red bg-[color-mix(in_srgb,var(--sun)_22%,var(--card))]' : ''}`} aria-current={focus ? 'true' : undefined}>
                {l.speaker && <span className="mr-1.5 font-mono text-xs uppercase tracking-wide text-ink-2">{l.speaker}</span>}
                <TargetText text={l.text} />
                {revealed && l.en && <span className="mt-0.5 block text-sm text-ink-2" lang="en">{l.en}</span>}
              </li>
            )
          })}
        </ol>
      </div>
    </figure>
  )
}
