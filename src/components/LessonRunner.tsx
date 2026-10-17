import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
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
import { IconX, IconCheck } from './ui/icons'
import { playSound, buzz } from '../engine/sounds'
import { ui } from '../engine/loader'
import { hashString } from '../engine/random'
import type { DogId } from './art/dogRegistry'
import { calmMotion, isE2E, nudge } from './game/motion'
import { DogReactionContext, DOG_TURNS, isComboMilestone, type DogReaction } from './game/reaction'
import { RouteProgress } from './game/RouteProgress'
import { ComboMeter, ComboBanner } from './game/Combo'
import { Companion } from './game/Companion'
import { StartSplash } from './game/StartSplash'
import { Burst } from './game/Burst'

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

  // Game feel. A calm runner (end-to-end runs, reduced motion) skips the movement but keeps the sounds.
  const [calm] = useState(calmMotion)
  const [splash, setSplash] = useState(() => mode === 'lesson' && !isE2E())
  const closeSplash = useCallback(() => setSplash(false), [])
  const [banner, setBanner] = useState<{ n: number; id: number; dog: DogId } | undefined>()
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | undefined>()
  const [leaving, setLeaving] = useState<{ index: number; ex: Exercise; answer: Answer | undefined; result?: GradeResult; dog: DogId } | undefined>()
  const stageRef = useRef<HTMLDivElement>(null)
  const fxId = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => void timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  // The dogs take turns, one per exercise, starting from a different dog in each lesson.
  const turn = useMemo(() => hashString(lessonId), [lessonId])
  const dogFor = (i: number): DogId => DOG_TURNS[(i + turn) % DOG_TURNS.length]!
  const reaction: DogReaction = useMemo(() => ({ dog: DOG_TURNS[(s.index + turn) % DOG_TURNS.length]!, verdict: s.result?.verdict }), [s.index, s.result, turn])

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
    const ok = r.verdict !== 'wrong'
    playSound(ok ? 'correct' : 'wrong')
    if (ok) buzz('correct')
    const streak = ok ? cur.streak + 1 : 0
    if (ok && isComboMilestone(streak)) {
      const id = ++fxId.current
      setBanner({ n: streak, id, dog: dogFor(cur.index) })
      later(() => {
        playSound('combo')
        buzz('combo')
      }, 260)
      later(() => setBanner((b) => (b?.id === id ? undefined : b)), 1800)
    }
    const verdict = r.verdict
    // Items and the grammar points they exercise are both scheduled.
    for (const item of new Set([...curEx.items, ...curEx.grammar])) void recordAnswer(item, verdict, curEx.kind)
    if (shouldPin) void pinAnswer(buildPin(curEx, answer, r, explanation))
    onAnswer?.(curEx, verdict)
  }

  // Right after a verdict: the answer pops (with a sparkle burst) or gives a gentle shake.
  useLayoutEffect(() => {
    const r = s.result
    const stage = stageRef.current
    const cur = stage?.querySelector<HTMLElement>('[data-current]')
    if (!r || !stage || !cur || calm) return
    const ok = r.verdict !== 'wrong'
    const kind = stateRef.current.queue[stateRef.current.index]?.kind
    const target =
      kind === 'match' ? cur.querySelector<HTMLElement>('.grid') : ok ? cur.querySelector<HTMLElement>('.tile.correct, [aria-label="Your answer"]') : cur.querySelector<HTMLElement>('.tile.wrong, [aria-label="Your answer"]')
    // a wrong option already shakes by itself (.tile.wrong)
    if (!target?.classList.contains('wrong')) nudge(target ?? cur, ok ? 'pop' : 'shake')
    if (!ok) return
    const box = (target ?? cur).getBoundingClientRect()
    const base = stage.getBoundingClientRect()
    const id = ++fxId.current
    setBurst({ id, x: Math.max(40, Math.min(base.width - 40, box.right - base.left - 34)), y: box.top - base.top + Math.min(box.height / 2, 40) })
    later(() => setBurst((b) => (b?.id === id ? undefined : b)), 900)
  }, [s.result, calm]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Continue (or skip): the finished exercise slides out to the left while the next slides in. */
  const advance = (type: 'next' | 'skip') => {
    const cur = stateRef.current
    const curEx = cur.queue[cur.index]
    if (!calm && curEx && cur.index + 1 < cur.queue.length) {
      const index = cur.index
      setLeaving({ index, ex: curEx, answer: cur.answer, result: cur.result, dog: dogFor(index) })
      later(() => setLeaving((l) => (l?.index === index ? undefined : l)), 260)
    }
    setBurst(undefined)
    dispatch({ type })
  }
  /** A tiny click when an answer slip is tapped. */
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (stateRef.current.result) return
    const t = (e.target as Element).closest?.('button.tile')
    if (t && !(t as HTMLButtonElement).disabled) playSound('tap')
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
  const won = s.result !== undefined && s.result.verdict !== 'wrong'
  const lines = !s.result ? [] : s.result.verdict === 'correct' ? ui.game.correct : s.result.verdict === 'almost' ? ui.game.almost : ui.game.wrong
  const line = lines[(s.index + s.correct + s.wrong) % Math.max(1, lines.length)] ?? ''
  const parts = title.split(' · ').filter(Boolean)
  const leg = Number(/\.l(\d+)$/.exec(lessonId)?.[1]) || undefined
  const noop = () => {}
  return (
    <div className={`mx-auto flex min-h-full max-w-xl flex-col overflow-x-clip px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] ${calm ? 'calm' : ''}`}>
      <div className="flex items-center gap-3" title={title}>
        <button type="button" onClick={() => setConfirmQuit(true)} className="-ml-1 rounded-full p-1.5 text-ink-2 transition hover:text-ink" aria-label="Quit">
          <IconX width={26} height={26} strokeWidth={2} />
        </button>
        <RouteProgress value={done} max={total} />
        {headerExtra}
        <ComboMeter streak={s.streak} />
      </div>
      {mode !== 'lesson' && <p className="eyebrow mt-2 truncate">{title}</p>}
      <div ref={stageRef} className="relative flex-1 pb-6 pt-6" onPointerDown={onStagePointerDown}>
        {leaving && leaving.index !== s.index && (
          <div key={`ex-${leaving.index}`} className="ex-leave" inert aria-hidden="true">
            <DogReactionContext.Provider value={{ dog: leaving.dog, verdict: leaving.result?.verdict }}>
              <ExerciseView exercise={leaving.ex} value={leaving.answer} onChange={noop} onSubmit={noop} checked={Boolean(leaving.result)} result={leaving.result} />
            </DogReactionContext.Provider>
          </div>
        )}
        <div key={`ex-${s.index}`} data-current="" className={calm ? undefined : 'ex-enter'}>
          <DogReactionContext.Provider value={reaction}>
            <ExerciseView exercise={ex} value={s.answer} onChange={(v) => dispatch({ type: 'answer', value: v })} onSubmit={(v) => check(v)} checked={Boolean(s.result)} result={s.result} />
          </DogReactionContext.Provider>
        </div>
        {burst && <Burst key={burst.id} x={burst.x} y={burst.y} />}
      </div>
      {!autoSubmit && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-paper px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          {/* Under the answer sheet the button stays put and turns into a green "correct" ticket (decorative, out of reach). */}
          <div className="flex gap-3" inert={s.result ? true : undefined} aria-hidden={s.result ? true : undefined}>
            {mode !== 'lesson' && mode !== 'checkpoint' && !s.result && (
              <Button variant="ghost" onClick={() => advance('skip')}>
                Skip
              </Button>
            )}
            <Button variant="primary" className={`flex-1 ${s.result ? (won ? 'btn-win' : 'btn-miss') : ''}`} disabled={!canCheck} onClick={() => check()}>
              {won ? (
                <>
                  <IconCheck width={22} height={22} strokeWidth={3} />
                  {ui.feedback.correct}
                </>
              ) : (
                'Check'
              )}
            </Button>
          </div>
        </div>
      )}
      {s.result && (
        <Feedback
          exercise={ex}
          result={s.result}
          explanation={s.explanation ?? { hints: [] }}
          last={s.index + 1 >= total}
          onContinue={() => advance('next')}
          pinned={s.pinned}
          onPin={mode === 'pinned' ? undefined : togglePin}
          companion={<Companion key={s.index} dog={reaction.dog} verdict={s.result.verdict} line={line} />}
        />
      )}
      {banner && <ComboBanner key={banner.id} n={banner.n} dog={banner.dog} />}
      {splash && <StartSplash leg={leg} title={parts.at(-1) ?? title} unit={parts.length > 1 ? parts.slice(0, -1).join(' · ') : undefined} onDone={closeSplash} />}
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
