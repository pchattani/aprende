import { useEffect, useRef } from 'react'
import type { TypeExercise, FindErrorExercise } from '../../engine/types'
import { SpeakerButton, Chip } from '../ui/basics'
import { Instruction, Prompt, DogSays, type ExerciseProps } from './shared'
import { SPECIAL_CHARS } from './chars'
import { TL } from '../../engine/course'
import { LANGUAGE } from '../../engine/course'
import { ui } from '../../engine/loader'

const TITLES: Record<string, string> = {
  typeEs: `Write this in ${LANGUAGE}`,
  typeEn: 'Write this in English',
  dictation: 'Type what you hear',
  conjugate: 'Complete with the right verb form',
  transform: 'Rewrite the sentence',
  findError: 'Find the mistake and write the correct sentence',
}

export function TypeAnswer({ exercise, value, onChange, onSubmit, checked }: ExerciseProps<TypeExercise | FindErrorExercise>) {
  const text = typeof value === 'string' ? value : ''
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [exercise])
  const isEnglish = exercise.kind === 'typeEn'
  const insert = (ch: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    const next = text.slice(0, start) + ch + text.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + ch.length, start + ch.length)
    })
  }
  return (
    <div>
      <Instruction>{exercise.askEn ? `Answer in ${LANGUAGE}` : TITLES[exercise.kind]}</Instruction>
      {exercise.kind === 'dictation' ? (
        <div className="my-8 flex items-center justify-center gap-4">
          <SpeakerButton text={exercise.audio ?? exercise.answers[0]!} size="lg" autoPlay />
          <SpeakerButton text={exercise.audio ?? exercise.answers[0]!} slow />
        </div>
      ) : exercise.kind === 'findError' ? (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-bad-500/60 bg-bad-100/40 p-3">
          <Prompt lang="es">{exercise.wrong}</Prompt>
        </div>
      ) : (
        <DogSays seed={exercise.prompt} aside={'audio' in exercise && exercise.audio ? <SpeakerButton text={exercise.audio} size="sm" /> : undefined}>
          <Prompt lang={exercise.kind === 'typeEs' ? 'en' : 'es'}>{exercise.prompt}</Prompt>
        </DogSays>
      )}
      {'hint' in exercise && exercise.hint && (
        <div className="mb-3">
          <Chip tone="sky">{exercise.hint}</Chip>
        </div>
      )}
      <textarea
        ref={ref}
        value={text}
        disabled={checked}
        onChange={(e) => onChange(e.target.value || undefined)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (text.trim()) onSubmit(text)
          }
        }}
        rows={3}
        lang={isEnglish ? 'en' : TL}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        placeholder={isEnglish ? 'Type in English' : ui.typePlaceholder}
        className="w-full resize-none rounded-2xl border-2 border-line bg-surface p-4 text-lg font-bold shadow-[0_4px_0_0_var(--line)] outline-none transition focus:border-sky-500 focus:shadow-[0_4px_0_0_var(--color-sky-500)]"
        aria-label="Your answer"
      />
      {!isEnglish && !checked && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Special characters">
          {SPECIAL_CHARS.map((c) => (
            <button key={c} type="button" onClick={() => insert(c)} className="tile px-3 py-1.5" lang={TL}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
