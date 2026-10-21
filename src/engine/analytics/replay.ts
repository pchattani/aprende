/**
 * Replay: rebuild every card's FSRS state before each of its reviews by feeding
 * its ReviewRows, in time order, through the same scheduler the app uses. This
 * yields the predicted recall at the moment of each answer (for calibration)
 * and a per-card timeline from which retrievability on any past day follows.
 */
import { generatorParameters } from 'ts-fsrs'
import { newCard, review } from '../srs'
import type { CardRow, ItemKind, ReviewRow, Stage } from '../types'
import type { LevelId } from '../schema'
import { DAY_MS } from './time'

/** FSRS-6 decay used by the app's scheduler (w[20]). */
export const FSRS_DECAY: number = generatorParameters().w[20] ?? 0.1542

/**
 * FSRS forgetting curve with fractional days: R(t, S) = (1 + F·t/S)^(−d),
 * where F = 0.9^(−1/d) − 1 so that R(S, S) = 0.9.
 */
export function forgetting(tDays: number, stability: number, decay = FSRS_DECAY): number {
  if (!(stability > 0)) return 0
  const factor = Math.pow(0.9, -1 / decay) - 1
  return Math.pow(1 + (factor * Math.max(0, tDays)) / stability, -decay)
}

/** Days until R falls to `target` for a memory of stability S (inverse of `forgetting`). */
export function daysToRecall(stability: number, target = 0.5, decay = FSRS_DECAY): number {
  const factor = Math.pow(0.9, -1 / decay) - 1
  return ((Math.pow(target, -1 / decay) - 1) / factor) * stability
}

export interface ReplayEvent {
  cardId: string
  kind: ItemKind
  ts: number
  correct: boolean
  rating: 1 | 2 | 3 | 4
  exercise: ReviewRow['exercise']
  grammar: string[]
  /** FSRS state before this review (0 new, 1 learning, 2 review, 3 relearning). */
  prevState: number
  prevStability: number
  prevStage: Stage
  /** Days since the card's previous review (NaN for its first). */
  elapsedDays: number
  /** Scheduler's recall probability just before this review (NaN for a first exposure). */
  predicted: number
}

export interface TimelinePoint {
  ts: number
  stability: number
  due: number
  stage: Stage
  state: number
  lapses: number
}

export interface CardTimeline {
  id: string
  kind: ItemKind
  level: LevelId
  grammar: string[]
  /** When the card became due for the first time (creation, or the first review if unknown). */
  createdTs: number
  /** State after each review, oldest first. */
  points: TimelinePoint[]
}

export interface Replay {
  events: ReplayEvent[]
  timelines: Map<string, CardTimeline>
  /** Replayed final card rows (equal to the stored rows when the log is complete). */
  finals: Map<string, CardRow>
}

export function kindOfId(id: string): ItemKind {
  return id.startsWith('w.') ? 'word' : id.startsWith('g.') ? 'grammar' : id.startsWith('c.') ? 'char' : 'sentence'
}

export function replay(cards: readonly CardRow[], reviews: readonly ReviewRow[], decay = FSRS_DECAY): Replay {
  const meta = new Map(cards.map((c) => [c.id, c]))
  const byCard = new Map<string, ReviewRow[]>()
  for (const r of reviews) {
    const list = byCard.get(r.cardId)
    if (list) list.push(r)
    else byCard.set(r.cardId, [r])
  }
  const events: ReplayEvent[] = []
  const timelines = new Map<string, CardTimeline>()
  const finals = new Map<string, CardRow>()
  for (const [id, list] of byCard) {
    list.sort((a, b) => a.ts - b.ts || (a.id ?? 0) - (b.id ?? 0))
    const m = meta.get(id)
    const kind = m?.kind ?? kindOfId(id)
    const level = m?.level ?? ((id.split('.')[1] ?? 'a1') as LevelId)
    const grammar = m?.grammar ?? list[0]!.grammar
    let row = newCard(id, kind, level, m?.lessonId ?? '', grammar, new Date(list[0]!.ts))
    const tl: CardTimeline = { id, kind, level, grammar, createdTs: list[0]!.ts, points: [] }
    for (const r of list) {
      const elapsed = row.last_review !== undefined ? (r.ts - row.last_review) / DAY_MS : NaN
      const predicted = row.state !== 0 && row.last_review !== undefined ? forgetting(elapsed, row.stability, decay) : NaN
      events.push({
        cardId: id, kind, ts: r.ts, correct: r.correct, rating: r.rating, exercise: r.exercise, grammar: r.grammar,
        prevState: row.state, prevStability: row.stability, prevStage: row.stage, elapsedDays: elapsed, predicted,
      })
      row = review(row, r.rating, new Date(r.ts))
      tl.points.push({ ts: r.ts, stability: row.stability, due: row.due, stage: row.stage, state: row.state, lapses: row.lapses })
    }
    timelines.set(id, tl)
    finals.set(id, row)
  }
  // Cards that exist but were never answered: due since creation, nothing learnt yet.
  for (const c of cards) {
    if (timelines.has(c.id)) continue
    timelines.set(c.id, { id: c.id, kind: c.kind, level: c.level, grammar: c.grammar, createdTs: c.due, points: [] })
  }
  events.sort((a, b) => a.ts - b.ts)
  return { events, timelines, finals }
}

/** The card's state at time T (the last review at or before T), or undefined if it had not been reviewed yet. */
export function pointAt(tl: CardTimeline, T: number): TimelinePoint | undefined {
  const pts = tl.points
  let lo = 0
  let hi = pts.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (pts[mid]!.ts <= T) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans >= 0 ? pts[ans] : undefined
}

/** Retrievability of a card at time T according to its replayed state (0 before its first review). */
export function retrievabilityAt(tl: CardTimeline, T: number, decay = FSRS_DECAY): number {
  const p = pointAt(tl, T)
  return p ? forgetting((T - p.ts) / DAY_MS, p.stability, decay) : 0
}
