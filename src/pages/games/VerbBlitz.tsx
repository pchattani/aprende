/**
 * Verb blitz: 60 seconds of quick-fire conjugation. Each prompt ("tú · tener · present", "you
 * have") offers four forms: the right one and plausible slips (other persons, other tenses, the
 * verb made regular). A streak multiplies the points (×2 from 3, ×3 from 6). Keys 1–4 pick.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { recordGame, GAMES_BEST_KEY, type GameBest } from './util'
import { addMinutes, e2eHook } from '../palabras/util'
import { kit, useVerbRound, recordVerb, shortTense, tensesInPlay, type VerbRound } from './verbRound'
import { PromptCard, TimerBar, NoVerbs } from './verbShared'
import { randomPrompt, choicesFor, blitzMultiplier, blitzPoints, type VerbPrompt } from '../../engine/games/verbPrompts'
import { Rng } from '../../engine/random'
import { playSound, buzz } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useKvValue } from '../../hooks/useProgress'
import { useSpeak } from '../../hooks/useSpeak'
import { Button, Chip } from '../../components/ui/basics'
import { Confetti } from '../../components/ui/Confetti'
import { Leo, Luna } from '../../components/ui/Dogs'
import { calmMotion, nudge } from '../../components/game/motion'

const SECONDS = 60

export default function VerbBlitz({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const data = useVerbRound(16, round)
  if (!data) return <GameHeader title="Verb blitz" subtitle="Loading your verbs…" onBack={onDone} />
  if (!data.deck.length || !data.tenses.length) {
    return (
      <div className="animate-rise pb-6">
        <GameHeader title="Verb blitz" onBack={onDone} />
        <NoVerbs onBack={onDone} />
      </div>
    )
  }
  return <Blitz key={round} data={data} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
}

interface Q {
  p: VerbPrompt
  options: string[]
  answer: number
}

function Blitz({ data, onDone, onAgain }: { data: VerbRound; onDone: () => void; onAgain: () => void }) {
  const [rng] = useState(() => new Rng(Date.now()))
  const best = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})
  const [prevBest, setPrevBest] = useState<number | undefined>()
  const [startedAt, setStartedAt] = useState<number | undefined>()
  const [left, setLeft] = useState(SECONDS)
  const [q, setQ] = useState<Q | undefined>()
  const [shownAt, setShownAt] = useState(0)
  const [picked, setPicked] = useState<number | undefined>()
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [asked, setAsked] = useState(0)
  const [right, setRight] = useState(0)
  const [misses, setMisses] = useState<VerbPrompt[]>([])
  const [over, setOver] = useState(false)
  const recent = useRef<string[]>([])
  const card = useRef<HTMLDivElement>(null)
  const startBtn = useRef<HTMLButtonElement>(null)
  const { say } = useSpeak()

  const end = () => {
    setPrevBest(best?.blitz?.score)
    setOver(true)
  }
  const nextQ = () => {
    const p = randomPrompt(kit, data.deck, data.tenses, rng, new Set(recent.current))
    if (!p) return end()
    recent.current = [...recent.current, p.key, p.verb.lemma].slice(-8)
    const { options, answer } = choicesFor(kit, p, rng, data.tenses, data.deck)
    setQ({ p, options, answer })
    setPicked(undefined)
    setShownAt(Date.now())
  }

  const start = () => {
    setStartedAt(Date.now())
    nextQ()
  }
  useEffect(() => {
    startBtn.current?.focus({ preventScroll: true })
  }, [])

  // the clock
  useEffect(() => {
    if (startedAt === undefined || over) return
    const t = setInterval(() => {
      const l = Math.max(0, SECONDS - Math.floor((Date.now() - startedAt) / 1000))
      setLeft(l)
      if (l === 0) end()
    }, 250)
    return () => clearInterval(t)
  }, [startedAt, over]) // eslint-disable-line react-hooks/exhaustive-deps

  // finished: best and minutes
  useEffect(() => {
    if (!over) return
    playSound('finish')
    void (async () => {
      await recordGame('blitz', { score, extra: { streak: bestStreak } })
      await addMinutes(SECONDS * 1000)
    })()
  }, [over]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q) e2eHook('verbs', { game: 'blitz', answer: q.p.answer, index: q.answer, options: q.options, asked })
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (i: number) => {
    if (!q || picked !== undefined || over) return
    setPicked(i)
    setAsked((n) => n + 1)
    const ok = i === q.answer
    recordVerb(q.p, ok ? 'correct' : 'wrong', Date.now() - shownAt < 2500)
    if (ok) {
      setScore((s) => s + blitzPoints(streak, q.p.irregular))
      setStreak((s) => s + 1)
      setBestStreak((b) => Math.max(b, streak + 1))
      setRight((r) => r + 1)
      const combo = blitzMultiplier(streak + 1) > blitzMultiplier(streak)
      playSound(combo ? 'combo' : 'correct')
      buzz(combo ? 'combo' : 'correct')
      void say(q.options[i]!)
    } else {
      setStreak(0)
      setMisses((m) => (m.some((x) => x.key === q.p.key) ? m : [...m, q.p]))
      playSound('wrong')
      if (!calmMotion()) nudge(card.current, 'shake')
    }
    setTimeout(nextQ, ok ? 380 : 1300)
  }

  // keys 1–4
  const chooseRef = useRef(choose)
  useLayoutEffect(() => {
    chooseRef.current = choose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) {
        e.preventDefault()
        chooseRef.current(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const mult = blitzMultiplier(streak)

  if (over) {
    const newBest = score > 0 && (prevBest === undefined || score > prevBest)
    return (
      <div className="animate-rise pb-6">
        <GameHeader title="Verb blitz" subtitle="Time!" onBack={onDone} />
        {newBest && !calmMotion() && <Confetti />}
        <div className="card text-center">
          <div className="mx-auto -mt-1 w-fit">{right >= 10 ? <Leo size={88} act="cheer" /> : <Luna size={88} act="talk" />}</div>
          <p className="font-display text-5xl">{score}</p>
          <p className="text-sm text-muted">
            points · {right} of {asked} right · best streak {bestStreak}
            {newBest ? ' · new best!' : prevBest ? ` · best ${prevBest}` : ''}
          </p>
          {misses.length > 0 && (
            <section className="mt-4 text-left" aria-label="Forms to practise">
              <h2 className="eyebrow mb-1">Practise these</h2>
              <ul className="grid gap-1 text-sm">
                {misses.slice(0, 8).map((p) => (
                  <li key={p.key} className="flex items-baseline gap-2 border-t border-line pt-1">
                    <span className="min-w-0 flex-1 truncate text-muted">
                      <span lang={TL}>{p.pronoun}</span> · <span lang={TL}>{p.verb.lemma}</span> · {shortTense(p.tenseLabel)}
                    </span>
                    <b lang={TL}>{p.answer}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={onDone}>
              Done
            </Button>
            <Button onClick={onAgain}>Play again</Button>
          </div>
        </div>
      </div>
    )
  }

  if (startedAt === undefined) {
    return (
      <div className="animate-rise pb-6">
        <GameHeader title="Verb blitz" subtitle="60 seconds. Four forms. Pick the right one." onBack={onDone} />
        <div className="card text-center">
          <div className="mx-auto w-fit">
            <Leo size={84} act="wave" />
          </div>
          <p className="mt-1 font-semibold">How many can you get in a minute?</p>
          <p className="mt-1 text-sm text-muted">Three in a row doubles your points, six triples them. Irregular forms are worth more.</p>
          <p className="mt-2 text-xs text-muted">Tenses in play: {tensesInPlay(data.tenses)} · keys 1–4 pick</p>
          <button ref={startBtn} type="button" className="btn btn-primary mt-4 w-full" onClick={start}>
            Start
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-rise pb-6">
      <GameHeader
        title="Verb blitz"
        subtitle={`${score} points · streak ${streak}`}
        right={
          <Chip tone={left <= 10 ? 'bad' : 'sky'} className="shrink-0 whitespace-nowrap tabular">
            {left} s
          </Chip>
        }
        onBack={onDone}
      />
      <TimerBar left={left * 1000} total={SECONDS * 1000} label="Time left" />
      <div className="mt-2 flex h-7 items-center justify-center">
        {mult > 1 && (
          <span key={mult} className="animate-pop rounded-full bg-[var(--sun)] px-3 py-0.5 text-sm font-extrabold text-[#2a1d00]" aria-live="polite">
            ×{mult} multiplier
          </span>
        )}
      </div>
      {q && (
        <div ref={card}>
          <PromptCard p={q.p} className="mt-1" />
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pick the form">
            {q.options.map((o, i) => {
              let cls = ''
              if (picked !== undefined) {
                if (i === q.answer) cls = 'correct'
                else if (i === picked) cls = 'wrong'
              }
              return (
                <button key={`${q.p.key}-${i}`} type="button" role="radio" aria-checked={picked === i} aria-keyshortcuts={String(i + 1)} disabled={picked !== undefined} onClick={() => choose(i)} className={`tile flex min-h-16 items-center gap-2 px-3 py-2.5 ${cls}`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-extrabold text-muted" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-lg leading-tight" lang={TL}>
                    {o}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 min-h-5 text-center text-sm font-semibold" role="status">
            {picked !== undefined && picked !== q.answer && (
              <span className="text-[var(--bad)]">
                <span lang={TL}>
                  {q.p.pronoun} {q.p.answer}
                </span>
                {q.p.english ? <span lang="en"> = {q.p.english}</span> : null}
              </span>
            )}
          </p>
        </div>
      )}
      <Button variant="ghost" className="mt-3 w-full" onClick={end}>
        Stop
      </Button>
    </div>
  )
}
