/** The learner's finished pool (engine/finished.ts): the words, grammar, lessons and levels the games may use. */
import { useEffect, useMemo, useState } from 'react'
import type { Finished } from '../engine/finished'
import { lessonRows } from '../db/progress'
import { useLessonRows } from './useProgress'

type FinishedData = typeof import('../engine/finishedData')
let data: Promise<FinishedData> | undefined
const loadData = () => (data ??= import('../engine/finishedData'))

/** The finished pool now (reads the lesson rows once). */
export async function loadFinishedWords(): Promise<Finished> {
  const [m, rows] = await Promise.all([loadData(), lessonRows()])
  return m.finishedFrom(rows.values())
}

/** The finished pool, live as lessons are completed; undefined while loading. */
export function useFinishedWords(): Finished | undefined {
  const rows = useLessonRows()
  const [m, setM] = useState<FinishedData | undefined>()
  useEffect(() => {
    let live = true
    void loadData().then((x) => {
      if (live) setM(() => x)
    })
    return () => {
      live = false
    }
  }, [])
  return useMemo(() => (rows && m ? m.finishedFrom(rows.values()) : undefined), [rows, m])
}
