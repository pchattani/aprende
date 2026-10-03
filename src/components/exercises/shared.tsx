import type { Exercise, GradeResult } from '../../engine/types'
import type { Answer } from '../../engine/grade'

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
    <p className={`leading-snug ${lang === 'es' ? 'font-display text-[1.6rem]' : 'text-2xl font-bold'}`} lang={lang}>
      {children}
    </p>
  )
}

export function Instruction({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-sans text-sm font-extrabold uppercase tracking-wide text-muted" style={{ fontFamily: 'var(--font-sans)', fontVariationSettings: 'normal', letterSpacing: '0.06em' }}>{children}</h2>
}
