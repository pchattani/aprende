import type { CSSProperties, MouseEvent } from 'react'
import { Link } from 'react-router'
import { IconBook, IconCheck, IconPaw, IconX } from '../ui/icons'
import { ChestArt, GateArt, StarIcon, TicketIcon } from './MapArt'
import { ChunkyBar } from './LegBar'
import { MAP, STATUS_LABEL } from './geometry'


const spotStyle = (x: number, y: number): CSSProperties => ({ top: y, transform: `translate(calc(-50% + ${x}px), -50%)` })

/** Caption beside a node, on the side facing the centre line. */
function Caption({ x, n, text, done }: { x: number; n?: string; text: string; done?: boolean }) {
  const left = x > 8
  return (
    <span className={`wm-cap ${done ? 'is-done' : ''}`} style={left ? { right: 'calc(100% + 14px)', textAlign: 'right' } : { left: 'calc(100% + 14px)' }} aria-hidden="true">
      {n && <span className="n">{n}</span>}
      {text}
    </span>
  )
}

export interface LessonNodeProps {
  id: string
  n: number
  title: string
  status: string
  mastery: number
  current: boolean
  open: boolean
  highlight: boolean
  x: number
  y: number
  onSelect: (id: string) => void
}

/**
 * A lesson on the road: a round medallion. The first tap opens its card (popover);
 * tapping it again while the card is open boards the lesson. The current lesson's
 * card starts open, so one tap on it boards.
 */
export function LessonNode({ id, n, title, status, mastery, current, open, highlight, x, y, onSelect }: LessonNodeProps) {
  const label = STATUS_LABEL[status] ?? status
  const done = status === 'learned' || status === 'mastered'
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (open || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    onSelect(id)
  }
  return (
    <div id={`lesson-${id}`} className={`wm-spot ${current ? 'is-current' : ''} ${open ? 'is-open' : ''}`} style={spotStyle(x, y)}>
      <span className="wm-ground" aria-hidden="true" />
      <span className="wm-raise">
        {current && <span className="wm-pulse" aria-hidden="true" />}
        {highlight && <span className="wm-flash" aria-hidden="true" />}
        <Link
          to={`/lesson/${id}`}
          onClick={onClick}
          aria-label={`${title}: ${label}`}
          aria-expanded={open}
          aria-controls={open ? `pop-${id}` : undefined}
          className={`wm-node is-${status} ${current ? 'is-current' : ''}`}
        >
          {status === 'started' && <span className="wm-arc" style={{ '--p': Math.max(0.15, mastery) } as CSSProperties} aria-hidden="true" />}
          {current ? <TicketIcon width={38} height={38} /> : status === 'mastered' ? <StarIcon width={30} height={30} /> : <IconPaw width={done ? 30 : 28} height={done ? 30 : 28} />}
          {done && !current && <span className="wm-postmark" aria-hidden="true" />}
          {done && !current && <span className="wm-badge" aria-hidden="true">{status === 'mastered' ? <StarIcon width={13} height={13} /> : <IconCheck width={14} height={14} strokeWidth={3.4} />}</span>}
        </Link>
      </span>
      {!current && <Caption x={x} n={`L${n}`} text={title} done={done} />}
    </div>
  )
}

/** The card that opens under a lesson node: title, how far along, Start and the guidebook. */
export function NodePopover({ id, n, count, title, status, mastery, stopName, x, y, onClose }: { id: string; n: number; count: number; title: string; status: string; mastery: number; stopName: string; x: number; y: number; onClose: () => void }) {
  const done = status === 'learned' || status === 'mastered'
  const start = status === 'new' ? 'Start' : status === 'started' ? 'Continue' : 'Practise again'
  const pct = Math.round(mastery * 100)
  return (
    <div id={`pop-${id}`} className="wm-pop" style={{ top: y + MAP.node / 2 + 22 }} role="group" aria-label={`${title}, lesson ${n} of ${count}`}>
      <div className="wm-pop-card">
        <span className="wm-pop-arrow" style={{ left: `calc(50% + ${x}px)` }} aria-hidden="true" />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="eyebrow" style={{ color: 'var(--lvl)' }}>Lesson {n} of {count} · {stopName}</p>
            <p className="mt-0.5 font-display text-[1.35rem] leading-tight">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-ink-2 transition active:scale-90" aria-label="Close lesson card">
            <IconX width={16} height={16} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <ChunkyBar value={mastery} max={1} className="flex-1" label={`Mastery ${pct}%`} />
          <span className="shrink-0 text-xs font-semibold text-ink-2">{done ? `${STATUS_LABEL[status] === 'solid' ? 'Solid' : 'Learned'} · ${pct}%` : status === 'started' ? `In progress · ${pct}%` : 'Not started'}</span>
        </div>
        <div className="mt-4 flex items-stretch gap-2.5">
          <Link to={`/lesson/${id}`} className="g-btn flex-1 text-[1.05rem] uppercase tracking-wider" aria-label={`${start}: lesson ${n}`}>
            {start}
          </Link>
          <Link to={`/lesson/${id}?guide`} className="g-btn is-ghost px-3.5 text-sm" aria-label={`Guidebook, lesson ${n}`} title="Guidebook: grammar and words">
            <IconBook width={18} height={18} />
            Guide
          </Link>
        </div>
      </div>
    </div>
  )
}

/** The stop's checkpoint quiz as a travel chest at the end of its lessons. */
export function ChestNode({ unitId, stopName, status, cleared, ready, x, y }: { unitId: string; stopName: string; status: string; cleared: boolean; ready: boolean; x: number; y: number }) {
  return (
    <div id={`checkpoint-${unitId}`} className="wm-spot" style={spotStyle(x, y)}>
      <span className="wm-ground" aria-hidden="true" />
      <span className="wm-raise">
        <Link to={`/checkpoint/${unitId}`} aria-label={`Checkpoint · ${stopName}: ${status}`} className={`wm-node is-chest ${cleared ? 'is-cleared' : ''} ${ready && !cleared ? 'is-ready' : ''}`}>
          <ChestArt open={cleared} size={50} />
          {cleared && <span className="wm-badge" aria-hidden="true"><IconCheck width={14} height={14} strokeWidth={3.4} /></span>}
        </Link>
      </span>
      <Caption x={x} n="Checkpoint" text={cleared ? status.replace('Cleared · ', 'Cleared ') : ready ? 'Ready to open' : 'After the lessons'} done={cleared} />
    </div>
  )
}

/** Border control: the level check as a gate at the end of the region. */
export function GateNode({ level, title, complete, passed, score }: { level: string; title: string; complete: boolean; passed: boolean; score?: number }) {
  return (
    <div className="relative flex flex-col items-center">
      <span className="wm-raise">
        <Link to={`/exam/${level}`} aria-label={`Border control, level check ${title}`} className={`wm-node is-gate ${passed ? 'is-passed' : ''}`}>
          <GateArt open={passed} size={72} />
          {passed && <span className="inkstamp absolute -bottom-3 -right-5 bg-card px-1.5 py-0 text-[11px] text-ok-500">Cleared</span>}
        </Link>
      </span>
      <div className="relative z-[1] mt-6 max-w-[17rem] rounded-2xl bg-paper/90 px-3 py-1 text-center">
        <p className="eyebrow" style={{ color: 'var(--lvl)' }}>Border control</p>
        <p className="font-display text-lg leading-tight">Level check · {title}</p>
        <p className="text-xs text-ink-2">{passed ? <>Passed · <span className="font-mono">{Math.round((score ?? 0) * 100)}%</span></> : complete ? 'Every lesson done. Show your papers for this region.' : 'Open now: cross whenever you feel ready.'}</p>
      </div>
    </div>
  )
}
