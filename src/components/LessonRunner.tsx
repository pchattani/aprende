import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import type { Exercise, GradeResult, LessonResult, PinRow } from '../engine/types'
import { grade, type Answer } from '../engine/grade'
import { explainAnswer, firstReplacement, type Explanation } from '../engine/explain'
import { recordAnswer, pinAnswer, unpin } from '../db/progress'
import { languagePack } from '@lang'
import { pinIdFor } from '../engine/pins'
import { useGradeDeps, explainDeps } from '../hooks/useDeps'
import { useSettings } from '../store/settings'
import { useSession } from '../store/session'
import { ExerciseView } from './exercises'
import { Feedback } from './Feedback'
import { Button } from './ui/basics'
import { IconX, IconWind, IconPaw } from './ui/icons'
import { playSound } from '../engine/sounds'

interface State {
  queue: Exercise[]
  index: number
  answer: Answer | undefined
  result?: GradeResult
  explanation?: Explanation
  pinned: boolean
  correct: number
  almost: number
  wrong: number
  requeued: Set<number>
  /** Answers in a row without a mistake (the combo). */
  streak: number
  /** Wrong answers come back at the end of the queue (not in a checkpoint, which is scored once per question). */
  requeue: boolean
  startedAt: number
  finished: boolean
}
type Action = { type: 'answer'; value: Answer | undefined } | { type: 'check'; result: GradeResult; explanation: Explanation; pinned: boolean } | { type: 'pin'; pinned: boolean } | { type: 'next' } | { type: 'skip' }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'answer':
      return { ...s, answer: a.value }
    case 'check': {
      const ok = a.result.verdict !== 'wrong'
      const queue = [...s.queue]
      const requeued = new Set(s.requeued)
      if (!ok && s.requeue && !requeued.has(s.index)) {
        queue.push(s.queue[s.index]!)
        requeued.add(queue.length - 1)
      }
      return {
        ...s, queue, requeued, result: a.result, explanation: a.explanation, pinned: a.pinned,
        correct: s.correct + (a.result.verdict === 'correct' ? 1 : 0),
        almost: s.almost + (a.result.verdict === 'almost' ? 1 : 0),
        wrong: s.wrong + (ok ? 0 : 1),
        streak: ok ? s.streak + 1 : 0,
      }
    }
    case 'pin':
      return { ...s, pinned: a.pinned }
    case 'next': {
      const last = s.index + 1 >= s.queue.length
      return { ...s, index: s.index + 1, answer: undefined, result: undefined, explanation: undefined, pinned: false, finished: last }
    }
    case 'skip':
      return { ...s, index: s.index + 1, answer: undefined, result: undefined, explanation: undefined, pinned: false, finished: s.index + 1 >= s.queue.length }
    default:
      return s
  }
}

function answerText(ex: Exercise, answer: Answer | undefined): string {
  if (answer === undefined) return ''
  if (typeof answer === 'number') return 'options' in ex ? ex.options[answer] ?? String(answer) : String(answer)
  if (Array.isArray(answer)) return answer.join(' ')
  if (typeof answer === 'object') return `${answer.mistakes} mismatched`
  return answer
}

export interface RunnerProps {
  exercises: Exercise[]
  /** 'lesson' records a lesson completion; 'review', 'practice', 'pinned' and 'checkpoint' only schedule cards. A checkpoint asks each question once (no re-queue, no skip). */
  mode: 'lesson' | 'review' | 'practice' | 'pinned' | 'checkpoint'
  lessonId: string
  title: string
  onFinish: (r: LessonResult) => void
  onQuit: () => void
  /** Called after each graded answer (pinned practice uses it to track streaks). */
  onAnswer?: (ex: Exercise, verdict: GradeResult['verdict']) => void
  /** Extra controls in the header, beside the progress route (e.g. the guidebook button). */
  headerExtra?: ReactNode
}

export function LessonRunner({ exercises, mode, lessonId, title, onFinish, onQuit, onAnswer, headerExtra }: RunnerProps) {
  const deps = useGradeDeps()
  const sound = useSettings((s) => s.sound)
  const autoPin = useSettings((s) => s.autoPin)
  const [s, dispatch] = useReducer(reducer, undefined, () => ({
    queue: exercises, index: 0, answer: undefined, pinned: false, correct: 0, almost: 0, wrong: 0, requeued: new Set<number>(), streak: 0, requeue: mode !== 'checkpoint', startedAt: Date.now(), finished: false,
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
    onFinish({
      lessonId, total: s.correct + s.almost + s.wrong, correct: s.correct, almost: s.almost, wrong: s.wrong,
      completed: true, durationMs: Date.now() - s.startedAt,
    })
  }, [s.finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildPin = (curEx: Exercise, answer: Answer, r: GradeResult, explanation: Explanation): Omit<PinRow, 'ts' | 'streak'> => {
    const hint = [...r.notes, ...explanation.hints][0]
    const review = curEx.review ?? { es: r.correct, en: 'translation' in curEx && curEx.translation ? curEx.translation : '' }
    return { id: pinIdFor(curEx), lessonId, exerciseKind: curEx.kind, given: answerText(curEx, answer), expected: r.correct, hint, es: review.es, en: review.en, missed: firstReplacement(explanation.diff) }
  }

  const check = (value?: Answer) => {
    const cur = stateRef.current
    const curEx = cur.queue[cur.index]
    const answer = value ?? cur.answer
    if (!curEx || cur.result || answer === undefined) return
    if (value !== undefined) dispatch({ type: 'answer', value })
    const r = grade(curEx, answer, deps)
    const explanation = r.verdict === 'correct' ? { hints: [] } : explainAnswer(curEx, answer, explainDeps)
    const shouldPin = r.verdict === 'wrong' && autoPin && mode !== 'pinned'
    dispatch({ type: 'check', result: r, explanation, pinned: shouldPin })
    if (sound) playSound(r.verdict === 'wrong' ? 'wrong' : 'correct')
    const verdict = r.verdict
    // Items and the grammar points they exercise are both scheduled.
    for (const item of new Set([...curEx.items, ...curEx.grammar])) void recordAnswer(item, verdict, curEx.kind)
    if (shouldPin) void pinAnswer(buildPin(curEx, answer, r, explanation))
    onAnswer?.(curEx, verdict)
  }
  const togglePin = () => {
    const cur = stateRef.current
    const curEx = cur.queue[cur.index]
    if (!curEx || !cur.result || cur.answer === undefined) return
    if (cur.pinned) {
      void unpin(pinIdFor(curEx))
      dispatch({ type: 'pin', pinned: false })
    } else {
      void pinAnswer(buildPin(curEx, cur.answer, cur.result, cur.explanation ?? { hints: [] }))
      dispatch({ type: 'pin', pinned: true })
    }
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
        // `solution`: tiles of the first accepted answer, in order (language-neutral for tests).
        const solution = ex && 'answers' in ex && 'tiles' in ex ? languagePack.words(ex.answers[0] ?? '') : undefined
        ;(window as unknown as { __aprende?: unknown }).__aprende = { exercise: ex, index: s.index, total, finished: s.finished, solution }
      }
    } catch {
      /* ignore */
    }
  }, [ex, s.index, total, s.finished])
  // A closed session must not leave a stale hook for the next screen.
  useEffect(
    () => () => {
      delete (window as unknown as { __aprende?: unknown }).__aprende
    },
    [],
  )

  if (!ex) return null
  const autoSubmit = ex.kind === 'match' || ex.kind === 'speak'
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3" title={title}>
        <button type="button" onClick={() => setConfirmQuit(true)} className="-ml-1 rounded-full p-1.5 text-ink-2 transition hover:text-ink" aria-label="Quit">
          <IconX width={26} height={26} strokeWidth={2} />
        </button>
        <RouteProgress value={done} max={total} />
        {headerExtra}
        <span className={`flex min-w-[3.4rem] items-center justify-end gap-1 font-mono text-sm transition ${s.streak >= 2 ? 'text-blue' : 'text-ink-2/50'}`} aria-label={`Tailwind: ${s.streak} in a row`} title="Tailwind: answers in a row">
          <IconWind width={18} height={18} />×{s.streak}
        </span>
      </div>
      {mode !== 'lesson' && <p className="eyebrow mt-2 truncate">{title}</p>}
      {s.result && s.result.verdict !== 'wrong' && s.streak >= 3 && s.streak % 3 === 0 && (
        <p key={s.streak} className="animate-pop mx-auto mt-2 font-hand text-2xl leading-none text-blue">Tailwind! {s.streak} in a row</p>
      )}
      <div className="flex-1 pb-6 pt-6">
        <ExerciseView key={`${s.index}`} exercise={ex} value={s.answer} onChange={(v) => dispatch({ type: 'answer', value: v })} onSubmit={(v) => check(v)} checked={Boolean(s.result)} result={s.result} />
      </div>
      {!s.result && !autoSubmit && (
        <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="flex gap-3">
            {mode !== 'lesson' && mode !== 'checkpoint' && (
              <Button variant="ghost" onClick={() => dispatch({ type: 'skip' })}>
                Skip
              </Button>
            )}
            <Button variant="primary" className="flex-1" disabled={!canCheck} onClick={() => check()}>
              Check
            </Button>
          </div>
        </div>
      )}
      {s.result && (
        <Feedback exercise={ex} result={s.result} explanation={s.explanation ?? { hints: [] }} last={s.index + 1 >= total} onContinue={() => dispatch({ type: 'next' })} pinned={s.pinned} onPin={mode === 'pinned' ? undefined : togglePin} />
      )}
      {confirmQuit && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="card animate-pop w-full max-w-sm text-center">
            <p className="font-hand text-3xl leading-none">Leaving the train?</p>
            <p className="mt-2 font-semibold">Quit this session?</p>
            <p className="mt-1 text-sm text-ink-2">Your answers so far are saved to your review schedule, but the {mode === 'pinned' ? 'practice' : mode} will not count as completed.</p>
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

/** Lesson progress as a leg of the journey: a dotted route that fills with ink, a paw marking where you are. */
function RouteProgress({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)))
  return (
    <div className="relative h-6 flex-1" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dotted border-line" />
      <span className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${pct * 100}%` }} />
      <span className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-ink bg-paper" aria-hidden="true" />
      <span className="absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red text-white shadow-card transition-[left] duration-500 ease-out" style={{ left: `${Math.max(4, pct * 100)}%` }} aria-hidden="true">
        <IconPaw width={13} height={13} />
      </span>
    </div>
  )
}
