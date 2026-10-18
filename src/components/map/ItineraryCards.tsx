/**
 * The cards of the journey itinerary: one large rounded card per lesson (how much is
 * learned, its status, Practice and the guidebook), the stop's checkpoint chest and the
 * region's border control. Each sits beside a stop on the slim route line (RouteDot).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { IconBook, IconCheck, IconPaw } from '../ui/icons'
import { ChestArt, GateArt, StarIcon, TicketIcon } from './MapArt'
import { ChunkyBar } from './LegBar'

/** Accessible status words for lessons (e2e reads `${title}: ${label}`; the name ends ", practice"). */
const STATUS_LABEL: Record<string, string> = { new: 'new', started: 'in progress', learned: 'learned', mastered: 'solid' }

const CHIP: Record<string, string> = { new: 'New', started: 'In progress', learned: 'Learned', mastered: 'Solid' }

/** The stop on the route line beside a card. */
export function RouteDot({ kind }: { kind: 'new' | 'started' | 'learned' | 'mastered' | 'current' | 'chest' | 'chest-done' | 'gate' | 'gate-done' }) {
  const icon =
    kind === 'learned' || kind === 'chest-done' || kind === 'gate-done' ? <IconCheck width={12} height={12} strokeWidth={3.6} />
    : kind === 'mastered' ? <StarIcon width={12} height={12} />
    : kind === 'current' ? <IconPaw width={14} height={14} />
    : null
  return (
    <span className={`it-dot is-${kind}`} aria-hidden="true">
      {kind === 'current' && <span className="it-dot-pulse" />}
      {icon}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`it-chip is-${status}`}>
      {status === 'learned' && <IconCheck width={12} height={12} strokeWidth={3.4} />}
      {status === 'mastered' && <StarIcon width={11} height={11} />}
      {CHIP[status] ?? status}
    </span>
  )
}

export interface LessonCardProps {
  id: string
  n: number
  title: string
  status: string
  /** 0..1 share of the lesson's words and phrases learned. */
  mastery: number
  words: number
  current: boolean
  highlight: boolean
  /** The dogs, drawn standing on the card's top edge. */
  children?: ReactNode
}

/**
 * A lesson in the itinerary. "Practice" is the lesson's link (named `${title}: ${status}`
 * so it reads as the lesson); "Guidebook" opens its grammar and words before boarding.
 */
export function LessonCard({ id, n, title, status, mastery, words, current, highlight, children }: LessonCardProps) {
  const label = STATUS_LABEL[status] ?? status
  const pct = Math.round(mastery * 100)
  return (
    <div id={`lesson-${id}`} className={`it-card is-${status} ${current ? 'is-current' : ''} ${highlight ? 'wm-highlight' : ''}`}>
      {children}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="it-eyebrow">
            {current && <TicketIcon width={16} height={16} className="-my-1 mr-1 inline-block" />}
            {current ? 'Up next · ' : ''}Lesson {n}
          </p>
          <p className={`mt-1 font-display leading-[1.15] ${current ? 'text-[1.4rem]' : 'text-[1.2rem]'}`}>{title}</p>
          {words > 0 && <p className="mt-0.5 text-xs text-ink-2">{words} new words · about 5 min</p>}
        </div>
        <StatusChip status={status} />
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <ChunkyBar value={mastery} max={1} className="flex-1" label={`${pct}% learned`} />
        <span className="shrink-0 text-xs text-ink-2"><span className="font-mono text-sm font-semibold text-ink">{pct}%</span> learned</span>
      </div>
      <div className="mt-3.5 flex items-stretch gap-2.5">
        <Link to={`/lesson/${id}`} className={`g-btn it-practice flex-1 ${current ? '' : 'is-soft'}`} aria-label={`${title}: ${label}, practice`}>
          Practice
        </Link>
        <Link to={`/lesson/${id}?guide`} className="g-btn is-ghost it-guide" aria-label={`Guidebook, lesson ${n}`} title="Guidebook: grammar and words">
          <IconBook width={17} height={17} />
          Guidebook
        </Link>
      </div>
    </div>
  )
}

/** The stop's checkpoint quiz: a travel chest at the end of its lessons. */
export function CheckpointCard({ unitId, stopName, status, cleared, ready, done, total, highlight }: { unitId: string; stopName: string; status: string; cleared: boolean; ready: boolean; done: number; total: number; highlight: boolean }) {
  return (
    <Link
      id={`checkpoint-${unitId}`}
      to={`/checkpoint/${unitId}`}
      aria-label={`Checkpoint · ${stopName}: ${status}`}
      className={`it-card it-cp flex items-center gap-3.5 ${cleared ? 'is-cleared' : ready ? 'is-ready' : ''} ${highlight ? 'wm-highlight' : ''}`}
    >
      <span className="it-cp-art" aria-hidden="true">
        <ChestArt open={cleared} size={46} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="it-eyebrow">Checkpoint</span>
          <span className={`it-chip ${cleared ? 'is-learned' : ready ? 'is-ready' : 'is-new'}`}>
            {cleared && <IconCheck width={12} height={12} strokeWidth={3.4} />}
            {cleared ? 'Cleared' : ready ? 'Ready' : 'Later'}
          </span>
        </span>
        <span className="mt-0.5 block font-display text-[1.1rem] leading-tight">Checkpoint · {stopName}</span>
        <span className="mt-1 block text-xs text-ink-2">
          {cleared ? <>Best score <span className="font-mono text-ink">{status.replace(/^Cleared · /, '')}</span></> : ready ? 'Every lesson done. Open the chest.' : <>After the lessons · <span className="font-mono text-ink">{done}</span>/{total} done</>}
        </span>
      </span>
    </Link>
  )
}

/** Border control: the region's level check, at the end of its stops. */
export function BorderCard({ level, title, complete, passed, score, highlight }: { level: string; title: string; complete: boolean; passed: boolean; score?: number; highlight?: boolean }) {
  return (
    <Link
      to={`/exam/${level}`}
      aria-label={`Border control, level check ${title}`}
      className={`it-card it-border flex items-center gap-3.5 ${passed ? 'is-passed' : ''} ${highlight ? 'wm-highlight' : ''}`}
    >
      <span className="it-border-art" aria-hidden="true">
        <GateArt open={passed} size={50} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="it-eyebrow">Border control</span>
          {passed ? <span className="it-chip is-passed"><IconCheck width={12} height={12} strokeWidth={3.4} />Cleared</span> : <span className="it-chip is-gate">Cross</span>}
        </span>
        <span className="mt-0.5 block font-display text-[1.2rem] leading-tight">Level check · {title}</span>
        <span className="mt-1 block text-xs leading-snug text-ink-2">
          {passed ? <>Passed · <span className="font-mono text-ink">{Math.round((score ?? 0) * 100)}%</span></> : complete ? 'Every lesson done. Show your papers.' : 'Open now: cross whenever you feel ready.'}
        </span>
      </span>
    </Link>
  )
}
