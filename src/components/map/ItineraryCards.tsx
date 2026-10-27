/**
 * The cards of the journey itinerary: one large rounded card per lesson (how much is
 * learned, its status, Practice and the guidebook), the stop's checkpoint chest and the
 * region's border control. Each sits beside a stop on the slim route line (RouteDot).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { IconBook, IconCheck, IconLock, IconPaw } from '../ui/icons'
import { ChestArt, GateArt, StarIcon, TicketIcon } from './MapArt'
import { ChunkyBar } from './LegBar'
import { PostcardPenArt } from '../compose/WritingArt'

/** Accessible status words for lessons (e2e reads `${title}: ${label}`; the name ends ", practice"). */
const STATUS_LABEL: Record<string, string> = { new: 'new', started: 'in progress', learned: 'learned', mastered: 'solid' }

const CHIP: Record<string, string> = { new: 'New', started: 'In progress', learned: 'Learned', mastered: 'Solid' }

/** The stop on the route line beside a card. */
export function RouteDot({ kind }: { kind: 'new' | 'started' | 'learned' | 'mastered' | 'current' | 'locked' | 'chest' | 'chest-done' | 'gate' | 'gate-done' }) {
  const icon =
    kind === 'learned' || kind === 'chest-done' || kind === 'gate-done' ? <IconCheck width={12} height={12} strokeWidth={3.6} />
    : kind === 'mastered' ? <StarIcon width={12} height={12} />
    : kind === 'current' ? <IconPaw width={14} height={14} />
    : kind === 'locked' ? <IconLock width={10} height={10} strokeWidth={3} />
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
  /** Locked (further along the route): what to finish first, e.g. "Finish Lesson 2 first". */
  locked?: string
  /** The dogs, drawn standing on the card's top edge. */
  children?: ReactNode
}

/**
 * A lesson in the itinerary. "Practice" is the lesson's link (named `${title}: ${status}`
 * so it reads as the lesson); "Guidebook" opens its grammar and words before boarding.
 * A locked lesson shows a lock and what to finish first; its guidebook stays readable.
 */
export function LessonCard({ id, n, title, status, mastery, words, current, highlight, locked, children }: LessonCardProps) {
  const label = STATUS_LABEL[status] ?? status
  const pct = Math.round(mastery * 100)
  if (locked)
    return (
      <div id={`lesson-${id}`} role="group" aria-label={`Lesson ${n}, ${title}: locked`} className={`it-card is-locked ${highlight ? 'wm-highlight' : ''}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="it-eyebrow">Lesson {n}</p>
            <p className="mt-1 font-display text-[1.2rem] leading-[1.15]">{title}</p>
            {words > 0 && <p className="mt-0.5 text-xs text-ink-2">{words} new words · about 5 min</p>}
          </div>
          <span className="it-chip is-locked"><IconLock width={12} height={12} strokeWidth={2.6} />Locked</span>
        </div>
        <p className="it-lock-hint mt-3"><IconLock width={15} height={15} className="shrink-0" />{locked}</p>
        <div className="mt-3.5 flex items-stretch gap-2.5">
          <button type="button" disabled className="g-btn it-practice is-locked flex-1" aria-label={`${title}: locked, practice. ${locked}`}>
            <IconLock width={16} height={16} />
            Practice
          </button>
          <Link to={`/lesson/${id}?guide`} className="g-btn is-ghost it-guide" aria-label={`Guidebook, lesson ${n}`} title="Guidebook: a preview of the grammar and words">
            <IconBook width={17} height={17} />
            Guidebook
          </Link>
        </div>
      </div>
    )
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
export function CheckpointCard({ unitId, stopName, status, cleared, ready, done, total, highlight, locked }: { unitId: string; stopName: string; status: string; cleared: boolean; ready: boolean; done: number; total: number; highlight: boolean; locked?: boolean }) {
  if (locked)
    return (
      <div id={`checkpoint-${unitId}`} role="group" aria-label={`Checkpoint · ${stopName}: locked`} className={`it-card it-cp is-locked flex items-center gap-3.5 ${highlight ? 'wm-highlight' : ''}`}>
        <span className="it-cp-art" aria-hidden="true">
          <ChestArt open={false} size={46} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="it-eyebrow">Checkpoint</span>
            <span className="it-chip is-locked"><IconLock width={12} height={12} strokeWidth={2.6} />Locked</span>
          </span>
          <span className="mt-0.5 block font-display text-[1.1rem] leading-tight">Checkpoint · {stopName}</span>
          <span className="mt-1 block text-xs text-ink-2">Finish the {total} lessons first · <span className="font-mono text-ink">{done}</span>/{total} done</span>
        </span>
      </div>
    )
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
export function BorderCard({ level, title, complete, passed, score, highlight, unlocks }: { level: string; title: string; complete: boolean; passed: boolean; score?: number; highlight?: boolean; unlocks?: string }) {
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
          {passed ? <>Passed · <span className="font-mono text-ink">{Math.round((score ?? 0) * 100)}%</span></> : complete ? 'Every lesson done. Show your papers.' : unlocks ? `Open now: pass it to skip ahead to ${unlocks}.` : 'Open now: cross whenever you feel ready.'}
        </span>
      </span>
    </Link>
  )
}

/**
 * The stop's writing prompts (/writing/:unitId): a postcard to write after the lessons,
 * "Writing · 4 prompts · best 82%". Locked like the checkpoint until the lessons are done.
 */
export function WritingCard({ unitId, stopName, count, done, best, open, lessonsDone, lessonsTotal, highlight }: { unitId: string; stopName: string; count: number; done: number; best?: number; open: boolean; lessonsDone: number; lessonsTotal: number; highlight: boolean }) {
  const all = done >= count
  const summary = `${count} prompts${best !== undefined ? ` · best ${best}%` : ''}`
  const art = (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--lvl-soft)]" aria-hidden="true" style={open ? undefined : { filter: 'grayscale(1)', opacity: 0.6 }}>
      <PostcardPenArt size={44} done={all} />
    </span>
  )
  if (!open)
    return (
      <div id={`writing-${unitId}`} role="group" aria-label={`Writing · ${stopName}: locked`} className={`it-card is-locked flex items-center gap-3.5 !py-3 ${highlight ? 'wm-highlight' : ''}`}>
        {art}
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="it-eyebrow">Writing</span>
            <span className="it-chip is-locked"><IconLock width={12} height={12} strokeWidth={2.6} />Locked</span>
          </span>
          <span className="mt-0.5 block font-display text-[1.1rem] leading-tight">Writing · {count} prompts</span>
          <span className="mt-1 block text-xs text-ink-2">After the {lessonsTotal} lessons · <span className="font-mono text-ink">{lessonsDone}</span>/{lessonsTotal} done</span>
        </span>
      </div>
    )
  return (
    <Link
      id={`writing-${unitId}`}
      to={`/writing/${unitId}`}
      aria-label={`Writing · ${stopName}: ${summary}${all ? ', done' : ''}`}
      className={`it-card flex items-center gap-3.5 !py-3 ${all ? '' : 'border-dashed'} ${highlight ? 'wm-highlight' : ''}`}
      style={{ borderColor: `color-mix(in srgb, var(--lvl) ${all ? 30 : 55}%, var(--line))` }}
    >
      {art}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="it-eyebrow">Writing</span>
          <span className={`it-chip ${all ? 'is-learned' : done ? 'is-started' : 'is-ready'}`}>
            {all && <IconCheck width={12} height={12} strokeWidth={3.4} />}
            {all ? 'Done' : done ? `${done}/${count}` : 'Open'}
          </span>
        </span>
        <span className="mt-0.5 block font-display text-[1.1rem] leading-tight">Writing · {count} prompts</span>
        <span className="mt-1 block text-xs text-ink-2">
          {best !== undefined ? <>Best <span className="font-mono text-ink">{best}%</span>{all ? ' · every prompt written' : ` · ${done} of ${count} done`}</> : 'Every lesson done. Write about this stop.'}
        </span>
      </span>
    </Link>
  )
}
