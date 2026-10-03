import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Exercise, GradeResult, LessonResult } from '../engine/types'
import { grade, type Answer } from '../engine/grade'
import { XP } from '../engine/ladder'
import { recordAnswer } from '../db/progress'
import { useGradeDeps } from '../hooks/useDeps'
import { useSettings } from '../store/settings'
import { useSession } from '../store/session'
import { ExerciseView } from './exercises'
import { Feedback } from './Feedback'
import { Button, Hearts, ProgressBar } from './ui/basics'
import { IconX } from './ui/icons'
import { playSound } from '../engine/sounds'

interface State {
  queue: Exercise[]
  index: number
  hearts: number
  answer: Answer | undefined
  result?: GradeResult
  correct: number
  almost: number
  wrong: number
  requeued: Set<number>
  startedAt: number
  finished: boolean
  xp: number
}
type Action = { type: 'answer'; value: Answer | undefined } | { type: 'check'; result: GradeResult; xp: number } | { type: 'next' } | { type: 'skip' }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'answer':
      return { ...s, answer: a.value }
    case 'check': {
      const ok = a.result.verdict !== 'wrong'
      const queue = [...s.queue]
      const requeued = new Set(s.requeued)
      if (!ok && !requeued.has(s.index)) {
        queue.push(s.queue[s.index]!)
        requeued.add(queue.length - 1)
      }
      return {
        ...s, queue, requeued, result: a.result,
        hearts: ok ? s.hearts : Math.max(0, s.hearts - 1),
        correct: s.correct + (a.result.verdict === 'correct' ? 1 : 0),
        almost: s.almost + (a.result.verdict === 'almost' ? 1 : 0),
        wrong: s.wrong + (ok ? 0 : 1),
        xp: s.xp + (ok ? a.xp : 0),
      }
    }
    case 'next': {
      const dead = s.hearts === 0
      const last = s.index + 1 >= s.queue.length
      return { ...s, index: s.index + 1, answer: undefined, result: undefined, finished: dead || last }
    }
    case 'skip':
      return { ...s, index: s.index + 1, answer: undefined, result: undefined, finished: s.index + 1 >= s.queue.length }
    default:
      return s
  }
}

export interface RunnerProps {
  exercises: Exercise[]
  /** 'lesson' uses hearts; 'review' and 'practice' do not. */
  mode: 'lesson' | 'review' | 'practice'
  lessonId: string
  title: string
  onFinish: (r: LessonResult) => void
  onQuit: () => void
}

export function LessonRunner({ exercises, mode, lessonId, title, onFinish, onQuit }: RunnerProps) {
  const deps = useGradeDeps()
  const heartsOn = useSettings((s) => s.hearts) && mode === 'lesson'
  const sound = useSettings((s) => s.sound)
  const [s, dispatch] = useReducer(reducer, undefined, () => ({
    queue: exercises, index: 0, hearts: heartsOn ? 3 : Infinity, answer: undefined, correct: 0, almost: 0, wrong: 0, requeued: new Set<number>(), startedAt: Date.now(), finished: false, xp: 0,
  }))
  const [confirmQuit, setConfirmQuit] = useState(false)
  const finishedRef = useRef(false)
  const setImmersive = useSession((s) => s.setImmersive)
  useEffect(() => {
    setImmersive(true)
    return () => setImmersive(false)
  }, [setImmersive])
  const stateRef = useRef(s)
  useEffect(() => {
    stateRef.current = s
  })
  const ex = s.queue[s.index]
  const total = s.queue.length
  const done = s.index

  useEffect(() => {
    if (!s.finished || finishedRef.current) return
    finishedRef.current = true
    const completed = s.hearts > 0
    const bonus = completed && s.wrong === 0 ? 5 : 0
    onFinish({
      lessonId, total: s.correct + s.almost + s.wrong, correct: s.correct, almost: s.almost, wrong: s.wrong,
      heartsLeft: Number.isFinite(s.hearts) ? s.hearts : 3, xp: completed ? s.xp + 10 + bonus : Math.floor(s.xp / 2), completed, durationMs: Date.now() - s.startedAt,
    })
  }, [s.finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const check = (value?: Answer) => {
    const cur = stateRef.current
    const curEx = cur.queue[cur.index]
    const answer = value ?? cur.answer
    if (!curEx || cur.result || answer === undefined) return
    if (value !== undefined) dispatch({ type: 'answer', value })
    const r = grade(curEx, answer, deps)
    const xp = XP[curEx.kind]
    dispatch({ type: 'check', result: r, xp })
    if (sound) playSound(r.verdict === 'wrong' ? 'wrong' : 'correct')
    const verdict = r.verdict
    for (const item of new Set(curEx.items)) void recordAnswer(item, verdict, curEx.kind, { xp: 0 })
  }
  const canCheck = useMemo(() => {
    if (!ex || s.answer === undefined) return false
    if (typeof s.answer === 'string') return s.answer.trim().length > 0
    if (Array.isArray(s.answer)) return s.answer.length > 0
    return true
  }, [ex, s.answer])

  // Test hook: expose the current exercise when the e2e flag is set (sessionStorage.e2e = '1').
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage.getItem('e2e')) {
        ;(window as unknown as { __aprende?: unknown }).__aprende = { exercise: ex, index: s.index, total, hearts: s.hearts, finished: s.finished }
      }
    } catch {
      /* ignore */
    }
  }, [ex, s.index, total, s.hearts, s.finished])

  if (!ex) return null
  const autoSubmit = ex.kind === 'match' || ex.kind === 'speak'
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setConfirmQuit(true)} className="rounded-full p-2 text-muted" aria-label="Quit">
          <IconX />
        </button>
        <ProgressBar value={done} max={total} tone="ok" className="flex-1" />
        {heartsOn && <Hearts count={s.hearts} />}
      </div>
      <p className="mt-2 truncate text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      <div className="flex-1 py-5">
        <ExerciseView key={`${s.index}`} exercise={ex} value={s.answer} onChange={(v) => dispatch({ type: 'answer', value: v })} onSubmit={(v) => check(v)} checked={Boolean(s.result)} result={s.result} />
      </div>
      {!s.result && !autoSubmit && (
        <div className="sticky bottom-0 -mx-4 border-t border-line bg-[var(--bg)]/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="flex gap-2">
            {mode !== 'lesson' && (
              <Button variant="ghost" onClick={() => dispatch({ type: 'skip' })}>
                Skip
              </Button>
            )}
            <Button variant={canCheck ? 'ok' : 'ghost'} className="flex-1" disabled={!canCheck} onClick={() => check()}>
              Check
            </Button>
          </div>
        </div>
      )}
      {s.result && <Feedback exercise={ex} result={s.result} last={s.index + 1 >= total || s.hearts === 0} onContinue={() => dispatch({ type: 'next' })} />}
      {confirmQuit && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="card w-full max-w-sm">
            <p className="text-lg font-extrabold">Quit this session?</p>
            <p className="mt-1 text-sm text-muted">Your answers so far are saved to your review schedule, but the {mode} will not count as completed.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setConfirmQuit(false)}>
                Keep going
              </Button>
              <Button variant="bad" onClick={onQuit}>
                Quit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
