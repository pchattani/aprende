/**
 * Measure words: a counter scene 「三 ＿ 狗」 and four classifiers to pick from. Twelve nouns a
 * round with a streak multiplier; each answer shows the phrase with Jyutping, plays it and
 * explains the classifier's "shape" family. A bonus round to finish: drag six nouns onto
 * their classifier baskets.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { VocabEntry } from '../../engine/schema'
import { vocabUpTo } from '../../engine/loader'
import { Rng } from '../../engine/random'
import { rapidPoints } from '../../engine/vocabGame'
import { CLASSIFIERS, NOUN_EMOJI, SORT_POINTS, classifierOf, measureRound, sortBoard, type MeasureQuestion, type SortBoard } from '../../engine/games/measureWords'
import { recordAnswer } from '../../db/progress'
import { playSound } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useSpeak } from '../../hooks/useSpeak'
import { useKvValue } from '../../hooks/useProgress'
import { Button, Chip, ProgressBar } from '../../components/ui/basics'
import { IconSpeaker } from '../../components/ui/icons'
import { Confetti } from '../../components/ui/Confetti'
import { Leo } from '../../components/ui/Dogs'
import { calmMotion, nudge } from '../../components/game/motion'
import { RoundButtons } from '../palabras/shared'
import { addMinutes, e2eHook } from '../palabras/util'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { GAMES_BEST_KEY, recordGame, useGameWords, type GameBest } from './util'
import { Ruby } from './cantoneseText'

const ID = 'measure'
const TITLE = 'Measure words'
const ROUND = 12
const hasClassifier = (v: VocabEntry) => Boolean(classifierOf(v))

export default function MeasureWords({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const learner = useGameWords(40, hasClassifier, round)
  const bests = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})
  const [best, setBest] = useState<number | undefined>()
  const [ready, setReady] = useState(-1)
  // the best before this round, so the results screen can say "new best"
  if (bests && ready !== round) {
    setBest(bests[ID]?.score)
    setReady(round)
  }
  if (!learner || ready !== round) return <p className="py-10 text-center text-sm text-muted">Loading {TITLE}…</p>
  return <Game key={round} learner={learner} best={best} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
}

/** A1/A2 nouns with a classifier, to top up the learner's own. */
const topUp = () => vocabUpTo('a2').filter(hasClassifier)

type Phase = 'play' | 'sort' | 'done'

function Game({ learner, best, onDone, onAgain }: { learner: VocabEntry[]; best?: number; onDone: () => void; onAgain: () => void }) {
  const [rng] = useState(() => new Rng(Date.now()))
  const pool = useMemo(() => topUp(), [])
  const questions = useMemo(() => measureRound(learner, pool, rng, ROUND), [learner, pool, rng])
  const board = useMemo(() => sortBoard(questions.map((q) => q.noun), pool, rng), [questions, pool, rng])
  const [phase, setPhase] = useState<Phase>('play')
  const [score, setScore] = useState(0)
  const [right, setRight] = useState(0)
  const [sorted, setSorted] = useState(0)
  const [startedAt] = useState(() => Date.now())
  /** Words already reviewed this round (the bonus round may repeat one). */
  const recorded = useRef(new Set<string>())
  const record = (v: VocabEntry, ok: boolean) => {
    if (recorded.current.has(v.id)) return
    recorded.current.add(v.id)
    void recordAnswer(v.id, ok ? 'correct' : 'wrong', 'fillBlank')
  }

  useEffect(() => {
    if (phase !== 'done') return
    playSound('finish')
    const ms = Date.now() - startedAt
    void (async () => {
      await recordGame(ID, { score })
      await addMinutes(ms)
    })()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'play')
    return (
      <Questions
        questions={questions}
        onScore={(pts, ok) => {
          setScore((s) => s + pts)
          if (ok) setRight((r) => r + 1)
        }}
        record={record}
        score={score}
        onDone={onDone}
        onFinish={(stopped) => setPhase(board && !stopped ? 'sort' : 'done')}
      />
    )
  if (phase === 'sort' && board)
    return (
      <Sorting
        board={board}
        score={score}
        record={record}
        onBack={onDone}
        onPlaced={(first) => {
          if (!first) return
          setScore((s) => s + SORT_POINTS)
          setSorted((n) => n + 1)
        }}
        onFinish={() => setPhase('done')}
      />
    )
  const isBest = score > 0 && (best === undefined || score > best)
  return (
    <div className="animate-rise pb-6 text-center">
      <GameHeader title={TITLE} onBack={onDone} />
      {isBest && <Confetti />}
      <div className="mx-auto w-fit">
        <Leo size={96} act={right >= questions.length / 2 ? 'cheer' : 'curious'} />
      </div>
      <p className="mt-1 font-display text-5xl">{score}</p>
      <p className="text-sm text-muted">
        points · {right} of {questions.length} right{board ? ` · ${sorted} of ${board.nouns.length} sorted` : ''}
        {isBest ? ' · new best!' : best ? ` · best ${best}` : ''}
      </p>
      <FamilyList questions={questions} />
      <RoundButtons onAgain={onAgain} onDone={onDone} />
    </div>
  )
}

/** The classifiers met this round, each with its family: the takeaway on the results screen. */
function FamilyList({ questions }: { questions: MeasureQuestion[] }) {
  const seen = [...new Set(questions.map((q) => q.cl))]
  return (
    <ul className="card mt-4 divide-y divide-[var(--line)] text-left" aria-label="Measure words this round">
      {seen.map((cl) => (
        <li key={cl} className="flex items-start gap-3 py-2">
          <Ruby text={cl} jp={CLASSIFIERS[cl]!.jp} className="font-display text-2xl leading-[1.6]" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="text-muted">{CLASSIFIERS[cl]!.family}</span>
            <span className="mt-0.5 block font-bold" lang={TL}>
              {questions
                .filter((q) => q.cl === cl)
                .map((q) => q.phrase)
                .join('　')}
            </span>
          </p>
        </li>
      ))}
    </ul>
  )
}

/** 🐕🐕🐕 for 三隻狗 (when the noun has an obvious picture). */
function Scene({ q }: { q: MeasureQuestion }) {
  const emoji = NOUN_EMOJI[q.noun.lemma]
  if (!emoji) return null
  return (
    <p className="flex flex-wrap justify-center gap-1 text-3xl leading-none" role="img" aria-label={`${q.count.en} × ${q.noun.en[0]}`}>
      {Array.from({ length: q.count.n }, (_, i) => (
        <span key={i} aria-hidden="true">
          {emoji}
        </span>
      ))}
    </p>
  )
}

function Questions({ questions, score, onScore, record, onDone, onFinish }: { questions: MeasureQuestion[]; score: number; onScore: (pts: number, ok: boolean) => void; record: (v: VocabEntry, ok: boolean) => void; onDone: () => void; onFinish: (stopped: boolean) => void }) {
  const { say } = useSpeak()
  const [i, setI] = useState(0)
  const [streak, setStreak] = useState(0)
  const [picked, setPicked] = useState<number | undefined>()
  const next = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const q = questions[i]

  useEffect(() => {
    if (q) e2eHook('measure', { index: i, total: questions.length, noun: q.noun.lemma, cl: q.cl, options: q.options, answer: q.answer, phrase: q.phrase, phraseJp: q.phraseJp })
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (picked !== undefined) next.current?.focus({ preventScroll: true })
  }, [picked])

  if (!q) return null
  const answered = picked !== undefined
  const ok = picked === q.answer
  const mult = Math.min(4, 1 + Math.floor(streak / 3))
  const choose = (oi: number) => {
    if (answered) return
    setPicked(oi)
    const hit = oi === q.answer
    record(q.noun, hit)
    void say(q.phrase)
    if (hit) {
      onScore(rapidPoints(streak), true)
      setStreak((s) => s + 1)
      playSound('correct')
      if (!calmMotion()) nudge(card.current, 'pop')
    } else {
      onScore(0, false)
      setStreak(0)
      playSound('wrong')
      if (!calmMotion()) nudge(card.current, 'shake')
    }
  }
  const advance = () => {
    setPicked(undefined)
    if (i + 1 >= questions.length) onFinish(false)
    else setI(i + 1)
  }
  const info = CLASSIFIERS[q.cl]!
  const wrongCl = answered && !ok ? q.options[picked] : undefined
  return (
    <div className="animate-rise pb-6">
      <GameHeader
        title={TITLE}
        subtitle={`${i + 1} of ${questions.length} · ${score} points`}
        onBack={onDone}
        right={
          <Chip tone={streak >= 3 ? 'gold' : 'sky'} className="shrink-0 whitespace-nowrap">
            <span aria-label={`Streak ${streak}`}>🔥 {streak}</span>
          </Chip>
        }
      />
      <ProgressBar value={i} max={questions.length} tone="brand" className="mb-4" />
      <div ref={card} className="card">
        <div className="flex items-center gap-3">
          <Leo size={56} act={answered ? (ok ? 'cheer' : 'sad') : 'think'} aria-hidden="true" />
          <p className="text-sm text-muted">
            Which measure word counts <span className="font-bold text-ink">{q.noun.en[0]}</span>?{mult > 1 ? <span className="ml-1 font-bold text-gold-600">×{mult}</span> : null}
          </p>
        </div>
        <div className="mt-3 rounded-2xl bg-surface-2 px-3 py-4">
          <Scene q={q} />
          <p className="mt-3 flex items-end justify-center gap-2 font-display text-4xl leading-[1.7]">
            <Ruby text={q.count.ch} jp={q.count.jp} />
            <span
              className={`inline-flex min-w-[2.2em] justify-center rounded-xl border-2 border-dashed px-1 ${answered ? (ok ? 'border-[var(--ok)] text-[var(--ok)]' : 'border-[var(--bad)] text-[var(--bad)]') : 'border-[var(--line-strong)] text-muted'}`}
              aria-label={answered ? `measure word ${q.cl}` : 'missing measure word'}
            >
              {answered ? <Ruby text={q.cl} jp={info.jp} /> : '＿'}
            </span>
            <Ruby text={q.noun.lemma} jp={q.noun.jp!} />
          </p>
          <p className="mt-1 text-center text-sm text-muted" lang="en">
            {q.count.en} × {q.noun.en[0]}
          </p>
        </div>

        {!answered && (
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Measure word">
            {q.options.map((c, oi) => (
              <button key={c} type="button" role="radio" aria-checked={false} aria-label={`${c} ${CLASSIFIERS[c]?.jp ?? ''}`} onClick={() => choose(oi)} className="tile flex flex-col items-center py-2.5" data-cl={c}>
                <Ruby text={c} jp={CLASSIFIERS[c]?.jp ?? ''} className="font-display text-3xl leading-[1.6]" />
              </button>
            ))}
          </div>
        )}

        {answered && (
          <div className={`mt-4 rounded-xl px-3 py-3 ${ok ? 'bg-[var(--sheet-ok)]' : 'bg-[var(--sheet-bad)]'}`} role="status">
            <p className={`text-xs font-extrabold uppercase tracking-wider ${ok ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}`}>{ok ? 'Yes!' : `It's ${q.cl}`}</p>
            <div className="mt-1 flex items-center gap-3">
              <button type="button" onClick={() => void say(q.phrase)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue text-white" aria-label={`Play ${q.phrase}`}>
                <IconSpeaker width={22} height={22} />
              </button>
              <div className="min-w-0">
                <p className="font-display text-3xl" lang={TL}>
                  {q.phrase}
                </p>
                <p className="text-sm font-semibold" lang={TL}>
                  {q.phraseJp}
                </p>
                <p className="text-sm text-muted" lang="en">
                  {q.count.en} × {q.noun.en.slice(0, 2).join(', ')}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm">
              <b lang={TL}>
                {q.cl} {info.jp}
              </b>
              : {info.family}.
            </p>
            {wrongCl && CLASSIFIERS[wrongCl] && (
              <p className="mt-1 text-sm text-muted">
                You picked{' '}
                <b lang={TL}>
                  {wrongCl} {CLASSIFIERS[wrongCl]!.jp}
                </b>
                : {CLASSIFIERS[wrongCl]!.family}.
              </p>
            )}
            {q.count.n === 2 && (
              <p className="mt-1 text-sm text-muted">
                Two is <b lang={TL}>兩 loeng5</b> before a measure word, not 二 ji6.
              </p>
            )}
          </div>
        )}
        {answered && (
          <button ref={next} type="button" className={`btn mt-3 w-full ${ok ? 'btn-ok' : 'btn-primary'}`} onClick={advance}>
            {i + 1 >= questions.length ? 'Bonus round' : 'Next'}
          </button>
        )}
      </div>
      <Button variant="ghost" className="mt-4 w-full" onClick={() => onFinish(true)}>
        Stop
      </Button>
    </div>
  )
}

/** Drag (or tap, then tap a basket) six nouns onto their classifiers. */
function Sorting({ board, score, record, onBack, onPlaced, onFinish }: { board: SortBoard; score: number; record: (v: VocabEntry, ok: boolean) => void; onBack: () => void; onPlaced: (firstTry: boolean) => void; onFinish: () => void }) {
  const { say } = useSpeak()
  const [placed, setPlaced] = useState<Map<string, string>>(new Map())
  const [selected, setSelected] = useState<string | undefined>()
  const [miss, setMiss] = useState<string | undefined>()
  const missed = useRef(new Set<string>())
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number; moved: boolean } | undefined>()
  const [over, setOver] = useState<string | undefined>()
  const suppressClick = useRef(false)
  const chips = useRef(new Map<string, HTMLButtonElement>())
  const nounById = useMemo(() => new Map(board.nouns.map((v) => [v.id, v])), [board])
  const left = board.nouns.filter((v) => !placed.has(v.id))

  useEffect(() => {
    e2eHook('measureSort', { bins: board.bins, nouns: board.nouns.map((v) => ({ lemma: v.lemma, cl: classifierOf(v) })) })
  }, [board])
  useEffect(() => {
    if (left.length) return
    const t = setTimeout(onFinish, calmMotion() ? 300 : 900)
    return () => clearTimeout(t)
  }, [left.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const drop = (id: string, bin: string) => {
    const v = nounById.get(id)
    if (!v || placed.has(id)) return
    setSelected(undefined)
    const cl = classifierOf(v)!
    if (cl === bin) {
      const m = new Map(placed)
      m.set(id, bin)
      setPlaced(m)
      const first = !missed.current.has(id)
      record(v, first)
      onPlaced(first)
      playSound('correct')
      void say(`一${cl}${v.lemma}`)
    } else {
      missed.current.add(id)
      setMiss(id)
      playSound('wrong')
      if (!calmMotion()) nudge(chips.current.get(id), 'shake')
      setTimeout(() => setMiss(undefined), 600)
    }
  }
  /** The basket under the pointer (looking beneath the chip being dragged). */
  const binAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint?.(x, y) ?? []) {
      const bin = (el.closest('[data-bin]') as HTMLElement | null)?.dataset.bin
      if (bin) return bin
    }
    return undefined
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return
    // a drag that ended on a basket unmounts its chip before any click, so reset here
    suppressClick.current = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ id, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false })
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    const moved = drag.moved || Math.hypot(dx, dy) > 8
    setDrag({ ...drag, dx, dy, moved })
    if (moved) setOver(binAt(e.clientX, e.clientY))
  }
  const endDrag = () => {
    setDrag(undefined)
    setOver(undefined)
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    if (drag.moved) {
      suppressClick.current = true
      const bin = binAt(e.clientX, e.clientY)
      if (bin) drop(drag.id, bin)
    }
    endDrag()
  }

  return (
    <div className="animate-rise pb-6">
      <GameHeader title="Bonus: sort them" subtitle={`${placed.size} of ${board.nouns.length} · ${score} points`} onBack={onBack} />
      <div className="mb-3 flex items-center gap-3">
        <Leo size={56} act={miss ? 'sad' : placed.size ? 'cheer' : 'curious'} aria-hidden="true" />
        <p className="text-sm text-muted">Drag each thing onto its measure word, or tap it and then the basket. +{SORT_POINTS} for each at the first try.</p>
      </div>
      <div className="flex min-h-[7.5rem] flex-wrap content-start justify-center gap-2" role="group" aria-label="Things to sort">
        {left.map((v) => {
          const dragging = drag?.id === v.id && drag.moved
          return (
            <button
              key={v.id}
              ref={(el) => {
                if (el) chips.current.set(v.id, el)
                else chips.current.delete(v.id)
              }}
              type="button"
              aria-pressed={selected === v.id}
              aria-label={`${v.lemma}, ${v.en[0]}`}
              data-noun={v.lemma}
              onPointerDown={(e) => onPointerDown(e, v.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={endDrag}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                setSelected(selected === v.id ? undefined : v.id)
              }}
              style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 20, transition: 'none' } : undefined}
              className={`tile flex touch-none select-none items-center gap-1.5 px-3 py-2 ${miss === v.id ? 'wrong' : ''} ${dragging ? 'shadow-float' : ''}`}
            >
              {NOUN_EMOJI[v.lemma] && (
                <span className="text-xl" aria-hidden="true">
                  {NOUN_EMOJI[v.lemma]}
                </span>
              )}
              <span className="text-left leading-tight">
                <Ruby text={v.lemma} jp={v.jp!} className="block text-lg leading-[1.7]" />
                <span className="block text-[11px] text-muted" lang="en">
                  {v.en[0]}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {board.bins.map((bin) => {
          const inside = board.nouns.filter((v) => placed.get(v.id) === bin)
          const info = CLASSIFIERS[bin]!
          return (
            <button
              key={bin}
              type="button"
              data-bin={bin}
              aria-label={`Basket ${bin} ${info.jp}: ${info.family}${inside.length ? `. Holds ${inside.map((v) => v.lemma).join(', ')}` : ''}`}
              onClick={() => selected && drop(selected, bin)}
              className={`flex min-h-40 flex-col items-center rounded-2xl border-2 border-dashed px-1.5 py-2 text-center motion-safe:transition-colors ${over === bin ? 'border-[var(--blue)] bg-[color-mix(in_srgb,var(--blue)_10%,var(--card))]' : selected ? 'border-[var(--line-strong)] bg-surface' : 'border-line bg-surface-2'}`}
            >
              <Ruby text={bin} jp={info.jp} className="font-display text-3xl leading-[1.6]" />
              <span className="mt-0.5 line-clamp-3 text-[11px] leading-tight text-muted">{info.family.split(':')[0]}</span>
              <span className="mt-2 flex flex-col gap-1">
                {inside.map((v) => (
                  <span key={v.id} className="rounded-lg bg-[var(--sheet-ok)] px-1.5 py-0.5 text-sm font-bold text-[var(--ok)]" lang={TL}>
                    {NOUN_EMOJI[v.lemma] ?? ''}
                    {bin}
                    {v.lemma}
                  </span>
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <Button variant="ghost" className="mt-5 w-full" onClick={onFinish}>
        Skip the bonus
      </Button>
    </div>
  )
}
