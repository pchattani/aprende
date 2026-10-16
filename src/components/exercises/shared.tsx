import type { Exercise, GradeResult } from '../../engine/types'
import type { Answer } from '../../engine/grade'
import { tlOf } from '../../engine/course'
import { MaybeTarget } from '../ui/TargetText'
import { Leo, Bonchita, Luna } from '../ui/Dogs'

export interface ExerciseProps<E extends Exercise = Exercise> {
  exercise: E
  value: Answer | undefined
  onChange: (value: Answer | undefined) => void
  /** Called when the exercise wants to submit (Enter, auto-complete). Pass the value to avoid stale state. */
  onSubmit: (value?: Answer) => void
  checked: boolean
  result?: GradeResult
}

export function Prompt({ children, lang = 'es' }: { children: React.ReactNode; lang?: 'es' | 'en' }) {
  return (
    <p className="text-[1.35rem] font-bold leading-snug" lang={tlOf(lang)}>
      {lang === 'es' ? <MaybeTarget>{children}</MaybeTarget> : children}
    </p>
  )
}

const DOGS = [Leo, Bonchita, Luna]

/** A dog says the prompt in a speech bubble; which dog depends on the text, so it stays put across re-renders. */
export function DogSays({ seed, children, aside }: { seed: string; children: React.ReactNode; aside?: React.ReactNode }) {
  const Dog = DOGS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % DOGS.length]!
  return (
    <div className="mb-6 flex items-end gap-2">
      <Dog size={92} className="-mb-1 shrink-0" />
      <div className="bubble bubble-left ml-2 flex min-w-0 flex-1 items-center gap-3">
        {aside}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

export function Instruction({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-display text-[1.6rem] leading-tight">{children}</h2>
}
