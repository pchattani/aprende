/**
 * Verb duel: race Luna to the right form. Each turn shows a prompt; type the form (or pick it,
 * a toggle) while Luna thinks. Whoever answers first and right takes the point; first to ten
 * wins the bone. Luna's speed follows the learner's pace and accuracy (engine/games/verbDuel.ts).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { recordGame, GAMES_BEST_KEY, type GameBest } from './util'
import { addMinutes, e2eHook } from '../palabras/util'
import { kit, useVerbRound, recordVerb, tensesInPlay, type VerbRound } from './verbRound'
import { PromptCard, FormInput, NoVerbs } from './verbShared'
import { randomPrompt, choicesFor, gradeForm, type VerbPrompt } from '../../engine/games/verbPrompts'
import { lunaPlan, duelWinner, banter, DUEL_TARGET, DUEL_MAX_TURNS, type LunaPlan, type BANTER } from '../../engine/games/verbDuel'
import { Rng } from '../../engine/random'
import { playSound, buzz } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useKvValue } from '../../hooks/useProgress'
import { Button } from '../../components/ui/basics'
import { Confetti } from '../../components/ui/Confetti'
import { Leo, Bonchita, Luna } from '../../components/ui/Dogs'
import { calmMotion } from '../../components/game/motion'
import type { Act } from '../../components/art/dogPose'

type Mode = 'type' | 'pick'

export default function VerbDuel({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const [mode, setMode] = useState<Mode>('type')
  const data = useVerbRound(16, round)
  if (!data) return <GameHeader title="Verb duel" subtitle="Loading your verbs…" onBack={onDone} />
  if (!data.deck.length || !data.tenses.length) {
    return (
      <div className="animate-rise pb-6">
        <GameHeader title="Verb duel" onBack={onDone} />
        <NoVerbs onBack={onDone} />
      </div>
    )
  }
  return <Duel key={round} data={data} mode={mode} setMode={setMode} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
}

interface Turn {
  p: VerbPrompt
  options: string[]
  answer: number
  at: number
  plan: LunaPlan
  luna: 'thinking' | 'right' | 'wrong'
  lunaSaid?: string
  mine: 'open' | 'right' | 'wrong'
  picked?: number
  note?: string
  /** Who took the point: set when the turn is over. */
  point?: 'me' | 'luna' | 'none'
}
interface State {
  phase: 'ready' | 'turn' | 'reveal' | 'over'
  me: number
  luna: number
  turns: number
  turn?: Turn
  times: number[]
  results: boolean[]
  line: string
  result?: 'me' | 'luna' | 'draw'
}

/** "Luna: “Hi”" → { dog: 'Luna', text: '“Hi”' }. */
const speaker = (line: string) => {
  const m = /^(Leo|Bonchita|Luna): (.*)$/.exec(line)
  return m ? { dog: m[1] as 'Leo' | 'Bonchita' | 'Luna', text: m[2]! } : { dog: 'Leo' as const, text: line }
}

function Duel({ data, mode, setMode, onDone, onAgain }: { data: VerbRound; mode: Mode; setMode: (m: Mode) => void; onDone: () => void; onAgain: () => void }) {
  const [rng] = useState(() => new Rng(Date.now()))
  const [startedAt] = useState(() => Date.now())
  const best = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})
  const [s, setS] = useState<State>(() => ({ phase: 'ready', me: 0, luna: 0, turns: 0, times: [], results: [], line: banter('start', rng) }))
  const ref = useRef(s)
  const update = (f: (st: State) => State) => {
    ref.current = f(ref.current)
    setS(ref.current)
  }
  const [text, setText] = useState('')
  const [wins, setWins] = useState<{ wins: number; losses: number } | undefined>()
  const timers = useRef<number[]>([])
  const recent = useRef<string[]>([])
  const nextBtn = useRef<HTMLButtonElement>(null)
  const modeRef = useRef(mode)
  useLayoutEffect(() => {
    modeRef.current = mode
  })

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clearTimers, [])
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const say = (kind: keyof typeof BANTER, form = '') => banter(kind, rng, form)

  /** The turn is decided: show the answer, then the next prompt (or the end). */
  const settle = (point: 'me' | 'luna' | 'none', line: string) => {
    clearTimers()
    const st = ref.current
    const me = st.me + (point === 'me' ? 1 : 0)
    const luna = st.luna + (point === 'luna' ? 1 : 0)
    const turns = st.turns + 1
    const result = duelWinner(me, luna, turns)
    update((x) => ({ ...x, me, luna, turns, phase: 'reveal', turn: x.turn && { ...x.turn, point }, line: result ? say(result === 'me' ? 'win' : 'lose') : line }))
    if (result) {
      later(() => finish(result), 1400)
    } else {
      later(startTurn, 2200)
    }
  }

  const finish = (result: 'me' | 'luna' | 'draw') => {
    clearTimers()
    update((x) => ({ ...x, phase: 'over', result }))
    playSound('finish')
    const prev = best?.duel?.extra ?? {}
    const w = { wins: Number(prev.wins ?? 0) + (result === 'me' ? 1 : 0), losses: Number(prev.losses ?? 0) + (result === 'luna' ? 1 : 0) }
    setWins(w)
    void (async () => {
      await recordGame('duel', { score: ref.current.me, extra: w })
      await addMinutes(Date.now() - startedAt)
    })()
  }

  const lunaAnswers = () => {
    const st = ref.current
    const t = st.turn
    if (st.phase !== 'turn' || !t || t.point) return
    if (t.plan.correct) {
      playSound('wrong')
      update((x) => ({ ...x, turn: x.turn && { ...x.turn, luna: 'right', lunaSaid: t.p.answer } }))
      settle('luna', say('lunaFirst', t.p.answer))
      return
    }
    const wrong = t.options.find((_, i) => i !== t.answer) ?? '…'
    update((x) => ({ ...x, turn: x.turn && { ...x.turn, luna: 'wrong', lunaSaid: wrong }, line: say('lunaWrong') }))
    if (t.mine === 'wrong') settle('none', say('nobody', t.p.answer))
  }

  const startTurn = () => {
    clearTimers()
    const st = ref.current
    const p = randomPrompt(kit, data.deck, data.tenses, rng, new Set(recent.current))
    if (!p) return finish(st.me > st.luna ? 'me' : st.luna > st.me ? 'luna' : 'draw')
    recent.current = [...recent.current, p.key, p.verb.lemma].slice(-8)
    const { options, answer } = choicesFor(kit, p, rng, data.tenses, data.deck)
    const plan = lunaPlan({ times: st.times, results: st.results, lead: st.me - st.luna, mode: modeRef.current }, rng)
    update((x) => ({ ...x, phase: 'turn', turn: { p, options, answer, at: Date.now(), plan, luna: 'thinking', mine: 'open' } }))
    setText('')
    later(lunaAnswers, plan.delay)
    // nobody gets it in time
    later(() => {
      const t = ref.current.turn
      if (ref.current.phase !== 'turn' || !t || t.point) return
      if (t.mine === 'open') update((x) => ({ ...x, results: [...x.results, false] }))
      settle('none', say('nobody', t.p.answer))
    }, Math.max(20000, plan.delay * 2.5))
  }

  const answer = (given: { text?: string; index?: number }) => {
    const st = ref.current
    const t = st.turn
    if (st.phase !== 'turn' || !t || t.mine !== 'open' || t.point) return
    const ms = Date.now() - t.at
    const g = given.index !== undefined ? { verdict: given.index === t.answer ? ('correct' as const) : ('wrong' as const), note: undefined } : gradeForm(kit, t.p, given.text ?? '')
    if (given.text !== undefined && !given.text.trim()) return
    recordVerb(t.p, g.verdict, ms < (modeRef.current === 'pick' ? 2500 : 5000))
    if (g.verdict !== 'wrong') {
      playSound('correct')
      buzz('correct')
      update((x) => ({ ...x, times: [...x.times, ms], results: [...x.results, true], turn: x.turn && { ...x.turn, mine: 'right', picked: given.index, note: g.note } }))
      settle('me', say('meFirst'))
      return
    }
    playSound('wrong')
    update((x) => ({ ...x, results: [...x.results, false], turn: x.turn && { ...x.turn, mine: 'wrong', picked: given.index, note: g.note }, line: say('meWrong') }))
    if (t.luna === 'wrong') settle('none', say('nobody', t.p.answer))
  }

  useEffect(() => {
    if (s.phase === 'reveal') nextBtn.current?.focus({ preventScroll: true })
    const t = s.turn
    e2eHook('verbs', { game: 'duel', phase: s.phase, me: s.me, luna: s.luna, answer: t?.p.answer, accepts: t?.p.accepts, index: t?.answer, options: t?.options, lunaDelay: t?.plan.delay })
  }, [s.phase, s.turn?.p.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // keys 1–4 in pick mode
  const answerRef = useRef(answer)
  useLayoutEffect(() => {
    answerRef.current = answer
  })
  useEffect(() => {
    if (mode !== 'pick') return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.tagName === 'INPUT') return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) {
        e.preventDefault()
        answerRef.current({ index: n - 1 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  const t = s.turn
  const lunaAct: Act = s.phase === 'over' ? (s.result === 'luna' ? 'cheer' : 'sad') : !t ? 'idle' : t.point === 'luna' ? 'cheer' : t.point === 'me' ? 'sad' : t.luna === 'thinking' ? 'think' : t.luna === 'wrong' ? 'sad' : 'idle'
  const who = speaker(s.line)

  if (s.phase === 'over') {
    const won = s.result === 'me'
    return (
      <div className="animate-rise pb-6">
        <GameHeader title="Verb duel" subtitle={won ? 'You won the bone!' : s.result === 'draw' ? 'A draw!' : 'Luna won the bone'} onBack={onDone} />
        {won && !calmMotion() && <Confetti />}
        <div className="card text-center">
          <div className="flex items-end justify-center gap-2">
            {won ? <Leo size={92} act="cheer" /> : <Luna size={92} act={s.result === 'luna' ? 'cheer' : 'idle'} />}
            <span className={`text-6xl ${won || s.result === 'luna' ? 'animate-stamp' : ''}`} role="img" aria-label="bone">
              🦴
            </span>
          </div>
          <p className="mt-2 font-display text-4xl tabular">
            {s.me} – {s.luna}
          </p>
          <p className="text-sm text-muted">
            You – Luna{wins ? ` · ${wins.wins} win${wins.wins === 1 ? '' : 's'}, ${wins.losses} loss${wins.losses === 1 ? '' : 'es'} so far` : ''}
          </p>
          <p className="mt-3 text-sm font-semibold" lang="en">
            {who.dog}: {who.text}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={onDone}>
              Done
            </Button>
            <Button onClick={onAgain}>Rematch</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-rise pb-6">
      <GameHeader title="Verb duel" subtitle={`First to ${DUEL_TARGET} wins the bone 🦴`} onBack={onDone} />

      <ModeToggle mode={mode} setMode={setMode} />

      {/* scoreboard */}
      <section className="card mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3" aria-label="Score">
        <div className="text-center">
          <p className="eyebrow">You</p>
          <p className="font-display text-4xl tabular" aria-label={`You: ${s.me}`}>
            {s.me}
          </p>
          <Pips n={s.me} tone="var(--blue)" />
        </div>
        <span className="text-2xl" aria-hidden="true">
          🦴
        </span>
        <div className="flex items-center justify-center gap-1">
          <div className="text-center">
            <p className="eyebrow">Luna</p>
            <p className="font-display text-4xl tabular" aria-label={`Luna: ${s.luna}`}>
              {s.luna}
            </p>
            <Pips n={s.luna} tone="var(--red)" />
          </div>
          <div className="-my-2 shrink-0">
            <Luna size={58} act={lunaAct} />
          </div>
        </div>
      </section>

      {/* what the dogs say */}
      <p className="mt-2 flex min-h-10 items-center gap-2 text-sm" aria-live="polite">
        <span className="shrink-0" aria-hidden="true">
          {who.dog === 'Leo' ? <Leo size={34} act="talk" /> : who.dog === 'Bonchita' ? <Bonchita size={34} act="talk" /> : <Luna size={34} act="talk" />}
        </span>
        <span className="min-w-0 flex-1">
          <b>{who.dog}:</b> <span lang="en">{who.text}</span>
        </span>
      </p>

      {s.phase === 'ready' && (
        <div className="card mt-2 text-center">
          <p className="font-semibold">Type the form (or pick it) before Luna does.</p>
          <p className="mt-1 text-sm text-muted">She gets quicker as you get better. A wrong answer gives her the chance to steal the point.</p>
          <p className="mt-2 text-xs text-muted">Tenses in play: {tensesInPlay(data.tenses)}</p>
          <button type="button" className="btn btn-primary mt-4 w-full" onClick={startTurn} autoFocus>
            Start the duel
          </button>
        </div>
      )}

      {t && s.phase !== 'ready' && (
        <div className="mt-2">
          <PromptCard p={t.p}>
            <LunaStatus t={t} />
          </PromptCard>
          {mode === 'type' ? (
            <div className="mt-3">
              <FormInput
                value={s.phase === 'reveal' && t.mine === 'open' ? '' : text}
                onChange={setText}
                onEnter={() => answer({ text })}
                disabled={s.phase !== 'turn' || t.mine !== 'open'}
                tone={t.mine === 'right' ? 'ok' : t.mine === 'wrong' ? 'bad' : undefined}
              />
              {s.phase === 'turn' && t.mine === 'open' && (
                <Button variant="ok" className="mt-3 w-full" onClick={() => answer({ text })} disabled={!text.trim()}>
                  Answer
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pick the form">
              {t.options.map((o, i) => {
                const reveal = s.phase === 'reveal' || t.mine !== 'open'
                const cls = reveal && i === t.answer && s.phase === 'reveal' ? 'correct' : t.picked === i && t.mine === 'wrong' ? 'wrong' : ''
                return (
                  <button key={`${t.p.key}-${i}`} type="button" role="radio" aria-checked={t.picked === i} aria-keyshortcuts={String(i + 1)} disabled={s.phase !== 'turn' || t.mine !== 'open'} onClick={() => answer({ index: i })} className={`tile flex min-h-14 items-center gap-2 px-3 py-2 ${cls}`}>
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
          )}
          {t.note && <p className="mt-2 text-center text-sm font-semibold text-muted">{t.note}</p>}
          {s.phase === 'reveal' && (
            <div className="card animate-rise mt-3 text-center" role="status">
              <p className="text-sm font-bold" style={{ color: t.point === 'me' ? 'var(--ok)' : t.point === 'luna' ? 'var(--red)' : 'var(--ink-2)' }}>
                {t.point === 'me' ? 'Your point!' : t.point === 'luna' ? 'Luna’s point' : 'No point this time'}
              </p>
              <p className="font-display text-2xl" lang={TL}>
                {t.p.pronoun} {t.p.answer}
              </p>
              {t.p.english && (
                <p className="text-sm text-muted" lang="en">
                  {t.p.english}
                </p>
              )}
              {!duelWinner(s.me, s.luna, s.turns) && (
                <button ref={nextBtn} type="button" className="btn btn-ghost mt-3 w-full py-2.5" onClick={startTurn}>
                  Next
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {s.phase !== 'ready' && (
        <p className="mt-3 text-center text-xs text-muted">
          Turn {Math.min(s.turns + 1, DUEL_MAX_TURNS)} · {DUEL_MAX_TURNS - s.turns} left at most
        </p>
      )}
      <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => (s.phase === 'ready' || s.me + s.luna === 0 ? onDone() : finish(s.me > s.luna ? 'me' : s.luna > s.me ? 'luna' : 'draw'))}>
        {s.phase === 'ready' ? 'Quit' : 'Stop the duel'}
      </button>
    </div>
  )
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex gap-2" role="group" aria-label="Answer mode">
      {(['type', 'pick'] as const).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`flex-1 rounded-2xl py-2 text-sm font-bold ${mode === m ? 'bg-ink text-paper' : 'bg-surface-2 text-muted'}`} style={mode === m ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
          {m === 'type' ? '⌨️ Type it' : '👆 Pick it'}
        </button>
      ))}
    </div>
  )
}

/** Ten little pips per player. */
function Pips({ n, tone }: { n: number; tone: string }) {
  return (
    <span className="mt-1 flex justify-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: DUEL_TARGET }, (_, k) => (
        <span key={k} className="block h-1.5 w-1.5 rounded-full" style={{ background: k < n ? tone : 'var(--line-strong)' }} />
      ))}
    </span>
  )
}

/** Luna thinking (dots), or her answer once she gives it. */
function LunaStatus({ t }: { t: Turn }) {
  if (t.luna === 'thinking' && !t.point) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
        Luna is thinking
        <span className="inline-flex gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((k) => (
            <span key={k} className={`block h-1.5 w-1.5 rounded-full bg-[var(--red)] ${calmMotion() ? '' : 'animate-pulse'}`} style={{ animationDelay: `${k * 200}ms` }} />
          ))}
        </span>
      </p>
    )
  }
  if (!t.lunaSaid) return null
  return (
    <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${t.luna === 'right' ? 'bg-[color-mix(in_srgb,var(--red)_14%,var(--card))] text-[var(--red)]' : 'bg-surface-2 text-muted line-through'}`}>
      Luna: <span lang={TL}>{t.lunaSaid}</span> {t.luna === 'right' ? '✓' : '✗'}
    </p>
  )
}
