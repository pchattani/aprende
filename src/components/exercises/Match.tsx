import { useEffect, useMemo, useState } from 'react'
import type { MatchExercise } from '../../engine/types'
import { Rng, hashString } from '../../engine/random'
import { useSpeak } from '../../hooks/useSpeak'
import { Instruction, type ExerciseProps } from './shared'

export function Match({ exercise, onChange, onSubmit, checked }: ExerciseProps<MatchExercise>) {
  const { say } = useSpeak()
  const rights = useMemo(() => new Rng(hashString(exercise.pairs.map((p) => p.left).join('|'))).shuffle(exercise.pairs.map((p) => p.right)), [exercise])
  const [left, setLeft] = useState<number | undefined>()
  const [right, setRight] = useState<number | undefined>()
  const [done, setDone] = useState<Set<number>>(new Set())
  const [mistakes, setMistakes] = useState(0)
  const [flash, setFlash] = useState<{ l?: number; r?: number } | null>(null)

  useEffect(() => {
    if (left === undefined || right === undefined) return
    const pair = exercise.pairs[left]!
    if (rights[right] === pair.right) {
      const next = new Set(done)
      next.add(left)
      setDone(next)
      setLeft(undefined)
      setRight(undefined)
      if (next.size === exercise.pairs.length) {
        const value = { mistakes }
        onChange(value)
        setTimeout(() => onSubmit(value), 350)
      }
    } else {
      setMistakes((m) => m + 1)
      setFlash({ l: left, r: right })
      setTimeout(() => {
        setFlash(null)
        setLeft(undefined)
        setRight(undefined)
      }, 500)
    }
  }, [left, right]) // eslint-disable-line react-hooks/exhaustive-deps

  const rightDone = new Set([...done].map((i) => exercise.pairs[i]!.right))
  return (
    <div>
      <Instruction>Tap the matching pairs</Instruction>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2" lang="es">
          {exercise.pairs.map((p, i) => (
            <button
              key={i}
              type="button"
              disabled={checked || done.has(i)}
              onClick={() => {
                setLeft(i)
                void say(p.left)
              }}
              className={`tile min-h-14 ${done.has(i) ? 'correct opacity-60' : flash?.l === i ? 'wrong' : left === i ? 'selected' : ''}`}
            >
              {p.left}
            </button>
          ))}
        </div>
        <div className="grid gap-2" lang="en">
          {rights.map((r, i) => (
            <button
              key={i}
              type="button"
              disabled={checked || rightDone.has(r)}
              onClick={() => setRight(i)}
              className={`tile min-h-14 ${rightDone.has(r) ? 'correct opacity-60' : flash?.r === i ? 'wrong' : right === i ? 'selected' : ''}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
