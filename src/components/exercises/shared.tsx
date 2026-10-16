import type { Exercise, GradeResult } from '../../engine/types'
import type { Answer } from '../../engine/grade'
import { tlOf } from '../../engine/course'
import { MaybeTarget } from '../ui/TargetText'
import { DogStamp } from '../art/DogStamp'

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

const DOGS = ['leo', 'bonchita', 'luna'] as const

/** A dog says the prompt: its portrait in a postage stamp, the words on a slip of paper beside it. Which dog depends on the text. */
export function DogSays({ seed, children, aside }: { seed: string; children: React.ReactNode; aside?: React.ReactNode }) {
  const dog = DOGS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % DOGS.length]!
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="shrink-0" aria-hidden="true"><DogStamp dog={dog} size={78} tilt={-4} /></span>
      <div className="relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-card">
        <span className="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-line bg-card" aria-hidden="true" />
        {aside}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

export function Instruction({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-display text-[1.55rem] leading-tight">{children}</h2>
}
