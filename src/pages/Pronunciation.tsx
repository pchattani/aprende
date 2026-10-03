import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { phonology, pack } from '../engine/loader'
import { Markdown } from '../components/ui/Markdown'
import { PageHeader, SpeakerButton, Button, Chip } from '../components/ui/basics'
import { IconArrowLeft, IconMic } from '../components/ui/icons'
import { listenOnce, sttSupported } from '../engine/speech'
import { match } from '../lang/es/normalize'

export default function Pronunciation() {
  const { id } = useParams()
  const nav = useNavigate()
  if (id) {
    const lesson = phonology.find((l) => l.id === id)
    if (!lesson) return <p className="p-4">Not found.</p>
    const i = phonology.indexOf(lesson)
    return (
      <div className="pb-6">
        <button type="button" onClick={() => nav('/pronunciation')} className="mb-3 flex items-center gap-1 text-sm font-bold text-muted">
          <IconArrowLeft width={18} height={18} /> Pronunciation
        </button>
        <Chip tone="brand">Lesson {i + 1}</Chip>
        <h1 className="mt-1 text-2xl font-extrabold">{lesson.title}</h1>
        <div className="card mt-3">
          <Markdown text={lesson.explanation} />
        </div>
        {lesson.items.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Listen and repeat</h2>
            <ul className="card divide-y divide-[var(--line)]">
              {lesson.items.map((it, j) => (
                <li key={j} className="flex items-center gap-3 py-2">
                  <SpeakerButton text={it.es} size="sm" />
                  <div className="flex-1">
                    <p className="font-bold" lang="es">{it.es} {it.ipa && <span className="ml-1 font-mono text-sm text-muted">/{it.ipa}/</span>}</p>
                    {it.tip && <p className="text-xs text-muted">{it.tip}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {lesson.minimalPairs.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Minimal pairs — hear the difference</h2>
            <div className="grid grid-cols-2 gap-2">
              {lesson.minimalPairs.map(([a, b], j) => (
                <div key={j} className="card flex items-center justify-between gap-2 p-2 text-sm">
                  <button type="button" className="tile flex-1 py-2 text-center" onClick={() => void speakWord(a)} lang="es">{a}</button>
                  <span className="text-muted">vs</span>
                  <button type="button" className="tile flex-1 py-2 text-center" onClick={() => void speakWord(b)} lang="es">{b}</button>
                </div>
              ))}
            </div>
          </section>
        )}
        {lesson.practice.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Shadowing — listen, then say it</h2>
            <ul className="space-y-2">
              {lesson.practice.map((s, j) => <Shadow key={j} text={s} />)}
            </ul>
          </section>
        )}
        {phonology[i + 1] && (
          <Link to={`/pronunciation/${phonology[i + 1]!.id}`} className="btn btn-primary mt-6 w-full">Next: {phonology[i + 1]!.title}</Link>
        )}
      </div>
    )
  }
  return (
    <div>
      <PageHeader title="Pronunciation" subtitle="Spanish spelling is almost perfectly regular. Learn the sounds once and read anything aloud." />
      <ol className="grid gap-2">
        {phonology.map((l, i) => (
          <li key={l.id}>
            <Link to={`/pronunciation/${l.id}`} className="card flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-extrabold text-brand-700">{i + 1}</span>
              <div>
                <p className="font-bold">{l.title}</p>
                <p className="text-xs text-muted">{l.items.length} sounds · {l.minimalPairs.length} pairs · {l.practice.length} sentences</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

async function speakWord(w: string) {
  const { speak } = await import('../engine/speech')
  await speak(w, { lang: pack.tts.lang, preferred: pack.tts.preferredVoices, rate: 0.85 })
}

function Shadow({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'listening' | 'ok' | 'almost' | 'bad'>('idle')
  const [heard, setHeard] = useState('')
  const supported = sttSupported()
  const go = async () => {
    setState('listening')
    const r = await listenOnce(pack.tts.lang)
    setHeard(r.transcript)
    const m = match(r.transcript, [text])
    if (m.verdict === 'correct') setState('ok')
    else if (m.verdict === 'almost' || (r.transcript && r.alternatives.some((a) => match(a, [text]).verdict !== 'wrong'))) setState('almost')
    else setState('bad')
  }
  return (
    <li className="card">
      <div className="flex items-center gap-3">
        <SpeakerButton text={text} size="sm" />
        <p className="flex-1 font-bold" lang="es">{text}</p>
        {supported && (
          <button type="button" onClick={() => void go()} className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${state === 'listening' ? 'animate-pulse bg-bad-500' : 'bg-sky-500'}`} aria-label="Record">
            <IconMic width={20} height={20} />
          </button>
        )}
      </div>
      {state !== 'idle' && state !== 'listening' && (
        <p className={`mt-2 text-sm font-bold ${state === 'ok' ? 'text-ok-600' : state === 'almost' ? 'text-gold-600' : 'text-bad-600'}`}>
          {state === 'ok' ? 'Clear! ' : state === 'almost' ? 'Close. ' : 'Try again. '}
          {heard && <span className="font-normal text-muted">I heard: “{heard}”</span>}
        </p>
      )}
      {!supported && <p className="mt-1 text-xs text-muted">Record and compare needs Chrome, Edge or Safari.</p>}
      {state === 'bad' && <Button variant="ghost" className="mt-2 py-1 text-xs" onClick={() => void speakWord(text)}>Hear it slowly</Button>}
    </li>
  )
}
