import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Exam as ExamT, LevelId } from '../engine/schema'
import { loadExam, levels, nextLevel } from '../engine/loader'
import { recordExam } from '../db/progress'
import { match } from '../lang/es/normalize'
import { checkText } from '../hooks/useDeps'
import { listenOnce, sttSupported } from '../engine/speech'
import { pack } from '../engine/loader'
import { Button, ProgressBar, SpeakerButton, Chip } from '../components/ui/basics'
import { IconX, IconMic, IconTrophy } from '../components/ui/icons'
import { SPECIAL_CHARS } from '../components/exercises/chars'
import { playSound } from '../engine/sounds'
import type { CheckerFinding } from '../lang/types'

type Section = 'reading' | 'listening' | 'grammar' | 'writing' | 'speaking' | 'result'
const ORDER: Section[] = ['reading', 'listening', 'grammar', 'writing', 'speaking', 'result']

export default function Exam() {
  const { level = 'a1' } = useParams()
  const nav = useNavigate()
  const [exam, setExam] = useState<ExamT | undefined | null>()
  const [section, setSection] = useState<Section>('reading')
  const [scores, setScores] = useState<Partial<Record<Section, number>>>({})
  useEffect(() => {
    loadExam(level as LevelId).then((e) => setExam(e ?? null))
  }, [level])
  const lvl = levels.find((l) => l.id === level)
  if (exam === undefined) return <p className="p-6 text-center text-muted">Loading checkpoint…</p>
  if (exam === null) return <div className="p-6"><p className="font-bold">No checkpoint exam for this level yet.</p><Button className="mt-4" onClick={() => nav('/')}>Back</Button></div>
  const idx = ORDER.indexOf(section)
  const done = (s: Section, score: number) => {
    const next = { ...scores, [s]: score }
    setScores(next)
    const nxt = ORDER[idx + 1]!
    if (nxt === 'result') {
      const vals = ['reading', 'listening', 'grammar', 'writing', 'speaking'].map((k) => next[k as Section] ?? 0)
      const total = vals.reduce((a, b) => a + b, 0) / vals.length
      const passed = total >= exam.passScore
      void recordExam({ level: level as LevelId, score: total, passed, ts: Date.now() })
      if (passed) playSound('finish')
    }
    setSection(nxt)
  }
  return (
    <div className="mx-auto min-h-full max-w-xl px-4 pb-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => nav('/')} className="rounded-full p-2 text-muted" aria-label="Quit"><IconX /></button>
        <ProgressBar value={idx} max={5} tone="gold" className="flex-1" />
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">{exam.title} · {section}</p>
      {section === 'reading' && <ReadingSection exam={exam} onDone={(s) => done('reading', s)} />}
      {section === 'listening' && <ListeningSection exam={exam} onDone={(s) => done('listening', s)} />}
      {section === 'grammar' && <GrammarSection exam={exam} onDone={(s) => done('grammar', s)} />}
      {section === 'writing' && <WritingSection exam={exam} onDone={(s) => done('writing', s)} />}
      {section === 'speaking' && <SpeakingSection exam={exam} onDone={(s) => done('speaking', s)} />}
      {section === 'result' && <Result scores={scores} pass={exam.passScore} levelTitle={lvl?.title ?? level} next={nextLevel(level as LevelId)} onHome={() => nav('/')} />}
    </div>
  )
}

function MCQ({ items, onDone }: { items: { prompt: string; options: string[]; answer: number; audio?: string }[]; onDone: (score: number) => void }) {
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => items.map(() => undefined))
  const complete = answers.every((a) => a !== undefined)
  return (
    <div className="mt-4 space-y-3">
      {items.map((q, i) => (
        <div key={i} className="card">
          <div className="flex items-start gap-2">
            {q.audio && <SpeakerButton text={q.audio} size="sm" />}
            <p className="font-bold" lang={q.audio ? 'en' : 'es'}>{q.prompt}</p>
          </div>
          <div className="mt-2 grid gap-1.5">
            {q.options.map((o, oi) => (
              <button key={oi} type="button" onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? oi : x)))} className={`tile py-2 text-sm ${answers[i] === oi ? 'selected' : ''}`} lang="es">
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button className="w-full" disabled={!complete} onClick={() => onDone(items.filter((q, i) => answers[i] === q.answer).length / items.length)}>
        Continue
      </Button>
    </div>
  )
}

function ReadingSection({ exam, onDone }: { exam: ExamT; onDone: (s: number) => void }) {
  return (
    <div>
      <h2 className="mt-3 text-xl font-extrabold">Reading</h2>
      <div className="card mt-3 whitespace-pre-line text-lg leading-relaxed" lang="es">{exam.reading.text}</div>
      <MCQ items={exam.reading.questions.map((q) => ({ prompt: q.q, options: q.options, answer: q.answer }))} onDone={onDone} />
    </div>
  )
}

function ListeningSection({ exam, onDone }: { exam: ExamT; onDone: (s: number) => void }) {
  const [typed, setTyped] = useState<string[]>(() => exam.listening.dictation.map(() => ''))
  const [phase, setPhase] = useState<'dictation' | 'mcq'>('dictation')
  const [dictScore, setDictScore] = useState(0)
  if (phase === 'dictation') {
    return (
      <div>
        <h2 className="mt-3 text-xl font-extrabold">Listening — dictation</h2>
        <p className="text-sm text-muted">Listen and type exactly what you hear. You can replay as often as you like.</p>
        <div className="mt-3 space-y-3">
          {exam.listening.dictation.map((s, i) => (
            <div key={i} className="card">
              <div className="flex items-center gap-2">
                <SpeakerButton text={s} size="sm" />
                <SpeakerButton text={s} slow size="sm" />
                <span className="text-sm text-muted">Sentence {i + 1}</span>
              </div>
              <textarea value={typed[i]} onChange={(e) => setTyped((t) => t.map((x, k) => (k === i ? e.target.value : x)))} rows={2} lang="es" className="mt-2 w-full rounded-xl border-2 border-line bg-surface-2 p-2 outline-none focus:border-sky-500" aria-label={`Dictation ${i + 1}`} />
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">{SPECIAL_CHARS.map((c) => <span key={c} className="rounded-lg border-2 border-line px-2 py-0.5 text-sm font-bold text-muted">{c}</span>)}</div>
          <Button
            className="w-full"
            disabled={typed.some((t) => !t.trim())}
            onClick={() => {
              const n = exam.listening.dictation.filter((s, i) => match(typed[i]!, [s]).verdict !== 'wrong').length
              const score = n / exam.listening.dictation.length
              if (exam.listening.questions.length) {
                setDictScore(score)
                setPhase('mcq')
              } else onDone(score)
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div>
      <h2 className="mt-3 text-xl font-extrabold">Listening — comprehension</h2>
      <MCQ items={exam.listening.questions.map((q) => ({ prompt: 'Listen and choose the right meaning', options: q.options, answer: q.answer, audio: q.audio }))} onDone={(s) => onDone((dictScore + s) / 2)} />
    </div>
  )
}

function GrammarSection({ exam, onDone }: { exam: ExamT; onDone: (s: number) => void }) {
  return (
    <div>
      <h2 className="mt-3 text-xl font-extrabold">Grammar and vocabulary</h2>
      <MCQ items={exam.grammar.map((q) => ({ prompt: q.prompt, options: q.options, answer: q.answer }))} onDone={onDone} />
    </div>
  )
}

function WritingSection({ exam, onDone }: { exam: ExamT; onDone: (s: number) => void }) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [checks, setChecks] = useState<boolean[]>(() => exam.writing.checklist.map(() => false))
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const findings: CheckerFinding[] = useMemo(() => (submitted ? checkText(text) : []), [submitted, text])
  const serious = findings.filter((f) => f.code !== 'unknown')
  if (!submitted) {
    return (
      <div>
        <h2 className="mt-3 text-xl font-extrabold">Writing</h2>
        <div className="card mt-3">
          <p className="font-bold">{exam.writing.prompt}</p>
          <p className="mt-1 text-xs text-muted">At least {exam.writing.minWords} words. No dictionary.</p>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} lang="es" className="mt-3 w-full rounded-2xl border-2 border-line bg-surface-2 p-3 text-lg outline-none focus:border-sky-500" aria-label="Your text" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SPECIAL_CHARS.map((c) => <button key={c} type="button" onClick={() => setText((t) => t + c)} className="rounded-lg border-2 border-line bg-surface px-2.5 py-1 font-bold" lang="es">{c}</button>)}
        </div>
        <p className="mt-2 text-sm text-muted">{words} words</p>
        <Button className="mt-3 w-full" disabled={words < exam.writing.minWords} onClick={() => setSubmitted(true)}>Submit</Button>
      </div>
    )
  }
  const checkScore = checks.filter(Boolean).length / checks.length
  const penalty = Math.min(0.4, serious.length * 0.05)
  const score = Math.max(0, checkScore - penalty)
  return (
    <div>
      <h2 className="mt-3 text-xl font-extrabold">Writing — review your text</h2>
      <div className="card mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Your text</p>
        <p className="mt-1 whitespace-pre-line" lang="es">{text}</p>
      </div>
      <div className="card mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Automatic check · {serious.length} issue{serious.length === 1 ? '' : 's'}</p>
        {serious.length === 0 ? <p className="mt-1 text-sm text-ok-600">No spelling, accent, agreement or common-error issues found.</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {serious.map((f, i) => (
              <li key={i}><Chip tone="bad" className="mr-1">{f.code}</Chip>{f.message}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="card mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Model answer</p>
        <p className="mt-1 whitespace-pre-line text-sm" lang="es">{exam.writing.modelAnswer}</p>
      </div>
      <div className="card mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Self-assessment — be honest, tick what your text does</p>
        <ul className="mt-2 space-y-2">
          {exam.writing.checklist.map((c, i) => (
            <li key={i}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((x) => x.map((v, k) => (k === i ? e.target.checked : v)))} className="mt-1 h-5 w-5" />
                {c}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <Button className="mt-4 w-full" onClick={() => onDone(score)}>Continue ({Math.round(score * 100)}%)</Button>
    </div>
  )
}

function SpeakingSection({ exam, onDone }: { exam: ExamT; onDone: (s: number) => void }) {
  const supported = sttSupported()
  const [results, setResults] = useState<(number | undefined)[]>(() => exam.speaking.map(() => undefined))
  const [busy, setBusy] = useState<number | undefined>()
  const record = async (i: number) => {
    setBusy(i)
    const r = await listenOnce(pack.tts.lang)
    setBusy(undefined)
    const m = match(r.transcript, [exam.speaking[i]!])
    const alt = r.alternatives.some((a) => match(a, [exam.speaking[i]!]).verdict !== 'wrong')
    setResults((x) => x.map((v, k) => (k === i ? (m.verdict === 'correct' || alt ? 1 : m.verdict === 'almost' ? 0.7 : 0.2) : v)))
  }
  const complete = results.every((r) => r !== undefined)
  return (
    <div>
      <h2 className="mt-3 text-xl font-extrabold">Speaking</h2>
      <p className="text-sm text-muted">{supported ? 'Read each sentence aloud. Speech recognition checks it.' : 'Speech recognition is not available in this browser. Read each sentence aloud and rate yourself honestly.'}</p>
      <ul className="mt-3 space-y-2">
        {exam.speaking.map((s, i) => (
          <li key={i} className="card">
            <div className="flex items-center gap-3">
              <SpeakerButton text={s} size="sm" />
              <p className="flex-1 font-bold" lang="es">{s}</p>
              {supported ? (
                <button type="button" onClick={() => void record(i)} className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${busy === i ? 'animate-pulse bg-bad-500' : 'bg-sky-500'}`} aria-label="Record"><IconMic width={20} height={20} /></button>
              ) : (
                <div className="flex gap-1">
                  {[0.3, 0.7, 1].map((v) => (
                    <button key={v} type="button" onClick={() => setResults((x) => x.map((r, k) => (k === i ? v : r)))} className={`rounded-lg border-2 px-2 py-1 text-xs font-bold ${results[i] === v ? 'border-sky-500 bg-sky-500/10' : 'border-line'}`}>{v === 1 ? 'Easy' : v === 0.7 ? 'OK' : 'Hard'}</button>
                  ))}
                </div>
              )}
            </div>
            {results[i] !== undefined && supported && <p className={`mt-1 text-xs font-bold ${results[i]! >= 0.7 ? 'text-ok-600' : 'text-bad-600'}`}>{results[i] === 1 ? 'Clear' : results[i]! >= 0.7 ? 'Understandable' : 'Not recognised — try again'}</p>}
          </li>
        ))}
      </ul>
      <Button className="mt-4 w-full" disabled={!complete} onClick={() => onDone(results.reduce<number>((a, b) => a + (b ?? 0), 0) / results.length)}>Finish</Button>
    </div>
  )
}

function Result({ scores, pass, levelTitle, next, onHome }: { scores: Partial<Record<Section, number>>; pass: number; levelTitle: string; next?: LevelId; onHome: () => void }) {
  const keys: Section[] = ['reading', 'listening', 'grammar', 'writing', 'speaking']
  const total = keys.reduce((a, k) => a + (scores[k] ?? 0), 0) / keys.length
  const passed = total >= pass
  return (
    <div className="mt-6 text-center">
      <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${passed ? 'bg-gold-300 text-gold-600' : 'bg-bad-100 text-bad-600'}`}><IconTrophy width={48} height={48} /></div>
      <h2 className="mt-4 text-3xl font-extrabold">{passed ? `${levelTitle} passed!` : 'Not yet'}</h2>
      <p className="mt-1 text-muted">Overall {Math.round(total * 100)}% · pass mark {Math.round(pass * 100)}%</p>
      <ul className="card mt-4 divide-y divide-[var(--line)] text-left text-sm">
        {keys.map((k) => (
          <li key={k} className="flex items-center justify-between py-2 capitalize"><span>{k}</span><span className="font-bold">{Math.round((scores[k] ?? 0) * 100)}%</span></li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">{passed ? (next ? `Level ${next.toUpperCase()} is now unlocked.` : 'You have completed the course syllabus.') : 'Review the weakest sections, keep doing your daily reviews, and try again whenever you like.'}</p>
      <Button className="mt-6 w-full" onClick={onHome}>Back to the path</Button>
    </div>
  )
}
