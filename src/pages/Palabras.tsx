import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { VocabEntry } from '../engine/schema'
import { vocab, vocabUpTo, LEVEL_ORDER_LIST } from '../engine/loader'
import { IRREGULAR } from '@lang/verbs'
import { allCards, recordAnswer, bumpDay } from '../db/progress'
import { Rng } from '../engine/random'
import { pickGameWords, crosswordLookup, memoryBoard, rapidRound, rapidPoints, type MemoryTile, type RapidQuestion } from '../engine/vocabGame'
import { languagePack } from '@lang'
import { todayKey } from '../engine/mastery'
import { PageHeader, Button, Chip } from '../components/ui/basics'
import { useKvValue } from '../hooks/useProgress'
import { useSpeak } from '../hooks/useSpeak'
import { playSound } from '../engine/sounds'
import { Confetti } from '../components/ui/Confetti'
import type { LevelId } from '../engine/schema'
import { TL, tlOf, FEATURES } from '../engine/course'
import { ui, LANGUAGE } from '../engine/loader'
import { Crossword } from './palabras/Crossword'
import { Listen } from './palabras/Listen'
import { SoundMatch } from './palabras/SoundMatch'
import { TooFew, NoAudioNotice } from './palabras/shared'
import { GAMES, type GameSection } from './games/catalog'
import { GAMES_BEST_KEY, type GameBest } from './games/util'
import { BEST_KEY, LISTEN_LABEL, useAudio, updateBest, addMinutes, formatTime, type Best } from './palabras/util'

type Game = 'memory' | 'rapid' | 'crossword' | 'listenPick' | 'listenType' | 'sound'
/** How many words each game asks pickGameWords for. */
const WANT: Record<Game, number> = { memory: 8, rapid: 30, crossword: 16, listenPick: 14, listenType: 10, sound: 16 }

export default function Palabras() {
  const nav = useNavigate()
  const best = useKvValue<Best>(BEST_KEY, {})
  const gamesBest = useKvValue<Record<string, GameBest>>(GAMES_BEST_KEY, {})
  const audio = useAudio()
  const [game, setGame] = useState<Game | undefined>()
  const [round, setRound] = useState(0)
  const [words, setWords] = useState<VocabEntry[] | undefined>()
  const [maxLevel, setMaxLevel] = useState<LevelId>('a1')
  const [count, setCount] = useState<number | undefined>()
  const start = async (g: Game) => {
    const cards = await allCards()
    const lvl = cards.reduce<LevelId>((m, c) => (LEVEL_ORDER_LIST.indexOf(c.level) > LEVEL_ORDER_LIST.indexOf(m) ? c.level : m), 'a1')
    const lookup = g === 'crossword' ? crosswordLookup((id) => vocab.get(id), languagePack) : (id: string) => vocab.get(id)
    const picked = pickGameWords(cards, lookup, WANT[g], new Rng(Date.now()))
    setMaxLevel(lvl)
    setCount(cards.filter((c) => c.kind === 'word').length)
    setWords(picked)
    setRound((r) => r + 1)
    setGame(g)
    window.scrollTo?.({ top: 0 })
  }
  const done = () => {
    setGame(undefined)
    setWords(undefined)
  }
  const again = () => {
    if (game) void start(game)
  }
  if (game && words) {
    if (words.length < 4) return <TooFew onBack={done} />
    switch (game) {
      case 'memory':
        return <Memory key={round} words={words} onDone={done} best={best?.memoryMs} />
      case 'rapid':
        return <Rapid key={round} words={words} maxLevel={maxLevel} onDone={done} best={best?.rapid} />
      case 'crossword':
        return <Crossword key={round} words={words} onDone={done} onAgain={again} best={best?.crosswordMs} />
      case 'listenPick':
      case 'listenType':
        return <Listen key={round} words={words} maxLevel={maxLevel} mode={game === 'listenPick' ? 'pick' : 'type'} onDone={done} onAgain={again} best={game === 'listenPick' ? best?.listenPick : best?.listenType} />
      case 'sound':
        return <SoundMatch key={round} words={words} onDone={done} onAgain={again} best={best?.soundMatch} />
    }
  }
  const pts = (n?: number) => (n ? `Best: ${n} points` : undefined)
  return (
    <div className="animate-rise pb-6">
      <PageHeader title="Mini games" subtitle="Games with the words and verbs you are learning. Every answer counts as a review." />
      <SectionTitle>Words</SectionTitle>
      <div className="grid gap-3">
        <ModeCard icon="🎴" tint="bg-brand-gradient" title={ui.games.memory} text={`Flip tiles and match each ${LANGUAGE} word with its meaning. 8 pairs against the clock.`} best={best?.memoryMs ? `Best: ${(best.memoryMs / 1000).toFixed(1)} s` : undefined} onClick={() => void start('memory')} />
        <ModeCard icon="⚡" tint="bg-sunset-gradient" title={ui.games.rapid} text="60 seconds, as many meanings as you can. Keep a streak for a multiplier." best={pts(best?.rapid)} onClick={() => void start('rapid')} />
        <ModeCard
          icon="✏️"
          tint="bg-mint-gradient"
          title={ui.games.crossword}
          text={FEATURES.romanization === 'jyutping' ? 'A little crossword from your words: English clues, answers in Jyutping without tones.' : 'A little crossword from your words: English clues, accents optional.'}
          best={best?.crosswords ? [best.crosswordMs ? `Best: ${formatTime(best.crosswordMs)}` : '', `${best.crosswords} solved`].filter(Boolean).join(' · ') : undefined}
          onClick={() => void start('crossword')}
        />
        <CatalogCards section="words" best={gamesBest} />
      </div>
      {GAMES.some((g) => g.available && g.section === 'verbs') && (
        <>
          <SectionTitle>Verbs</SectionTitle>
          <div className="grid gap-3">
            <CatalogCards section="verbs" best={gamesBest} />
          </div>
        </>
      )}
      {GAMES.some((g) => g.available && g.section === 'characters') && (
        <>
          <SectionTitle>Characters and tones</SectionTitle>
          <div className="grid gap-3">
            <CatalogCards section="characters" best={gamesBest} />
          </div>
        </>
      )}
      <SectionTitle>Listening</SectionTitle>
      <div className="grid gap-3">
        <section className="card" aria-labelledby="mode-listen">
          <div className="flex items-center gap-4">
            <ModeIcon icon="🎧" tint="bg-coral-500" />
            <span className="min-w-0 flex-1">
              <span id="mode-listen" className="block font-semibold" lang={TL}>
                {ui.games.listen}
              </span>
              <span className="block text-sm text-muted">Hear a word, then pick its meaning or type it. 10 words; keep the streak going.</span>
            </span>
          </div>
          {audio === 'ok' ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['listenPick', 'listenType'] as const).map((g) => (
                <button key={g} type="button" onClick={() => void start(g)} className="tile flex flex-col items-center gap-0.5 px-2 py-2.5 text-center">
                  <span className="text-xl" aria-hidden="true">
                    {g === 'listenPick' ? '👆' : '⌨️'}
                  </span>
                  <span className="text-sm leading-tight">{LISTEN_LABEL[g === 'listenPick' ? 'pick' : 'type']}</span>
                  <span className="text-[11px] font-bold text-ok-600">{best?.[g] ? `Best ${best[g]}` : ' '}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <NoAudioNotice audio={audio} compact />
            </div>
          )}
        </section>
        <ModeCard
          icon="🔊"
          tint="bg-pink-500"
          title={ui.games.soundMatch}
          text="Four sounds, four written words: match each sound to its word. Three boards."
          best={pts(best?.soundMatch)}
          disabled={audio !== 'ok'}
          notice={audio !== 'ok' ? <NoAudioNotice audio={audio} compact /> : undefined}
          onClick={() => void start('sound')}
        />
      </div>
      {count === 0 && <p className="mt-3 text-center text-sm text-muted">Finish a lesson first so there are words to play with.</p>}
      <p className="mt-4 text-center text-xs"><button type="button" className="font-bold text-muted underline" onClick={() => nav('/review')}>Back to Review</button></p>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="eyebrow mb-2 mt-6 first-of-type:mt-0">{children}</h2>
}

/** The catalog's games for one section, each opening /games/<id>. */
function CatalogCards({ section, best }: { section: GameSection; best?: Record<string, GameBest> }) {
  const nav = useNavigate()
  return (
    <>
      {GAMES.filter((g) => g.available && g.section === section).map((g) => {
        const b = best?.[g.id]
        const label = b ? [b.score !== undefined ? `Best: ${b.score}` : '', b.ms !== undefined ? `Best: ${formatTime(b.ms)}` : '', b.plays ? `${b.plays} played` : ''].filter(Boolean).join(' · ') : undefined
        return <ModeCard key={g.id} icon={g.icon} tint={g.tint} title={g.title} text={g.blurb} best={label} onClick={() => nav(`/games/${g.id}`)} />
      })}
    </>
  )
}

function ModeIcon({ icon, tint }: { icon: string; tint: string }) {
  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${tint}`} aria-hidden="true">
      {icon}
    </span>
  )
}

function ModeCard({ icon, tint, title, text, best, onClick, disabled = false, notice }: { icon: string; tint: string; title: string; text: string; best?: string; onClick: () => void; disabled?: boolean; notice?: ReactNode }) {
  const body = (
    <>
      <ModeIcon icon={icon} tint={tint} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold" lang={TL}>
          {title}
        </span>
        <span className="block text-sm text-muted">{text}</span>
        {best ? <span className="mt-1 block text-xs font-bold text-ok-600">{best}</span> : null}
      </span>
    </>
  )
  if (disabled) {
    return (
      <section className="card" aria-label={title}>
        <div className="flex items-center gap-4 opacity-75">{body}</div>
        {notice && <div className="mt-3">{notice}</div>}
      </section>
    )
  }
  return (
    <button type="button" onClick={onClick} className="card flex w-full items-center gap-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]">
      {body}
    </button>
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
              await updateBest((b2) => ({ ...b2, memoryMs: Math.min(b2.memoryMs ?? Infinity, ms) }))
              await addMinutes(ms)
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
              className={`flex aspect-square items-center justify-center rounded-2xl border-2 p-1 text-center text-xs font-semibold leading-tight transition sm:text-sm ${done ? 'border-ok-500 bg-ok-100 text-ok-700 dark:bg-ok-500/20' : up ? 'border-brand-500 bg-brand-100 dark:bg-brand-500/20' : 'border-line bg-surface shadow-card hover:-translate-y-0.5'}`}
            >
              {up ? t.text : <span className="text-2xl" aria-hidden="true">🐾</span>}
            </button>
          )
        })}
      </div>
      {finishedMs !== undefined && (
        <div className="card mt-4 text-center">
          <p className="text-2xl font-semibold">{ui.games.win}</p>
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
      await updateBest((b) => ({ ...b, rapid: Math.max(b.rapid ?? 0, score) }))
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
        <p className="text-5xl font-semibold text-gradient">{score}</p>
        <p className="text-sm text-muted">points · {right} of {i} right{best !== undefined && score > best ? ' · new best!' : best ? ` · best ${best}` : ''}</p>
        <Button className="mt-6 w-full" onClick={onDone}>Done</Button>
      </div>
    )
  }
  return (
    <div className="animate-rise pb-6">
      <PageHeader title={ui.games.rapid} subtitle={`${score} points · streak ${streak}`} right={<Chip tone={left <= 10 ? 'bad' : 'sky'}>{left} s</Chip>} />
      {mult > 1 && <p className="mb-2 text-center text-xs font-semibold text-gold-600">×{mult} multiplier</p>}
      {q && (
        <div className="card">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-brand-600">What does it mean?</p>
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
