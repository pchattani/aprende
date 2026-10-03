import { useEffect, useRef } from 'react'
import type { TypeExercise, FindErrorExercise } from '../../engine/types'
import { SpeakerButton, Chip } from '../ui/basics'
import { Instruction, Prompt, type ExerciseProps } from './shared'
import { SPECIAL_CHARS } from './chars'

const TITLES: Record<string, string> = {
  typeEs: 'Write this in Spanish',
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
      <Instruction>{TITLES[exercise.kind]}</Instruction>
      {exercise.kind === 'dictation' ? (
        <div className="my-6 flex items-center justify-center gap-3">
          <SpeakerButton text={exercise.audio ?? exercise.answers[0]!} size="lg" autoPlay />
          <SpeakerButton text={exercise.audio ?? exercise.answers[0]!} slow />
        </div>
      ) : exercise.kind === 'findError' ? (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-bad-500/60 bg-bad-100/40 p-3">
          <Prompt lang="es">{exercise.wrong}</Prompt>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-3">
          {'audio' in exercise && exercise.audio && <SpeakerButton text={exercise.audio} size="sm" />}
          <Prompt lang={exercise.kind === 'typeEs' ? 'en' : 'es'}>{exercise.prompt}</Prompt>
        </div>
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
        lang={isEnglish ? 'en' : 'es'}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        placeholder={isEnglish ? 'Type in English' : 'Escribe en español'}
        className="w-full resize-none rounded-2xl border-2 border-line bg-surface-2 p-3 text-lg outline-none focus:border-sky-500"
        aria-label="Your answer"
      />
      {!isEnglish && !checked && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Special characters">
          {SPECIAL_CHARS.map((c) => (
            <button key={c} type="button" onClick={() => insert(c)} className="rounded-lg border-2 border-line bg-surface px-2.5 py-1 font-bold" lang="es">
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
