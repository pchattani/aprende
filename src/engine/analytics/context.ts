import type { DayRow } from '../types'
import { answersOf } from './answers'
import { replay, type Replay } from './replay'
import { dayKeyOf, todayKey } from './time'
import type { AnalyticsData, Answer } from './types'

/** Shared, precomputed views of the learner's data. Build once with `prepare` and pass to each metric. */
export interface Ctx {
  data: AnalyticsData
  now: number
  today: string
  replay: Replay
  answers: Answer[]
  dayMap: Map<string, DayRow>
  /** Days with any practice (minutes, reviews, lessons or a logged answer). */
  activeDays: Set<string>
  /** Review rows per local day, from the log. */
  reviewsByDay: Map<string, number>
  /** Cards met for the first time per local day, from the log. */
  newByDay: Map<string, number>
  /** Distinct already-seen cards reviewed per local day (the scheduler's throughput). */
  cardsReviewedByDay: Map<string, number>
  /** Answers (exercises) per local day. */
  answersByDay: Map<string, number>
}

export function prepare(data: AnalyticsData, now = Date.now()): Ctx {
  const rp = replay(data.cards, data.reviews)
  const answers = answersOf(data.reviews)
  const dayMap = new Map(data.days.map((d) => [d.date, d]))
  const reviewsByDay = new Map<string, number>()
  for (const r of data.reviews) {
    const k = dayKeyOf(r.ts)
    reviewsByDay.set(k, (reviewsByDay.get(k) ?? 0) + 1)
  }
  const newByDay = new Map<string, number>()
  for (const tl of rp.timelines.values()) {
    if (!tl.points.length) continue
    const k = dayKeyOf(tl.points[0]!.ts)
    newByDay.set(k, (newByDay.get(k) ?? 0) + 1)
  }
  const seen = new Map<string, Set<string>>()
  for (const e of rp.events) {
    if (e.prevState === 0) continue
    const k = dayKeyOf(e.ts)
    const s = seen.get(k) ?? new Set<string>()
    s.add(e.cardId)
    seen.set(k, s)
  }
  const cardsReviewedByDay = new Map([...seen].map(([k, s]) => [k, s.size]))
  const answersByDay = new Map<string, number>()
  for (const a of answers) {
    const k = dayKeyOf(a.ts)
    answersByDay.set(k, (answersByDay.get(k) ?? 0) + 1)
  }
  const activeDays = new Set<string>(reviewsByDay.keys())
  for (const d of data.days) if (d.minutes > 0 || d.reviews > 0 || d.lessons > 0) activeDays.add(d.date)
  return { data, now, today: todayKey(new Date(now)), replay: rp, answers, dayMap, activeDays, reviewsByDay, newByDay, cardsReviewedByDay, answersByDay }
}

/** Minutes practised on a day: the logged minutes, or the span of its answer sessions when nothing was logged. */
export function minutesOn(ctx: Ctx, key: string, sessionMinutes?: Map<string, number>): number {
  const logged = ctx.dayMap.get(key)?.minutes ?? 0
  return logged > 0 ? logged : (sessionMinutes?.get(key) ?? 0)
}
