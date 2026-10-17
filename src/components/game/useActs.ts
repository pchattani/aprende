import { useEffect, useState } from 'react'
import type { Act } from '../art/dogPose'

/** Acts played in order, each for its number of milliseconds; the last one holds. Restarts when `key` changes. */
export type ActScript = readonly (readonly [Act, number])[]

export function useActs(script: ActScript, key: unknown): Act {
  const [step, setStep] = useState<{ key: unknown; i: number }>({ key, i: 0 })
  const i = step.key === key ? step.i : 0
  if (step.key !== key) setStep({ key, i: 0 })
  useEffect(() => {
    if (i >= script.length - 1) return
    const t = setTimeout(() => setStep((s) => (s.key === key ? { key, i: s.i + 1 } : s)), script[i]![1])
    return () => clearTimeout(t)
  }, [i, key, script])
  return script[Math.min(i, script.length - 1)]?.[0] ?? 'idle'
}

/** The companion and the speaking dog: cheer at a right answer, then say their line; droop briefly at a wrong one. */
export const ACTS = {
  /** A new exercise: the dog says the prompt, then waits, looking up, for the answer. */
  ask: [['talk', 1300], ['think', 0]],
  correct: [['cheer', 1300], ['talk', 1000], ['idle', 0]],
  wrong: [['sad', 1100], ['talk', 900], ['idle', 0]],
  /** The prompt stamp after the answer: it reacts, and the companion does the talking. */
  stampCorrect: [['cheer', 1300], ['idle', 0]],
  stampWrong: [['sad', 1100], ['idle', 0]],
} as const satisfies Record<string, ActScript>
