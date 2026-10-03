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

export const SPECIAL_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡']

export function Prompt({ children, lang = 'es' }: { children: React.ReactNode; lang?: 'es' | 'en' }) {
  return (
    <p className="text-xl font-bold leading-snug" lang={lang}>
      {children}
    </p>
  )
}

export function Instruction({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg font-extrabold">{children}</h2>
}
