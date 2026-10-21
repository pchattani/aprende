/** Observed recall: accuracy with Wilson intervals, its trend, and where it is significantly weaker. */
import type { Ctx } from './context'
import { benjaminiHochberg, ols, twoProportionZ, wilson, type Proportion } from './stats'
import { DAY_MS, dayKeyOf, shiftDay, startOfDay } from './time'
import type { Answer } from './types'

export interface Breakdown extends Proportion {
  id: string
  /** Accuracy of all other answers in the window (the baseline it is tested against). */
  restP: number
  z: number
  pValue: number
  /** Benjamini–Hochberg adjusted p-value across the tested groups. */
  qValue: number
  /** 'below' / 'above' when significant (q < alpha) with enough answers. */
  flag: 'below' | 'above' | null
}

export interface WeekPoint extends Proportion {
  start: string
}

export interface RecallMetric {
  d7: Proportion
  d30: Proportion
  all: Proportion
  /** Last 30 days versus the 30 days before. */
  vsPrior: { prior: Proportion; z: number; pValue: number }
  weekly: WeekPoint[]
  /** Weighted OLS of weekly accuracy on week index (percentage points per week). */
  trend: { slopePerWeek: number; se: number; z: number; weeks: number }
  windowDays: number
  baseline: Proportion
  byExercise: Breakdown[]
  byModality: Breakdown[]
  byGrammar: Breakdown[]
}

export const MODALITY: Record<string, 'listening' | 'speaking' | 'writing' | 'reading'> = {
  listen: 'listening', dictation: 'listening', speak: 'speaking',
  typeEs: 'writing', typeEn: 'writing', conjugate: 'writing', transform: 'writing', findError: 'writing',
  choiceEs: 'reading', choiceEn: 'reading', match: 'reading', fillBlank: 'reading', reply: 'reading', wordBank: 'reading', order: 'reading', orderText: 'reading',
  trace: 'writing', writeChar: 'writing', pictogram: 'reading', hearChar: 'listening',
}

export const EXERCISE_LABEL: Record<string, string> = {
  choiceEs: 'Pick the meaning', choiceEn: 'Pick the translation', wordBank: 'Word tiles', typeEs: 'Type in the language', typeEn: 'Type in English',
  listen: 'Listen and pick', dictation: 'Dictation', match: 'Match pairs', fillBlank: 'Fill the blank', conjugate: 'Conjugate', transform: 'Transform',
  findError: 'Find the error', speak: 'Speak', order: 'Word order', reply: 'Pick the reply', orderText: 'Order the text',
  trace: 'Trace a character', writeChar: 'Write a character', pictogram: 'Pictogram', hearChar: 'Hear and pick the characters',
}

function prop(as: readonly Answer[]): Proportion {
  return wilson(as.filter((a) => a.correct).length, as.length)
}

/**
 * Compare each group against the rest of the window with a two-proportion z-test,
 * then control the false-discovery rate across groups (Benjamini–Hochberg).
 */
export function breakdown(answers: readonly Answer[], keysOf: (a: Answer) => readonly string[], opts: { minShow?: number; minFlag?: number; alpha?: number } = {}): Breakdown[] {
  const { minShow = 12, minFlag = 20, alpha = 0.1 } = opts
  const N = answers.length
  const K = answers.filter((a) => a.correct).length
  const acc = new Map<string, { k: number; n: number }>()
  for (const a of answers) {
    for (const key of new Set(keysOf(a))) {
      const g = acc.get(key) ?? { k: 0, n: 0 }
      g.n++
      if (a.correct) g.k++
      acc.set(key, g)
    }
  }
  const rows = [...acc.entries()].filter(([, g]) => g.n >= minShow).map(([id, g]) => {
    const t = twoProportionZ(g.k, g.n, K - g.k, N - g.n)
    return { id, ...wilson(g.k, g.n), restP: N - g.n > 0 ? (K - g.k) / (N - g.n) : NaN, z: t.z, pValue: t.pValue }
  })
  const q = benjaminiHochberg(rows.map((r) => (Number.isFinite(r.pValue) ? r.pValue : 1)))
  return rows
    .map((r, i) => ({ ...r, qValue: q[i]!, flag: r.n >= minFlag && q[i]! < alpha ? (r.z < 0 ? 'below' : 'above') : null }) as Breakdown)
    .sort((a, b) => a.p - b.p)
}

export function recallMetric(ctx: Ctx, windowDays = 60): RecallMetric {
  const { answers, now } = ctx
  const since = (d: number) => startOfDay(shiftDay(ctx.today, -(d - 1)))
  const inLast = (d: number) => answers.filter((a) => a.ts >= since(d))
  const last30 = inLast(30)
  const prior = answers.filter((a) => a.ts >= since(60) && a.ts < since(30))
  const pr = prop(prior)
  const cur = prop(last30)
  const t = twoProportionZ(cur.k, cur.n, pr.k, pr.n)

  // Weekly buckets ending today (up to 12 weeks).
  const weekly: WeekPoint[] = []
  for (let w = 11; w >= 0; w--) {
    const end = since(1) + DAY_MS - w * 7 * DAY_MS
    const start = end - 7 * DAY_MS
    const as = answers.filter((a) => a.ts >= start && a.ts < end && a.ts <= now)
    if (as.length) weekly.push({ start: dayKeyOf(start), ...prop(as) })
  }
  const idx = weekly.map((_, i) => i)
  const fit = weekly.length >= 3 ? ols(idx, weekly.map((w) => w.p), weekly.map((w) => w.n)) : undefined

  const win = inLast(windowDays)
  return {
    d7: prop(inLast(7)),
    d30: cur,
    all: prop(answers),
    vsPrior: { prior: pr, z: t.z, pValue: t.pValue },
    weekly,
    trend: { slopePerWeek: fit?.slope ?? NaN, se: fit?.seSlope ?? NaN, z: fit ? fit.slope / fit.seSlope : NaN, weeks: weekly.length },
    windowDays,
    baseline: prop(win),
    byExercise: breakdown(win, (a) => [a.exercise]),
    byModality: breakdown(win, (a) => [MODALITY[a.exercise] ?? 'reading'], { minShow: 20, minFlag: 30 }),
    byGrammar: breakdown(win, (a) => a.grammar),
  }
}
