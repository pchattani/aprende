/**
 * The hub's departures board: one row per language, like a split-flap board in a
 * station hall. Pure presentational component (no course-specific imports) so the
 * hub build can use it.
 */
export interface BoardRow {
  id: string
  flag: string
  /** Language name in English (Spanish) */
  name: string
  /** The course's destination country or region (Argentina) */
  destination: string
  href: string
  /** started: has progress; new: never opened */
  status: 'started' | 'new'
  /** Current CEFR level, e.g. "A2" */
  level?: string
  /** Consecutive active days ending today or yesterday */
  daysOnRoad?: number
  /** ISO date of the last practice day */
  lastActive?: string
  /** Lessons completed / total */
  lessonsDone?: number
  lessonsTotal?: number
}

function statusOf(r: BoardRow, today: string): { text: string; tone: 'go' | 'wait' | 'idle' } {
  if (r.status === 'new') return { text: 'Not booked', tone: 'idle' }
  if (r.lastActive === today) return { text: 'Departed today', tone: 'go' }
  if ((r.daysOnRoad ?? 0) > 0) return { text: 'Boarding', tone: 'wait' }
  return { text: 'Delayed', tone: 'idle' }
}

/** Split-flap characters: each letter in its own little tile. */
function Flaps({ text, width }: { text: string; width: number }) {
  const chars = text.toUpperCase().padEnd(width, ' ').slice(0, width).split('')
  return (
    <span className="inline-flex gap-[2px]" aria-hidden="true">
      {chars.map((c, i) => (
        <span key={i} className="relative inline-flex h-[1.55em] w-[1em] items-center justify-center overflow-hidden rounded-[3px] bg-[#232a40] text-[#f4d47c]">
          <span className="relative z-[1]">{c === ' ' ? ' ' : c}</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-black/50" />
        </span>
      ))}
    </span>
  )
}

export function DeparturesBoard({ rows, today, title = 'Departures' }: { rows: BoardRow[]; today: string; title?: string }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[#151a2b] text-[#e9ecf6] shadow-float" aria-label={title}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f4d47c]">{title}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Level · Status</p>
      </div>
      <ul className="divide-y divide-white/10">
        {rows.map((r) => {
          const st = statusOf(r, today)
          const pct = r.lessonsTotal ? Math.round(((r.lessonsDone ?? 0) / r.lessonsTotal) * 100) : 0
          return (
            <li key={r.id}>
              <a href={r.href} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none" aria-label={`${r.name}, ${r.destination}: ${st.text}${r.level ? `, level ${r.level}` : ''}`}>
                <span className="text-2xl leading-none" aria-hidden="true">{r.flag}</span>
                <span className="min-w-0">
                  <span className="block font-mono text-[13px] sm:text-sm"><Flaps text={r.destination} width={10} /></span>
                  <span className="mt-1 block truncate text-xs text-white/60">
                    {r.name}
                    {r.status === 'started' ? <> · <span className="font-mono text-white/80">{pct}%</span> of the route</> : ''}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="font-mono text-sm text-[#f4d47c]">{r.level ?? '—'}</span>
                  <span className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${st.tone === 'go' ? 'text-[#7ee2a8]' : st.tone === 'wait' ? 'text-[#f4d47c]' : 'text-white/45'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.tone === 'go' ? 'bg-[#7ee2a8]' : st.tone === 'wait' ? 'animate-pulse bg-[#f4d47c]' : 'bg-white/30'}`} aria-hidden="true" />
                    {st.text}
                  </span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
