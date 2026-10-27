/**
 * Sort it: a target-language word appears on a card; flick or drag it into its basket (or tap
 * the basket). Two baskets to start, a third joins halfway. Topics the learner has enough
 * words for (Food vs Clothes); gender (el / la) or part of speech when topic data is thin.
 * 15 cards a round, with the meaning shown after every answer.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { languagePack } from '@lang'
import type { VocabEntry } from '../../engine/schema'
import { vocab } from '../../engine/loader'
import { rapidPoints } from '../../engine/vocabGame'
import { sortRound, type Basket, type SortRound } from '../../engine/games/sortIt'
import { Rng } from '../../engine/random'
import { recordAnswer } from '../../db/progress'
import { playSound, buzz } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useSpeak } from '../../hooks/useSpeak'
import { useKvValue } from '../../hooks/useProgress'
import { Chip } from '../../components/ui/basics'
import { IconCheck, IconX } from '../../components/ui/icons'
import { Confetti } from '../../components/ui/Confetti'
import { Luna } from '../../components/ui/Dogs'
import { TargetText } from '../../components/ui/TargetText'
import { calmMotion, nudge } from '../../components/game/motion'
import { RoundButtons, TooFew } from '../palabras/shared'
import { addMinutes, e2eHook, formatTime } from '../palabras/util'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { GAMES_BEST_KEY, recordGame, useGameWords, type GameBest } from './util'

const ID = 'sort'
const TITLE = 'Sort it'
const fold = (s: string) => languagePack.stripMarks(languagePack.normalize(s))

export default function SortIt({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const words = useGameWords(240, (v) => Boolean(v.en[0]), round)
  const best = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})?.[ID]
  const [seed] = useState(() => Date.now())
  const game = useMemo(() => (words ? (sortRound(words, vocab.values(), { lang: languagePack.id, rng: new Rng(seed), fold }) ?? null) : undefined), [words, seed])
  if (game === undefined) return <GameHeader title={TITLE} subtitle="Loading your words…" onBack={onDone} />
  if (game === null) {
    return (
      <div className="animate-rise pb-6">
        <GameHeader title={TITLE} onBack={onDone} />
        <TooFew onBack={onDone} game={ID}>Sorting needs a few words from two different topics.</TooFew>
      </div>
    )
  }
  // a new round arrives with new words (after Play again): key by its cards so the board starts over
  return <Sorting key={game.cards.map((c) => c.v.id).join()} game={game} best={best} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
}

interface Answer {
  v: VocabEntry
  right: number
  picked: number
}

function Sorting({ game, best, onDone, onAgain }: { game: SortRound; best?: GameBest; onDone: () => void; onAgain: () => void }) {
  const { say } = useSpeak()
  const calm = useMemo(() => calmMotion(), [])
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [answer, setAnswer] = useState<Answer | undefined>()
  const [startedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [finishedMs, setFinishedMs] = useState<number | undefined>()
  const card = useRef<HTMLDivElement>(null)
  const baskets = useRef<(HTMLButtonElement | null)[]>([])
  const drag = useRef<{ id: number; x0: number; y0: number; moved: boolean; samples: { x: number; y: number; t: number }[] } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** Mirrors of score and answers for the delayed "next card" (timers see stale state). */
  const scoreRef = useRef(0)
  const answersRef = useRef<Answer[]>([])

  const total = game.cards.length
  const current = game.cards[i]
  const finished = finishedMs !== undefined
  const shown = i >= game.thirdFrom ? game.baskets.length : Math.min(2, game.baskets.length)
  const visible = game.baskets.slice(0, shown)

  useEffect(() => {
    if (!current) return
    e2eHook('sort', { index: i, word: current.v.lemma, basket: basketName(game.baskets[current.basket]!), baskets: visible.map(basketName), mode: game.mode })
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (finished) return
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 250)
    return () => clearInterval(t)
  }, [startedAt, finished])
  useEffect(() => () => clearTimeout(timer.current), [])

  // the third basket pops in when it joins
  useEffect(() => {
    if (i === game.thirdFrom && game.baskets.length > 2 && !calm) nudge(baskets.current[2], 'pop')
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    clearTimeout(timer.current)
    const ms = Date.now() - startedAt
    setFinishedMs(ms)
    setI(total)
    playSound('finish')
    const list = answersRef.current
    // a time only counts when every card of the round was sorted right
    const perfect = list.length === total && list.every((a) => a.right === a.picked)
    void (async () => {
      await recordGame(ID, { score: scoreRef.current, ms: perfect ? ms : undefined })
      await addMinutes(ms)
    })()
  }

  const next = () => {
    clearTimeout(timer.current)
    setAnswer(undefined)
    if (i + 1 >= total) finish()
    else setI((k) => k + 1)
  }

  const choose = (b: number) => {
    if (!current || answer || finished) return
    const ok = b === current.basket
    const a = { v: current.v, right: current.basket, picked: b }
    setAnswer(a)
    answersRef.current = [...answersRef.current, a]
    setAnswers(answersRef.current)
    void recordAnswer(current.v.id, ok ? 'correct' : 'wrong', 'choiceEs', { fast: ok })
    const el = card.current
    if (ok) {
      scoreRef.current += rapidPoints(streak)
      setScore(scoreRef.current)
      setStreak((s) => s + 1)
      playSound('correct')
      buzz('correct')
      void say(current.v.lemma)
      // the card drops into its basket
      const target = baskets.current[b]
      if (el && target && !calm) {
        const c = el.getBoundingClientRect()
        const t = target.getBoundingClientRect()
        const dx = t.left + t.width / 2 - (c.left + c.width / 2) + parseTransform(el).x
        const dy = t.top + t.height / 2 - (c.top + c.height / 2) + parseTransform(el).y
        el.style.transition = 'transform 260ms cubic-bezier(0.4, 0, 0.6, 1), opacity 260ms'
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.35)`
        el.style.opacity = '0'
      }
      timer.current = setTimeout(next, calm ? 700 : 900)
    } else {
      setStreak(0)
      playSound('wrong')
      reset()
      if (!calm) nudge(el, 'shake')
      timer.current = setTimeout(next, 2200)
    }
  }

  const reset = () => {
    const el = card.current
    if (!el) return
    el.style.transition = calm ? 'none' : 'transform 220ms cubic-bezier(0.3, 1.4, 0.5, 1)'
    el.style.transform = ''
    el.style.opacity = ''
  }

  // ------------------------------------------------------------------ drag and flick
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (answer || finished || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.currentTarget.style.transition = 'none'
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] }
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (Math.hypot(dx, dy) > 6) d.moved = true
    d.samples = [...d.samples.slice(-4), { x: e.clientX, y: e.clientY, t: e.timeStamp }]
    e.currentTarget.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${(dx / 16).toFixed(1)}deg)`
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved) {
      if (current) void say(current.v.lemma)
      return reset()
    }
    const c = e.currentTarget.getBoundingClientRect()
    const cx = c.left + c.width / 2
    const cy = c.top + c.height / 2
    const rects = visible.map((_, k) => baskets.current[k]?.getBoundingClientRect())
    // dropped on a basket
    const over = rects.findIndex((r) => r && cx >= r.left && cx <= r.right && cy >= r.top - 12 && cy <= r.bottom + 12)
    if (over >= 0) return choose(over)
    // flicked towards one: follow the throw down to the baskets' row
    const a = d.samples[0]!
    const b = d.samples[d.samples.length - 1]!
    const dt = Math.max(1, b.t - a.t)
    const vx = (b.x - a.x) / dt
    const vy = (b.y - a.y) / dt
    const row = rects.find(Boolean)
    if (row && vy > 0.35 && Math.hypot(vx, vy) > 0.5) {
      const x = cx + (vx * Math.max(0, row.top + row.height / 2 - cy)) / vy
      const hit = rects.reduce((m, r, k) => (r && Math.abs(r.left + r.width / 2 - x) < Math.abs((rects[m]?.left ?? 0) + (rects[m]?.width ?? 0) / 2 - x) ? k : m), 0)
      return choose(hit)
    }
    reset()
  }

  // keys 1–3 pick a basket
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= shown) {
        e.preventDefault()
        choose(n - 1)
      } else if (e.key === 'Enter' && answer) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (finished || !current) {
    const right = answers.filter((a) => a.right === a.picked).length
    const ms = finishedMs ?? elapsed
    const isBest = score > 0 && (best?.score === undefined || score > best.score)
    const missed = answers.filter((a) => a.right !== a.picked)
    return (
      <div className="animate-rise pb-6 text-center">
        <GameHeader title={TITLE} onBack={onDone} />
        {isBest && <Confetti />}
        <div className="mx-auto w-fit">
          <Luna size={96} act={right >= total * 0.7 ? 'cheer' : 'curious'} />
        </div>
        <p className="mt-1 font-display text-5xl">{score}</p>
        <p className="text-sm text-muted">
          points · {right} of {total} sorted in {formatTime(ms)}
          {isBest ? ' · new best!' : best?.score ? ` · best ${best.score}` : ''}
        </p>
        {missed.length > 0 && (
          <section className="card mt-4 text-left" aria-label="Words to look at again">
            <h2 className="eyebrow mb-1.5">To look at again</h2>
            <ul className="grid gap-1.5 text-sm">
              {missed.map((a) => (
                <li key={a.v.id} className="flex items-baseline gap-2">
                  <TargetText text={a.v.lemma} className="font-bold" />
                  <span className="min-w-0 flex-1 text-muted" lang="en">
                    {a.v.en[0]}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-[var(--ok)]">{basketName(game.baskets[a.right]!)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <RoundButtons onAgain={onAgain} onDone={onDone} />
      </div>
    )
  }

  const ok = answer && answer.picked === answer.right
  return (
    <div className="animate-rise pb-6">
      <GameHeader
        title={TITLE}
        subtitle={`Card ${i + 1} of ${total} · ${score} points`}
        onBack={onDone}
        right={
          <Chip tone="sky" className="mt-2 shrink-0 whitespace-nowrap">
            {formatTime(elapsed)}
          </Chip>
        }
      />
      <div className="mb-3 flex items-center gap-3">
        <Luna size={52} act={answer ? (ok ? 'cheer' : 'sad') : 'curious'} aria-hidden="true" />
        <p className="text-sm text-muted">{i === game.thirdFrom && shown > 2 ? 'A third basket! Keep sorting.' : 'Flick the word into its basket, or tap the basket.'}</p>
      </div>

      <div className="relative flex h-52 items-center justify-center">
        <div
          key={i}
          ref={card}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            drag.current = null
            reset()
          }}
          className={`card flex min-h-36 w-[min(78%,300px)] cursor-grab touch-none select-none flex-col items-center justify-center text-center will-change-transform active:cursor-grabbing ${answer ? (ok ? 'border-[var(--ok)]' : 'border-[var(--bad)]') : ''} ${calm ? '' : 'animate-rise'}`}
          role="group"
          aria-label={`Word: ${current.v.lemma}. Which basket?`}
          data-word={current.v.lemma}
        >
          <span className="text-3xl font-semibold leading-tight [overflow-wrap:anywhere]">
            <TargetText text={current.v.lemma} />
          </span>
          {answer && (
            <span className={`mt-2 flex items-center gap-1 text-sm font-bold ${ok ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}`} lang="en">
              {ok ? <IconCheck width={16} height={16} aria-hidden="true" /> : <IconX width={16} height={16} aria-hidden="true" />}
              {current.v.en[0]}
            </span>
          )}
        </div>
      </div>

      <p className="min-h-10 text-center text-sm font-semibold" role="status" aria-live="polite">
        {answer &&
          (ok ? (
            <span className="text-[var(--ok)]">
              Yes! <TargetText text={answer.v.lemma} /> goes in {basketName(game.baskets[answer.right]!)}.
            </span>
          ) : (
            <button type="button" onClick={next} className="text-[var(--bad)]">
              <TargetText text={answer.v.lemma} /> ({answer.v.en[0]}) goes in {basketName(game.baskets[answer.right]!)}. <span className="underline">Next</span>
            </button>
          ))}
      </p>

      <div className={`grid gap-2.5 ${shown > 2 ? 'grid-cols-3' : 'grid-cols-2'}`} role="group" aria-label="Baskets">
        {visible.map((b, k) => {
          const cls = answer ? (k === answer.right ? 'correct' : k === answer.picked ? 'wrong' : 'opacity-60') : ''
          return (
            <button
              key={b.key}
              ref={(el) => {
                baskets.current[k] = el
              }}
              type="button"
              onClick={() => choose(k)}
              disabled={Boolean(answer)}
              aria-label={`${basketName(b)}${b.hint && b.icon ? ` (${b.hint})` : ''}`}
              aria-keyshortcuts={String(k + 1)}
              className={`tile flex min-h-28 flex-col items-center justify-center gap-1 px-1.5 py-3 text-center disabled:cursor-default ${cls}`}
            >
              {b.icon ? (
                <span className="text-3xl leading-none" aria-hidden="true">
                  {b.icon}
                </span>
              ) : (
                <span className="font-display text-3xl leading-none" lang={TL}>
                  {b.label}
                </span>
              )}
              {b.icon && <span className="text-sm font-bold leading-tight">{b.label}</span>}
              {b.hint && <span className="text-[11px] font-semibold leading-tight text-muted">{b.hint}</span>}
              <span aria-hidden="true" className="text-xl leading-none opacity-70">
                🧺
              </span>
            </button>
          )
        })}
      </div>
      <button type="button" className="btn btn-ghost mt-5 w-full" onClick={finish}>
        Stop
      </button>
    </div>
  )
}

/** "Food", or "el (masculine)" for a gender basket. */
function basketName(b: Basket): string {
  return b.icon ? b.label : `${b.label} (${b.hint})`
}

/** The translate part of an element's inline transform (where a drag left it). */
function parseTransform(el: HTMLElement): { x: number; y: number } {
  const m = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 }
}
