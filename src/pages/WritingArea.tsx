/**
 * The writing area (/writing): every stop whose lessons are done and that has writing prompts,
 * by level, with how many prompts are written and the best scores. Each opens the stop's
 * prompts (/writing/:unitId). Reachable from Tools and Review.
 */
import { Link } from 'react-router'
import { levels } from '../engine/loader'
import { stopFor } from '../engine/journey'
import { isWritingOpen } from '../engine/unlock'
import { WRITING_PASS } from '../engine/writing'
import { useLessonRows, useKvPrefix } from '../hooks/useProgress'
import { useWritingStops, writingKey, writingSummary, type WritingRecord } from '../hooks/useWriting'
import { LANGUAGE } from '../engine/course'
import { PageHeader } from '../components/ui/basics'
import { IconCheck } from '../components/ui/icons'
import { PostcardPenArt } from '../components/compose/WritingArt'
import '../components/map/map.css'

export default function WritingArea() {
  const rows = useLessonRows()
  const records = useKvPrefix<WritingRecord>('writing:')
  const stops = useWritingStops()
  if (!rows || !records || !stops) return <div className="p-8 text-center text-muted">Loading…</div>

  let openCount = 0
  let waiting = 0
  const sections = levels.map((lv) => {
    const list = lv.units.flatMap((u) => {
      const s = stops.get(u.id)
      if (!s) return []
      const rec = records.get(writingKey(u.id))
      const attempted = Boolean(rec && Object.values(rec.prompts).some((p) => p.checks > 0))
      if (!isWritingOpen(u.id, rows, s.lessons, attempted)) {
        waiting++
        return []
      }
      openCount++
      return [{ unit: u, stop: s, rec, sum: writingSummary(rec, s.prompts, WRITING_PASS) }]
    })
    return { lv, list }
  })

  return (
    <div>
      <PageHeader title="Writing" subtitle={`Short writing tasks in ${LANGUAGE} after each stop's lessons, checked for grammar, spelling, the task and your words.`} />
      {openCount === 0 ? (
        <div className="card flex items-center gap-4">
          <PostcardPenArt size={56} />
          <div>
            <p className="font-semibold">Your writing desk opens soon</p>
            <p className="mt-0.5 text-sm text-ink-2">Finish all the lessons of a stop and its writing prompts open here and on the journey.</p>
          </div>
        </div>
      ) : (
        sections.map(({ lv, list }) =>
          list.length ? (
            <section key={lv.id} className={`lvl-${lv.id} mb-6`}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{lv.title} · {lv.name}</h2>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
                {list.map(({ unit, stop, sum }) => {
                  const where = stopFor(unit.id)
                  const name = where?.stop.name ?? unit.title
                  const all = sum.done === stop.prompts
                  return (
                    <li key={unit.id}>
                      <Link to={`/writing/${unit.id}?from=area`} className="it-card flex items-center gap-3.5 !py-3" aria-label={`Writing · ${name}: ${sum.done} of ${stop.prompts} prompts done${sum.best !== undefined ? `, best ${sum.best}%` : ''}`}>
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--lvl-soft)]"><PostcardPenArt size={40} done={all} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-[1.1rem] leading-tight">{name}</span>
                          <span className="mt-0.5 block text-xs text-ink-2">{unit.title} · {stop.prompts} prompts</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`it-chip ${all ? 'is-learned' : sum.done ? 'is-started' : 'is-new'}`}>
                            {all && <IconCheck width={12} height={12} strokeWidth={3.4} />}
                            {sum.done}/{stop.prompts}
                          </span>
                          {sum.best !== undefined && <span className="font-mono text-xs text-ink-2">best <span className="text-ink">{sum.best}%</span></span>}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null,
        )
      )}
      {waiting > 0 && <p className="mt-2 text-center text-xs text-ink-2">{waiting} more {waiting === 1 ? 'stop opens' : 'stops open'} as you finish their lessons.</p>}
    </div>
  )
}
