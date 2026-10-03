import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { readers, levels } from '../engine/loader'
import type { Reader as ReaderT, VocabEntry } from '../engine/schema'
import type { ReadingRow } from '../engine/types'
import { db } from '../db'
import { saveReading, deleteReading, ensureCards } from '../db/progress'
import { useLiveQuery } from 'dexie-react-hooks'
import { tokenize } from '../lang/es/tokenize'
import { coverage, readability } from '../engine/coverage'
import { lookup } from '../lang/es/inflect'
import { getDictionary } from '../hooks/useDeps'
import { useAllCards } from '../hooks/useProgress'
import { Button, Chip, PageHeader, SpeakerButton, Empty } from '../components/ui/basics'
import { IconArrowLeft, IconPlus, IconCheck, IconX } from '../components/ui/icons'
import { stripAccents } from '../lang/es/normalize'

export default function Reader() {
  const { id } = useParams()
  if (id) return <ReaderView id={id} />
  return <Library />
}

function Library() {
  const rows = useLiveQuery(() => db.reading.toArray(), []) ?? []
  const imported = rows.filter((r) => r.text)
  const [importing, setImporting] = useState(false)
  const nav = useNavigate()
  const status = new Map(rows.map((r) => [r.id, r]))
  return (
    <div>
      <PageHeader title="Reader" subtitle="Graded texts for your level, or paste anything in Spanish." right={<Button variant="ghost" className="px-3 py-2" onClick={() => setImporting(true)}><IconPlus width={18} height={18} /> Import</Button>} />
      <p className="mb-4 text-sm text-muted">Tap any word for its meaning and add it to your reviews. The meter tells you how much of a text you already know — research suggests 95–98% is the sweet spot for learning.</p>
      {imported.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Your texts</h2>
          <ul className="grid gap-2">
            {imported.map((r) => (
              <li key={r.id} className="card flex items-center gap-3">
                <Link to={`/reader/${r.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.title}</p>
                  <p className="text-xs text-muted">{r.words} words {r.finished ? '· finished' : ''}</p>
                </Link>
                <button type="button" aria-label="Delete" className="p-2 text-muted" onClick={() => void deleteReading(r.id)}>
                  <IconX width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {levels.map((lvl) => {
        const list = readers.filter((r) => r.level === lvl.id)
        if (!list.length) return null
        return (
          <section key={lvl.id} className="mb-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{lvl.title} · {lvl.name}</h2>
            <ul className="grid gap-2">
              {list.map((r) => (
                <li key={r.id}>
                  <Link to={`/reader/${r.id}`} className="card flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{r.title}</p>
                      <p className="text-xs text-muted">{r.kind}{r.author ? ` · ${r.author}` : ''} · {r.paragraphs.reduce((n, p) => n + tokenize(p.es).filter((t) => t.kind === 'word').length, 0)} words</p>
                    </div>
                    {status.get(r.id)?.finished && <IconCheck className="text-ok-600" />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {readers.length === 0 && imported.length === 0 && <Empty title="No texts yet">Import a text to start reading.</Empty>}
      {importing && <ImportDialog onClose={() => setImporting(false)} onDone={(rid) => { setImporting(false); nav(`/reader/${rid}`) }} />}
    </div>
  )
}

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const words = tokenize(text).filter((t) => t.kind === 'word').length
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="card w-full max-w-lg">
        <p className="text-lg font-extrabold">Import a Spanish text</p>
        <p className="text-sm text-muted">Paste an article, a story, song lyrics… It stays on this device.</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mt-3 w-full rounded-xl border-2 border-line bg-surface-2 p-2 outline-none focus:border-sky-500" aria-label="Title" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Pega el texto aquí…" lang="es" className="mt-2 w-full rounded-xl border-2 border-line bg-surface-2 p-2 outline-none focus:border-sky-500" aria-label="Text" />
        <p className="mt-1 text-xs text-muted">{words} words</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!text.trim() || words < 5}
            onClick={async () => {
              const id = `imp-${Date.now()}`
              await saveReading({ id, title: title.trim() || text.trim().slice(0, 40), text, words, progress: 0, finished: false, updatedAt: Date.now() })
              onDone(id)
            }}
          >
            Import
          </Button>
        </div>
      </div>
    </div>
  )
}

function ReaderView({ id }: { id: string }) {
  const nav = useNavigate()
  const bundled = readers.find((r) => r.id === id)
  const row = useLiveQuery(() => db.reading.get(id), [id])
  const cards = useAllCards()
  const [showEn, setShowEn] = useState<Set<number>>(new Set())
  const [popup, setPopup] = useState<{ word: string; entries: VocabEntry[] } | undefined>()
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const dict = useMemo(() => getDictionary(), [])
  const paragraphs: { es: string; en?: string }[] = bundled ? bundled.paragraphs : (row?.text ?? '').split(/\n\s*\n|\n/).filter((p) => p.trim()).map((es) => ({ es }))
  const knownIds = useMemo(() => new Set((cards ?? []).filter((c) => c.kind === 'word' && c.reps > 0).map((c) => c.id)), [cards])
  const cov = useMemo(() => coverage(paragraphs.flatMap((p) => tokenize(p.es)), dict, knownIds, new Set((bundled?.glossary ?? []).map((g) => g.es.toLowerCase()))), [paragraphs, dict, knownIds, bundled])
  const read = readability(cov.ratio)
  useEffect(() => {
    if (!bundled && row === undefined) return
  }, [bundled, row])
  if (!bundled && row === undefined) return <p className="p-4 text-muted">Loading…</p>
  if (!bundled && !row) return <p className="p-4">Text not found.</p>
  const title = bundled?.title ?? row!.title
  const tapWord = (w: string) => {
    const lw = w.toLowerCase()
    const entries = lookup(dict, lw) ?? lookup(dict, stripAccents(lw)) ?? []
    setPopup({ word: w, entries })
  }
  return (
    <div className="pb-24">
      <button type="button" onClick={() => nav('/reader')} className="mb-3 flex items-center gap-1 text-sm font-bold text-muted">
        <IconArrowLeft width={18} height={18} /> Library
      </button>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {bundled?.author && <p className="text-sm text-muted">{bundled.author}{bundled.source ? ` · ${bundled.source}` : ''}</p>}
      <div className="card mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-xs font-bold">
            <span>You know {Math.round(cov.ratio * 100)}% of the words</span>
            <Chip tone={read.tone === 'ok' ? 'ok' : read.tone === 'warn' ? 'gold' : 'bad'}>{read.label}</Chip>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full ${read.tone === 'ok' ? 'bg-ok-500' : read.tone === 'warn' ? 'bg-gold-500' : 'bg-bad-500'}`} style={{ width: `${cov.ratio * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{cov.unknownForms.size} unfamiliar word forms · tap a word to look it up</p>
        </div>
      </div>
      {bundled?.intro && <p className="mt-3 text-sm text-muted">{bundled.intro}</p>}
      <article className="mt-4 space-y-4">
        {paragraphs.map((p, i) => (
          <div key={i} className="card">
            <div className="flex items-start gap-2">
              <SpeakerButton text={p.es} size="sm" />
              <p className="flex-1 text-lg leading-relaxed" lang="es">
                {tokenize(p.es).map((t, j) =>
                  t.kind === 'word' ? (
                    <button key={j} type="button" onClick={() => tapWord(t.text)} className={`rounded px-0.5 ${wordClass(t.text, dict, knownIds)}`}>
                      {t.text}
                    </button>
                  ) : (
                    <span key={j}>{t.text}</span>
                  ),
                )}
              </p>
            </div>
            {p.en && (
              <button type="button" className="mt-2 text-xs font-bold text-sky-600" onClick={() => setShowEn((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })}>
                {showEn.has(i) ? 'Hide translation' : 'Show translation'}
              </button>
            )}
            {p.en && showEn.has(i) && <p className="mt-1 text-sm text-muted">{p.en}</p>}
          </div>
        ))}
      </article>
      {bundled && bundled.questions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">Comprehension</h2>
          {bundled.questions.map((q, qi) => (
            <div key={qi} className="card mb-2">
              <p className="font-bold">{q.q}</p>
              <div className="mt-2 grid gap-1.5">
                {q.options.map((o, oi) => {
                  const chosen = answers[qi]
                  const cls = chosen === undefined ? '' : oi === q.answer ? 'correct' : oi === chosen ? 'wrong' : ''
                  return (
                    <button key={oi} type="button" disabled={chosen !== undefined} onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))} className={`tile py-2 text-sm ${cls}`}>
                      {o}
                    </button>
                  )
                })}
              </div>
              {answers[qi] !== undefined && q.explain && <p className="mt-2 text-xs text-muted">{q.explain}</p>}
            </div>
          ))}
        </section>
      )}
      {bundled && bundled.glossary.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">Glossary</h2>
          <ul className="card divide-y divide-[var(--line)] text-sm">
            {bundled.glossary.map((g, i) => (
              <li key={i} className="flex justify-between py-1.5"><span className="font-bold" lang="es">{g.es}</span><span className="text-muted">{g.en}</span></li>
            ))}
          </ul>
        </section>
      )}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 px-4">
        <div className="mx-auto max-w-xl">
          <Button
            variant={row?.finished ? 'ghost' : 'ok'}
            className="w-full"
            onClick={() => void saveReading({ id, title, level: bundled?.level, text: row?.text, words: cov.total, progress: 1, finished: !(row?.finished ?? false), updatedAt: Date.now() })}
          >
            {row?.finished ? 'Mark as unread' : 'Mark as finished'}
          </Button>
        </div>
      </div>
      {popup && <WordPopup word={popup.word} entries={popup.entries} known={knownIds} onClose={() => setPopup(undefined)} />}
    </div>
  )
}

function WordPopup({ word, entries, known, onClose }: { word: string; entries: VocabEntry[]; known: Set<string>; onClose: () => void }) {
  const [added, setAdded] = useState(false)
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="card w-full max-w-xl rounded-b-none pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <SpeakerButton text={word} size="sm" />
          <p className="text-2xl font-extrabold" lang="es">{word}</p>
        </div>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Not in the course dictionary yet. Capitalised words are usually names.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-xl bg-surface-2 p-3">
                <p className="font-bold" lang="es">
                  {e.pos === 'noun' && e.gender ? `${e.gender === 'f' ? 'la' : 'el'} ` : ''}
                  {e.lemma} <Chip className="ml-1">{e.pos}{e.gender ? ` · ${e.gender}` : ''}</Chip> <Chip tone="brand" className="uppercase">{e.level}</Chip>
                </p>
                <p className="text-sm">{e.en.join(', ')}</p>
                {e.example && <p className="mt-1 text-xs text-muted" lang="es">{e.example.es} — {e.example.en}</p>}
                {e.variant && <p className="mt-1 text-xs text-muted">Latin America: {Object.values(e.variant).join(', ')}</p>}
                {known.has(e.id) ? (
                  <p className="mt-2 text-xs font-bold text-ok-600">In your reviews</p>
                ) : (
                  <Button variant="ghost" className="mt-2 w-full py-2 text-xs" disabled={added} onClick={async () => { await ensureCards([{ id: e.id, kind: 'word', level: e.level, lessonId: 'reader', grammar: [] }]); setAdded(true) }}>
                    {added ? 'Added to reviews' : 'Add to my reviews'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" className="mt-3 w-full" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}

function wordClass(word: string, dict: ReturnType<typeof getDictionary>, known: Set<string>): string {
  const entries = lookup(dict, word.toLowerCase())
  if (!entries) return /^[A-ZÁÉÍÓÚÑ]/.test(word) ? '' : 'bg-amber-100/70 dark:bg-amber-900/40'
  if (known.size && !entries.some((e) => known.has(e.id))) return 'underline decoration-dotted decoration-stone-400'
  return ''
}

export type { ReaderT, ReadingRow }
