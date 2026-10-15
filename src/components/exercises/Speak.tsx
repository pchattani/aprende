import { useState } from 'react'
import type { TypeExercise } from '../../engine/types'
import { listenOnce, sttSupported, ensureMicPermission, listenErrorMessage, isIosStandalone, stopListening, type ListenError } from '../../engine/speech'
import { pack } from '../../engine/loader'
import { languagePack as spanish } from '@lang'
import { SpeakerButton, Chip } from '../ui/basics'
import { IconMic } from '../ui/icons'
import { Instruction, Prompt, type ExerciseProps } from './shared'
import { TL } from '../../engine/course'
import { LANGUAGE } from '../../engine/course'

/** Pick the recogniser alternative closest to an accepted answer. */
function bestAlternative(alts: string[], answers: string[]): string {
  let best = alts[0] ?? ''
  let score = -1
  for (const a of alts) {
    const m = spanish.match(a, answers)
    const s = m.verdict === 'correct' ? 3 : m.verdict === 'almost' ? 2 : overlap(a, answers[0] ?? '')
    if (s > score) {
      score = s
      best = a
    }
  }
  return best
}
function overlap(a: string, b: string): number {
  const A = new Set(spanish.words(a).map((w) => spanish.normalize(w, { accentInsensitive: true })))
  const B = spanish.words(b).map((w) => spanish.normalize(w, { accentInsensitive: true }))
  return B.length ? B.filter((w) => A.has(w)).length / B.length : 0
}

export function Speak({ exercise, value, onChange, onSubmit, checked }: ExerciseProps<TypeExercise>) {
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState<ListenError | undefined>(isIosStandalone() ? 'not-allowed' : undefined)
  const transcript = typeof value === 'string' ? value : ''
  const supported = sttSupported() && !isIosStandalone()

  const start = async () => {
    if (checked) return
    if (listening) {
      stopListening()
      return
    }
    setError(undefined)
    setLive('')
    const perm = await ensureMicPermission()
    if (perm) {
      setError(perm)
      return
    }
    setListening(true)
    const r = await listenOnce(pack.stt ?? pack.tts.lang, 10000, setLive)
    setListening(false)
    if (r.error) {
      setError(r.error)
      return
    }
    const said = bestAlternative(r.alternatives, exercise.answers)
    onChange(said)
    setTimeout(() => onSubmit(said), 250)
  }
  const selfCheck = () => {
    onChange(exercise.answers[0]!)
    onSubmit(exercise.answers[0]!)
  }

  const variant = exercise.variant
  return (
    <div>
      <Instruction>{variant === 'reply' ? 'Answer aloud' : variant === 'repeat' ? 'Listen and repeat' : 'Say this sentence'}</Instruction>
      <div className="mb-4 flex items-start gap-3">
        <SpeakerButton text={exercise.audio ?? exercise.prompt} size="sm" autoPlay={variant !== undefined} />
        <SpeakerButton text={exercise.audio ?? exercise.prompt} size="sm" slow />
        <Prompt lang="es">{exercise.prompt}</Prompt>
      </div>
      {variant === 'reply' ? (
        <div className="mb-6">
          {exercise.hint && <Chip tone="sky">{exercise.hint}</Chip>}
          {checked && (
            <p className="mt-3 text-sm text-muted">
              A natural answer: <span className="font-bold text-[var(--text)]" lang={TL}>{exercise.answers[0]}</span>
            </p>
          )}
        </div>
      ) : (
        exercise.translation && <p className="mb-6 text-sm text-muted">{exercise.translation}</p>
      )}
      {supported ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void start()}
            disabled={checked}
            className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-float transition active:scale-95 ${listening ? 'animate-pulse bg-bad-500' : 'bg-brand-gradient'}`}
            aria-label={listening ? 'Listening, tap to stop' : 'Tap to speak'}
          >
            <IconMic width={44} height={44} />
          </button>
          <p className="min-h-[2.5rem] text-center text-sm text-muted" aria-live="polite">
            {listening ? (live ? <>Hearing: <span className="font-bold text-[var(--text)]" lang={TL}>“{live}”</span></> : 'Listening… speak now') : transcript.trim() ? `I heard: “${transcript.trim()}”` : variant === 'reply' ? `Tap the microphone and answer the question in ${LANGUAGE}` : variant === 'repeat' ? 'Tap the microphone and repeat the word' : 'Tap the microphone and read the sentence aloud'}
          </p>
          {error && <p className="rounded-2xl bg-gold-100 px-3 py-2 text-center text-sm font-semibold text-[var(--text)] dark:bg-gold-500/15" role="alert">{listenErrorMessage(error)}</p>}
          {!checked && (
            <button type="button" className="text-sm font-bold text-muted underline" onClick={selfCheck}>
              Can't use the mic? I said it
            </button>
          )}
        </div>
      ) : (
        <div className="card text-sm text-muted">
          {isIosStandalone() ? listenErrorMessage('not-allowed') : listenErrorMessage('unsupported')} {variant === 'reply' ? 'Answer aloud, then compare with the suggested reply after checking.' : 'Read it aloud, compare it with the audio, then continue.'}
          <button type="button" className="btn btn-ghost mt-3 w-full" onClick={selfCheck}>
            I said it
          </button>
        </div>
      )}
    </div>
  )
}
