import { useState } from 'react'
import type { TypeExercise } from '../../engine/types'
import { listenOnce, sttSupported } from '../../engine/speech'
import { pack } from '../../engine/loader'
import { SpeakerButton } from '../ui/basics'
import { IconMic } from '../ui/icons'
import { Instruction, Prompt, type ExerciseProps } from './shared'

export function Speak({ exercise, value, onChange, onSubmit, checked }: ExerciseProps<TypeExercise>) {
  const [listening, setListening] = useState(false)
  const transcript = typeof value === 'string' ? value : ''
  const supported = sttSupported()
  const start = async () => {
    if (listening || checked) return
    setListening(true)
    const r = await listenOnce(pack.tts.lang)
    setListening(false)
    const value = r.transcript || ' '
    onChange(value)
    setTimeout(() => onSubmit(value), 200)
  }
  return (
    <div>
      <Instruction>Say this sentence</Instruction>
      <div className="mb-4 flex items-start gap-3">
        <SpeakerButton text={exercise.prompt} size="sm" />
        <Prompt lang="es">{exercise.prompt}</Prompt>
      </div>
      {exercise.translation && <p className="mb-6 text-sm text-muted">{exercise.translation}</p>}
      {supported ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void start()}
            disabled={checked}
            className={`flex h-24 w-24 items-center justify-center rounded-full text-white transition ${listening ? 'animate-pulse bg-bad-500' : 'bg-sky-500'}`}
            aria-label={listening ? 'Listening…' : 'Tap to speak'}
          >
            <IconMic width={44} height={44} />
          </button>
          <p className="text-sm text-muted">{listening ? 'Listening… speak now' : transcript.trim() ? `I heard: “${transcript.trim()}”` : 'Tap the microphone and read the sentence aloud'}</p>
        </div>
      ) : (
        <div className="card text-sm text-muted">
          Speech recognition is not available in this browser. Read the sentence aloud, then tap Continue. (Chrome, Edge and Safari support it.)
          <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => { onChange(exercise.answers[0]!); onSubmit(exercise.answers[0]!) }}>
            I said it
          </button>
        </div>
      )}
    </div>
  )
}
