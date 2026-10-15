import { useState } from 'react'
import { Button, SpeakerButton } from './ui/basics'

export interface MCQItem {
  prompt: string
  options: string[]
  answer: number
  audio?: string
  /** Shown under the item after checking (when `reveal` is on). */
  explain?: string
  /** Language of the prompt text (default Spanish; 'en' for instructions). */
  promptLang?: 'es' | 'en'
}

/**
 * A list of multiple-choice questions with one Continue button. With `reveal`,
 * the first press marks every answer and shows explanations; the second continues.
 */
export function MCQ({ items, onDone, reveal = false, label = 'Continue' }: { items: MCQItem[]; onDone: (score: number, correct: number) => void; reveal?: boolean; label?: string }) {
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => items.map(() => undefined))
  const [checked, setChecked] = useState(false)
  const complete = answers.every((a) => a !== undefined)
  const correct = items.filter((q, i) => answers[i] === q.answer).length
  const submit = () => {
    if (reveal && !checked) {
      setChecked(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    onDone(items.length ? correct / items.length : 0, correct)
  }
  return (
    <div className="mt-4 space-y-3">
      {checked && (
        <p className="rounded-2xl bg-surface-2 px-3 py-2 text-center text-sm font-extrabold" role="status">
          {correct} of {items.length} correct
        </p>
      )}
      {items.map((q, i) => (
        <div key={i} className="card">
          <div className="flex items-start gap-2">
            {q.audio && <SpeakerButton text={q.audio} size="sm" />}
            <p className="font-bold" lang={q.promptLang ?? (q.audio ? 'en' : 'es')}>{q.prompt}</p>
          </div>
          <div className="mt-2 grid gap-1.5" role="radiogroup" aria-label={q.prompt}>
            {q.options.map((o, oi) => {
              let cls = ''
              if (checked) {
                if (oi === q.answer) cls = 'correct'
                else if (answers[i] === oi) cls = 'wrong'
              } else if (answers[i] === oi) cls = 'selected'
              return (
                <button key={oi} type="button" role="radio" aria-checked={answers[i] === oi} disabled={checked} onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? oi : x)))} className={`tile py-2 text-sm ${cls}`} lang="es">
                  {o}
                </button>
              )
            })}
          </div>
          {checked && q.explain && <p className="mt-2 text-sm text-muted">{q.explain}</p>}
        </div>
      ))}
      <Button className="w-full" disabled={!complete} onClick={submit}>
        {reveal && !checked ? 'Check' : label}
      </Button>
    </div>
  )
}
