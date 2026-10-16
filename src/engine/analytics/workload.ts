/** Workload (due forecast, backlog, throughput) and effort/efficiency. */
import type { Ctx } from './context'
import { minutesOn } from './context'
import { MATURE_DAYS } from './memory'
import type { NavPoint } from './nav'
import { pointAt } from './replay'
import { mean, ols, sum } from './stats'
import { dayKeyOf, dayRange, endOfDay, sessions, shiftDay } from './time'

export interface ForecastDay {
  date: string
  young: number
  mature: number
}

export interface WorkloadMetric {
  /** Cards due now (overdue included). */
  backlog: number
  /** Cards falling due on each of the next 30 days (today = cards due later today). */
  forecast: ForecastDay[]
  peak: { date: string; total: number }
  /** Mean distinct already-seen cards reviewed per calendar day over the trailing window. */
  throughput: number
  throughputDays: number
  /** Mean cards falling due per day over the next 7 days. */
  inflow7: number
  /** throughput − inflow7: cards per day left over to work the backlog down. */
  netDrain: number
  /** backlog / netDrain (Infinity when the drain is ≤ 0). */
  daysToClear: number
  /** Backlog at the end of each of the last 30 days (reconstructed). */
  backlogSeries: { date: string; backlog: number }[]
  backlogChange7: number
}

export function workloadMetric(ctx: Ctx, trailing = 14): WorkloadMetric {
  const { now, today } = ctx
  const cards = ctx.data.cards
  const backlog = cards.filter((c) => c.due <= now).length
  const keys = dayRange(shiftDay(today, 29), 30)
  const forecast: ForecastDay[] = keys.map((date) => ({ date, young: 0, mature: 0 }))
  const index = new Map(keys.map((k, i) => [k, i]))
  for (const c of cards) {
    if (c.due <= now) continue
    const i = index.get(dayKeyOf(c.due))
    if (i === undefined) continue
    if (c.stability >= MATURE_DAYS) forecast[i]!.mature++
    else forecast[i]!.young++
  }
  const peakI = forecast.reduce((bi, d, i, a) => (d.young + d.mature > a[bi]!.young + a[bi]!.mature ? i : bi), 0)
  const past = dayRange(shiftDay(today, -1), trailing)
  const throughput = mean(past.map((k) => ctx.cardsReviewedByDay.get(k) ?? 0))
  const inflow7 = mean(forecast.slice(0, 7).map((d) => d.young + d.mature))
  const netDrain = throughput - inflow7
  const tls = [...ctx.replay.timelines.values()]
  const backlogSeries = dayRange(today, 30).map((date, i, a) => {
    const T = i === a.length - 1 ? now : endOfDay(date)
    let n = 0
    for (const tl of tls) {
      if (tl.createdTs > T) continue
      const p = pointAt(tl, T)
      if ((p ? p.due : tl.createdTs) <= T) n++
    }
    return { date, backlog: n }
  })
  const bl = backlogSeries.map((b) => b.backlog)
  return {
    backlog,
    forecast,
    peak: { date: forecast[peakI]!.date, total: forecast[peakI]!.young + forecast[peakI]!.mature },
    throughput,
    throughputDays: trailing,
    inflow7,
    netDrain,
    daysToClear: backlog === 0 ? 0 : netDrain > 0 ? backlog / netDrain : Infinity,
    backlogSeries,
    backlogChange7: bl[bl.length - 1]! - (bl[bl.length - 8] ?? 0),
  }
}

export interface EffortDay {
  date: string
  minutes: number
  newItems: number
  /** Answered exercises (one exercise may credit several cards). */
  reviews: number
  /** Change in total NAV (words + other) over the day. */
  navDelta: number
}

export interface EffortMetric {
  windowDays: number
  minutes: number
  activeDays: number
  minutesPerDay: number
  minutesPerActiveDay: number
  newPerMinute: number
  reviewsPerMinute: number
  totalMinutes: number
  /** Total minutes ÷ current total NAV: minutes of practice per postcard you can recall now. */
  costPerPostcard: number
  /** NAV change over the window ÷ minutes in the window. */
  marginalPerMinute: number
  /** OLS of daily NAV change on minutes: slope = postcards per minute, intercept = change on an idle day. */
  regression: { slope: number; seSlope: number; intercept: number; seIntercept: number; r2: number; n: number }
  daily: EffortDay[]
}

/** Minutes per day estimated from answer sessions (first to last answer + 30 s), used when no minutes were logged. */
export function sessionMinutesByDay(ctx: Ctx): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions(ctx.answers)) {
    const k = dayKeyOf(s.start)
    m.set(k, (m.get(k) ?? 0) + (s.end - s.start + 30_000) / 60_000)
  }
  return m
}

export function effortMetric(ctx: Ctx, nav: NavPoint[], windowDays = 30): EffortMetric {
  const sm = sessionMinutesByDay(ctx)
  const navByDate = new Map(nav.map((p, i) => [p.date, i]))
  const total = (i: number) => nav[i]!.words + nav[i]!.other
  const keys = dayRange(ctx.today, windowDays)
  const daily: EffortDay[] = keys.map((date) => {
    const i = navByDate.get(date)
    return {
      date,
      minutes: minutesOn(ctx, date, sm),
      newItems: Math.max(ctx.newByDay.get(date) ?? 0, ctx.dayMap.get(date)?.newItems ?? 0),
      reviews: ctx.answersByDay.get(date) ?? 0,
      navDelta: i !== undefined && i > 0 ? total(i) - total(i - 1) : NaN,
    }
  })
  const minutes = sum(daily.map((d) => d.minutes))
  const active = daily.filter((d) => d.minutes > 0 || d.reviews > 0).length
  const allKeys = new Set([...ctx.dayMap.keys(), ...sm.keys()])
  const totalMinutes = sum([...allKeys].map((k) => minutesOn(ctx, k, sm)))
  const navNow = nav.length ? total(nav.length - 1) : 0
  const startI = nav.length - 1 - windowDays
  const navGain = startI >= 0 ? navNow - total(startI) : navNow
  // Exclude today (still in progress) from the regression.
  const reg = daily.slice(0, -1).filter((d) => Number.isFinite(d.navDelta))
  const fit = reg.length >= 7 ? ols(reg.map((d) => d.minutes), reg.map((d) => d.navDelta)) : undefined
  return {
    windowDays,
    minutes,
    activeDays: active,
    minutesPerDay: minutes / windowDays,
    minutesPerActiveDay: active ? minutes / active : NaN,
    newPerMinute: minutes ? sum(daily.map((d) => d.newItems)) / minutes : NaN,
    reviewsPerMinute: minutes ? sum(daily.map((d) => d.reviews)) / minutes : NaN,
    totalMinutes,
    costPerPostcard: navNow > 0 ? totalMinutes / navNow : NaN,
    marginalPerMinute: minutes ? navGain / minutes : NaN,
    regression: { slope: fit?.slope ?? NaN, seSlope: fit?.seSlope ?? NaN, intercept: fit?.intercept ?? NaN, seIntercept: fit?.seIntercept ?? NaN, r2: fit?.r2 ?? NaN, n: reg.length },
    daily,
  }
}

