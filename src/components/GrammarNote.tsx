import type { GrammarNote } from '../engine/schema'
import { Markdown, inline } from './ui/Markdown'
import { SpeakerButton, Chip } from './ui/basics'

export function GrammarNoteView({ note, compact = false }: { note: GrammarNote; compact?: boolean }) {
  return (
    <article>
      {!compact && (
        <header className="mb-3">
          <Chip tone="brand" className="mb-2 uppercase">{note.level}</Chip>
          <h1 className="text-2xl font-extrabold">{note.title}</h1>
          <p className="mt-1 text-muted">{inline(note.summary)}</p>
        </header>
      )}
      {compact && <p className="mb-2 text-sm text-muted">{inline(note.summary)}</p>}
      <Markdown text={note.explanation} />
      {note.examples.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Examples</h3>
          <ul className="space-y-2">
            {note.examples.map((e, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-surface-2 p-2">
                <SpeakerButton text={e.es} size="sm" />
                <div>
                  <p className="font-semibold" lang="es">{e.es}</p>
                  <p className="text-sm text-muted">{e.en}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {note.pitfalls.length > 0 && (
        <section className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">Watch out</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {note.pitfalls.map((p, i) => (
              <li key={i}>{inline(p)}</li>
            ))}
          </ul>
        </section>
      )}
      {note.variant && (
        <section className="mt-4 rounded-xl border-2 border-sky-300 bg-sky-50 p-3 text-sky-900 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-100">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">Latin America</h3>
          <p className="text-sm">{inline(note.variant)}</p>
        </section>
      )}
    </article>
  )
}
