import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { grammar, levels } from '../engine/loader'
import { LEVEL_ORDER, type LevelId } from '../engine/schema'
import { GrammarNoteView } from '../components/GrammarNote'
import { PageHeader, Button, Chip } from '../components/ui/basics'
import { IconArrowLeft, IconSearch } from '../components/ui/icons'
import { useAllCards } from '../hooks/useProgress'
import { stripAccents } from '../lang/es/normalize'

export default function Grammar() {
  const { id } = useParams()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<LevelId | 'all'>('all')
  const cards = useAllCards()
  const notes = useMemo(() => [...grammar.values()].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)), [])
  const filtered = useMemo(() => {
    const needle = stripAccents(q.toLowerCase())
    return notes.filter((n) => (level === 'all' || n.level === level) && (!needle || stripAccents(`${n.id} ${n.title} ${n.summary}`.toLowerCase()).includes(needle)))
  }, [notes, q, level])

  if (id) {
    const note = grammar.get(id)
    if (!note) return <p className="p-4">Unknown grammar point.</p>
    const related = note.related.map((r) => grammar.get(r)).filter(Boolean)
    const n = cards?.filter((c) => c.grammar.includes(id)).length ?? 0
    return (
      <div className="pb-6">
        <button type="button" onClick={() => nav(-1)} className="mb-3 flex items-center gap-1 text-sm font-bold text-muted">
          <IconArrowLeft width={18} height={18} /> Back
        </button>
        <GrammarNoteView note={note} />
        {note.drills.length > 0 && (
          <section className="mt-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Pattern sentences</h3>
            <ul className="space-y-1 text-sm">
              {note.drills.map((d, i) => (
                <li key={i} className="rounded-xl bg-surface-2 p-2">
                  <span className="font-semibold" lang="es">{d.es}</span> <span className="text-muted">— {d.en}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {related.length > 0 && (
          <section className="mt-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Related</h3>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link key={r!.id} to={`/grammar/${r!.id}`} className="rounded-full bg-surface-2 px-3 py-1 text-sm font-bold">
                  {r!.title}
                </Link>
              ))}
            </div>
          </section>
        )}
        <Button className="mt-6 w-full" disabled={n === 0} onClick={() => nav(`/review?grammar=${encodeURIComponent(id)}`)}>
          {n ? `Practise this point (${n} items)` : 'Practise after meeting it in a lesson'}
        </Button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Grammar" subtitle={`${notes.length} points, A1 to C2`} />
      <label className="mb-3 flex items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3">
        <IconSearch className="text-muted" width={18} height={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (ser, subjuntivo, por/para…)" className="w-full bg-transparent py-2 outline-none" aria-label="Search grammar" />
      </label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['all', ...LEVEL_ORDER] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLevel(l)} className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${level === l ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted'}`}>
            {l}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-[var(--line)] rounded-2xl border-2 border-line bg-surface">
        {filtered.map((n) => (
          <li key={n.id}>
            <Link to={`/grammar/${n.id}`} className="flex items-center gap-3 p-3">
              <Chip tone="brand" className="uppercase">{n.level}</Chip>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{n.title}</p>
                <p className="truncate text-xs text-muted">{n.summary}</p>
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && <li className="p-4 text-center text-sm text-muted">No matches.</li>}
      </ul>
      <p className="mt-3 text-xs text-muted">{levels.map((l) => `${l.title}: ${notes.filter((n) => n.level === l.id).length}`).join(' · ')}</p>
    </div>
  )
}
