/**
 * Scramble: an English clue and the word's letters as shuffled tiles; tap them into the slots
 * (tap a placed tile to send it back). It checks itself when the slots are full. 75 seconds,
 * a streak multiplier, hints that cost points. Cantonese scrambles the characters of words of
 * two or more characters; the Jyutping shows once the word is solved.
 */
import { useEffect, useRef, useState } from 'react'
import { languagePack } from '@lang'
import type { VocabEntry } from '../../engine/schema'
import { vocab } from '../../engine/loader'
import { crosswordLetters } from '../../engine/vocabGame'
import { Rng } from '../../engine/random'
import {
  newScramble,
  pickDecoys,
  decoyCount,
  tileText,
  place,
  unplace,
  unplaceLast,
  placeLetter,
  hint as hintOf,
  clearSlots,
  reshuffle,
  isFull,
  isSolved,
  isPlaced,
  scramblePoints,
  scrambleMultiplier,
  scrambleVerdict,
  scrambleOrder,
  SCRAMBLE_SECONDS,
  HINT_COST,
  type ScrambleState,
} from '../../engine/games/scramble'
import { recordAnswer } from '../../db/progress'
import { playSound } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useSpeak } from '../../hooks/useSpeak'
import { Chip, Button } from '../../components/ui/basics'
import { IconSpeaker } from '../../components/ui/icons'
import { TargetText } from '../../components/ui/TargetText'
import { TooFew } from '../palabras/shared'
import { addMinutes, e2eHook } from '../palabras/util'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { useGameWords, recordGame } from './util'
import { JYUTPING, fold, givesAway, useGameBest } from './wordGames'
import { GameOver, Loading } from './WordGameOver'

const ID = 'scramble'
const TITLE = 'Scramble'
const HAN = /^\p{Script=Han}$/u

/** The tiles: the characters of a Cantonese word (two to six), or the letters of a word (accents kept). */
function tilesOf(v: VocabEntry): string[] | undefined {
  if (JYUTPING) {
    const chars = [...v.lemma]
    return chars.length >= 2 && chars.length <= 6 && chars.every((ch) => HAN.test(ch)) ? chars : undefined
  }
  return crosswordLetters(v, languagePack.normalize)
}
let byLemma: Map<string, VocabEntry[]> | undefined
/** True when `word` is another word of the course with one of v's meanings (a synonym the tiles must not spell). */
function meansTheSame(v: VocabEntry, word: string): boolean {
  if (!byLemma) {
    byLemma = new Map()
    for (const w of vocab.values()) byLemma.set(w.lemma, [...(byLemma.get(w.lemma) ?? []), w])
  }
  const glosses = new Set(v.en.map((e) => e.toLowerCase().trim()))
  return (byLemma.get(word) ?? []).some((w) => w.id !== v.id && w.en.some((e) => glosses.has(e.toLowerCase().trim())))
}

/**
 * A fresh board for `v`. Short Cantonese words get decoy characters from the learner's other
 * words in this round (2 for two characters, 1 for three), so they are not a simple swap.
 */
function boardFor(v: VocabEntry, words: VocabEntry[], rng: Rng): ScrambleState {
  const tiles = tilesOf(v)!
  const n = JYUTPING ? decoyCount(tiles.length) : 0
  const pool = n ? words.filter((w) => w.id !== v.id).flatMap((w) => [...w.lemma].filter((ch) => HAN.test(ch))) : []
  return newScramble(tiles, rng, n ? pickDecoys(tiles, pool, n, rng, (word) => meansTheSame(v, word)) : [])!
}

const fits = (v: VocabEntry) => {
  const t = tilesOf(v)
  // a word whose tiles are all the same (拜拜) cannot be scrambled
  return Boolean(t && !givesAway(v, t) && scrambleOrder(t, new Rng(1)))
}

export default function Scramble({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const words = useGameWords(30, fits, round)
  const best = useGameBest(ID)
  return (
    <div className="animate-rise pb-6">
      {words === undefined ? (
        <>
          <GameHeader title={TITLE} onBack={onDone} />
          <Loading />
        </>
      ) : words.length < 4 ? (
        <>
          <GameHeader title={TITLE} onBack={onDone} />
          <TooFew onBack={onDone} />
        </>
      ) : (
        <Round key={round} words={words} best={best?.score} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
      )}
    </div>
  )
}

type Status = 'play' | 'right' | 'wrong' | 'skipped'

function Round({ words, best, onDone, onAgain }: { words: VocabEntry[]; best?: number; onDone: () => void; onAgain: () => void }) {
  const { say, supported } = useSpeak()
  const [rng] = useState(() => new Rng(Date.now()))
  const [i, setI] = useState(0)
  const v = words[i]
  const [s, setS] = useState<ScrambleState>(() => boardFor(words[0]!, words, rng))
  const [status, setStatus] = useState<Status>('play')
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [solved, setSolved] = useState(0)
  const [gained, setGained] = useState(0)
  const [startedAt] = useState(() => Date.now())
  const [left, setLeft] = useState(SCRAMBLE_SECONDS)
  const [over, setOver] = useState(false)
  /** Set once the round ends, with the best score before it (the kv value updates once the round is recorded). */
  const [ended, setEnded] = useState<{ best?: number } | undefined>()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const finished = over || i >= words.length
  const busy = status !== 'play'

  useEffect(() => {
    if (finished) return
    const t = setInterval(() => {
      const l = Math.max(0, SCRAMBLE_SECONDS - Math.floor((Date.now() - startedAt) / 1000))
      setLeft(l)
      if (l === 0) setOver(true)
    }, 250)
    return () => clearInterval(t)
  }, [startedAt, finished])
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (v) e2eHook('scramble', { index: i, tiles: s.tiles, pool: s.pool.map((t) => tileText(s, t)), decoys: s.decoys })
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!finished) return
    clearTimeout(timer.current)
    playSound('finish')
    const ms = Math.min(Date.now() - startedAt, SCRAMBLE_SECONDS * 1000)
    void (async () => {
      setEnded({ best })
      await recordGame(ID, { score })
      await addMinutes(ms)
    })()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextWord = () => {
    const k = i + 1
    setI(k)
    setStatus('play')
    if (words[k]) setS(boardFor(words[k], words, rng))
  }
  /** Every change to the slots goes through here: a full row checks itself. */
  const apply = (n: ScrambleState) => {
    if (busy || finished || !v) return
    setS(n)
    if (!isFull(n)) return
    if (isSolved(n)) {
      const pts = scramblePoints(n.tiles.length, n.hints, streak)
      setScore((x) => x + pts)
      setGained(pts)
      setStreak((x) => x + 1)
      setSolved((x) => x + 1)
      setStatus('right')
      void recordAnswer(v.id, scrambleVerdict(n), 'typeEs')
      playSound('correct')
      void say(v.lemma)
      timer.current = setTimeout(nextWord, 1300)
    } else {
      setStreak(0)
      setStatus('wrong')
      playSound('wrong')
      timer.current = setTimeout(() => {
        setS((cur) => clearSlots(cur, true))
        setStatus('play')
      }, 700)
    }
  }
  const skip = () => {
    if (busy || !v) return
    setStreak(0)
    setStatus('skipped')
    void recordAnswer(v.id, 'wrong', 'typeEs')
    playSound('wrong')
    void say(v.lemma)
    timer.current = setTimeout(nextWord, 1800)
  }

  // typing: letters place the matching tile (accents optional), Backspace sends the last one back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || finished || busy) return
      if (e.key === 'Backspace') {
        e.preventDefault()
        setS((cur) => unplaceLast(cur))
      } else if (e.key.length === 1 && /^\p{L}$/u.test(e.key)) {
        const n = placeLetter(s, e.key, (a, b) => a === b || fold(a) === fold(b))
        if (n !== s) {
          e.preventDefault()
          apply(n)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (finished && !ended) return <GameHeader title={TITLE} onBack={onDone} />
  if (finished) {
    const bestBefore = ended?.best
    const isBest = score > 0 && (bestBefore === undefined || score > bestBefore)
    return (
      <>
        <GameHeader title={TITLE} onBack={onDone} />
        <GameOver dog="luna" happy={solved > 0} title={left === 0 ? 'Time!' : undefined} big={score} party={isBest} onAgain={onAgain} onDone={onDone}>
          points · {solved} word{solved === 1 ? '' : 's'} unscrambled{isBest ? ' · new best!' : bestBefore ? ` · best ${bestBefore}` : ''}
        </GameOver>
      </>
    )
  }
  if (!v) return null
  const mult = scrambleMultiplier(streak)
  const n = s.tiles.length
  // the slots share the card's width (page and card padding: 64px, 6px gaps), up to 3.1rem each
  const tileW = `min(3.1rem, calc((100vw - ${64 + (n - 1) * 6}px) / ${n}))`
  // pool tiles stay big enough to tap (2.5rem), wrapping onto a second row for long words
  const m = s.pool.length
  const poolW = `max(2.5rem, min(3.1rem, calc((100vw - ${32 + (m - 1) * 8}px) / ${m})))`
  const reveal = status === 'right' || status === 'skipped'
  return (
    <>
      <GameHeader
        title={TITLE}
        subtitle={`${score} points · streak ${streak}`}
        right={
          <Chip tone={left <= 10 ? 'bad' : 'sky'} className="shrink-0 whitespace-nowrap">
            {left} s
          </Chip>
        }
        onBack={onDone}
      />
      <p className="-mt-2 mb-2 min-h-4 text-center text-xs font-semibold text-gold-600">{mult > 1 ? `×${mult} multiplier` : ''}</p>

      <div className="card text-center">
        <p className="eyebrow">Unscramble the word for</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="text-xl font-semibold leading-snug" lang="en">
            {v.en[0]}
          </p>
          {supported && (
            <button type="button" onClick={() => void say(v.lemma)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue text-white" aria-label="Hear the word (hint)">
              <IconSpeaker width={18} height={18} />
            </button>
          )}
        </div>

        <div className={`mt-4 flex justify-center gap-1.5 ${status === 'wrong' ? 'motion-safe:animate-[shake_380ms_ease-in-out]' : ''}`} role="group" aria-label="Your answer">
          {s.slots.map((t, k) => {
            const ch = t === null ? undefined : tileText(s, t)
            const shown = status === 'skipped' ? s.tiles[k] : ch
            const tone =
              status === 'right'
                ? 'border-[var(--ok)] bg-[color-mix(in_srgb,var(--ok)_14%,var(--card))] text-[var(--ok)]'
                : status === 'wrong'
                  ? 'border-[var(--bad)] bg-[color-mix(in_srgb,var(--bad)_12%,var(--card))] text-[var(--bad)]'
                  : status === 'skipped'
                    ? 'border-line-strong bg-surface-2 text-muted'
                    : s.locked[k]
                      ? 'border-[var(--sun)] bg-[color-mix(in_srgb,var(--sun)_16%,var(--card))]'
                      : ch
                        ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_9%,var(--card))]'
                        : 'border-dashed border-line-strong bg-surface-2'
            return (
              <button
                key={k}
                type="button"
                disabled={busy || ch === undefined || s.locked[k]}
                onClick={() => setS(unplace(s, k))}
                aria-label={ch === undefined ? `Slot ${k + 1}, empty` : `Slot ${k + 1}: ${ch}${s.locked[k] ? ', from a hint' : ', tap to take back'}`}
                className={`flex aspect-square items-center justify-center rounded-xl border-[1.5px] font-display leading-none transition-colors ${JYUTPING ? '' : 'uppercase'} ${tone}`}
                style={{ width: tileW, fontSize: JYUTPING ? `calc(${tileW} * 0.55)` : `calc(${tileW} * 0.5)` }}
                lang={TL}
              >
                {shown}
              </button>
            )
          })}
        </div>

        <p className="mt-3 min-h-12 text-sm font-semibold" role="status" aria-live="polite">
          {reveal ? (
            <span className={status === 'right' ? 'text-[var(--ok)]' : 'text-muted'}>
              {status === 'right' ? `+${gained} · ` : 'It was '}
              <TargetText text={v.lemma} className="font-display text-lg" />
            </span>
          ) : status === 'wrong' ? (
            <span className="text-[var(--bad)]">Not quite: try another order.</span>
          ) : (
            <span className="text-xs font-medium text-muted">{JYUTPING ? (s.decoys.length ? 'Tap the characters in order: not every one belongs.' : 'Tap the characters in order.') : 'Tap the letters in order, or type them.'}</span>
          )}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Tiles">
        {s.pool.map((t) => {
          const used = isPlaced(s, t)
          return (
            <button
              key={t}
              type="button"
              disabled={used || busy}
              aria-hidden={used}
              tabIndex={used ? -1 : undefined}
              onClick={() => apply(place(s, t))}
              className={`tile flex aspect-square items-center justify-center px-0 py-0 text-center font-display leading-none ${JYUTPING ? '' : 'uppercase'} ${used ? 'invisible' : ''}`}
              style={{ width: poolW, fontSize: JYUTPING ? `calc(${poolW} * 0.55)` : `calc(${poolW} * 0.5)` }}
              data-tile={tileText(s, t)}
              lang={TL}
            >
              {tileText(s, t)}
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" className="tile py-2.5 text-center text-sm" disabled={busy} onClick={() => setS(reshuffle(s, rng))}>
          Shuffle
        </button>
        <button type="button" className="tile py-2.5 text-center text-sm" disabled={busy} onClick={() => apply(hintOf(s))}>
          Hint <span className="text-xs text-muted">−{HINT_COST}</span>
        </button>
        <button type="button" className="tile py-2.5 text-center text-sm" disabled={busy} onClick={skip}>
          Skip
        </button>
      </div>

      <Button variant="ghost" className="mt-4 w-full" onClick={() => setOver(true)}>
        Stop
      </Button>
    </>
  )
}
