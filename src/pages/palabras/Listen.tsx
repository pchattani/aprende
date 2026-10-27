/**
 * Escucha: hear a word, then pick its meaning from four English options ("pick") or
 * type what you heard ("type"). Ten words a round, with a streak multiplier.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { languagePack } from '@lang'
import { IRREGULAR } from '@lang/verbs'
import type { VocabEntry } from '../../engine/schema'
import { vocab, ui } from '../../engine/loader'
import { rapidRound, rapidPoints, type RapidQuestion } from '../../engine/vocabGame'
import { Rng } from '../../engine/random'
import { recordAnswer } from '../../db/progress'
import { playSound } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useSpeak } from '../../hooks/useSpeak'
import { PageHeader, Chip, Button, ProgressBar } from '../../components/ui/basics'
import { IconSpeaker, IconTurtle } from '../../components/ui/icons'
import { Confetti } from '../../components/ui/Confetti'
import { Bonchita } from '../../components/ui/Dogs'
import { TargetText } from '../../components/ui/TargetText'
import { SPECIAL_CHARS } from '../../components/exercises/chars'
import { RoundButtons, NoAudioNotice, NoVoiceHint, TooFew } from './shared'
import { addMinutes, updateBest, e2eHook, useAudio, LISTEN_LABEL, LISTEN_ROUND, type ListenMode } from './util'

type Verdict = 'correct' | 'almost' | 'wrong'

/** `pool`: the finished words, the only ones offered as options (fewer options rather than an unfinished word). */
export function Listen({ words, pool, mode, onDone, onAgain, best }: { words: VocabEntry[]; pool: VocabEntry[]; mode: ListenMode; onDone: () => void; onAgain: () => void; best?: number }) {
  const audio = useAudio()
  const [rng] = useState(() => new Rng(Date.now()))
  const questions: RapidQuestion[] = useMemo(
    () =>
      mode === 'pick'
        ? rapidRound(words, { vocab, pool, verbs: IRREGULAR, stageOf: () => 0, speech: false }, rng, 1).slice(0, LISTEN_ROUND)
        : words.slice(0, LISTEN_ROUND).map((v) => ({ v, options: [], answer: -1 })),
    [words, pool, mode, rng],
  )
  if (audio !== 'ok') {
    return (
      <div className="animate-rise pb-6">
        <PageHeader title={ui.games.listen} subtitle={LISTEN_LABEL[mode]} />
        <NoAudioNotice audio={audio} />
        <Button variant="ghost" className="mt-4 w-full" onClick={onDone}>
          Back
        </Button>
      </div>
    )
  }
  if (questions.length < 4) return <TooFew onBack={onDone} game="listen" />
  return <Round questions={questions} mode={mode} onDone={onDone} onAgain={onAgain} best={best} />
}

function Round({ questions, mode, onDone, onAgain, best }: { questions: RapidQuestion[]; mode: ListenMode; onDone: () => void; onAgain: () => void; best?: number }) {
  const { say } = useSpeak()
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [right, setRight] = useState(0)
  const [picked, setPicked] = useState<number | undefined>()
  const [typed, setTyped] = useState('')
  const [verdict, setVerdict] = useState<{ v: Verdict; notes: string[] } | undefined>()
  const [startedAt] = useState(() => Date.now())
  const field = useRef<HTMLInputElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const q = questions[i]
  const finished = i >= questions.length

  // play each new word (the tap that started the round counts as the gesture browsers want)
  useEffect(() => {
    if (!q) return
    e2eHook('listen', { lemma: q.v.lemma, jp: q.v.jp, answer: q.answer, index: i })
    void say(q.v.lemma)
    if (mode === 'type') field.current?.focus({ preventScroll: true })
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (verdict && (verdict.v === 'wrong' || mode === 'type')) next.current?.focus({ preventScroll: true })
  }, [verdict]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!finished) return
    playSound('finish')
    const ms = Date.now() - startedAt
    void (async () => {
      await updateBest((b) => (mode === 'pick' ? { ...b, listenPick: Math.max(b.listenPick ?? 0, score) } : { ...b, listenType: Math.max(b.listenType ?? 0, score) }))
      await addMinutes(ms)
    })()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => {
    clearTimeout(timer.current)
    setPicked(undefined)
    setTyped('')
    setVerdict(undefined)
    setI((k) => k + 1)
  }
  const settle = (v: Verdict, notes: string[] = []) => {
    if (!q) return
    setVerdict({ v, notes })
    void recordAnswer(q.v.id, v, mode === 'pick' ? 'listen' : 'dictation', { fast: v === 'correct' })
    if (v !== 'wrong') {
      setScore((s) => s + rapidPoints(streak))
      setStreak((s) => s + 1)
      setRight((r) => r + 1)
      playSound('correct')
      if (mode === 'pick') timer.current = setTimeout(advance, 1100)
    } else {
      setStreak(0)
      playSound('wrong')
    }
  }
  const pick = (oi: number) => {
    if (!q || verdict) return
    setPicked(oi)
    settle(oi === q.answer ? 'correct' : 'wrong')
  }
  const submit = () => {
    if (!q || verdict) return
    if (!typed.trim()) return
    const m = languagePack.match(typed, q.v.jp ? [q.v.lemma, q.v.jp] : [q.v.lemma])
    settle(m.verdict, m.notes)
  }
  const insert = (ch: string) => {
    setTyped((t) => t + ch)
    field.current?.focus({ preventScroll: true })
  }

  if (finished) {
    const isBest = score > 0 && (best === undefined || score > best)
    return (
      <div className="animate-rise pb-6 text-center">
        <PageHeader title={ui.games.listen} subtitle={LISTEN_LABEL[mode]} />
        {isBest && <Confetti />}
        <div className="mx-auto w-fit">
          <Bonchita size={96} act={right >= questions.length / 2 ? 'cheer' : 'curious'} />
        </div>
        <p className="mt-1 font-display text-5xl">{score}</p>
        <p className="text-sm text-muted">
          points · {right} of {questions.length} right{isBest ? ' · new best!' : best ? ` · best ${best}` : ''}
        </p>
        <RoundButtons onAgain={onAgain} onDone={onDone} />
      </div>
    )
  }
  if (!q) return null
  const mult = Math.min(4, 1 + Math.floor(streak / 3))
  const act = verdict ? (verdict.v === 'wrong' ? 'sad' : 'cheer') : 'curious'
  return (
    <div className="animate-rise pb-6">
      <PageHeader
        title={ui.games.listen}
        subtitle={`${LISTEN_LABEL[mode]} · ${score} points`}
        right={
          <Chip tone={streak >= 3 ? 'gold' : 'sky'} className="shrink-0 whitespace-nowrap">
            <span aria-label={`Streak ${streak}`}>🔥 {streak}</span>
          </Chip>
        }
      />
      <ProgressBar value={i} max={questions.length} tone="sky" className="mb-4" />
      <div className="card">
        <div className="flex items-center justify-center gap-3">
          <Bonchita size={64} act={act} aria-hidden="true" />
          <button
            type="button"
            onClick={() => void say(q.v.lemma)}
            className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue text-white shadow-[0_4px_0_0_color-mix(in_srgb,var(--blue)_60%,var(--ink))] transition-transform active:translate-y-0.5 active:shadow-none"
            aria-label="Replay the word"
          >
            <IconSpeaker width={38} height={38} />
          </button>
          <button
            type="button"
            onClick={() => void say(q.v.lemma, 'slower')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-blue shadow-[0_3px_0_0_var(--line-strong)] transition-transform active:translate-y-0.5 active:shadow-none"
            aria-label="Play slowly"
            title="Extra slow"
          >
            <IconTurtle width={24} height={24} />
          </button>
        </div>
        <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wider text-blue">
          Word {i + 1} of {questions.length}
          {mult > 1 ? ` · ×${mult}` : ''}
        </p>
        {!verdict && <p className="mt-1 text-center text-sm text-muted">{mode === 'pick' ? 'Listen, then pick what it means.' : 'Listen, then type the word you hear.'}</p>}
        <NoVoiceHint />

        {verdict && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-center ${verdict.v === 'wrong' ? 'bg-[var(--sheet-bad)]' : 'bg-[var(--sheet-ok)]'}`} role="status">
            <p className={`text-xs font-extrabold uppercase tracking-wider ${verdict.v === 'wrong' ? 'text-[var(--bad)]' : 'text-[var(--ok)]'}`}>{verdict.v === 'wrong' ? 'It was' : verdict.v === 'almost' ? 'Almost!' : 'Yes!'}</p>
            <p className="mt-1 font-display text-2xl leading-[1.7]">
              <TargetText text={q.v.lemma} />
            </p>
            <p className="text-sm text-muted" lang="en">
              {q.v.en.slice(0, 2).join(', ')}
            </p>
            {verdict.notes.map((n) => (
              <p key={n} className="mt-1 text-xs text-muted">
                {n}
              </p>
            ))}
          </div>
        )}

        {mode === 'pick' ? (
          <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Meaning">
            {q.options.map((o, oi) => {
              let cls = ''
              if (verdict) {
                if (oi === q.answer) cls = 'correct'
                else if (oi === picked) cls = 'wrong'
              }
              return (
                <button key={oi} type="button" role="radio" aria-checked={picked === oi} disabled={!!verdict} onClick={() => pick(oi)} className={`tile py-2.5 ${cls}`} lang="en">
                  {o}
                </button>
              )
            })}
          </div>
        ) : (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (verdict) advance()
              else submit()
            }}
          >
            <input
              ref={field}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={!!verdict}
              lang={TL}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder={ui.typePlaceholder}
              aria-label="What you hear"
              className="w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-lg font-bold shadow-[0_4px_0_0_var(--line)] outline-none transition focus:border-sky-500 focus:shadow-[0_4px_0_0_var(--color-sky-500)]"
            />
            {!verdict && SPECIAL_CHARS.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Special characters">
                {SPECIAL_CHARS.map((c) => (
                  <button key={c} type="button" onClick={() => insert(c)} className="tile px-3 py-1.5" lang={TL}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            {!verdict && (
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
                <Button variant="ghost" onClick={() => settle('wrong')}>
                  Show me
                </Button>
                <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>
                  Check
                </button>
              </div>
            )}
          </form>
        )}

        {verdict && (verdict.v === 'wrong' || mode === 'type') && (
          <button ref={next} type="button" className={`btn mt-3 w-full ${verdict.v === 'wrong' ? 'btn-primary' : 'btn-ok'}`} onClick={advance}>
            Continue
          </button>
        )}
      </div>
      <Button variant="ghost" className="mt-4 w-full" onClick={() => setI(questions.length)}>
        Stop
      </Button>
    </div>
  )
}
