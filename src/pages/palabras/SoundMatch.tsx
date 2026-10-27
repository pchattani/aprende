/**
 * Empareja por sonido: four speaker buttons and four written words; tap a sound,
 * then the word it says. Three boards, points with a streak multiplier.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { languagePack } from '@lang'
import type { VocabEntry } from '../../engine/schema'
import { ui } from '../../engine/loader'
import { soundBoards, rapidPoints } from '../../engine/vocabGame'
import { Rng } from '../../engine/random'
import { recordAnswer } from '../../db/progress'
import { playSound } from '../../engine/sounds'
import { useSpeak } from '../../hooks/useSpeak'
import { PageHeader, Chip, Button } from '../../components/ui/basics'
import { IconSpeaker, IconCheck } from '../../components/ui/icons'
import { Confetti } from '../../components/ui/Confetti'
import { Luna } from '../../components/ui/Dogs'
import { TargetText } from '../../components/ui/TargetText'
import { RoundButtons, NoAudioNotice, NoVoiceHint, TooFew } from './shared'
import { addMinutes, updateBest, e2eHook, useAudio } from './util'

/** Words that sound alike (accents aside, or the same toned Jyutping) never share a board. */
const soundKey = (v: VocabEntry) => v.jp ?? languagePack.stripMarks(languagePack.normalize(v.lemma))

export function SoundMatch({ words, onDone, onAgain, best }: { words: VocabEntry[]; onDone: () => void; onAgain: () => void; best?: number }) {
  const audio = useAudio()
  const [rng] = useState(() => new Rng(Date.now()))
  const boards = useMemo(() => soundBoards(words, rng, soundKey), [words, rng])
  if (audio !== 'ok') {
    return (
      <div className="animate-rise pb-6">
        <PageHeader title={ui.games.soundMatch} />
        <NoAudioNotice audio={audio} />
        <Button variant="ghost" className="mt-4 w-full" onClick={onDone}>
          Back
        </Button>
      </div>
    )
  }
  if (!boards.length) return <TooFew onBack={onDone} game="sound" />
  return <Game boards={boards} rng={rng} onDone={onDone} onAgain={onAgain} best={best} />
}

function Game({ boards, rng, onDone, onAgain, best }: { boards: VocabEntry[][]; rng: Rng; onDone: () => void; onAgain: () => void; best?: number }) {
  const { say } = useSpeak()
  const [b, setB] = useState(0)
  const board = boards[b]
  /** Written words in a different order from the speakers. */
  const written = useMemo(() => (board ? rng.shuffle(board) : []), [board, rng])
  const [sound, setSound] = useState<string | undefined>()
  const [word, setWord] = useState<string | undefined>()
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [miss, setMiss] = useState<{ sound: string; word: string } | undefined>()
  const missed = useRef(new Set<string>())
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [right, setRight] = useState(0)
  const [startedAt] = useState(() => Date.now())
  const finished = b >= boards.length
  const total = boards.reduce((n, x) => n + x.length, 0)

  useEffect(() => {
    if (board) e2eHook('sound', { speakers: board.map((v) => v.lemma), words: written.map((v) => v.lemma) })
  }, [board, written])

  useEffect(() => {
    if (!finished) return
    playSound('finish')
    const ms = Date.now() - startedAt
    void (async () => {
      await updateBest((x) => ({ ...x, soundMatch: Math.max(x.soundMatch ?? 0, score) }))
      await addMinutes(ms)
    })()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const attempt = (s: string, w: string) => {
    setSound(undefined)
    setWord(undefined)
    if (s === w) {
      const m = new Set(matched)
      m.add(s)
      setMatched(m)
      void recordAnswer(s, missed.current.has(s) ? 'wrong' : 'correct', 'listen')
      setScore((x) => x + rapidPoints(streak))
      setStreak((x) => x + 1)
      if (!missed.current.has(s)) setRight((x) => x + 1)
      playSound('correct')
      if (board && m.size === board.length) {
        setTimeout(() => {
          setMatched(new Set())
          setB((x) => x + 1)
        }, 650)
      }
    } else {
      missed.current.add(s)
      setStreak(0)
      setMiss({ sound: s, word: w })
      playSound('wrong')
      setTimeout(() => setMiss(undefined), 600)
    }
  }
  const tapSound = (id: string, lemma: string) => {
    void say(lemma)
    if (word) attempt(id, word)
    else setSound(id === sound ? undefined : id)
  }
  const tapWord = (id: string) => {
    if (sound) attempt(sound, id)
    else setWord(id === word ? undefined : id)
  }

  if (finished || !board) {
    const isBest = score > 0 && (best === undefined || score > best)
    return (
      <div className="animate-rise pb-6 text-center">
        <PageHeader title={ui.games.soundMatch} />
        {isBest && <Confetti />}
        <div className="mx-auto w-fit">
          <Luna size={96} act="cheer" />
        </div>
        <p className="mt-1 font-display text-5xl">{score}</p>
        <p className="text-sm text-muted">
          points · {right} of {total} first try{isBest ? ' · new best!' : best ? ` · best ${best}` : ''}
        </p>
        <RoundButtons onAgain={onAgain} onDone={onDone} />
      </div>
    )
  }
  return (
    <div className="animate-rise pb-6">
      <PageHeader
        title={ui.games.soundMatch}
        subtitle={`Board ${b + 1} of ${boards.length} · ${score} points`}
        right={
          <Chip tone={streak >= 3 ? 'gold' : 'sky'} className="shrink-0 whitespace-nowrap">
            <span aria-label={`Streak ${streak}`}>🔥 {streak}</span>
          </Chip>
        }
      />
      <div className="mb-3 flex items-center gap-3">
        <Luna size={56} act={miss ? 'sad' : matched.size ? 'cheer' : 'curious'} aria-hidden="true" />
        <p className="text-sm text-muted">Tap a sound to hear it, then the word it says.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="grid gap-2.5" role="group" aria-label="Sounds">
          {board.map((v, i) => {
            const done = matched.has(v.id)
            const cls = done ? 'correct' : miss?.sound === v.id ? 'wrong' : sound === v.id ? 'selected' : ''
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={sound === v.id}
                aria-label={done ? `Sound ${i + 1}: ${v.lemma}, matched. Play again` : `Sound ${i + 1}`}
                onClick={() => (done ? void say(v.lemma) : tapSound(v.id, v.lemma))}
                className={`tile flex min-h-16 min-w-0 items-center gap-2.5 px-3 py-2 ${cls}`}
              >
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${done ? 'bg-[var(--ok)]' : 'bg-blue'} text-white`}>
                  {done ? <IconCheck width={20} height={20} /> : <IconSpeaker width={22} height={22} />}
                </span>
                {done ? (
                  <span className="min-w-0 truncate text-sm font-bold text-[var(--ok)]">
                    <TargetText text={v.lemma} />
                  </span>
                ) : (
                  <span className="text-lg font-extrabold text-muted">{i + 1}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="grid gap-2.5" role="group" aria-label="Words">
          {written.map((v) => {
            const done = matched.has(v.id)
            const cls = done ? 'correct' : miss?.word === v.id ? 'wrong' : word === v.id ? 'selected' : ''
            return (
              <button key={v.id} type="button" disabled={done} aria-pressed={word === v.id} onClick={() => tapWord(v.id)} className={`tile flex min-h-16 items-center justify-center px-2 py-2 text-center text-lg leading-tight ${cls}`} data-word={v.lemma}>
                <TargetText text={v.lemma} />
              </button>
            )
          })}
        </div>
      </div>
      <NoVoiceHint />
      <Button variant="ghost" className="mt-5 w-full" onClick={() => setB(boards.length)}>
        Stop
      </Button>
    </div>
  )
}
