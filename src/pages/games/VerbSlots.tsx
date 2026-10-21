/**
 * Verb slots: a three-reel slot machine (person, verb, tense). Pull the lever, the reels settle
 * one by one, then type the form before 15 seconds run out. Three right in a row hits the
 * jackpot; irregular forms pay more. After each spin the full form and the verb's mini table teach.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { recordGame, GAMES_BEST_KEY, type GameBest } from './util'
import { addMinutes, e2eHook } from '../palabras/util'
import { kit, useVerbRound, recordVerb, shortTense, type VerbRound } from './verbRound'
import { FormInput, Paradigm, TimerBar, NoVerbs } from './verbShared'
import { randomPrompt, paradigm, gradeForm, slotPoints, isJackpot, JACKPOT_BONUS, pronounsOf, type VerbPrompt, type FormGrade, type ParadigmRow } from '../../engine/games/verbPrompts'
import { pronounEnglish } from '../../engine/games/englishVerb'
import { Rng } from '../../engine/random'
import { playSound, buzz } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useKvValue } from '../../hooks/useProgress'
import { useSpeak } from '../../hooks/useSpeak'
import { Button, SpeakerButton } from '../../components/ui/basics'
import { Confetti } from '../../components/ui/Confetti'
import { Leo, Bonchita } from '../../components/ui/Dogs'
import { calmMotion } from '../../components/game/motion'
import { awardCoins } from '../../db/progress'
import { coinsLabel } from '../../engine/economy'

const SPINS = 10
const SECONDS = 15
const ITEM_H = 76
/** Filler items per reel and spin time: each reel runs a little longer, so they settle one by one. */
const REELS = [
  { name: 'Person', fill: 9, ms: 900 },
  { name: 'Verb', fill: 13, ms: 1350 },
  { name: 'Tense', fill: 17, ms: 1800 },
] as const

export default function VerbSlots({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const data = useVerbRound(12, round)
  if (!data) return <GameHeader title="Verb slots" subtitle="Loading your verbs…" onBack={onDone} />
  if (!data.deck.length || !data.tenses.length) {
    return (
      <div className="animate-rise pb-6">
        <GameHeader title="Verb slots" onBack={onDone} />
        <NoVerbs onBack={onDone} />
      </div>
    )
  }
  return <Slots key={round} data={data} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
}

type Phase = 'idle' | 'spinning' | 'ask' | 'reveal' | 'over'
interface Result {
  p: VerbPrompt
  g: FormGrade
  points: number
  jackpot: boolean
  timeout: boolean
}
interface ReelItem {
  main: string
  sub: string
  /** The main text is in the course language (pronouns, verbs); tenses are English. */
  target?: boolean
}

function Slots({ data, onDone, onAgain }: { data: VerbRound; onDone: () => void; onAgain: () => void }) {
  const [rng] = useState(() => new Rng(Date.now()))
  const [startedAt] = useState(() => Date.now())
  const best = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})
  const [prevBest, setPrevBest] = useState<number | undefined>()
  const [phase, setPhase] = useState<Phase>('idle')
  const [spin, setSpin] = useState(0)
  const [p, setP] = useState<VerbPrompt | undefined>()
  const [reels, setReels] = useState<ReelItem[][]>(() => REELS.map(() => [{ main: '?', sub: ' ' }]))
  const [settled, setSettled] = useState<Set<number>>(new Set())
  const askedAt = useRef(0)
  const [left, setLeft] = useState(SECONDS * 1000)
  const [text, setText] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [jackpots, setJackpots] = useState(0)
  const spinBtn = useRef<HTMLButtonElement>(null)
  const lever = useRef<HTMLSpanElement>(null)
  const { say } = useSpeak()

  const score = results.reduce((s, r) => s + r.points, 0)
  let streak = 0
  for (let k = results.length - 1; k >= 0 && results[k]!.g.verdict !== 'wrong'; k--) streak++
  const last = results.at(-1)
  const spinNo = phase === 'reveal' || phase === 'over' ? results.length : results.length + 1
  const showJackpot = Boolean(last?.jackpot && phase === 'reveal')

  const doSpin = () => {
    if ((phase !== 'idle' && phase !== 'reveal') || results.length >= SPINS) return
    const avoid = new Set(results.slice(-4).flatMap((r) => [r.p.key, r.p.verb.lemma]))
    const next = randomPrompt(kit, data.deck, data.tenses, rng, avoid)
    if (!next) return
    const pick = <T,>(xs: readonly T[], n: number) => Array.from({ length: n }, () => rng.pick(xs))
    const persons = kit.persons.map((_, i) => i).filter((i) => !kit.skipPersons.has(i))
    const personItem = (person: number, pronoun = rng.pick(pronounsOf(kit.persons[person] ?? ''))): ReelItem => ({ main: pronoun, sub: pronounEnglish(pronoun, person), target: true })
    const verbItem = (lemma: string, en: string): ReelItem => ({ main: lemma, sub: en.replace(/\s*\(.*\)/, ''), target: true })
    const tenseItem = (t: string): ReelItem => ({ main: shortTense(kit.labels[t]?.en ?? t), sub: kit.labels[t]?.es ?? '' })
    setReels([
      [...pick(persons, REELS[0].fill).map((q) => personItem(q)), personItem(next.person, next.pronoun)],
      [...pick(data.deck, REELS[1].fill).map((v) => verbItem(v.lemma, v.en)), verbItem(next.verb.lemma, next.verb.en)],
      [...pick(data.tenses, REELS[2].fill).map(tenseItem), tenseItem(next.tense)],
    ])
    setP(next)
    setText('')
    settledRef.current = new Set()
    setSettled(settledRef.current)
    setSpin((s) => s + 1)
    setPhase('spinning')
    playSound('tap')
    buzz('tap')
    const el = lever.current
    if (el && !calmMotion() && typeof el.animate === 'function') {
      el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(46px)', offset: 0.4 }, { transform: 'translateY(0)' }], { duration: 520, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)' })
    }
  }

  // a reel stopped; once all three have, start the clock
  const settledRef = useRef<Set<number>>(new Set())
  const onSettled = (k: number) => {
    if (settledRef.current.has(k)) return
    settledRef.current = new Set(settledRef.current).add(k)
    setSettled(settledRef.current)
    if (settledRef.current.size === REELS.length) {
      setPhase('ask')
      setLeft(SECONDS * 1000)
    }
  }

  const submit = (timeout = false) => {
    if (phase !== 'ask' || !p) return
    if (!timeout && !text.trim()) return
    const ms = Date.now() - askedAt.current
    const g: FormGrade = timeout ? { verdict: 'wrong', correct: p.answer, note: 'Time’s up!' } : gradeForm(kit, p, text)
    let points = slotPoints(g.verdict, p.irregular, SECONDS - ms / 1000)
    const jackpot = g.verdict !== 'wrong' && isJackpot(streak + 1)
    if (jackpot) points += JACKPOT_BONUS
    recordVerb(p, g.verdict, ms < 5000)
    setResults((rs) => [...rs, { p, g, points, jackpot, timeout }])
    setPhase('reveal')
    if (jackpot) {
      // jackpot bonuses go into the real purse (spendable in the shop), not just the round's score
      void awardCoins(JACKPOT_BONUS, `game:slots:jackpot:${Date.now()}`)
      setJackpots((j) => j + 1)
      playSound('combo')
      buzz('combo')
    } else playSound(g.verdict === 'wrong' ? 'wrong' : 'correct')
    if (g.verdict !== 'wrong') void say(`${p.pronoun} ${g.correct}`)
  }

  // the 15 second clock
  const submitRef = useRef(submit)
  useLayoutEffect(() => {
    submitRef.current = submit
  })
  useEffect(() => {
    if (phase !== 'ask') return
    askedAt.current = Date.now()
    const t = setInterval(() => {
      const l = SECONDS * 1000 - (Date.now() - askedAt.current)
      setLeft(Math.max(0, l))
      if (l <= 0) submitRef.current(true)
    }, 100)
    return () => clearInterval(t)
  }, [phase, spin])

  useEffect(() => {
    if (phase === 'reveal') spinBtn.current?.focus({ preventScroll: true })
    e2eHook('verbs', { game: 'slots', phase, spin: spinNo, answer: p?.answer, accepts: p?.accepts, score })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    setPrevBest(best?.slots?.score)
    setPhase('over')
    playSound('finish')
    void (async () => {
      await recordGame('slots', { score, extra: { jackpots } })
      await addMinutes(Date.now() - startedAt)
    })()
  }

  const rows = useMemo(() => (p && phase === 'reveal' ? paradigm(kit, p.verb.lemma, p.tense) : []), [p, phase])
  const right = results.filter((r) => r.g.verdict !== 'wrong').length

  if (phase === 'over') {
    const newBest = score > 0 && (prevBest === undefined || score > prevBest)
    return (
      <div className="animate-rise pb-6">
        <GameHeader title="Verb slots" subtitle={`${right} of ${results.length} right`} onBack={onDone} />
        {newBest && !calmMotion() && <Confetti />}
        <div className="card text-center">
          <div className="mx-auto -mt-1 w-fit">{right * 2 >= results.length ? <Leo size={88} act="cheer" /> : <Bonchita size={88} act="talk" />}</div>
          <p className="font-display text-5xl" aria-label={`${score} coins`}>
            🪙 {score}
          </p>
          <p className="mt-1 text-sm text-muted">
            {jackpots ? `${jackpots} jackpot${jackpots === 1 ? '' : 's'} · ` : ''}
            {newBest ? 'New best!' : prevBest ? `Best: ${prevBest}` : 'coins'}
          </p>
          {jackpots > 0 && (
            <p className="mt-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--sun)_24%,var(--card))] px-3 py-1 text-sm font-bold">
              +{coinsLabel(jackpots * JACKPOT_BONUS)} added to your purse
            </p>
          )}
          <ol className="mt-4 grid gap-1 text-left text-sm" aria-label="Your spins">
            {results.map((r, k) => (
              <li key={k} className="flex items-baseline gap-2 border-t border-line pt-1">
                <span aria-label={r.g.verdict === 'wrong' ? 'wrong' : 'right'} className={r.g.verdict === 'wrong' ? 'text-[var(--bad)]' : 'text-[var(--ok)]'}>
                  {r.g.verdict === 'wrong' ? '✗' : '✓'}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  <span lang={TL}>{r.p.pronoun}</span> · <span lang={TL}>{r.p.verb.lemma}</span> · {shortTense(r.p.tenseLabel)}
                </span>
                <b lang={TL}>{r.g.correct}</b>
              </li>
            ))}
          </ol>
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

  return (
    <div className="animate-rise pb-6">
      <GameHeader
        title="Verb slots"
        subtitle={`Spin ${spinNo} of ${SPINS}${streak > 1 ? ` · ${streak} in a row` : ''}`}
        right={
          <span className="shrink-0 whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--sun)_28%,var(--card))] px-3 py-1 text-sm font-extrabold tabular" aria-label={`${score} coins`}>
            🪙 {score}
          </span>
        }
        onBack={onDone}
      />
      {showJackpot && !calmMotion() && <Confetti key={jackpots} count={40} />}

      <section aria-label="Slot machine" className="relative rounded-3xl border-[1.5px] border-line bg-[color-mix(in_srgb,var(--red)_12%,var(--card))] p-3 shadow-card">
        <div className="mb-2 flex items-center justify-between px-1">
          <Lights on={phase === 'spinning' || showJackpot} />
          <span className="font-display text-sm uppercase tracking-[0.18em] text-[var(--red)]">Jackpot ×3</span>
          <Lights on={phase === 'spinning' || showJackpot} />
        </div>
        <div className="flex items-stretch gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
            {REELS.map((r, k) => (
              <Reel key={k} name={r.name} items={reels[k]!} spin={spin} ms={r.ms} settled={spin > 0 && settled.has(k)} onSettled={() => onSettled(k)} />
            ))}
          </div>
          <button type="button" onClick={doSpin} disabled={phase !== 'idle' && phase !== 'reveal'} className="relative w-8 shrink-0 rounded-full bg-surface-2 disabled:opacity-60" aria-label="Pull the lever to spin">
            <span aria-hidden="true" className="absolute inset-x-[13px] bottom-3 top-6 rounded-full" style={{ background: 'var(--line-strong)' }} />
            <span ref={lever} aria-hidden="true" className="absolute left-1/2 top-1 -ml-[12px] block h-6 w-6 rounded-full border-2 border-[color-mix(in_srgb,var(--red)_70%,var(--ink))] bg-[var(--red)] shadow-[0_2px_0_0_color-mix(in_srgb,var(--red)_55%,var(--ink))]" />
          </button>
        </div>
        {showJackpot && (
          <>
            <CoinBurst key={jackpots} />
            <p className="pointer-events-none absolute inset-x-0 top-[34%] text-center">
              <span className="animate-stamp inline-block rounded-xl border-2 border-[var(--sun)] bg-[var(--ink)] px-4 py-1 font-display text-2xl text-[var(--sun)] shadow-float">JACKPOT! +{JACKPOT_BONUS}</span>
            </p>
          </>
        )}
      </section>

      <div className="mt-3 min-h-[2.5rem]" aria-live="polite">
        {phase === 'idle' && <p className="text-center text-sm text-muted">Tenses in play: {data.tenses.map((t) => shortTense(kit.labels[t]?.en ?? t)).join(', ')}. Pull the lever or press Spin.</p>}
        {phase === 'spinning' && <p className="text-center text-sm font-semibold text-muted">Spinning…</p>}
        {phase === 'ask' && p && (
          <p className="text-center text-sm">
            Write <b lang={TL}>{p.pronoun}</b> + <b lang={TL}>{p.verb.lemma}</b> in the <b>{shortTense(p.tenseLabel).toLowerCase()}</b>
            {p.english ? (
              <span className="text-muted" lang="en">
                {' '}
                (“{p.english}”)
              </span>
            ) : null}
            {p.irregular ? (
              <span className="ml-1 font-bold text-[var(--sun)]" title="Irregular: worth more">
                ★
              </span>
            ) : null}
          </p>
        )}
        {showJackpot && <p className="sr-only">Jackpot! Three in a row: {coinsLabel(JACKPOT_BONUS)} added to your purse.</p>}
      </div>

      {phase === 'ask' && p && (
        <div className="mt-1">
          <div className="mb-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TimerBar left={left} total={SECONDS * 1000} label="Time left" />
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-bold tabular text-muted">{Math.ceil(left / 1000)} s</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-3.5 shrink-0 text-lg font-semibold text-muted" lang={TL}>
              {p.pronoun}
            </span>
            <div className="min-w-0 flex-1">
              <FormInput value={text} onChange={setText} onEnter={() => submit()} />
            </div>
          </div>
          <Button variant="ok" className="mt-3 w-full" onClick={() => submit()} disabled={!text.trim()}>
            Check
          </Button>
        </div>
      )}

      {phase === 'reveal' && last && <Reveal r={last} rows={rows} />}

      {(phase === 'idle' || phase === 'reveal') && (
        <>
          <button ref={spinBtn} type="button" className="btn btn-primary mt-4 w-full" onClick={results.length >= SPINS ? finish : doSpin}>
            {results.length >= SPINS ? 'See results' : results.length ? 'Spin again' : 'Spin'}
          </button>
          {results.length < SPINS && (
            <button type="button" className="btn btn-ghost mt-3 w-full" onClick={results.length ? finish : onDone}>
              {results.length ? 'Stop and count coins' : 'Quit'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** The answer, the points and the verb's table for the tense. */
function Reveal({ r, rows }: { r: Result; rows: ParadigmRow[] }) {
  const { p, g } = r
  const tone = g.verdict === 'correct' ? 'ok' : g.verdict === 'almost' ? 'sun' : 'bad'
  const head = g.verdict === 'correct' ? 'Right!' : g.verdict === 'almost' ? 'Almost!' : r.timeout ? 'Time’s up!' : 'Not quite'
  return (
    <div className="card animate-rise mt-1" role="status">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold" style={{ color: `var(--${tone})` }}>
          {g.verdict === 'wrong' ? '✗' : '✓'} {head}
          {g.note && !r.timeout ? (
            <span className="mt-0.5 block text-sm font-semibold" lang={TL}>
              {g.note}
            </span>
          ) : null}
        </p>
        {r.points > 0 && <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--sun)_28%,var(--card))] px-2.5 py-0.5 text-sm font-extrabold">+{r.points} 🪙</span>}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <SpeakerButton text={`${p.pronoun} ${g.correct}`} size="sm" />
        <div className="min-w-0">
          <p className="font-display text-2xl" lang={TL}>
            {p.pronoun} {g.correct}
          </p>
          {p.english && (
            <p className="text-sm text-muted" lang="en">
              {p.english}
            </p>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">
        <span lang={TL}>{p.verb.lemma}</span> · <span lang={TL}>{p.tenseName}</span>
      </p>
      <Paradigm rows={rows} person={p.person} tense={p.tenseLabel} />
      {rows.some((x) => x.irregular) && <p className="mt-1 text-[11px] text-muted">★ irregular form</p>}
    </div>
  )
}

/** One reel: a strip of items that slides up and stops on the last one. */
function Reel({ name, items, spin, ms, onSettled, settled }: { name: string; items: ReelItem[]; spin: number; ms: number; onSettled: () => void; settled: boolean }) {
  const strip = useRef<HTMLDivElement>(null)
  const done = useRef(onSettled)
  useLayoutEffect(() => {
    done.current = onSettled
  })
  useLayoutEffect(() => {
    const el = strip.current
    if (!el || spin === 0) return
    const end = -(items.length - 1) * ITEM_H
    el.style.transform = `translateY(${end}px)`
    if (calmMotion() || typeof el.animate !== 'function') {
      done.current()
      return
    }
    const a = el.animate(
      [{ transform: 'translateY(0)', filter: 'blur(0)' }, { transform: `translateY(${end * 0.5}px)`, filter: 'blur(1.5px)', offset: 0.45 }, { transform: `translateY(${end - 12}px)`, filter: 'blur(0)', offset: 0.88 }, { transform: `translateY(${end}px)` }],
      { duration: ms, easing: 'cubic-bezier(0.25, 0.5, 0.3, 1)' },
    )
    a.onfinish = () => {
      playSound('tap')
      done.current()
    }
    return () => {
      a.onfinish = null
      a.cancel()
    }
  }, [spin]) // eslint-disable-line react-hooks/exhaustive-deps
  const final = items.at(-1)!
  return (
    <div className="min-w-0">
      <div
        className="relative overflow-hidden rounded-xl border-[1.5px] border-line bg-surface shadow-[inset_0_7px_10px_-8px_rgba(0,0,0,0.45),inset_0_-7px_10px_-8px_rgba(0,0,0,0.45)]"
        style={{ height: ITEM_H }}
        role="img"
        aria-label={settled ? `${name}: ${final.main}` : `${name} reel`}
        data-reel={name.toLowerCase()}
      >
        <div ref={strip} className="will-change-transform" aria-hidden="true">
          {items.map((it, k) => (
            <ReelCell key={k} it={it} />
          ))}
        </div>
      </div>
      <p className="mt-1 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{name}</p>
    </div>
  )
}

function ReelCell({ it }: { it: ReelItem }) {
  const size = it.main.length <= 7 ? 'text-xl' : it.main.length <= 9 ? 'text-base' : 'text-sm'
  return (
    <div className="flex flex-col items-center justify-center px-1 text-center" style={{ height: ITEM_H }}>
      <span className={`block max-w-full truncate font-display leading-tight ${size}`} lang={it.target ? TL : 'en'}>
        {it.main}
      </span>
      <span className="mt-0.5 line-clamp-2 block max-w-full text-[10.5px] leading-tight text-muted" lang={it.target ? 'en' : TL}>
        {it.sub}
      </span>
    </div>
  )
}

/** Little lights along the top of the machine; they blink while the reels spin. */
function Lights({ on }: { on: boolean }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {[0, 1, 2, 3].map((k) => (
        <span key={k} className={`block h-2 w-2 rounded-full ${on && !calmMotion() ? 'animate-pulse' : ''}`} style={{ background: on ? 'var(--sun)' : 'var(--line-strong)', animationDelay: `${k * 120}ms` }} />
      ))}
    </span>
  )
}

/** Coins bursting out of the machine on a jackpot (not with reduced motion). */
function CoinBurst() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    ;([...el.children] as HTMLElement[]).forEach((c, k) => {
      if (typeof c.animate !== 'function') return
      const dx = ((k * 47) % 180) - 90
      const dy = -90 - ((k * 31) % 80)
      c.animate([{ transform: 'translate(0, 0) scale(0.6)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1, offset: 0.6 }, { transform: `translate(${dx * 1.2}px, ${dy + 70}px) scale(1)`, opacity: 0 }], { duration: 1100 + (k % 4) * 120, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' })
    })
  }, [])
  if (calmMotion()) return null
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2">
      {Array.from({ length: 14 }, (_, k) => (
        <span key={k} className="absolute -ml-3 -mt-3 text-2xl">
          🪙
        </span>
      ))}
    </div>
  )
}
