import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { bumpDay, getKv, setKv } from '../db/progress'
import { levels, pack, LANGUAGE } from '../engine/loader'
import { TL } from '../engine/course'
import { todayKey } from '../engine/mastery'
import { stopSpeaking, targetVoices, ttsSupported } from '../engine/speech'
import { buildQuiz, formatDuration, listenKey, siblingEnglish, LISTEN_KV, LISTEN_PASS, type ListenPiece, type ListenQuiz, type ListenRecord } from '../engine/listening'
import { listeningPieces, listeningPiece } from '../engine/listeningData'
import type { LevelId } from '../engine/schema'
import { useSpeak } from '../hooks/useSpeak'
import { useSettings } from '../store/settings'
import { languagePack } from '@lang'
import { Button, Chip, Empty } from '../components/ui/basics'
import { TargetText } from '../components/ui/TargetText'
import { Leo, Bonchita, Luna } from '../components/ui/Dogs'
import { isE2E, prefersReducedMotion } from '../components/game/motion'
import { IconArrowLeft, IconCheck, IconHeadphones, IconPause, IconPlay, IconReplay, IconSkipBack, IconSkipForward, IconSpeaker, IconTurtle, IconInfo } from '../components/ui/icons'

// ---------------------------------------------------------------------------
// The list (Read & listen → Listen)

function useRecords(): Map<string, ListenRecord> {
  const rows = useLiveQuery(() => db.kv.where('key').startsWith(LISTEN_KV).toArray(), [])
  return useMemo(() => new Map((rows ?? []).map((r) => [r.key.slice(LISTEN_KV.length), r.value as ListenRecord])), [rows])
}

function kindLabel(p: ListenPiece): string {
  if (p.kind === 'dialogue') return `Conversation · ${p.speakers.length} voices`
  return p.part ? `Passage · part ${p.part.n} of ${p.part.of}` : 'Passage'
}

function ScoreBadge({ rec }: { rec?: ListenRecord }) {
  if (!rec) return null
  const pct = Math.round(rec.best * 100)
  return rec.best >= LISTEN_PASS ? (
    <Chip tone="ok" className="shrink-0 gap-1"><IconCheck width={13} height={13} strokeWidth={3} />{pct}%</Chip>
  ) : (
    <Chip tone="gold" className="shrink-0">Best {pct}%</Chip>
  )
}

export function ListenList() {
  const records = useRecords()
  const byLevel = useMemo(() => levels.map((l) => ({ level: l, pieces: listeningPieces.filter((p) => p.level === l.id) })).filter((g) => g.pieces.length), [])
  // The first level with something left to do starts open; the learner can open any other.
  const firstOpen = byLevel.find((g) => g.pieces.some((p) => !((records.get(p.id)?.best ?? 0) >= LISTEN_PASS)))?.level.id ?? byLevel[0]?.level.id
  const [toggled, setToggled] = useState<Partial<Record<LevelId, boolean>>>({})
  if (!byLevel.length) return <Empty title="Nothing to listen to yet">Listening pieces appear as the course grows.</Empty>
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Each piece is read aloud line by line. Listen first, then answer a few questions and write down one line. Turn on the transcript any time you need it.</p>
      {byLevel.map(({ level, pieces }) => {
        const open = toggled[level.id] ?? level.id === firstOpen
        const done = pieces.filter((p) => (records.get(p.id)?.best ?? 0) >= LISTEN_PASS).length
        return (
          <section key={level.id} className="mb-3">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setToggled((t) => ({ ...t, [level.id]: !open }))}
              className="flex w-full items-center justify-between gap-3 py-2 text-left"
            >
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{level.title} · {level.name}</h2>
              <span className="flex items-center gap-2 text-xs font-semibold text-muted">
                {done}/{pieces.length}
                <span aria-hidden="true" className={`inline-block transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}>›</span>
              </span>
            </button>
            {open && (
              <ul className="grid gap-2">
                {pieces.map((p) => (
                  <li key={p.id}>
                    <Link to={`/listen/${p.id}`} className="card flex items-center gap-3 py-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${p.kind === 'dialogue' ? 'bg-[color-mix(in_srgb,var(--blue)_14%,var(--card))] text-blue' : 'bg-surface-2 text-ink-2'}`} aria-hidden="true">
                        <IconHeadphones width={19} height={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold" lang={TL}>{p.title}</p>
                        <p className="truncate text-xs text-muted">{kindLabel(p)} · {formatDuration(p.seconds)}</p>
                      </div>
                      <ScoreBadge rec={records.get(p.id)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The player (/listen/:id)

export default function ListenPage() {
  const { id = '' } = useParams()
  const piece = listeningPiece(id)
  const nav = useNavigate()
  if (!piece) {
    return (
      <div className="pt-2">
        <BackToList onClick={() => nav('/reader?tab=listen')} />
        <Empty title="Piece not found">It may have moved. Pick another one from the list.</Empty>
      </div>
    )
  }
  // A fresh player for each piece.
  return <Player key={piece.id} piece={piece} />
}

function BackToList({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-3 flex items-center gap-1 text-sm font-bold text-muted">
      <IconArrowLeft width={18} height={18} /> Listen
    </button>
  )
}

const DOGS = [Leo, Bonchita, Luna]
/** Voice tweaks per speaker when the device has a single voice: pitch and a touch of rate. */
const PITCH = [1, 0.72, 1.32, 0.88]
const RATE = [1, 0.94, 1.06, 1]

type Voice = { voiceURI?: string; pitch?: number; rateScale?: number }

/** Each speaker gets a different voice when the device has several, otherwise a different pitch. */
function useSpeakerVoices(speakers: string[]): (speaker?: string) => Voice {
  const chosen = useSettings((s) => s.voiceURI)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => targetVoices(pack.tts.lang))
  useEffect(() => {
    if (!ttsSupported()) return
    const load = () => setVoices(targetVoices(pack.tts.lang))
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [])
  return useCallback(
    (speaker?: string) => {
      const i = speaker ? speakers.indexOf(speaker) : 0
      if (i <= 0) return {}
      // Speaker 1 keeps the learner's voice; the others take the remaining voices in turn.
      const first = voices.find((v) => v.voiceURI === chosen) ?? voices.find((v) => pack.tts.preferredVoices.some((n) => v.name.includes(n))) ?? voices.find((v) => v.localService) ?? voices[0]
      const others = voices.filter((v) => v !== first)
      if (others.length) {
        const v = others[(i - 1) % others.length]!
        // Fewer voices than speakers: the extra speakers also shift pitch.
        return { voiceURI: v.voiceURI, pitch: i > others.length ? PITCH[i % PITCH.length] : undefined }
      }
      return { pitch: PITCH[i % PITCH.length], rateScale: RATE[i % RATE.length] }
    },
    [voices, chosen, speakers],
  )
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function Player({ piece }: { piece: ListenPiece }) {
  const nav = useNavigate()
  const { say, supported } = useSpeak()
  const sound = useSettings((s) => s.sound)
  const setSound = useSettings((s) => s.setSound)
  const transcriptPref = useSettings((s) => s.listenTranscript)
  const setTranscriptPref = useSettings((s) => s.setListenTranscript)
  const voiceFor = useSpeakerVoices(piece.speakers)
  const e2e = useMemo(() => isE2E(), [])
  const noTts = !e2e && !ttsSupported()
  const canPlay = e2e || supported

  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [heard, setHeard] = useState<Set<number>>(() => new Set())
  const [slow, setSlow] = useState(false)
  const [auto, setAuto] = useState(true)
  const [readInstead, setReadInstead] = useState(false)
  const [showEn, setShowEn] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const token = useRef(0)
  // The playback loop reads these between lines, so a change applies to the next line.
  const autoRef = useRef(auto)
  const slowRef = useRef(slow)
  const quizRef = useRef<HTMLElement>(null)
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now()
  }, [])
  const changeSlow = (v: boolean) => {
    slowRef.current = v
    setSlow(v)
  }
  const changeAuto = (v: boolean) => {
    autoRef.current = v
    setAuto(v)
  }
  const showTranscript = transcriptPref || readInstead
  const last = piece.lines.length - 1

  const stop = useCallback(() => {
    token.current++
    stopSpeaking()
    setPlaying(false)
  }, [])
  useEffect(() => () => {
    token.current++
    stopSpeaking()
  }, [])

  const speakLine = useCallback(
    async (i: number) => {
      const line = piece.lines[i]!
      if (e2e) return wait(120)
      await say(line.text, slowRef.current, voiceFor(line.speaker))
    },
    [piece, e2e, say, voiceFor],
  )

  /** Play from line `start`; with `onlyThis` (replay), just that line. */
  const run = useCallback(
    async (start: number, onlyThis = false) => {
      const mine = ++token.current
      setPlaying(true)
      for (let i = start; i <= last; i++) {
        setIdx(i)
        await speakLine(i)
        if (token.current !== mine) return
        setHeard((h) => (h.has(i) ? h : new Set(h).add(i)))
        if (onlyThis || i === last || !autoRef.current) break
        // A slightly longer pause when the speaker changes.
        await wait(piece.lines[i + 1]?.speaker !== piece.lines[i]!.speaker ? 650 : 400)
        if (token.current !== mine) return
      }
      setPlaying(false)
    },
    [last, piece, speakLine],
  )

  const reachedEnd = heard.has(last)
  // Questions open once the piece has played to its end (or on request).
  const showQuiz = quizOpen || reachedEnd
  const openQuiz = () => {
    setQuizOpen(true)
    requestAnimationFrame(() => quizRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }))
  }

  const togglePlay = () => {
    if (playing) return stop()
    void run(idx === last && heard.has(last) ? 0 : idx)
  }
  const go = (i: number) => {
    const n = Math.max(0, Math.min(last, i))
    if (playing) void run(n)
    else {
      stop()
      setIdx(n)
    }
  }
  const playLines = useCallback(
    async (from: number, span = 1) => {
      const mine = ++token.current
      for (let i = from; i < from + span; i++) {
        await speakLine(i)
        if (token.current !== mine) return
      }
    },
    [speakLine],
  )

  const current = piece.lines[idx]!
  const speakerIdx = current.speaker ? piece.speakers.indexOf(current.speaker) : 0
  const cast = piece.speakers.length ? piece.speakers : ['Narrator']
  const nextPiece = listeningPieces[listeningPieces.findIndex((p) => p.id === piece.id) + 1]

  return (
    <div className="pb-8">
      <BackToList onClick={() => nav('/reader?tab=listen')} />
      <h1 className="text-2xl font-semibold" lang={TL}>{piece.title}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Chip tone="brand" className="uppercase">{piece.level}</Chip>
        <Chip>{kindLabel(piece)}</Chip>
        <Chip>{formatDuration(piece.seconds)}</Chip>
      </div>
      {piece.context && <p className="mt-3 text-sm text-muted">{piece.context}</p>}

      {noTts && (
        <Notice>
          <p className="font-bold">No voice on this device</p>
          <p className="mt-1 text-sm text-muted">This browser can’t read {LANGUAGE} aloud, so there is nothing to hear here. Chrome, Edge and Safari have voices. You can still read the piece and answer the questions.</p>
          {!showTranscript && <Button variant="ghost" className="mt-3 w-full py-2.5 text-sm" onClick={() => setReadInstead(true)}>Show the transcript instead</Button>}
        </Notice>
      )}
      {!noTts && !sound && !e2e && (
        <Notice>
          <p className="font-bold">Sound is off</p>
          <p className="mt-1 text-sm text-muted">Turn sound on to hear the piece, or read the transcript instead.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button className="py-2.5 text-sm" onClick={() => setSound(true)}>Turn sound on</Button>
            <Button variant="ghost" className="py-2.5 text-sm" disabled={showTranscript} onClick={() => setReadInstead(true)}>Read instead</Button>
          </div>
        </Notice>
      )}

      {/* Player */}
      <section className="card mt-4" aria-label="Player">
        <div className="flex items-end justify-center gap-2" aria-hidden="true">
          {cast.slice(0, 4).map((name, i) => {
            const Dog = DOGS[i % DOGS.length]!
            const on = i === speakerIdx
            return (
              <div key={name} className={`flex min-w-0 flex-1 flex-col items-center transition-opacity motion-reduce:transition-none ${on ? 'opacity-100' : 'opacity-55'}`} style={{ maxWidth: 104 }}>
                <Dog size={cast.length > 3 ? 56 : 68} act={on && playing ? 'talk' : 'idle'} mood={i === 3 ? 'curious' : 'happy'} />
                <span className={`mt-1 max-w-full truncate rounded-full px-2 py-0.5 text-xs font-bold ${on ? 'bg-brand-gradient text-white' : 'text-muted'}`}>{name}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-center text-sm font-semibold text-muted" aria-live="polite">
          {playing ? `Playing line ${idx + 1} of ${piece.lines.length}` : reachedEnd ? 'End of the piece · questions below' : `Line ${idx + 1} of ${piece.lines.length}`}
        </p>
        <ol className="mt-2 flex flex-wrap items-center justify-center gap-1.5" aria-label="Lines">
          {piece.lines.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={`Line ${i + 1}${heard.has(i) ? ', heard' : ''}`}
                aria-current={i === idx ? 'step' : undefined}
                onClick={() => (canPlay ? void run(i, !auto) : setIdx(i))}
                className="flex h-6 items-center px-0.5"
              >
                <span className={`block h-2.5 rounded-full transition-all motion-reduce:transition-none ${i === idx ? 'w-6 bg-blue' : heard.has(i) ? 'w-2.5 bg-ink-2' : 'w-2.5 bg-line'}`} />
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-center justify-center gap-3">
          <RoundButton label="Previous line" onClick={() => go(idx - 1)} disabled={!canPlay || idx === 0}><IconSkipBack width={20} height={20} /></RoundButton>
          <RoundButton label="Replay line" onClick={() => void run(idx, true)} disabled={!canPlay}><IconReplay width={20} height={20} /></RoundButton>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canPlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-blue text-white shadow-card transition-transform active:scale-95 disabled:opacity-40 motion-reduce:transition-none"
          >
            {playing ? <IconPause width={28} height={28} /> : <IconPlay width={28} height={28} className="translate-x-0.5" />}
          </button>
          <RoundButton label="Next line" onClick={() => go(idx + 1)} disabled={!canPlay || idx === last}><IconSkipForward width={20} height={20} /></RoundButton>
          <RoundButton label={slow ? 'Normal speed' : 'Slow speed'} pressed={slow} onClick={() => changeSlow(!slow)} disabled={!canPlay}><IconTurtle width={20} height={20} /></RoundButton>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold">
          <Pill on={!slow} onClick={() => changeSlow(false)} disabled={!canPlay}>Normal</Pill>
          <Pill on={slow} onClick={() => changeSlow(true)} disabled={!canPlay}>Slow</Pill>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
          <Pill on={auto} onClick={() => changeAuto(!auto)} label="Auto-advance" disabled={!canPlay}>Auto-advance {auto ? 'on' : 'off'}</Pill>
        </div>
      </section>

      {/* Transcript */}
      <section className="card mt-3" aria-label="Transcript">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Transcript</p>
          <Switch label="Show transcript" checked={showTranscript} onChange={(v) => { setTranscriptPref(v); if (!v) setReadInstead(false) }} />
        </div>
        {showTranscript ? (
          <>
            <ol className="mt-3 space-y-1">
              {piece.lines.map((l, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => (canPlay ? void run(i, true) : setIdx(i))}
                    className={`w-full rounded-xl px-2.5 py-1.5 text-left transition-colors motion-reduce:transition-none ${i === idx ? 'bg-[color-mix(in_srgb,var(--blue)_11%,var(--card))]' : ''}`}
                  >
                    {l.speaker && <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">{l.speaker}</span>}
                    <TargetText text={l.text} className="text-[1.05rem] leading-relaxed" />
                    {showEn && l.en && <span className="mt-0.5 block text-sm text-muted" lang="en">{l.en}</span>}
                  </button>
                </li>
              ))}
            </ol>
            {piece.lines.some((l) => l.en) && (
              <div className="mt-3 flex justify-end border-t border-line pt-3">
                <Switch label="English translation" checked={showEn} onChange={setShowEn} small />
              </div>
            )}
          </>
        ) : (
          <div className="mt-3" data-testid="transcript-hidden">
            <div className="space-y-2" aria-hidden="true">
              {[92, 70, 84].map((w) => <div key={w} className="h-2.5 rounded-full bg-surface-2" style={{ width: `${w}%` }} />)}
            </div>
            <p className="mt-3 text-sm text-muted">Hidden so you train your ears. Listen first; turn it on if you get stuck.</p>
          </div>
        )}
      </section>

      {!showQuiz && (
        <Button variant="ghost" className="mt-4 w-full" onClick={openQuiz}>{heard.size ? 'Go to the questions' : 'Skip to the questions'}</Button>
      )}
      {showQuiz && (
        <section ref={quizRef} className="mt-6 scroll-mt-4" aria-label="Questions">
          <Quiz piece={piece} showText={showTranscript} canPlay={canPlay} playLines={playLines} getStarted={() => started.current} nextPiece={nextPiece} onAgain={() => { stop(); setHeard(new Set()); setIdx(0); setQuizOpen(false); started.current = Date.now(); window.scrollTo({ top: 0 }) }} />
        </section>
      )}
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="card mt-4 flex gap-3 border-gold-300" role="status">
      <IconInfo className="mt-0.5 shrink-0 text-gold-600" width={20} height={20} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function RoundButton({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] transition-transform active:scale-95 disabled:opacity-35 motion-reduce:transition-none ${pressed ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_12%,var(--card))] text-blue' : 'border-line bg-card text-ink'}`}
    >
      {children}
    </button>
  )
}

function Pill({ on, onClick, label, disabled, children }: { on: boolean; onClick: () => void; label?: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick} disabled={disabled} className={`rounded-full px-3 py-1 transition-colors disabled:opacity-40 motion-reduce:transition-none ${on ? 'bg-ink text-paper' : 'bg-surface-2 text-ink-2'}`}>
      {children}
    </button>
  )
}

function Switch({ label, checked, onChange, small = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`flex items-center gap-2 font-semibold ${small ? 'text-xs text-muted' : 'text-sm'}`}>
      {label}
      <span className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${checked ? 'bg-ok-500' : 'bg-stone-300 dark:bg-stone-600'}`} aria-hidden="true">
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Questions, dictation and score

type Verdict = 'correct' | 'almost' | 'wrong'

function Quiz({ piece, showText, canPlay, playLines, getStarted, nextPiece, onAgain }: {
  piece: ListenPiece
  showText: boolean
  canPlay: boolean
  playLines: (from: number, span?: number) => Promise<void>
  getStarted: () => number
  nextPiece?: ListenPiece
  onAgain: () => void
}) {
  const key = listenKey(piece.id)
  const [attempt, setAttempt] = useState<number>()
  const [record, setRecord] = useState<ListenRecord>()
  useEffect(() => {
    let live = true
    void getKv<ListenRecord | undefined>(key, undefined).then((r) => {
      if (!live) return
      setRecord(r)
      setAttempt((a) => a ?? r?.attempts ?? 0)
    })
    return () => {
      live = false
    }
  }, [key])
  const quiz: ListenQuiz | undefined = useMemo(() => (attempt === undefined ? undefined : buildQuiz(piece, attempt, siblingEnglish(piece, listeningPieces))), [piece, attempt])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [typed, setTyped] = useState('')
  const [verdict, setVerdict] = useState<Verdict>()
  const [result, setResult] = useState<{ correct: number; total: number; best: number }>()
  if (!quiz) return <p className="text-center text-sm text-muted">Loading questions…</p>

  const total = quiz.questions.length + (quiz.dictation ? 1 : 0)
  const answeredAll = quiz.questions.every((_, i) => answers[i] !== undefined) && (!quiz.dictation || verdict !== undefined)
  const check = () => {
    if (!quiz.dictation || !typed.trim()) return
    setVerdict(languagePack.match(typed, [quiz.dictation.text]).verdict)
  }
  const finish = async () => {
    const correct = quiz.questions.filter((q, i) => answers[i] === q.answer).length + (quiz.dictation && verdict !== 'wrong' ? 1 : 0)
    const score = total ? correct / total : 0
    const best = Math.max(record?.best ?? 0, score)
    const rec: ListenRecord = { best, last: score, date: todayKey(), attempts: (record?.attempts ?? 0) + 1 }
    setResult({ correct, total, best })
    setRecord(rec)
    await setKv(key, rec)
    await bumpDay(todayKey(), { minutes: Math.max(1, Math.round((Date.now() - getStarted()) / 60000)) })
  }

  if (result) {
    const pct = Math.round((result.correct / (result.total || 1)) * 100)
    const good = result.correct / (result.total || 1) >= LISTEN_PASS
    return (
      <div className="card text-center" role="status" aria-label="Score">
        <div className="flex justify-center"><Luna size={96} act={good ? 'cheer' : 'think'} mood={good ? 'happy' : 'curious'} /></div>
        <p className="eyebrow mt-2">Your score</p>
        <p className="font-mono text-5xl font-semibold tracking-tight">{result.correct}/{result.total}</p>
        <p className="mt-1 text-sm text-muted">{pct}% · best {Math.round(result.best * 100)}%</p>
        <p className="mt-2 font-semibold">{good ? 'Great ears! That counts as done.' : 'Good practice. Listen again and try a fresh set of questions.'}</p>
        <div className="mt-4 grid gap-2">
          {nextPiece && <Link to={`/listen/${nextPiece.id}`} className="btn btn-primary">Next piece</Link>}
          <Button variant="ghost" onClick={() => { setAnswers({}); setTyped(''); setVerdict(undefined); setResult(undefined); setAttempt((a) => (a ?? 0) + 1); onAgain() }}>Listen again</Button>
          <Link to="/reader?tab=listen" className="text-sm font-bold text-muted">Back to the list</Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Check what you understood</h2>
      <p className="mb-3 text-sm text-muted">{quiz.questions.length ? `${quiz.questions.length} question${quiz.questions.length === 1 ? '' : 's'}, then one line to write down.` : 'Write down one line you heard.'}</p>
      {quiz.questions.map((q, qi) => {
        const chosen = answers[qi]
        return (
          <div key={qi} className="card mb-2">
            <div className="flex items-start gap-2">
              {q.line !== undefined && q.kind === 'meaning' && canPlay && (
                <button type="button" aria-label="Play the line" onClick={() => void playLines(q.line!, q.span)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue text-white shadow-card active:scale-95">
                  <IconSpeaker width={18} height={18} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{q.prompt}</p>
                {q.line !== undefined && q.kind === 'meaning' && (showText || !canPlay) && (
                  <p className="mt-1 text-sm">{piece.lines.slice(q.line, q.line + (q.span ?? 1)).map((l, k) => <TargetText key={k} text={`${k ? ' ' : ''}${l.text}`} />)}</p>
                )}
              </div>
            </div>
            <div className="mt-2 grid gap-1.5" role="radiogroup" aria-label={q.prompt}>
              {q.options.map((o, oi) => {
                const cls = chosen === undefined ? '' : oi === q.answer ? 'correct' : oi === chosen ? 'wrong' : ''
                return (
                  <button key={oi} type="button" role="radio" aria-checked={chosen === oi} disabled={chosen !== undefined} onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))} className={`tile py-2 text-sm ${cls}`}>
                    {o}
                  </button>
                )
              })}
            </div>
            {chosen !== undefined && q.explain && <p className="mt-2 text-xs text-muted">{q.explain}</p>}
          </div>
        )
      })}
      {quiz.dictation && (
        <div className="card mb-2">
          <p className="font-bold">Type what you heard</p>
          <p className="text-xs text-muted">{canPlay ? 'Play the line as often as you like.' : 'Copy the line below to practise spelling.'} {languagePack.romanize ? 'Characters or Jyutping both count.' : 'Accents are forgiven.'}</p>
          <div className="mt-2 flex items-center gap-2">
            {canPlay && (
              <>
                <button type="button" aria-label="Play the line to write" onClick={() => void playLines(quiz.dictation!.line)} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue text-white shadow-card active:scale-95"><IconSpeaker width={20} height={20} /></button>
                <SlowLine text={quiz.dictation.text} />
              </>
            )}
            {(!canPlay || showText) && verdict === undefined && <TargetText text={quiz.dictation.text} className="text-sm text-muted" />}
          </div>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') check() }}
            disabled={verdict !== undefined}
            lang={TL}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="What you heard"
            placeholder="Type the line…"
            className="mt-2 w-full rounded-xl border-2 border-line bg-surface-2 p-2.5 outline-none focus:border-sky-500 disabled:opacity-80"
          />
          {verdict === undefined ? (
            <Button className="mt-2 w-full py-2.5" disabled={!typed.trim()} onClick={check}>Check</Button>
          ) : (
            <div className={`mt-2 rounded-xl p-3 text-sm ${verdict === 'wrong' ? 'bg-[color-mix(in_srgb,var(--bad)_12%,var(--card))] text-[var(--bad)]' : 'bg-[color-mix(in_srgb,var(--ok)_14%,var(--card))] text-[var(--ok)]'}`}>
              <p className="font-bold">{verdict === 'correct' ? 'Spot on!' : verdict === 'almost' ? 'Nearly perfect: that counts.' : 'Not quite. It was:'}</p>
              <TargetText text={quiz.dictation.text} className="mt-0.5 block text-base" />
            </div>
          )}
        </div>
      )}
      <Button variant="ok" className="mt-3 w-full" disabled={!answeredAll} onClick={() => void finish()}>See my score</Button>
    </div>
  )
}

function SlowLine({ text }: { text: string }) {
  const { say } = useSpeak()
  return (
    <button type="button" aria-label="Play slowly" onClick={() => void say(text, true)} className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-line bg-card text-ink active:scale-95">
      <IconTurtle width={20} height={20} />
    </button>
  )
}
