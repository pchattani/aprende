/**
 * Word rain: an English prompt sits on the ground; target-language words fall in three lanes
 * and the learner taps the one that matches before it lands. A wrong tap or a landed answer
 * costs a paw (three in all). The fall speeds up gently. The loop runs on requestAnimationFrame
 * and moves the words with transforms only; React re-renders when a word appears or goes.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { languagePack } from '@lang'
import { IRREGULAR } from '@lang/verbs'
import type { VocabEntry } from '../../engine/schema'
import { vocab } from '../../engine/loader'
import { distractorWords } from '../../engine/generate'
import { rapidPoints } from '../../engine/vocabGame'
import { RAIN_LANES, RAIN_LIVES, nextPrompt, pickPrompt, removeDrop, startRain, stepRain, type RainState } from '../../engine/games/wordRain'
import { Rng } from '../../engine/random'
import { recordAnswer } from '../../db/progress'
import { playSound, buzz } from '../../engine/sounds'
import { useSpeak } from '../../hooks/useSpeak'
import { useKvValue } from '../../hooks/useProgress'
import { Button, Chip } from '../../components/ui/basics'
import { IconPaw, IconPause, IconPlay } from '../../components/ui/icons'
import { Confetti } from '../../components/ui/Confetti'
import { Bonchita, Leo } from '../../components/ui/Dogs'
import { TargetText } from '../../components/ui/TargetText'
import { calmMotion, nudge } from '../../components/game/motion'
import { RoundButtons, TooFew } from '../palabras/shared'
import { addMinutes, e2eHook } from '../palabras/util'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { GAMES_BEST_KEY, recordGame, useGameWords, type GameBest } from './util'
import { REQUIRE, hasGloss } from './requirements'
import { useFinishedWords } from '../../hooks/useFinishedWords'

const ID = 'rain'
const TITLE = 'Word rain'
/** Spelling key: two entries spelled alike must never be told apart by meaning on screen. */
const spell = (s: string) => languagePack.stripMarks(languagePack.normalize(s))
const gloss = (g: string) => g.toLowerCase().replace(/\(.*?\)/g, '').replace(/^to /, '').trim()
/** Height of a falling word before it has been measured. */
const DROP_H = 56

export default function WordRain({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const words = useGameWords(40, hasGloss, round)
  const finished = useFinishedWords()
  const best = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})?.[ID]
  if (!words || !finished) return <GameHeader title={TITLE} subtitle="Loading your words…" onBack={onDone} />
  if (words.length < REQUIRE[ID]!.need) {
    return (
      <div className="animate-rise pb-6">
        <GameHeader title={TITLE} onBack={onDone} />
        <TooFew onBack={onDone} game={ID} />
      </div>
    )
  }
  return <Rain key={round} words={words} pool={finished.entries} best={best?.score} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
}

type Phase = 'ready' | 'play' | 'paused' | 'over'
interface Pop {
  key: number
  lane: number
  /** Pixels from the top of the field. */
  top: number
  text: string
}
interface Feedback {
  tone: 'ok' | 'bad'
  /** Target-language word and what it means. */
  word: string
  meaning: string
  note?: 'landed' | 'wrong'
}

function Rain({ words, pool, best, onDone, onAgain }: { words: VocabEntry[]; pool: VocabEntry[]; best?: number; onDone: () => void; onAgain: () => void }) {
  const { say } = useSpeak()
  const [rng] = useState(() => new Rng(Date.now()))
  const reduced = useMemo(() => calmMotion(), [])

  // prompts (the learner's words) and up to three same-topic distractors each, from the finished words only
  const { prompts, distractors, byId } = useMemo(() => {
    const ctx = { vocab, pool, verbs: IRREGULAR, stageOf: () => 0 as const, speech: false }
    const byId = new Map<string, VocabEntry>()
    const distractors = new Map<string, string[]>()
    for (const v of words) {
      const ds = distractorWords(v, ctx, rng, 3).filter((d) => spell(d.lemma) !== spell(v.lemma) && (!v.jp || d.jp !== v.jp))
      if (ds.length < 2) continue
      byId.set(v.id, v)
      for (const d of ds) byId.set(d.id, d)
      distractors.set(v.id, ds.map((d) => d.id))
    }
    return { prompts: words.filter((v) => distractors.has(v.id)).map((v) => v.id), distractors, byId }
  }, [words, pool, rng])

  const st = useRef<RainState | undefined>(undefined)
  const order = useRef<string[]>([])
  const recent = useRef<string[]>([])
  /** The current prompt was tapped wrongly once already (recorded as "almost" when caught). */
  const slipped = useRef(false)
  const nodes = useRef(new Map<number, HTMLElement>())
  const heights = useRef(new Map<number, number>())
  const field = useRef<HTMLDivElement>(null)
  const fieldH = useRef(400)
  const livesRef = useRef(RAIN_LIVES)
  /** Words tapped wrongly, shaking before they burst. */
  const busy = useRef(new Set<number>())
  const popKey = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [drops, setDrops] = useState<{ key: number; id: string; lane: number }[]>([])
  const [target, setTarget] = useState<string | undefined>()
  const [lives, setLives] = useState(RAIN_LIVES)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [caught, setCaught] = useState(0)
  const [asked, setAsked] = useState(0)
  const [pops, setPops] = useState<Pop[]>([])
  const [wrong, setWrong] = useState<number | undefined>()
  const [feedback, setFeedback] = useState<Feedback | undefined>()
  const [mood, setMood] = useState<'curious' | 'cheer' | 'sad'>('curious')

  const sync = () => setDrops(st.current ? st.current.drops.map(({ key, id, lane }) => ({ key, id, lane })) : [])
  const yPx = (key: number, y: number) => (y * (fieldH.current - (heights.current.get(key) ?? DROP_H))).toFixed(1)

  useEffect(() => {
    if (!target) return
    const v = byId.get(target)
    e2eHook('rain', { target: v?.lemma, prompt: v?.en[0], onScreen: drops.map((d) => byId.get(d.id)?.lemma) })
  }, [target, drops, byId])

  // the field's height, for the fall distance
  useEffect(() => {
    const el = field.current
    if (!el) return
    fieldH.current = el.clientHeight
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => (fieldH.current = el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** The next prompt: not on screen, not just asked, and nothing falling that means or looks the same. */
  const choosePrompt = (s: RainState | undefined): string => {
    const falling = (s?.drops ?? []).map((d) => byId.get(d.id)!)
    const glosses = new Set(falling.flatMap((v) => v.en.map(gloss)))
    const spellings = new Set(falling.map((v) => spell(v.lemma)))
    const onScreen = new Set(falling.map((v) => v.id))
    const ok = (id: string) => {
      const v = byId.get(id)!
      return !spellings.has(spell(v.lemma)) && !v.en.some((g) => glosses.has(gloss(g)))
    }
    const id = pickPrompt(order.current, onScreen, recent.current, ok)!
    order.current = [...order.current.filter((x) => x !== id), id]
    recent.current = [...recent.current, id].slice(-3)
    slipped.current = false
    setAsked((n) => n + 1)
    return id
  }

  const start = () => {
    // due and weak words come first; shuffle the front a little so rounds differ
    order.current = rng.shuffle(prompts.slice(0, 12)).concat(prompts.slice(12))
    const first = choosePrompt(undefined)
    st.current = startRain(first, distractors.get(first)!, rng)
    setTarget(first)
    sync()
    setPhase('play')
  }

  const advance = () => {
    const s = st.current!
    const next = choosePrompt(s)
    st.current = nextPrompt(s, next, distractors.get(next)!, rng)
    setTarget(next)
  }

  const loseLife = () => {
    livesRef.current = Math.max(0, livesRef.current - 1)
    setLives(livesRef.current)
    setStreak(0)
    setMood('sad')
    playSound('wrong')
    if (livesRef.current === 0) setPhase('over')
  }

  const addPop = (lane: number, y: number, text: string) => {
    const key = ++popKey.current
    setPops((p) => [...p, { key, lane, top: y * (fieldH.current - DROP_H), text }])
    setTimeout(() => setPops((p) => p.filter((x) => x.key !== key)), 650)
  }

  // the loop: runs only while playing; a pause or the end stops it
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const s = st.current
      if (!s) return
      const r = stepRain(s, (now - last) / 1000, rng, { reduced })
      last = now
      st.current = r.state
      for (const d of r.state.drops) {
        const el = nodes.current.get(d.key)
        if (el) el.style.transform = `translate3d(0, ${yPx(d.key, d.y)}px, 0)`
      }
      if (r.spawned || r.landed.length) sync()
      for (const d of r.landed) {
        heights.current.delete(d.key)
        if (d.id !== r.state.target) continue
        // the answer landed: a paw lost, the right word shown, a new prompt
        const v = byId.get(d.id)!
        void recordAnswer(v.id, 'wrong', 'choiceEn')
        setFeedback({ tone: 'bad', word: v.lemma, meaning: v.en[0]!, note: 'landed' })
        loseLife()
        if (livesRef.current > 0) advance()
      }
      if (livesRef.current > 0) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // leaving the tab pauses the game
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) setPhase((p) => (p === 'play' ? 'paused' : p))
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  // game over: best score and minutes
  useEffect(() => {
    if (phase !== 'over') return
    playSound('finish')
    const ms = (st.current?.elapsed ?? 0) * 1000
    void (async () => {
      await recordGame(ID, { score })
      await addMinutes(ms)
    })()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (key: number) => {
    const s = st.current
    if (phase !== 'play' || !s || busy.current.has(key)) return
    const d = s.drops.find((x) => x.key === key)
    if (!d) return
    const v = byId.get(d.id)!
    if (d.id === s.target) {
      const pts = rapidPoints(streak)
      setScore((x) => x + pts)
      setStreak((x) => x + 1)
      setCaught((x) => x + 1)
      setMood('cheer')
      setFeedback({ tone: 'ok', word: v.lemma, meaning: v.en[0]! })
      void recordAnswer(v.id, slipped.current ? 'almost' : 'correct', 'choiceEn', { fast: !slipped.current })
      playSound('correct')
      buzz('correct')
      void say(v.lemma)
      addPop(d.lane, d.y, `+${pts}`)
      st.current = removeDrop(s, key)
      heights.current.delete(key)
      advance()
      sync()
      return
    }
    // a wrong word: it shakes, shows what it means, and bursts
    busy.current.add(key)
    slipped.current = true
    setWrong(key)
    setFeedback({ tone: 'bad', word: v.lemma, meaning: v.en[0]!, note: 'wrong' })
    if (!reduced) nudge(nodes.current.get(key)?.firstElementChild, 'shake')
    loseLife()
    setTimeout(() => {
      busy.current.delete(key)
      setWrong((w) => (w === key ? undefined : w))
      if (st.current) st.current = removeDrop(st.current, key)
      heights.current.delete(key)
      sync()
    }, 380)
  }

  const prompt = target ? byId.get(target) : undefined
  const mult = Math.min(4, 1 + Math.floor(streak / 3))

  if (phase === 'over') {
    const isBest = score > 0 && (best === undefined || score > best)
    return (
      <div className="animate-rise pb-6 text-center">
        <GameHeader title={TITLE} onBack={onDone} />
        {isBest && <Confetti />}
        <div className="mx-auto w-fit">
          <Leo size={96} act={caught >= 5 ? 'cheer' : 'curious'} />
        </div>
        <p className="mt-1 font-display text-5xl">{score}</p>
        <p className="text-sm text-muted">
          points · {caught} of {asked} caught{isBest ? ' · new best!' : best ? ` · best ${best}` : ''}
        </p>
        {feedback?.tone === 'bad' && (
          <p className="mt-3 text-sm">
            Last one: <TargetText text={feedback.word} className="font-bold" /> = <span lang="en">{feedback.meaning}</span>
          </p>
        )}
        <RoundButtons onAgain={onAgain} onDone={onDone} />
      </div>
    )
  }

  const paused = phase === 'paused'
  return (
    <div className="animate-rise pb-6">
      <GameHeader
        title={TITLE}
        subtitle={phase === 'ready' ? 'Catch the word before it lands.' : `${score} points · streak ${streak}`}
        onBack={onDone}
        right={
          phase !== 'ready' ? (
            <button
              type="button"
              onClick={() => setPhase(paused ? 'play' : 'paused')}
              className="tile mt-1 flex h-11 w-11 shrink-0 items-center justify-center px-0 py-0"
              aria-label={paused ? 'Resume' : 'Pause'}
              aria-pressed={paused}
            >
              {paused ? <IconPlay width={20} height={20} /> : <IconPause width={20} height={20} />}
            </button>
          ) : undefined
        }
      />
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <span className="flex items-center gap-1" role="img" aria-label={`${lives} of ${RAIN_LIVES} paws left`}>
          {Array.from({ length: RAIN_LIVES }, (_, i) => (
            <IconPaw key={i} width={24} height={24} className={`transition-opacity ${i < lives ? 'text-coral-500' : 'text-line opacity-60'}`} />
          ))}
        </span>
        {mult > 1 && <Chip tone="gold">×{mult} multiplier</Chip>}
      </div>

      <div
        ref={field}
        className="relative h-[min(54vh,470px)] min-h-[300px] overflow-hidden rounded-2xl border-[1.5px] border-line bg-[linear-gradient(180deg,color-mix(in_srgb,var(--blue)_13%,var(--card)),var(--card)_85%)]"
        role="group"
        aria-label="Falling words"
      >
        <div className={paused ? 'invisible' : undefined}>
          {drops.map((d) => {
            const v = byId.get(d.id)!
            return (
              <div
                key={d.key}
                ref={(el) => {
                  if (!el) {
                    nodes.current.delete(d.key)
                    return
                  }
                  // the loop owns the transform; a new word starts where the game state has it
                  if (!nodes.current.has(d.key)) {
                    heights.current.set(d.key, el.offsetHeight)
                    el.style.transform = `translate3d(0, ${yPx(d.key, st.current?.drops.find((x) => x.key === d.key)?.y ?? 0)}px, 0)`
                  }
                  nodes.current.set(d.key, el)
                }}
                className="absolute top-0 px-1 will-change-transform"
                style={{ left: `${(d.lane * 100) / RAIN_LANES}%`, width: `${100 / RAIN_LANES}%` }}
              >
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    tap(d.key)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      tap(d.key)
                    }
                  }}
                  disabled={paused}
                  data-word={v.lemma}
                  className={`tile flex min-h-12 w-full touch-manipulation items-center justify-center px-1.5 py-2 text-center text-[1.05rem] leading-tight [overflow-wrap:anywhere] ${wrong === d.key ? 'wrong' : ''}`}
                >
                  <TargetText text={v.lemma} />
                </button>
              </div>
            )
          })}
          {pops.map((p) => (
            <span
              key={p.key}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 text-center font-display text-2xl font-bold text-[var(--ok)]"
              style={{ left: `${(p.lane * 100) / RAIN_LANES}%`, width: `${100 / RAIN_LANES}%`, transform: `translate3d(0, ${p.top.toFixed(0)}px, 0)` }}
              ref={(el) => {
                if (el && !reduced && !el.dataset.played && typeof el.animate === 'function') {
                  el.dataset.played = '1'
                  el.animate([{ opacity: 1, translate: '0 0', scale: '1' }, { opacity: 0, translate: '0 -40px', scale: '1.3' }], { duration: 640, easing: 'ease-out', fill: 'forwards' })
                }
              }}
            >
              {p.text}
            </span>
          ))}
        </div>

        {phase === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Bonchita size={84} act="talk" />
            <p className="text-sm text-ink-2">The English word sits on the ground. Tap the matching word before it lands. A wrong tap or a landed answer costs a paw.</p>
            <Button onClick={start} className="w-full max-w-60">
              Start
            </Button>
          </div>
        )}
        {paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[color-mix(in_srgb,var(--card)_80%,transparent)] p-6 text-center">
            <p className="font-display text-2xl">Paused</p>
            <Button onClick={() => setPhase('play')} className="w-full max-w-60">
              Resume
            </Button>
          </div>
        )}
      </div>

      {/* the ground: the English prompt */}
      <div className="relative -mt-3 rounded-b-2xl border-[1.5px] border-t-0 border-[color-mix(in_srgb,var(--ok)_45%,var(--line))] bg-[color-mix(in_srgb,var(--ok)_12%,var(--card))] px-3 pb-3 pt-5 shadow-card">
        <div className="flex items-center gap-3">
          <Bonchita size={48} act={phase === 'ready' ? 'idle' : mood} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Catch the word for</p>
            <p className="truncate font-display text-2xl leading-tight" lang="en" aria-live="polite" data-testid="rain-prompt">
              {phase === 'ready' ? '…' : (prompt?.en[0] ?? '')}
            </p>
          </div>
        </div>
        <p className="mt-1.5 min-h-5 text-center text-sm font-semibold" role="status" aria-live="polite">
          {feedback ? (
            <span className={feedback.tone === 'ok' ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}>
              {feedback.note === 'landed' ? 'Missed: ' : feedback.note === 'wrong' ? 'Not that one: ' : ''}
              <TargetText text={feedback.word} /> = <span lang="en">{feedback.meaning}</span>
            </span>
          ) : (
            <span className="text-xs font-medium text-muted">Words fall faster as you go.</span>
          )}
        </p>
      </div>
      {phase !== 'ready' && (
        <Button variant="ghost" className="mt-4 w-full" onClick={() => setPhase('over')}>
          Stop
        </Button>
      )}
    </div>
  )
}
