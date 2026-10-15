import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { VocabEntry } from '../engine/schema'
import { vocab, vocabUpTo, LEVEL_ORDER_LIST } from '../engine/loader'
import { IRREGULAR } from '@lang/verbs'
import { allCards, recordAnswer, bumpDay, getKv, setKv } from '../db/progress'
import { Rng } from '../engine/random'
import { pickGameWords, memoryBoard, rapidRound, rapidPoints, type MemoryTile, type RapidQuestion } from '../engine/vocabGame'
import { todayKey } from '../engine/mastery'
import { PageHeader, Button, Chip } from '../components/ui/basics'
import { useKvValue } from '../hooks/useProgress'
import { useSpeak } from '../hooks/useSpeak'
import { playSound } from '../engine/sounds'
import { Confetti } from '../components/ui/Confetti'
import type { LevelId } from '../engine/schema'
import { TL, tlOf } from '../engine/course'
import { ui, LANGUAGE } from '../engine/loader'

type Game = 'memory' | 'rapid'
interface Best {
  memoryMs?: number
  rapid?: number
}

export default function Palabras() {
  const nav = useNavigate()
  const best = useKvValue<Best>('palabrasBest', {})
  const [game, setGame] = useState<Game | undefined>()
  const [words, setWords] = useState<VocabEntry[] | undefined>()
  const [maxLevel, setMaxLevel] = useState<LevelId>('a1')
  const [count, setCount] = useState<number | undefined>()
  const start = async (g: Game) => {
    const cards = await allCards()
    const lvl = cards.reduce<LevelId>((m, c) => (LEVEL_ORDER_LIST.indexOf(c.level) > LEVEL_ORDER_LIST.indexOf(m) ? c.level : m), 'a1')
    const picked = pickGameWords(cards, (id) => vocab.get(id), g === 'memory' ? 8 : 30, new Rng(Date.now()))
    setMaxLevel(lvl)
    setCount(cards.filter((c) => c.kind === 'word').length)
    setWords(picked)
    setGame(g)
  }
  const done = () => {
    setGame(undefined)
    setWords(undefined)
  }
  if (game === 'memory' && words) {
    if (words.length < 4) return <TooFew onBack={done} />
    return <Memory words={words} onDone={done} best={best?.memoryMs} />
  }
  if (game === 'rapid' && words) {
    if (words.length < 4) return <TooFew onBack={done} />
    return <Rapid words={words} maxLevel={maxLevel} onDone={done} best={best?.rapid} />
  }
  return (
    <div className="animate-rise pb-6">
      <PageHeader title={ui.games.name} subtitle="Two quick games with the words you are learning. Every answer counts as a review." />
      <button type="button" onClick={() => void start('memory')} className="card mb-3 flex w-full items-center gap-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-2xl" aria-hidden="true">🎴</span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{ui.games.memory}</span>
          <span className="block text-sm text-muted">Flip tiles and match each {LANGUAGE} word with its meaning. 8 pairs against the clock.</span>
          {best?.memoryMs ? <span className="mt-1 block text-xs font-bold text-ok-600">Best: {(best.memoryMs / 1000).toFixed(1)} s</span> : null}
        </span>
      </button>
      <button type="button" onClick={() => void start('rapid')} className="card mb-3 flex w-full items-center gap-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sunset-gradient text-2xl" aria-hidden="true">⚡</span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{ui.games.rapid}</span>
          <span className="block text-sm text-muted">60 seconds, as many meanings as you can. Keep a streak for a multiplier.</span>
          {best?.rapid ? <span className="mt-1 block text-xs font-bold text-ok-600">Best: {best.rapid} points</span> : null}
        </span>
      </button>
      {count === 0 && <p className="text-center text-sm text-muted">Finish a lesson first so there are words to play with.</p>}
      <p className="mt-4 text-center text-xs"><button type="button" className="font-bold text-muted underline" onClick={() => nav('/review')}>Back to Review</button></p>
    </div>
  )
}

function TooFew({ onBack }: { onBack: () => void }) {
  return (
    <div className="card text-center">
      <p className="font-extrabold">Not enough words yet</p>
      <p className="mt-1 text-sm text-muted">Complete a lesson or two and come back: the games use the words you have met.</p>
      <Button className="mt-3 w-full" onClick={onBack}>Back</Button>
    </div>
  )
}

function Memory({ words, onDone, best }: { words: VocabEntry[]; onDone: () => void; best?: number }) {
  const [rng] = useState(() => new Rng(Date.now()))
  const tiles = useMemo(() => memoryBoard(words, rng, Math.min(8, words.length)), [words, rng])
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)
  const [startedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [finishedMs, setFinishedMs] = useState<number | undefined>()
  const { say } = useSpeak()
  const lock = useRef(false)
  useEffect(() => {
    if (finishedMs !== undefined) return
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 200)
    return () => clearInterval(t)
  }, [startedAt, finishedMs])
  const pairs = tiles.length / 2
  const flip = (i: number) => {
    if (lock.current || open.includes(i) || matched.has(tiles[i]!.key)) return
    const next = [...open, i]
    setOpen(next)
    if (tiles[i]!.side === 'es') void say(tiles[i]!.text)
    if (next.length === 2) {
      lock.current = true
      setMoves((m) => m + 1)
      const [a, b] = next.map((k) => tiles[k]!)
      const hit = a!.key === b!.key && a!.side !== b!.side
      setTimeout(() => {
        if (hit) {
          const m = new Set(matched)
          m.add(a!.key)
          setMatched(m)
          void recordAnswer(a!.key, 'correct', 'match', { fast: true })
          playSound('correct')
          if (m.size === pairs) {
            const ms = Date.now() - startedAt
            setFinishedMs(ms)
            playSound('finish')
            void (async () => {
              const b2 = await getKv<Best>('palabrasBest', {})
              await setKv('palabrasBest', { ...b2, memoryMs: Math.min(b2.memoryMs ?? Infinity, ms) })
              await bumpDay(todayKey(), { minutes: Math.max(1, Math.round(ms / 60000)) })
            })()
          }
        } else {
          void recordAnswer(a!.key, 'wrong', 'match')
        }
        setOpen([])
        lock.current = false
      }, hit ? 350 : 800)
    }
  }
  return (
    <div className="animate-rise pb-6">
      <PageHeader title={ui.games.memory} subtitle={`${matched.size} / ${pairs} pairs · ${moves} moves`} right={<Chip tone="sky">{((finishedMs ?? elapsed) / 1000).toFixed(1)} s</Chip>} />
      {finishedMs !== undefined && <Confetti />}
      <div className="grid grid-cols-4 gap-2" role="grid" aria-label="Memory board">
        {tiles.map((t: MemoryTile, i) => {
          const up = open.includes(i) || matched.has(t.key)
          const done = matched.has(t.key)
          return (
            <button
              key={i}
              type="button"
              onClick={() => flip(i)}
              disabled={done || finishedMs !== undefined}
              aria-label={up ? t.text : 'Hidden tile'}
              lang={tlOf(t.side)}
              className={`flex aspect-square items-center justify-center rounded-2xl border-2 p-1 text-center text-xs font-extrabold leading-tight transition sm:text-sm ${done ? 'border-ok-500 bg-ok-100 text-ok-700 dark:bg-ok-500/20' : up ? 'border-brand-500 bg-brand-100 dark:bg-brand-500/20' : 'border-line bg-surface shadow-card hover:-translate-y-0.5'}`}
            >
              {up ? t.text : <span className="text-2xl" aria-hidden="true">🐾</span>}
            </button>
          )
        })}
      </div>
      {finishedMs !== undefined && (
        <div className="card mt-4 text-center">
          <p className="text-2xl font-extrabold">{ui.games.win}</p>
          <p className="text-sm text-muted">
            {pairs} pairs in {(finishedMs / 1000).toFixed(1)} s and {moves} moves.{best && finishedMs < best ? ' New best time!' : best ? ` Best: ${(best / 1000).toFixed(1)} s.` : ''}
          </p>
          <Button className="mt-3 w-full" onClick={onDone}>Done</Button>
        </div>
      )}
      {finishedMs === undefined && <Button variant="ghost" className="mt-4 w-full" onClick={onDone}>Quit</Button>}
    </div>
  )
}

const RAPID_SECONDS = 60

function Rapid({ words, maxLevel, onDone, best }: { words: VocabEntry[]; maxLevel: LevelId; onDone: () => void; best?: number }) {
  const [rng] = useState(() => new Rng(Date.now()))
  const questions = useMemo(() => rapidRound(words, { vocab, pool: vocabUpTo(maxLevel), verbs: IRREGULAR, stageOf: () => 0, speech: false }, rng), [words, maxLevel, rng])
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [right, setRight] = useState(0)
  const [picked, setPicked] = useState<number | undefined>()
  const [left, setLeft] = useState(RAPID_SECONDS)
  const [over, setOver] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const { say } = useSpeak()
  useEffect(() => {
    if (over) return
    const t = setInterval(() => {
      const l = Math.max(0, RAPID_SECONDS - Math.floor((Date.now() - startedAt) / 1000))
      setLeft(l)
      if (l === 0) setOver(true)
    }, 250)
    return () => clearInterval(t)
  }, [startedAt, over])
  const q: RapidQuestion | undefined = questions[i]
  const finished = over || i >= questions.length
  useEffect(() => {
    if (!finished) return
    playSound('finish')
    void (async () => {
      const b = await getKv<Best>('palabrasBest', {})
      await setKv('palabrasBest', { ...b, rapid: Math.max(b.rapid ?? 0, score) })
      await bumpDay(todayKey(), { minutes: 1 })
    })()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps
  const answer = (oi: number) => {
    if (!q || picked !== undefined || finished) return
    setPicked(oi)
    const ok = oi === q.answer
    void recordAnswer(q.v.id, ok ? 'correct' : 'wrong', 'choiceEs', { fast: true })
    if (ok) {
      void say(q.v.lemma)
      setScore((s) => s + rapidPoints(streak))
      setStreak((s) => s + 1)
      setRight((r) => r + 1)
      playSound('correct')
    } else {
      setStreak(0)
      playSound('wrong')
    }
    setTimeout(() => {
      setPicked(undefined)
      setI((k) => k + 1)
    }, ok ? 350 : 900)
  }
  const mult = Math.min(4, 1 + Math.floor(streak / 3))
  if (finished) {
    return (
      <div className="animate-rise pb-6 text-center">
        <PageHeader title={ui.games.rapid} />
        {score > 0 && score >= (best ?? 0) && <Confetti />}
        <p className="text-5xl font-extrabold text-gradient">{score}</p>
        <p className="text-sm text-muted">points · {right} of {i} right{best !== undefined && score > best ? ' · new best!' : best ? ` · best ${best}` : ''}</p>
        <Button className="mt-6 w-full" onClick={onDone}>Done</Button>
      </div>
    )
  }
  return (
    <div className="animate-rise pb-6">
      <PageHeader title={ui.games.rapid} subtitle={`${score} points · streak ${streak}`} right={<Chip tone={left <= 10 ? 'bad' : 'sky'}>{left} s</Chip>} />
      {mult > 1 && <p className="mb-2 text-center text-xs font-extrabold text-gold-600">×{mult} multiplier</p>}
      {q && (
        <div className="card">
          <p className="text-center text-xs font-extrabold uppercase tracking-wider text-brand-600">What does it mean?</p>
          <p className="my-4 text-center font-display text-3xl" lang={TL}>{q.v.lemma}</p>
          <div className="grid gap-2" role="radiogroup">
            {q.options.map((o, oi) => {
              let cls = ''
              if (picked !== undefined) {
                if (oi === q.answer) cls = 'correct'
                else if (oi === picked) cls = 'wrong'
              }
              return (
                <button key={oi} type="button" role="radio" aria-checked={picked === oi} disabled={picked !== undefined} onClick={() => answer(oi)} className={`tile py-2.5 ${cls}`} lang="en">
                  {o}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <Button variant="ghost" className="mt-4 w-full" onClick={() => setOver(true)}>Stop</Button>
    </div>
  )
}
