/**
 * Word of the day: a Wordle-style puzzle. One hidden word a day, the same all day, from the
 * words the learner has met (the course's A1 words for a new learner), 4–7 letters with
 * accents stripped (Cantonese: Jyutping without tones). Six guesses, each a word from the
 * course; green, yellow and grey tiles carry icons too, so the colours are never the only clue.
 * Today's guesses are kept, so leaving and coming back resumes the puzzle; once it is done the
 * page shows the result, the streak and a countdown to tomorrow's word, plus practice words.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { languagePack } from '@lang'
import type { VocabEntry } from '../../engine/schema'
import { vocab } from '../../engine/loader'
import { DAILY_GUESSES, dailyLetters, foldWord, formatCountdown, guessList, keyStates, liveStreak, msToTomorrow, nextStreak, scoreGuess, wordOfDay, type Mark } from '../../engine/games/dailyWord'
import { todayKey } from '../../engine/mastery'
import { Rng } from '../../engine/random'
import { allCards, getKv, recordAnswer, setKv } from '../../db/progress'
import { getDictionary } from '../../hooks/useDeps'
import { playSound } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useKvValue } from '../../hooks/useProgress'
import { useSettings } from '../../store/settings'
import { Button, Chip, SpeakerButton } from '../../components/ui/basics'
import { IconCheck } from '../../components/ui/icons'
import { Confetti } from '../../components/ui/Confetti'
import { Bonchita } from '../../components/ui/Dogs'
import { TargetText } from '../../components/ui/TargetText'
import { calmMotion, nudge } from '../../components/game/motion'
import { addMinutes, e2eHook } from '../palabras/util'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { GAMES_BEST_KEY, recordGame, type GameBest } from './util'

const ID = 'daily'
const TITLE = 'Word of the day'
/** Today's puzzle in progress (or done), so it survives leaving the page. */
const SAVE_KEY = 'dailyWord'
const JYUTPING = languagePack.id === 'yue'
/** A learner with fewer fitting words than this plays the course's A1 words instead. */
const MIN_MET = 12
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

interface DailySave {
  day: string
  id: string
  guesses: string[]
  done?: 'won' | 'lost'
  /** The last few days' words, not repeated for a while. */
  recent: string[]
}

/** Words of the course that fit the puzzle: the learner's (met), or A1 for a new learner. */
async function candidates(): Promise<VocabEntry[]> {
  const cards = await allCards()
  const met = cards.flatMap((c) => {
    const v = c.kind === 'word' ? vocab.get(c.id) : undefined
    return v?.en[0] && dailyLetters(v, languagePack) ? [v] : []
  })
  if (met.length >= MIN_MET) return met
  return [...vocab.values()].filter((v) => v.level === 'a1' && v.en[0] && dailyLetters(v, languagePack))
}

/** Every spelling the course knows (lemmas and inflected forms), folded like the answers, by length. */
let guessCache: Map<number, Set<string>> | undefined
function validGuesses(): Map<number, Set<string>> {
  if (!guessCache) {
    const forms: string[] = [...getDictionary().keys()]
    for (const v of vocab.values()) forms.push(v.jp ?? v.lemma)
    guessCache = guessList(forms, languagePack, JYUTPING)
  }
  return guessCache
}

export default function DailyWord({ onDone }: GameProps) {
  const [save, setSave] = useState<DailySave | undefined>()
  const [pool, setPool] = useState<VocabEntry[]>([])
  const [practice, setPractice] = useState<{ v: VocabEntry; n: number } | undefined>()
  const [loadKey, setLoadKey] = useState(0)
  const best = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})?.[ID]

  // today's word: kept once chosen, so it stays the same all day even as the learner meets new words
  useEffect(() => {
    let live = true
    void (async () => {
      const today = todayKey()
      const prev = await getKv<DailySave | undefined>(SAVE_KEY, undefined)
      const list = await candidates()
      let s = prev
      if (!s || s.day !== today || !vocab.get(s.id)) {
        const id = wordOfDay(
          list.map((v) => v.id),
          today,
          languagePack.id,
          prev?.recent ?? [],
        )
        if (!id) return
        s = { day: today, id, guesses: [], recent: [...(prev?.recent ?? []), id].slice(-30) }
        await setKv(SAVE_KEY, s)
      }
      if (!live) return
      setPool(list)
      setSave(s)
    })()
    return () => {
      live = false
    }
  }, [loadKey])

  const startPractice = () => {
    const rng = new Rng(Date.now())
    const others = pool.filter((v) => v.id !== save?.id && v.id !== practice?.v.id)
    if (others.length) setPractice((p) => ({ v: rng.pick(others), n: (p?.n ?? 0) + 1 }))
  }

  if (!save) return <GameHeader title={TITLE} subtitle="Finding today's word…" onBack={onDone} />
  const streak = liveStreak({ day: best?.day, streak: Number(best?.extra?.streak ?? 0) }, save.day)

  if (practice) {
    return (
      <Puzzle
        key={`p${practice.n}`}
        answer={practice.v}
        mode="practice"
        streak={streak}
        onDone={onDone}
        onPractice={startPractice}
        onBackToDaily={() => setPractice(undefined)}
        onFinish={async (won, n) => {
          await recordAnswer(practice.v.id, won ? (n <= 4 ? 'correct' : 'almost') : 'wrong', 'typeEs')
          const prev = await getKv<Record<string, GameBest>>(GAMES_BEST_KEY, {})
          await recordGame(ID, { extra: { practised: Number(prev[ID]?.extra?.practised ?? 0) + 1 } })
        }}
      />
    )
  }
  const answer = vocab.get(save.id)!
  return (
    <Puzzle
      key={save.day}
      answer={answer}
      mode="daily"
      initial={save.guesses}
      streak={streak}
      onDone={onDone}
      onPractice={startPractice}
      onTomorrow={() => setLoadKey((k) => k + 1)}
      onGuess={(guesses, done) => {
        const s = { ...save, guesses, done }
        setSave(s)
        void setKv(SAVE_KEY, s)
      }}
      onFinish={async (won, n) => {
        await recordAnswer(answer.id, won ? (n <= 4 ? 'correct' : 'almost') : 'wrong', 'typeEs')
        const prev = (await getKv<Record<string, GameBest>>(GAMES_BEST_KEY, {}))[ID]
        const next = nextStreak({ day: prev?.day, streak: Number(prev?.extra?.streak ?? 0) }, save.day, won)
        await recordGame(ID, {
          score: next,
          day: save.day,
          extra: {
            streak: next,
            wins: Number(prev?.extra?.wins ?? 0) + (won ? 1 : 0),
            days: Number(prev?.extra?.days ?? 0) + 1,
            guesses: won ? n : 0,
            word: answer.id,
          },
        })
      }}
    />
  )
}

interface Row {
  guess: string[]
  marks: Mark[]
}

function Puzzle({
  answer,
  mode,
  initial = [],
  streak,
  onDone,
  onPractice,
  onBackToDaily,
  onTomorrow,
  onGuess,
  onFinish,
}: {
  answer: VocabEntry
  mode: 'daily' | 'practice'
  initial?: string[]
  streak: number
  onDone: () => void
  onPractice: () => void
  onBackToDaily?: () => void
  onTomorrow?: () => void
  onGuess?: (guesses: string[], done?: 'won' | 'lost') => void
  onFinish: (won: boolean, guesses: number) => Promise<void>
}) {
  const letters = useMemo(() => dailyLetters(answer, languagePack)!, [answer])
  const n = letters.length
  const target = letters.join('')
  const valid = useMemo(() => validGuesses().get(n) ?? new Set<string>(), [n])
  const calm = useMemo(() => calmMotion(), [])
  const [rows, setRows] = useState<Row[]>(() => initial.map((g) => ({ guess: [...g], marks: scoreGuess([...g], letters) })))
  const [typed, setTyped] = useState<string[]>([])
  const [note, setNote] = useState<{ text: string; tone: 'muted' | 'bad' } | undefined>()
  const [startedAt] = useState(() => Date.now())
  const [justFinished, setJustFinished] = useState(false)
  const rowEls = useRef<(HTMLDivElement | null)[]>([])
  const won = rows.some((r) => r.guess.join('') === target)
  const done = won || rows.length >= DAILY_GUESSES
  const keys = useMemo(() => keyStates(rows), [rows])
  /** Letters beyond a–z that the course's words use (ñ). */
  const extra = useMemo(() => {
    const set = new Set<string>()
    for (const w of valid) for (const ch of w) if (!/[a-z]/.test(ch)) set.add(ch)
    for (const ch of letters) if (!/[a-z]/.test(ch)) set.add(ch)
    return [...set].sort()
  }, [valid, letters])

  useEffect(() => {
    const other = [...valid].find((w) => w !== target)
    e2eHook('daily', { answer: target, mode, other })
  }, [target, valid, mode])

  const type = useCallback(
    (ch: string) => {
      if (done) return
      setNote(undefined)
      setTyped((t) => (t.length < n ? [...t, ch] : t))
    },
    [done, n],
  )
  const back = useCallback(() => {
    if (done) return
    setNote(undefined)
    setTyped((t) => t.slice(0, -1))
  }, [done])

  const submit = () => {
    if (done) return
    const row = rowEls.current[rows.length]
    if (typed.length < n) {
      setNote({ text: `The word has ${n} letters.`, tone: 'muted' })
      if (!calm) nudge(row, 'shake')
      return
    }
    const word = typed.join('')
    if (word !== target && !valid.has(word)) {
      setNote({ text: `“${word}” is not in the word list. Try another word.`, tone: 'muted' })
      if (!calm) nudge(row, 'shake')
      return
    }
    const next = [...rows, { guess: typed, marks: scoreGuess(typed, letters) }]
    setRows(next)
    setTyped([])
    const isWin = word === target
    const over = isWin || next.length >= DAILY_GUESSES
    onGuess?.(
      next.map((r) => r.guess.join('')),
      over ? (isWin ? 'won' : 'lost') : undefined,
    )
    // turn the tiles over one by one
    if (!calm && row) [...row.children].forEach((el, k) => (el as HTMLElement).animate?.([{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)', offset: 0.5 }, { transform: 'rotateX(0)' }], { duration: 420, delay: k * 90, easing: 'ease-in-out' }))
    if (over) {
      setJustFinished(true)
      playSound(isWin ? 'finish' : 'wrong')
      void (async () => {
        await onFinish(isWin, next.length)
        await addMinutes(Date.now() - startedAt)
      })()
    } else playSound('tap')
  }

  // the physical keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        back()
      } else if (e.key.length === 1 && /^\p{L}$/u.test(e.key)) {
        const ch = foldWord(e.key, languagePack)
        if (ch && [...ch].length === 1 && (/[a-z]/.test(ch) || extra.includes(ch))) {
          e.preventDefault()
          type(ch)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hint = `${n} letters${answer.pos === 'noun' ? ' · a noun' : answer.pos === 'verb' ? ' · a verb' : answer.pos === 'adj' ? ' · an adjective' : ''}${JYUTPING ? ' · Jyutping, no tones' : ''}`
  const kbRows = [...ROWS]
  if (extra.length) kbRows[1] = kbRows[1] + extra.join('')

  return (
    <div className="animate-rise pb-6">
      <GameHeader
        title={TITLE}
        subtitle={mode === 'daily' ? (done ? 'Today’s word' : 'Guess today’s word in six tries.') : 'Practice word: no streak, just for fun.'}
        onBack={onDone}
        right={
          <Chip tone={streak >= 3 ? 'gold' : 'sky'} className="mt-2 shrink-0 whitespace-nowrap">
            <span aria-label={`Streak ${streak} days`}>🔥 {streak}</span>
          </Chip>
        }
      />
      {justFinished && won && <Confetti />}
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">{hint}</p>

      <div className="mx-auto grid gap-1.5" style={{ maxWidth: n * 58 }} role="grid" aria-label={`Guesses, ${rows.length} of ${DAILY_GUESSES} used`}>
        {Array.from({ length: DAILY_GUESSES }, (_, r) => {
          const row = rows[r]
          // once solved, the unused rows give their space to the result
          if (done && !row) return null
          const live = !row && r === rows.length && !done
          const shown = row ? row.guess : live ? typed : []
          return (
            <div
              key={r}
              ref={(el) => {
                rowEls.current[r] = el
              }}
              role="row"
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, perspective: 600 }}
            >
              {Array.from({ length: n }, (_, k) => {
                const ch = shown[k]
                const m = row?.marks[k]
                return <Tile key={k} ch={ch} mark={m} active={live && k === typed.length} />
              })}
            </div>
          )
        })}
      </div>

      <p className="mt-2 min-h-5 text-center text-sm font-semibold" role="status" aria-live="polite">
        {note ? <span className={note.tone === 'bad' ? 'text-[var(--bad)]' : 'text-ink-2'}>{note.text}</span> : null}
      </p>

      {done ? (
        <Result answer={answer} won={won} guesses={rows.length} mode={mode} onDone={onDone} onPractice={onPractice} onBackToDaily={onBackToDaily} onTomorrow={onTomorrow} />
      ) : (
        <Keyboard rows={kbRows} keys={keys} onLetter={type} onBack={back} onEnter={submit} />
      )}
    </div>
  )
}

const MARK_LABEL: Record<Mark, string> = { hit: 'right spot', near: 'in the word, wrong spot', miss: 'not in the word' }

/** Mark colours (tile and key), set with CSS variables so they follow the theme. */
const markClass = (m: Mark | undefined) =>
  m === 'hit'
    ? 'border-[var(--ok)] bg-[var(--ok)] text-[var(--paper)]'
    : m === 'near'
      ? 'border-[var(--sun)] bg-[var(--sun)] text-[#2a1d00] [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgba(255,255,255,0.22)_6px_9px)]'
      : m === 'miss'
        ? 'border-line bg-surface-2 text-muted'
        : ''

/** The colour-blind-safe marker: a tick for the right spot, a ring with arrows for the wrong spot. */
function MarkIcon({ mark, size = 12 }: { mark: Mark | undefined; size?: number }) {
  if (mark === 'hit') return <IconCheck width={size} height={size} aria-hidden="true" className="absolute right-[3px] top-[3px]" strokeWidth={3} />
  if (mark === 'near')
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className="absolute right-[3px] top-[3px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M1.5 6h9M3.5 4 1.5 6l2 2M8.5 4l2 2-2 2" />
      </svg>
    )
  return null
}

function Tile({ ch, mark, active }: { ch?: string; mark?: Mark; active: boolean }) {
  const base = mark ? markClass(mark) : ch ? 'border-ink-2 bg-surface' : active ? 'border-blue bg-surface' : 'border-line bg-surface'
  return (
    <div
      role="gridcell"
      aria-label={ch ? `${ch}${mark ? `, ${MARK_LABEL[mark]}` : ''}` : 'empty'}
      className={`relative flex aspect-square min-w-0 items-center justify-center rounded-[10px] border-2 font-display text-[clamp(1.2rem,6vw,1.9rem)] font-semibold uppercase leading-none ${base}`}
      lang={TL}
    >
      {ch}
      <MarkIcon mark={mark} />
    </div>
  )
}

function Keyboard({ rows, keys, onLetter, onBack, onEnter }: { rows: string[]; keys: Map<string, Mark>; onLetter: (ch: string) => void; onBack: () => void; onEnter: () => void }) {
  return (
    <div className="mt-3 grid gap-1.5 select-none" role="group" aria-label="Keyboard">
      {rows.map((row, r) => (
        <div key={r} className="flex justify-center gap-1">
          {r === rows.length - 1 && (
            <button type="button" onClick={onEnter} className="flex h-12 min-w-0 flex-[1.6] items-center justify-center rounded-lg border-[1.5px] border-line bg-surface-2 text-xs font-extrabold uppercase tracking-wide shadow-[0_2px_0_0_var(--line-strong)] active:translate-y-px" aria-label="Enter guess">
              Enter
            </button>
          )}
          {[...row].map((ch) => {
            const m = keys.get(ch)
            return (
              <button
                key={ch}
                type="button"
                onClick={() => onLetter(ch)}
                aria-label={`${ch}${m ? `, ${MARK_LABEL[m]}` : ''}`}
                className={`relative flex h-12 min-w-0 max-w-11 flex-1 items-center justify-center rounded-lg border-[1.5px] text-lg font-bold uppercase shadow-[0_2px_0_0_var(--line-strong)] active:translate-y-px ${m ? markClass(m) : 'border-line bg-surface'} ${m === 'miss' ? 'opacity-55' : ''}`}
                lang={TL}
              >
                {ch}
                <MarkIcon mark={m} size={9} />
              </button>
            )
          })}
          {r === rows.length - 1 && (
            <button type="button" onClick={onBack} className="flex h-12 min-w-0 flex-[1.6] items-center justify-center rounded-lg border-[1.5px] border-line bg-surface-2 text-lg font-bold shadow-[0_2px_0_0_var(--line-strong)] active:translate-y-px" aria-label="Delete letter">
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function Result({ answer, won, guesses, mode, onDone, onPractice, onBackToDaily, onTomorrow }: { answer: VocabEntry; won: boolean; guesses: number; mode: 'daily' | 'practice'; onDone: () => void; onPractice: () => void; onBackToDaily?: () => void; onTomorrow?: () => void }) {
  const [left, setLeft] = useState(() => msToTomorrow(new Date()))
  /** Readings already sit above the characters (TargetText) unless turned off in Settings. */
  const readings = useSettings((s) => s.romanization) && Boolean(languagePack.romanize)
  useEffect(() => {
    if (mode !== 'daily') return
    const t = setInterval(() => setLeft(msToTomorrow(new Date())), 1000)
    return () => clearInterval(t)
  }, [mode])
  // past midnight with the page open: a new word is ready
  const fresh = mode === 'daily' && left < 1500
  return (
    <div className="card mt-3 text-center">
      <div className="mx-auto -mt-1 w-fit">
        <Bonchita size={84} act={won ? 'cheer' : 'sad'} />
      </div>
      <p className="text-lg font-semibold">{won ? (guesses === 1 ? 'First try!' : `Got it in ${guesses}!`) : 'So close. The word was:'}</p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <span className="text-3xl font-semibold">
          <TargetText text={answer.lemma} />
        </span>
        <SpeakerButton text={answer.lemma} size="sm" />
      </div>
      {answer.jp && !readings && <p className="text-sm font-semibold text-muted">{answer.jp}</p>}
      <p className="mt-1 text-ink-2" lang="en">
        {answer.en.slice(0, 3).join(', ')}
      </p>
      {answer.example && (
        <p className="mt-2 text-sm">
          <TargetText text={answer.example.es} className="font-semibold" />
          <span className="block text-muted" lang="en">
            {answer.example.en}
          </span>
        </p>
      )}
      {mode === 'daily' ? (
        fresh ? (
          <Button className="mt-4 w-full" onClick={onTomorrow}>
            Play today’s word
          </Button>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Next word in <span className="font-mono font-bold text-ink" aria-live="off">{formatCountdown(left)}</span>
          </p>
        )
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={mode === 'practice' && onBackToDaily ? onBackToDaily : onDone}>
          {mode === 'practice' ? 'Today’s word' : 'Done'}
        </Button>
        <Button onClick={onPractice}>{mode === 'practice' ? 'Another one' : 'Practice word'}</Button>
      </div>
    </div>
  )
}
