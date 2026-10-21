/**
 * Fetch!: hangman with Leo. An English clue and a row of letter slots; tap letters on the
 * on-screen keyboard (or type them). Each miss rolls the ball one step further down the path;
 * six misses and it is lost in the bushes. Five words a round. Accents come free: "a" shows á.
 * Cantonese spells the Jyutping (without tones) of the characters shown.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { languagePack } from '@lang'
import type { VocabEntry } from '../../engine/schema'
import { ui } from '../../engine/loader'
import { newFetch, guess, isWon, isLost, isOver, shown, hits, spared, fetchPoints, fetchVerdict, fetchKeyboard, FETCH_STEPS, FETCH_ROUND, type FetchState } from '../../engine/games/fetch'
import { recordAnswer } from '../../db/progress'
import { playSound } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { useSpeak } from '../../hooks/useSpeak'
import { Chip, Button } from '../../components/ui/basics'
import { IconSpeaker } from '../../components/ui/icons'
import { Leo } from '../../components/ui/Dogs'
import { TargetText } from '../../components/ui/TargetText'
import { TooFew } from '../palabras/shared'
import { addMinutes, e2eHook } from '../palabras/util'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { useGameWords, recordGame } from './util'
import { JYUTPING, fold, givesAway, useGameBest } from './wordGames'
import { GameOver, Loading } from './WordGameOver'

const ID = 'fetch'
const TITLE = 'Fetch!'
const KEYS = fetchKeyboard(fold, JYUTPING ? [] : undefined)
const KEYSET = new Set(KEYS.flat())
/** Leo's spot at the left of the scene (px). */
const LEO_X = 12

/** What is spelled: the word as the course writes it (lowercase, ligatures spelled out), or Jyutping without tones. */
function answerOf(v: VocabEntry): string | undefined {
  const a = v.jp ? v.jp.replace(/[1-6]/g, '') : languagePack.normalize(v.lemma).normalize('NFC')
  const letters = [...a].filter((ch) => /^\p{L}$/u.test(ch))
  if (letters.length < 3 || letters.length > 12 || a.length > 16 || a.split(' ').length > 3) return undefined
  if (![...a].every((ch) => ch === ' ' || ch === "'" || /^\p{L}$/u.test(ch))) return undefined
  if (givesAway(v, letters) || !letters.every((ch) => KEYSET.has(newFetch(ch, fold).keys[0]!))) return undefined
  return a
}
const fits = (v: VocabEntry) => answerOf(v) !== undefined

export default function Fetch({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const words = useGameWords(FETCH_ROUND * 2, fits, round)
  const best = useGameBest(ID)
  return (
    <div className="animate-rise pb-6">
      {words === undefined ? (
        <>
          <GameHeader title={TITLE} onBack={onDone} />
          <Loading />
        </>
      ) : words.length < 3 ? (
        <>
          <GameHeader title={TITLE} onBack={onDone} />
          <TooFew onBack={onDone} />
        </>
      ) : (
        <Round key={round} words={words.slice(0, FETCH_ROUND)} best={best?.score} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
      )}
    </div>
  )
}

interface Result {
  id: string
  won: boolean
  points: number
}

function Round({ words, best, onDone, onAgain }: { words: VocabEntry[]; best?: number; onDone: () => void; onAgain: () => void }) {
  const { say, supported } = useSpeak()
  const [i, setI] = useState(0)
  const v = words[i]
  const [s, setS] = useState<FetchState>(() => newFetch(answerOf(words[0]!)!, fold))
  const [results, setResults] = useState<Result[]>([])
  const [last, setLast] = useState<{ key: string; hit: number } | undefined>()
  const [startedAt] = useState(() => Date.now())
  /** Set once the round ends, with the best score before it (the kv value updates once the round is recorded). */
  const [ended, setEnded] = useState<{ best?: number } | undefined>()
  const next = useRef<HTMLButtonElement>(null)
  const settled = useRef(-1)
  const finished = i >= words.length
  const over = isOver(s)
  const score = results.reduce((n, r) => n + r.points, 0)

  useEffect(() => {
    if (v) e2eHook('fetch', { index: i, answer: s.chars.join(''), keys: [...new Set(s.keys.filter(Boolean))] })
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // a word is over: count it as a review once, say it, and hand the focus to "Next"
  useEffect(() => {
    if (!over || !v || settled.current === i) return
    settled.current = i
    const won = isWon(s)
    void recordAnswer(v.id, fetchVerdict(s), 'typeEs')
    setResults((r) => [...r, { id: v.id, won, points: fetchPoints(s) }])
    playSound(won ? 'correct' : 'wrong')
    void say(v.lemma)
    next.current?.focus({ preventScroll: true })
  }, [over]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!finished) return
    playSound('finish')
    const ms = Date.now() - startedAt
    void (async () => {
      setEnded({ best })
      await recordGame(ID, { score })
      await addMinutes(ms)
    })()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const press = (key: string) => {
    if (over || s.guessed.includes(key)) return
    const n = hits(s, key)
    setLast({ key, hit: n })
    setS(guess(s, key))
    if (n) playSound('tap')
  }
  const advance = () => {
    const k = i + 1
    setI(k)
    setLast(undefined)
    if (words[k]) setS(newFetch(answerOf(words[k])!, fold))
  }

  // physical keyboard: letters guess (é counts as e), Enter moves on
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || finished) return
      if (e.key === 'Enter' && over) {
        if (document.activeElement !== next.current) {
          e.preventDefault()
          advance()
        }
        return
      }
      if (e.key.length !== 1 || !/^\p{L}$/u.test(e.key)) return
      const k = newFetch(e.key, fold).keys[0]
      if (k && KEYSET.has(k)) {
        e.preventDefault()
        press(k)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (finished && !ended) return <GameHeader title={TITLE} onBack={onDone} />
  if (finished) {
    const bestBefore = ended?.best
    const won = results.filter((r) => r.won).length
    const isBest = score > 0 && (bestBefore === undefined || score > bestBefore)
    return (
      <>
        <GameHeader title={TITLE} onBack={onDone} />
        <GameOver happy={won > 0} title={won > 0 && won === results.length ? ui.games.win : `${won} of ${results.length} fetched`} big={score} party={isBest} onAgain={onAgain} onDone={onDone}>
          points{isBest ? ' · new best!' : bestBefore ? ` · best ${bestBefore}` : ''}
        </GameOver>
        <ul className="mt-4 grid gap-1.5" aria-label="Words this round">
          {results.map((r) => {
            const w = words.find((x) => x.id === r.id)!
            return (
              <li key={r.id} className="flex items-center gap-2 rounded-xl border-[1.5px] border-line bg-surface px-3 py-2 text-sm">
                <span aria-hidden="true">{r.won ? '🎾' : '🌿'}</span>
                <TargetText text={w.lemma} className="font-bold" />
                <span className="min-w-0 flex-1 truncate text-muted" lang="en">
                  {w.en[0]}
                </span>
                <span className={`font-bold ${r.won ? 'text-[var(--ok)]' : 'text-muted'}`}>{r.won ? `+${r.points}` : 'lost'}</span>
              </li>
            )
          })}
        </ul>
      </>
    )
  }
  if (!v) return null
  const won = isWon(s)
  const lost = isLost(s)
  const open = shown(s)
  const words2 = groups(s.chars)
  const longest = Math.max(...words2.map((g) => g.length))
  return (
    <>
      <GameHeader
        title={TITLE}
        subtitle={`Word ${i + 1} of ${words.length} · ${score} points`}
        right={
          <Chip tone={spared(s) <= 2 && !won ? 'bad' : 'sky'} className="shrink-0 whitespace-nowrap">
            <span aria-label={`${spared(s)} misses left`}>🎾 {spared(s)}</span>
          </Chip>
        }
        onBack={onDone}
      />

      <Scene misses={s.misses} won={won} lost={lost} lastMiss={last?.hit === 0} />

      <div className="card mt-3 text-center">
        <p className="eyebrow">{JYUTPING ? 'Spell it in Jyutping' : 'Clue'}</p>
        <p className="mt-0.5 text-xl font-semibold leading-snug" lang="en">
          {v.en[0]}
        </p>
        {JYUTPING && (
          <p className="mt-1 font-display text-3xl" lang={TL}>
            {v.lemma}
          </p>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2" role="group" aria-label={`The word: ${s.chars.map((ch, k) => (open[k] ? ch : 'blank')).join(' ')}`}>
          {words2.map((g, gi) => (
            <span key={gi} className="flex gap-1" aria-hidden="true">
              {g.map(({ ch, k }) =>
                s.keys[k] === null ? (
                  <span key={k} className="flex items-end font-display text-2xl leading-none">
                    {ch}
                  </span>
                ) : (
                  <span
                    key={k}
                    className={`flex items-end justify-center border-b-[3px] pb-0.5 font-display uppercase leading-none transition-colors ${lost && !open[k] ? 'border-[var(--bad)] text-[var(--bad)]' : open[k] ? 'border-[var(--ok)]' : 'border-line-strong'}`}
                    style={{ width: `clamp(1.15rem, ${Math.min(8.2, 80 / longest)}vw, 2.1rem)`, height: '2.4rem', fontSize: `clamp(1rem, ${Math.min(6.6, 66 / longest)}vw, 1.65rem)` }}
                    lang={TL}
                  >
                    {open[k] || lost ? ch : ''}
                  </span>
                ),
              )}
            </span>
          ))}
        </div>
        <p className="mt-3 min-h-5 text-sm font-semibold" role="status" aria-live="polite">
          {won ? (
            <span className="text-[var(--ok)]">Leo fetched it! +{fetchPoints(s)}</span>
          ) : lost ? (
            <span className="text-[var(--bad)]">The ball got away. It was:</span>
          ) : last ? (
            last.hit ? (
              <span className="text-[var(--ok)]">
                {last.hit === 1 ? 'One' : last.hit} “{last.key.toUpperCase()}”{last.hit === 1 ? '' : 's'}!
              </span>
            ) : (
              <span className="text-[var(--bad)]">No “{last.key.toUpperCase()}”: the ball rolls on.</span>
            )
          ) : (
            <span className="text-xs font-medium text-muted">{JYUTPING ? 'Tap letters to spell the sound, no tone numbers.' : 'Tap a letter. Accents come free: A shows Á too.'}</span>
          )}
        </p>
      </div>

      {over ? (
        <div className="card mt-3 flex items-center gap-3">
          <button type="button" onClick={() => void say(v.lemma)} disabled={!supported} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue text-white disabled:opacity-40" aria-label="Hear the word">
            <IconSpeaker width={24} height={24} />
          </button>
          <span className="min-w-0 flex-1">
            <TargetText text={v.lemma} className="block font-display text-2xl leading-tight" />
            <span className="block text-sm text-muted" lang="en">
              {v.en.slice(0, 2).join(', ')}
            </span>
          </span>
          <button ref={next} type="button" onClick={advance} className="btn btn-primary shrink-0 px-5">
            {i + 1 < words.length ? 'Next' : 'Finish'}
          </button>
        </div>
      ) : (
        <Keyboard s={s} onKey={press} />
      )}

      <Button variant="ghost" className="mt-4 w-full" onClick={() => setI(words.length)}>
        Stop
      </Button>
    </>
  )
}

/** The answer split into words (spaces break the slot rows). */
function groups(chars: string[]): { ch: string; k: number }[][] {
  const out: { ch: string; k: number }[][] = [[]]
  chars.forEach((ch, k) => (ch === ' ' ? out.push([]) : out[out.length - 1]!.push({ ch, k })))
  return out.filter((g) => g.length)
}

function Keyboard({ s, onKey }: { s: FetchState; onKey: (k: string) => void }) {
  const used = useMemo(() => new Set(s.guessed), [s.guessed])
  return (
    <div className="mt-3 grid gap-1.5" role="group" aria-label="Letters">
      {KEYS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1">
          {row.map((k) => {
            const tried = used.has(k)
            const hit = tried && s.keys.includes(k)
            return (
              <button
                key={k}
                type="button"
                disabled={tried}
                onClick={() => onKey(k)}
                aria-label={`${k.toUpperCase()}${tried ? (hit ? ', in the word' : ', not in the word') : ''}`}
                className={`tile flex h-12 min-w-0 flex-1 basis-0 items-center justify-center px-0 py-0 text-center font-display text-lg uppercase ${hit ? 'correct' : tried ? 'opacity-35' : ''}`}
                style={{ maxWidth: '2.6rem' }}
                lang={TL}
              >
                {k}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * Leo, a dirt path of six steps and the bushes. The ball sits at Leo's paws and rolls a step for
 * each miss; on a win Leo runs to it, on a loss it disappears into the bushes.
 */
function Scene({ misses, won, lost, lastMiss }: { misses: number; won: boolean; lost: boolean; lastMiss: boolean }) {
  // ball positions along the path: 0 = at Leo's paws, FETCH_STEPS = in the bushes
  const at = (k: number) => `calc(${LEO_X + 60}px + (100% - ${LEO_X + 60 + 44}px) * ${k / FETCH_STEPS})`
  const step = lost ? FETCH_STEPS : misses
  /** Where Leo stands: home, or beside the ball once he has fetched it. */
  const leo = won ? `calc(${at(step)} - 60px)` : `${LEO_X}px`
  const act = won ? 'cheer' : lost ? 'sad' : lastMiss ? 'think' : 'curious'
  return (
    <div className="card relative h-[132px] overflow-hidden p-0" role="img" aria-label={won ? 'Leo fetched the ball' : lost ? 'The ball rolled into the bushes' : misses ? `The ball is ${misses} step${misses === 1 ? '' : 's'} from Leo, ${FETCH_STEPS - misses} before the bushes` : 'The ball is at Leo’s paws'}>
      {/* a pale sun, a cloud, a strip of grass and the path */}
      <span aria-hidden="true" className="absolute right-10 top-4 h-9 w-9 rounded-full bg-[color-mix(in_srgb,var(--sun)_45%,var(--card))]" />
      <svg aria-hidden="true" className="absolute left-[38%] top-5" width="62" height="22" viewBox="0 0 62 22">
        <path d="M10 20a8 8 0 0 1 2-15.8A11 11 0 0 1 32 3a9 9 0 0 1 16 4.5A7 7 0 0 1 54 20Z" fill="color-mix(in srgb, var(--blue) 10%, var(--card-2))" />
      </svg>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-11 bg-[color-mix(in_srgb,var(--ok)_16%,var(--card))]" />
      <div aria-hidden="true" className="absolute bottom-3 left-3 right-6 h-5 rounded-full bg-[color-mix(in_srgb,var(--sun)_26%,var(--card))]" />
      {Array.from({ length: FETCH_STEPS }, (_, k) => k + 1).map((k) => (
        <span key={k} aria-hidden="true" className="absolute bottom-[17px] -translate-x-1/2" style={{ left: `calc(${at(k)} + 11px)` }}>
          <Paw passed={k <= step} last={k === FETCH_STEPS} />
        </span>
      ))}
      {/* the ball, under the bushes so a lost ball hides in them; in Leo's mouth once fetched */}
      <span
        aria-hidden="true"
        className={`absolute bottom-[16px] transition-[left,transform,opacity] duration-500 ease-out motion-reduce:transition-none ${won ? 'z-10 delay-300' : ''}`}
        style={{ left: won ? `calc(${leo} + 30px)` : at(step), transform: `translateY(${won ? -12 : 0}px) rotate(${step * 140}deg)`, opacity: lost ? 0.15 : 1 }}
      >
        <Ball />
      </span>
      <span aria-hidden="true" className="absolute bottom-[6px] right-[-6px]">
        <Bush />
      </span>
      {/* Leo runs to the ball on a win */}
      <span className="absolute bottom-[10px] transition-[left] duration-500 ease-out motion-reduce:transition-none" style={{ left: leo }}>
        <Leo size={84} act={act} aria-hidden="true" />
      </span>
    </div>
  )
}

function Ball() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="10" fill="#cfe04a" stroke="#8a9a1c" strokeWidth="1.2" />
      <path d="M3.2 6.5c3.6 1.6 3.6 7.4 0 9M18.8 6.5c-3.6 1.6-3.6 7.4 0 9" fill="none" stroke="#fffbe8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function Paw({ passed, last }: { passed: boolean; last: boolean }) {
  const fill = passed ? 'var(--bad)' : 'var(--ink-2)'
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ opacity: passed ? 0.75 : last ? 0.25 : 0.35 }}>
      <ellipse cx="7" cy="9.3" rx="3.3" ry="2.7" fill={fill} />
      <circle cx="2.6" cy="5.6" r="1.4" fill={fill} />
      <circle cx="5.4" cy="3.3" r="1.4" fill={fill} />
      <circle cx="8.6" cy="3.3" r="1.4" fill={fill} />
      <circle cx="11.4" cy="5.6" r="1.4" fill={fill} />
    </svg>
  )
}

function Bush() {
  return (
    <svg width="64" height="50" viewBox="0 0 64 50">
      <ellipse cx="22" cy="34" rx="18" ry="15" fill="color-mix(in srgb, var(--ok) 70%, var(--ink))" />
      <ellipse cx="40" cy="27" rx="20" ry="20" fill="var(--ok)" />
      <ellipse cx="52" cy="38" rx="13" ry="11" fill="color-mix(in srgb, var(--ok) 82%, var(--card))" />
      <circle cx="34" cy="20" r="2" fill="var(--sun)" />
      <circle cx="47" cy="31" r="1.6" fill="var(--red)" />
    </svg>
  )
}
