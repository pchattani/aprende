/**
 * Tone detective: listening for Cantonese tones. Three levels of ten: "Same or different?"
 * (one syllable said twice), "Which tone?" (one syllable, pick it on the contour chart) and
 * "Two-syllable words" (the learner's words, one tone per syllable). Replay and extra-slow
 * buttons; each answer reveals character, Jyutping and meaning. Without a Cantonese voice
 * (or with sound off) the same levels run as reading practice: the character and its
 * Jyutping without the tone number.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { VocabEntry } from '../../engine/schema'
import { ui, vocabUpTo } from '../../engine/loader'
import { Rng } from '../../engine/random'
import { rapidPoints } from '../../engine/vocabGame'
import { TONES, TONE_LIST, sameOrDifferentRound, toneLabel, toneless, toneWords, whichToneRound, wordToneRound, type PairQuestion, type Tone, type ToneQuestion } from '../../engine/games/tones'
import { recordAnswer } from '../../db/progress'
import { playSound } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useSpeak } from '../../hooks/useSpeak'
import { useKvValue } from '../../hooks/useProgress'
import { Button, Chip, ProgressBar } from '../../components/ui/basics'
import { IconSpeaker, IconTurtle } from '../../components/ui/icons'
import { Confetti } from '../../components/ui/Confetti'
import { Bonchita } from '../../components/ui/Dogs'
import { calmMotion, nudge } from '../../components/game/motion'
import { NoAudioNotice, RoundButtons } from '../palabras/shared'
import { addMinutes, e2eHook, useAudio, useNoVoice } from '../palabras/util'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { GAMES_BEST_KEY, recordGame, useGameWords, type GameBest } from './util'
import { Ruby } from './cantoneseText'

const ID = 'tones'
const TITLE = 'Tone detective'
const ROUND = 10

type Level = 'same' | 'which' | 'word'
const LEVELS: { id: Level; icon: string; title: string; text: string; reading: string }[] = [
  { id: 'same', icon: '👂', title: 'Same or different?', text: 'Hear one syllable twice. Same tone, or two different ones?', reading: 'Two characters, one syllable. Do they share a tone?' },
  { id: 'which', icon: '📈', title: 'Which tone?', text: 'Hear one syllable and pick its tone on the chart.', reading: 'See a character and pick its tone on the chart.' },
  { id: 'word', icon: '🗣️', title: 'Two-syllable words', text: 'Hear one of your words and catch both tones.', reading: 'See one of your words and give both tones.' },
]

/** Readings of each character (most common first), loaded only in the Cantonese build. */
const charTables = import.meta.glob('@lang/data/chars.json', { import: 'default' }) as Record<string, () => Promise<Record<string, string[]>>>
function useReadings(): ((c: string) => string[] | undefined) | undefined {
  const load = Object.values(charTables)[0]
  const [table, setTable] = useState<Record<string, string[]> | undefined>(load ? undefined : {})
  useEffect(() => {
    if (!load) return
    let live = true
    void load().then((t) => live && setTable(t))
    return () => {
      live = false
    }
  }, [load])
  return useMemo(() => (table ? (c: string) => table[c] : undefined), [table])
}

/** One or two Han characters with toned Jyutping: candidates for levels b and c. */
const toneable = (v: VocabEntry) => Boolean(v.jp) && /^\p{Script=Han}{1,2}$/u.test(v.lemma)

/** Colours for the six contours, readable on light and dark cards. */
const TONE_COLOR: Record<Tone, string> = { 1: '#e0567a', 2: '#e2862b', 3: '#2f9e6b', 4: '#3d7be0', 5: '#8a5cd6', 6: '#7f8aa3' }
/** y for a Chao pitch (5 high … 1 low) in a 0–40 box. */
const pitchY = (p: number) => 36 - (p - 1) * 8

function contourPath(t: Tone, x0 = 6, x1 = 54): string {
  const [a, b] = TONES[t].pitch
  const y0 = pitchY(a)
  const y1 = pitchY(b)
  if (a === b) return `M${x0} ${y0} L${x1} ${y1}`
  // rising tones start flat and curve up; tone 4 dips
  const mx = x0 + (x1 - x0) * 0.45
  return a < b ? `M${x0} ${y0} Q${mx} ${y0 + 1} ${x1} ${y1}` : `M${x0} ${y0} Q${mx} ${y0} ${x1} ${y1}`
}

function Contour({ t, className = '' }: { t: Tone; className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((p) => (
        <line key={p} x1="2" x2="58" y1={pitchY(p)} y2={pitchY(p)} stroke="var(--line)" strokeWidth="1" />
      ))}
      <path d={contourPath(t)} fill="none" stroke={TONE_COLOR[t]} strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}

/** The six contours on one chart (pitch 5 high … 1 low), with the 三九四零五二 mnemonic. */
function ToneChart() {
  return (
    <figure className="card" aria-labelledby="tone-chart-cap">
      <svg viewBox="0 0 300 120" className="w-full" role="img" aria-label="Pitch chart of the six tones: 1 high level, 2 high rising, 3 mid level, 4 low falling, 5 low rising, 6 low level">
        {[1, 2, 3, 4, 5].map((p) => (
          <g key={p}>
            <line x1="24" x2="296" y1={12 + (5 - p) * 24} y2={12 + (5 - p) * 24} stroke="var(--line)" strokeWidth="1" />
            <text x="8" y={16 + (5 - p) * 24} fontSize="11" fill="var(--ink-2)">
              {p}
            </text>
          </g>
        ))}
        {TONE_LIST.map((t, k) => {
          const [a, b] = TONES[t].pitch
          const x0 = 30 + k * 45
          const x1 = x0 + 34
          const y = (p: number) => 12 + (5 - p) * 24
          const d = a === b ? `M${x0} ${y(a)} L${x1} ${y(b)}` : `M${x0} ${y(a)} Q${x0 + 15} ${y(a) + (a < b ? 2 : 0)} ${x1} ${y(b)}`
          return (
            <g key={t}>
              <path d={d} fill="none" stroke={TONE_COLOR[t]} strokeWidth="5" strokeLinecap="round" />
              <text x={x0 + 17} y={y(Math.max(a, b)) - 5} fontSize="12" fontWeight="800" textAnchor="middle" fill={TONE_COLOR[t]}>
                {t}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption id="tone-chart-cap" className="mt-1 grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs text-muted">
        {TONE_LIST.map((t) => (
          <span key={t}>
            <b style={{ color: TONE_COLOR[t] }}>{t}</b> {TONES[t].name} <span lang={TL}>{TONES[t].mnemonic}</span>
          </span>
        ))}
      </figcaption>
      <p className="mt-2 text-xs text-muted">
        Say <span lang={TL}>三九四零五二</span> <i>saam1 gau2 sei3 ling4 ng5 ji6</i>: tones 1 to 6 in order.
      </p>
    </figure>
  )
}

/** The six tone buttons: contour, number and name ("tone 4, low falling"). */
function TonePad({ onPick, disabled, marks }: { onPick: (t: Tone) => void; disabled?: boolean; marks?: Partial<Record<Tone, 'correct' | 'wrong' | 'selected'>> }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Tones">
      {TONE_LIST.map((t) => (
        <button key={t} type="button" disabled={disabled} onClick={() => onPick(t)} aria-label={toneLabel(t)} data-tone={t} className={`tile flex flex-col items-center px-1 py-1.5 ${marks?.[t] ?? ''}`}>
          <Contour t={t} className="h-8 w-14" />
          <span className="text-lg font-extrabold leading-none" style={{ color: TONE_COLOR[t] }}>
            {t}
          </span>
          <span className="text-[11px] leading-tight text-muted">{TONES[t].name}</span>
        </button>
      ))}
    </div>
  )
}

export default function ToneDetective({ onDone }: GameProps) {
  const audio = useAudio()
  const noVoice = useNoVoice()
  const readings = useReadings()
  const [round, setRound] = useState(0)
  const words = useGameWords(80, toneable, round)
  const bests = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})
  const [level, setLevel] = useState<Level | undefined>()
  /** Reading-only: chosen by the learner, or forced when nothing can be heard. */
  const [readOnly, setReadOnly] = useState<boolean | undefined>()
  const canHear = audio === 'ok'
  const reading = !canHear || (readOnly ?? noVoice)
  const best = bests?.[ID]
  const levelBest = (l: Level) => {
    const b = best?.extra?.[l]
    return typeof b === 'number' ? b : undefined
  }

  if (level && words && readings) {
    return (
      <Round
        key={`${level}-${round}`}
        level={level}
        reading={reading}
        words={words}
        readings={readings}
        best={levelBest(level)}
        onBack={() => setLevel(undefined)}
        onAgain={() => setRound((r) => r + 1)}
        onFinish={async (score) => {
          await recordGame(ID, { score, extra: { [level]: Math.max(levelBest(level) ?? 0, score) } })
        }}
      />
    )
  }
  return (
    <div className="animate-rise pb-6">
      <GameHeader title={TITLE} subtitle="Six tones, one ear. Catch the pitch of each syllable." onBack={onDone} />
      {!canHear ? (
        <div className="mb-3">
          <NoAudioNotice audio={audio} />
          <p className="mt-2 text-sm text-muted">You can still play: the reading version shows each character with its Jyutping, minus the tone number, and you pick the tone.</p>
        </div>
      ) : (
        noVoice && (
          <div role="note" className="mb-3 rounded-xl border-[1.5px] border-dashed border-line bg-surface-2 p-4 text-sm">
            <p className="font-semibold">Tone detective needs a Cantonese voice</p>
            <p className="mt-1 text-muted">{ui.voiceHelp}</p>
            <p className="mt-2 text-muted">Until then, play the reading version: see the character and its Jyutping without the tone number, and pick the tone.</p>
          </div>
        )
      )}
      {canHear && (
        <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to play">
          {[false, true].map((r) => (
            <button key={String(r)} type="button" role="radio" aria-checked={reading === r} onClick={() => setReadOnly(r)} className={`tile flex items-center justify-center gap-1.5 py-2 text-sm ${reading === r ? 'selected' : ''}`}>
              <span aria-hidden="true">{r ? '👀' : '🎧'}</span> {r ? 'Reading only' : 'Listening'}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3">
        {LEVELS.map((l) => {
          const b = levelBest(l.id)
          return (
            <button key={l.id} type="button" disabled={!words || !readings} onClick={() => setLevel(l.id)} className="card flex w-full items-center gap-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-coral-500 text-2xl" aria-hidden="true">
                {l.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{l.title}</span>
                <span className="block text-sm text-muted">{reading ? l.reading : l.text}</span>
                {b ? <span className="mt-1 block text-xs font-bold text-ok-600">Best: {b} points</span> : null}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-4">
        <ToneChart />
      </div>
    </div>
  )
}

type Q = { kind: 'pair'; q: PairQuestion } | { kind: 'tone'; q: ToneQuestion }

function Round({ level, reading, words, readings, best, onBack, onAgain, onFinish }: { level: Level; reading: boolean; words: VocabEntry[]; readings: (c: string) => string[] | undefined; best?: number; onBack: () => void; onAgain: () => void; onFinish: (score: number) => Promise<void> }) {
  const [rng] = useState(() => new Rng(Date.now()))
  /** The best before this round (the prop updates as soon as the round is recorded). */
  const [prevBest] = useState(best)
  const questions: Q[] = useMemo(() => {
    if (level === 'same') return sameOrDifferentRound(rng, ROUND).map((q) => ({ kind: 'pair' as const, q }))
    if (level === 'which') return whichToneRound(toneWords(words, 1, readings), rng, ROUND).map((q) => ({ kind: 'tone' as const, q }))
    const pool = toneWords(vocabUpTo('a1'), 2, readings)
    return wordToneRound(toneWords(words, 2, readings), pool, rng, ROUND).map((q) => ({ kind: 'tone' as const, q }))
  }, [level, words, readings, rng])
  const { say } = useSpeak()
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [right, setRight] = useState(0)
  /** Tones picked so far for the current question (one per syllable). */
  const [picks, setPicks] = useState<Tone[]>([])
  const [same, setSame] = useState<boolean | undefined>()
  const [verdict, setVerdict] = useState<boolean | undefined>()
  const [startedAt] = useState(() => Date.now())
  const card = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  /** Bumped on every new question so a pair still playing stops. */
  const playId = useRef(0)
  const cur = questions[i]
  const finished = i >= questions.length
  const meta = LEVELS.find((l) => l.id === level)!

  const play = async (slow: boolean | 'slower' = false) => {
    if (!cur || reading) return
    const id = ++playId.current
    if (cur.kind === 'tone') return say(cur.q.text, slow)
    await say(cur.q.a.ch, slow)
    await new Promise((r) => setTimeout(r, slow ? 700 : 450))
    if (id === playId.current) await say(cur.q.b.ch, slow)
  }

  useEffect(() => {
    if (!cur) return
    e2eHook('tones', cur.kind === 'pair' ? { level, index: i, a: cur.q.a.jp, b: cur.q.b.jp, same: cur.q.same } : { level, index: i, text: cur.q.text, jp: cur.q.jp, tones: cur.q.tones })
    void play()
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (verdict !== undefined) next.current?.focus({ preventScroll: true })
  }, [verdict])
  useEffect(() => {
    if (!finished) return
    playSound('finish')
    const ms = Date.now() - startedAt
    void (async () => {
      await onFinish(score)
      await addMinutes(ms)
    })()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const settle = (ok: boolean) => {
    if (!cur) return
    setVerdict(ok)
    if (cur.kind === 'tone' && cur.q.vocabId) void recordAnswer(cur.q.vocabId, ok ? 'correct' : 'wrong', reading ? 'choiceEs' : 'listen')
    if (ok) {
      setScore((s) => s + rapidPoints(streak))
      setStreak((s) => s + 1)
      setRight((r) => r + 1)
      playSound('correct')
      if (!calmMotion()) nudge(card.current, 'pop')
    } else {
      setStreak(0)
      playSound('wrong')
      if (!calmMotion()) nudge(card.current, 'shake')
    }
  }
  const pickTone = (t: Tone) => {
    if (!cur || cur.kind !== 'tone' || verdict !== undefined) return
    const p = [...picks, t]
    setPicks(p)
    if (p.length >= cur.q.tones.length) settle(p.every((x, k) => x === cur.q.tones[k]))
  }
  const pickSame = (s: boolean) => {
    if (!cur || cur.kind !== 'pair' || verdict !== undefined) return
    setSame(s)
    settle(s === cur.q.same)
  }
  const advance = () => {
    playId.current++
    setPicks([])
    setSame(undefined)
    setVerdict(undefined)
    setI((k) => k + 1)
  }

  if (finished) {
    const isBest = score > 0 && (prevBest === undefined || score > prevBest)
    return (
      <div className="animate-rise pb-6 text-center">
        <GameHeader title={TITLE} subtitle={meta.title} onBack={onBack} />
        {isBest && <Confetti />}
        <div className="mx-auto w-fit">
          <Bonchita size={96} act={right >= questions.length / 2 ? 'cheer' : 'curious'} />
        </div>
        <p className="mt-1 font-display text-5xl">{score}</p>
        <p className="text-sm text-muted">
          points · {right} of {questions.length} right{isBest ? ' · new best!' : prevBest ? ` · best ${prevBest}` : ''}
        </p>
        <RoundButtons onAgain={onAgain} onDone={onBack} />
      </div>
    )
  }
  if (!cur) return null
  const answered = verdict !== undefined
  const mult = Math.min(4, 1 + Math.floor(streak / 3))
  const nSyl = cur.kind === 'tone' ? cur.q.tones.length : 1
  const marks: Partial<Record<Tone, 'correct' | 'wrong' | 'selected'>> = {}
  if (cur.kind === 'tone') {
    for (const p of picks) marks[p] = 'selected'
    if (answered) {
      for (const p of picks) if (!cur.q.tones.includes(p)) marks[p] = 'wrong'
      for (const t of cur.q.tones) marks[t] = 'correct'
    }
  }
  return (
    <div className="animate-rise pb-6">
      <GameHeader
        title={TITLE}
        subtitle={`${meta.title} · ${score} points`}
        onBack={onBack}
        right={
          <Chip tone={streak >= 3 ? 'gold' : 'sky'} className="shrink-0 whitespace-nowrap">
            <span aria-label={`Streak ${streak}`}>🔥 {streak}</span>
          </Chip>
        }
      />
      <ProgressBar value={i} max={questions.length} tone="sky" className="mb-4" />
      <div ref={card} className="card">
        {reading ? (
          <ReadingPrompt cur={cur} picks={picks} answered={answered} />
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Bonchita size={64} act={answered ? (verdict ? 'cheer' : 'sad') : 'curious'} aria-hidden="true" />
            <button
              type="button"
              onClick={() => void play()}
              className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue text-white shadow-[0_4px_0_0_color-mix(in_srgb,var(--blue)_60%,var(--ink))] transition-transform active:translate-y-0.5 active:shadow-none"
              aria-label={cur.kind === 'pair' ? 'Play both again' : 'Replay'}
            >
              <IconSpeaker width={38} height={38} />
            </button>
            <button
              type="button"
              onClick={() => void play('slower')}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-blue shadow-[0_3px_0_0_var(--line-strong)] transition-transform active:translate-y-0.5 active:shadow-none"
              aria-label="Play slowly"
              title="Extra slow"
            >
              <IconTurtle width={24} height={24} />
            </button>
          </div>
        )}
        <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wider text-blue">
          {i + 1} of {questions.length}
          {mult > 1 ? ` · ×${mult}` : ''}
        </p>
        {!answered && (
          <p className="mt-1 text-center text-sm text-muted">
            {cur.kind === 'pair'
              ? reading
                ? 'Do they have the same tone?'
                : 'Same tone both times, or different?'
              : nSyl > 1
                ? `Pick the tone of syllable ${picks.length + 1} of ${nSyl}.`
                : reading
                  ? 'Which tone does it have?'
                  : 'Which tone did you hear?'}
          </p>
        )}
        {!reading && !answered && cur.kind === 'tone' && nSyl > 1 && <Slots n={nSyl} picks={picks} />}
        {!answered && picks.length > 0 && (
          <p className="mt-1 text-center">
            <button type="button" className="text-xs font-bold text-muted underline" onClick={() => setPicks(picks.slice(0, -1))}>
              Undo tone {picks.length}
            </button>
          </p>
        )}

        {answered && <Reveal cur={cur} ok={verdict} picks={picks} same={same} onPlay={(text) => void say(text)} canPlay={!reading} />}

        {cur.kind === 'pair' ? (
          !answered && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="tile py-3 font-bold" onClick={() => pickSame(true)}>
                <span aria-hidden="true">🟰 </span>Same tone
              </button>
              <button type="button" className="tile py-3 font-bold" onClick={() => pickSame(false)}>
                <span aria-hidden="true">↕️ </span>Different tones
              </button>
            </div>
          )
        ) : (
          <TonePad onPick={pickTone} disabled={answered} marks={marks} />
        )}

        {answered && (
          <button ref={next} type="button" className={`btn mt-3 w-full ${verdict ? 'btn-ok' : 'btn-primary'}`} onClick={advance}>
            {i + 1 >= questions.length ? 'See score' : 'Next'}
          </button>
        )}
      </div>
      <Button variant="ghost" className="mt-4 w-full" onClick={() => setI(questions.length)}>
        Stop
      </Button>
    </div>
  )
}

/** Two boxes for a two-syllable word: the tones picked so far. */
function Slots({ n, picks }: { n: number; picks: Tone[] }) {
  return (
    <div className="mt-2 flex justify-center gap-2" aria-label={`Picked ${picks.length ? picks.map((t) => `tone ${t}`).join(', ') : 'nothing yet'}`}>
      {Array.from({ length: n }, (_, k) => (
        <span key={k} className={`inline-flex h-10 w-12 items-center justify-center rounded-xl border-2 text-lg font-extrabold ${k === picks.length ? 'border-[var(--blue)]' : 'border-line'}`} style={picks[k] ? { color: TONE_COLOR[picks[k]!] } : undefined}>
          {picks[k] ?? '?'}
        </span>
      ))}
    </div>
  )
}

/** Reading-only prompt: characters with Jyutping minus the tone numbers. */
function ReadingPrompt({ cur, picks, answered }: { cur: Q; picks: Tone[]; answered: boolean }) {
  if (cur.kind === 'pair')
    return (
      <div className="flex items-center justify-center gap-6">
        {[cur.q.a, cur.q.b].map((it, k) => (
          <div key={k} className="text-center">
            <p className="font-display text-5xl" lang={TL}>
              {it.ch}
            </p>
            <p className="mt-1 text-lg font-bold text-muted">{toneless(it.jp)}?</p>
          </div>
        ))}
      </div>
    )
  const chars = [...cur.q.text]
  const syl = toneless(cur.q.jp).split(' ')
  return (
    <div className="flex items-end justify-center gap-3">
      {chars.map((c, k) => (
        <div key={k} className="text-center">
          <p className="font-display text-5xl" lang={TL}>
            {c}
          </p>
          <p className="mt-1 text-lg font-bold text-muted">
            {syl[k]}
            <span style={picks[k] ? { color: TONE_COLOR[picks[k]!] } : undefined}>{picks[k] ?? (answered ? '' : '?')}</span>
          </p>
        </div>
      ))}
    </div>
  )
}

/** After an answer: the character(s), Jyutping, meaning and the tones' names. */
function Reveal({ cur, ok, picks, same, onPlay, canPlay }: { cur: Q; ok?: boolean; picks: Tone[]; same?: boolean; onPlay: (text: string) => void; canPlay: boolean }) {
  const items = cur.kind === 'pair' ? [cur.q.a, cur.q.b].map((x) => ({ text: x.ch, jp: x.jp, en: x.en })) : [{ text: cur.q.text, jp: cur.q.jp, en: cur.q.en }]
  const toneNames = (jp: string) =>
    jp
      .split(' ')
      .map((s) => Number(s.slice(-1)) as Tone)
      .map((t) => `${t} ${TONES[t].name}`)
      .join(' + ')
  let headline = ok ? 'Yes!' : 'Not quite'
  if (cur.kind === 'pair') headline = `${ok ? 'Yes! ' : ''}${cur.q.same ? 'Same tone' : 'Different tones'}${!ok && same !== undefined ? ` (you said ${same ? 'same' : 'different'})` : ''}`
  else if (!ok) headline = `It's ${cur.q.tones.join(' ')}${picks.length ? ` (you picked ${picks.join(' ')})` : ''}`
  return (
    <div className={`mt-3 rounded-xl px-3 py-2 ${ok ? 'bg-[var(--sheet-ok)]' : 'bg-[var(--sheet-bad)]'}`} role="status">
      <p className={`text-center text-xs font-extrabold uppercase tracking-wider ${ok ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}`}>{headline}</p>
      <div className={`mt-1 grid gap-2 ${items.length > 1 ? 'grid-cols-2' : ''}`}>
        {items.map((it) => (
          <div key={it.text + it.jp} className="flex items-center justify-center gap-2 text-center">
            {canPlay && (
              <button type="button" onClick={() => onPlay(it.text)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue text-white" aria-label={`Play ${it.text}`}>
                <IconSpeaker width={18} height={18} />
              </button>
            )}
            <div className="min-w-0">
              <p className="font-display text-3xl leading-[1.7]">
                <Ruby text={it.text} jp={it.jp} />
              </p>
              <p className="text-sm font-bold" lang={TL}>
                {it.jp}
              </p>
              <p className="text-xs text-muted" lang="en">
                {it.en}
              </p>
              <p className="text-[11px] text-muted">{toneNames(it.jp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
