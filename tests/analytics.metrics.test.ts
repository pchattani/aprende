import { describe, it, expect } from 'vitest'
import { newCard, review, Rating } from '@/engine/srs'
import type { CardRow, DayRow, ItemKind, LessonRow, ReviewRow } from '@/engine/types'
import type { ExerciseKind } from '@/engine/schema'
import {
  prepare, replay, forgetting, daysToRecall, retrievabilityAt, answersOf, knowledgeNav, navSeries, recallMetric, calibrationMetric, spacedEvents,
  forgettingMetric, memoryBook, workloadMetric, effortMetric, consistencyMetric, fatigueMetric, etaMetric, computeInsights, courseSummary,
  wilson, brier, todayKey, shiftDay, DAY_MS, type CourseMeta, type AnalyticsData,
} from '@/engine/analytics'

const MIN = 60_000
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()
const NOW = at(2026, 10, 16, 20, 0)

/** A tiny learner simulator that writes cards and reviews exactly like recordAnswer does. */
function learner() {
  const cards = new Map<string, CardRow>()
  const reviews: ReviewRow[] = []
  const days = new Map<string, DayRow>()
  return {
    cards,
    reviews,
    add(id: string, kind: ItemKind, ts: number, grammar: string[] = [], level: CardRow['level'] = 'a1') {
      if (!cards.has(id)) cards.set(id, newCard(id, kind, level, 'a1.u01.l1', grammar, new Date(ts)))
    },
    answer(id: string, verdict: 'correct' | 'almost' | 'wrong' | 'easy', ts: number, exercise: ExerciseKind = 'choiceEs') {
      const c = cards.get(id)!
      const g = verdict === 'wrong' ? Rating.Again : verdict === 'almost' ? Rating.Hard : verdict === 'easy' ? Rating.Easy : Rating.Good
      cards.set(id, review(c, g, new Date(ts)))
      reviews.push({ id: reviews.length + 1, cardId: id, ts, rating: g as 1 | 2 | 3 | 4, correct: verdict !== 'wrong', exercise, grammar: c.grammar })
      const k = todayKey(new Date(ts))
      const d = days.get(k) ?? { date: k, xp: 0, reviews: 0, lessons: 0, newItems: 0, minutes: 0 }
      d.reviews++
      days.set(k, d)
    },
    day(key: string, patch: Partial<DayRow>) {
      const d = days.get(key) ?? { date: key, xp: 0, reviews: 0, lessons: 0, newItems: 0, minutes: 0 }
      days.set(key, { ...d, ...patch })
    },
    data(lessons: LessonRow[] = []): AnalyticsData {
      return { cards: [...cards.values()], reviews: [...reviews], days: [...days.values()], lessons }
    },
  }
}

const META: CourseMeta = {
  levels: [
    { id: 'a1', items: 10, grammar: ['g.one', 'g.two'] },
    { id: 'a2', items: 20, grammar: ['g.three'] },
  ],
  grammarTitles: { 'g.hard': 'Hard topic' },
}

describe('replay', () => {
  const L = learner()
  const verdicts = ['correct', 'wrong', 'correct', 'almost', 'correct', 'easy', 'wrong', 'correct', 'correct'] as const
  const ids = ['w.uno', 's.a1.u01.l1.1', 'g.one']
  ids.forEach((id, j) => {
    const t0 = at(2026, 8, 1, 9 + j)
    L.add(id, id.startsWith('w.') ? 'word' : id.startsWith('g.') ? 'grammar' : 'sentence', t0, id.startsWith('g.') ? [id] : [])
    let t = t0
    verdicts.forEach((v, i) => {
      L.answer(id, verdicts[(i + j) % verdicts.length] ?? v, t)
      t += (i % 3 === 0 ? 10 * MIN : (i + 1) * 0.9 * DAY_MS) + j * 7 * MIN
    })
  })
  const rp = replay(L.data().cards, L.data().reviews)

  it('reproduces every stored card state exactly', () => {
    for (const c of L.cards.values()) {
      const r = rp.finals.get(c.id)!
      for (const f of ['stability', 'difficulty', 'due', 'stage', 'streak', 'reps', 'lapses', 'state', 'last_review', 'scheduled_days', 'learning_steps'] as const) {
        expect(r[f], `${c.id}.${f}`).toEqual(c[f])
      }
    }
  })
  it('gives the predicted recall before each review', () => {
    const ev = rp.events.filter((e) => e.cardId === 'w.uno')
    expect(Number.isNaN(ev[0]!.predicted)).toBe(true) // first exposure: no prediction
    const tl = rp.timelines.get('w.uno')!
    const e3 = ev[3]!
    const prev = tl.points[2]!
    expect(e3.elapsedDays).toBeCloseTo((e3.ts - prev.ts) / DAY_MS, 10)
    expect(e3.predicted).toBeCloseTo(forgetting(e3.elapsedDays, prev.stability), 12)
  })
  it('retrievability on past days follows the timeline', () => {
    const tl = rp.timelines.get('w.uno')!
    expect(retrievabilityAt(tl, tl.points[0]!.ts - 1)).toBe(0)
    expect(retrievabilityAt(tl, tl.points[0]!.ts)).toBeCloseTo(1, 12)
    const p = tl.points[tl.points.length - 1]!
    expect(retrievabilityAt(tl, p.ts + 2 * DAY_MS)).toBeCloseTo(forgetting(2, p.stability), 12)
  })
  it('forgetting curve: R(S) = 0.9 and the inverse matches', () => {
    expect(forgetting(7, 7)).toBeCloseTo(0.9, 10)
    expect(forgetting(0, 3)).toBe(1)
    expect(forgetting(daysToRecall(5, 0.5), 5)).toBeCloseTo(0.5, 10)
  })
  it('collapses rows of one exercise into one answer', () => {
    const rows: ReviewRow[] = [
      { cardId: 'w.a', ts: 1000, rating: 3, correct: true, exercise: 'typeEs', grammar: [] },
      { cardId: 'g.x', ts: 1000, rating: 3, correct: true, exercise: 'typeEs', grammar: ['g.x'] },
      { cardId: 'w.b', ts: 2000, rating: 1, correct: false, exercise: 'listen', grammar: [] },
    ]
    const a = answersOf(rows)
    expect(a).toHaveLength(2)
    expect(a[0]!.cards).toEqual(['w.a', 'g.x'])
    expect(a[0]!.grammar).toEqual(['g.x'])
  })
})

describe('knowledge NAV', () => {
  const L = learner()
  // Ten words learnt 20 days ago, then nothing: NAV decays monotonically.
  for (let i = 0; i < 10; i++) {
    const t = at(2026, 9, 26, 10) + i * MIN
    L.add(`w.${i}`, 'word', t)
    L.answer(`w.${i}`, 'correct', t)
    L.answer(`w.${i}`, 'correct', t + DAY_MS)
  }
  L.add('s.a1.u01.l1.1', 'sentence', at(2026, 9, 26, 11))
  L.answer('s.a1.u01.l1.1', 'correct', at(2026, 9, 26, 11))
  const ctx = prepare(L.data(), NOW)
  const nav = knowledgeNav(ctx, 31)

  it('is Σ R over word cards now, with sentences on their own line', () => {
    const expected = [...L.cards.values()].filter((c) => c.kind === 'word').reduce((s, c) => s + forgetting((NOW - c.last_review!) / DAY_MS, c.stability), 0)
    expect(nav.current).toBeCloseTo(expected, 8)
    const s = L.cards.get('s.a1.u01.l1.1')!
    expect(nav.currentOther).toBeCloseTo(forgetting((NOW - s.last_review!) / DAY_MS, s.stability), 8)
    expect(nav.series).toHaveLength(31)
    expect(nav.series[0]!.words).toBe(0)
  })
  it('changes, drawdown and hit rate on a decaying book', () => {
    const w = nav.series.map((p) => p.words)
    expect(nav.change7.abs).toBeCloseTo(w[30]! - w[23]!, 10)
    expect(nav.change7.pct).toBeCloseTo((w[30]! - w[23]!) / w[23]!, 10)
    // Two up days (learning, first review), every later day down.
    expect(nav.hitRate.k).toBe(2)
    expect(nav.drawdown.pct).toBeLessThan(0)
    expect(nav.drawdown.recoveryDate).toBeUndefined()
    expect(nav.drawdown.troughDate).toBe(todayKey(new Date(NOW)))
    expect(nav.drawdown.peakDate).toBe('2026-09-27')
    expect(nav.drawdown.pct).toBeCloseTo((w[30]! - w[11]!) / w[11]!, 10) // 27 Sep is index 11
  })
  it('navSeries samples past days at the end of the day', () => {
    const s = navSeries(ctx, 3)
    expect(s[2]!.words).toBeCloseTo(nav.current, 10)
  })
})

describe('recall and breakdowns', () => {
  const L = learner()
  let t = at(2026, 10, 14, 18)
  const ids: string[] = []
  // 100 answers on easy items (90 right), 30 on a hard grammar topic (10 right).
  for (let i = 0; i < 100; i++) {
    const id = `s.a1.u01.l1.${i}`
    L.add(id, 'sentence', t, ['g.easy'])
    L.answer(id, i % 10 === 0 ? 'wrong' : 'correct', (t += 20_000), i % 2 ? 'listen' : 'choiceEs')
    ids.push(id)
  }
  for (let i = 0; i < 30; i++) {
    const id = `s.a1.u02.l1.${i}`
    L.add(id, 'sentence', t, ['g.hard'])
    L.answer(id, i % 3 === 0 ? 'correct' : 'wrong', (t += 20_000), 'typeEs')
  }
  const ctx = prepare(L.data(), NOW)
  const r = recallMetric(ctx)

  it('7-day recall is a Wilson interval over answers', () => {
    expect(r.d7).toEqual(wilson(100, 130))
    expect(r.all.n).toBe(130)
  })
  it('flags the grammar topic that is significantly below the rest', () => {
    const hard = r.byGrammar.find((g) => g.id === 'g.hard')!
    expect(hard.n).toBe(30)
    expect(hard.p).toBeCloseTo(1 / 3, 10)
    expect(hard.restP).toBeCloseTo(0.9, 10)
    expect(hard.flag).toBe('below')
    expect(r.byGrammar.find((g) => g.id === 'g.easy')!.flag).toBe('above')
    const typed = r.byExercise.find((e) => e.id === 'typeEs')!
    expect(typed.flag).toBe('below')
    expect(r.byModality.find((m) => m.id === 'writing')!.flag).toBe('below')
  })
  it('turns it into a ranked suggestion with a drill route', () => {
    const ins = computeInsights(L.data(), META, NOW)
    const s = ins.suggestions.find((x) => x.id === 'grammar:g.hard')!
    expect(s.severity).toBe('high')
    expect(s.title).toContain('Hard topic')
    expect(s.action.to).toBe('/review?grammar=g.hard')
    expect(s.evidence).toMatch(/n = 30/)
    expect(ins.suggestions[0]!.severity).toBe('high')
  })
})

describe('calibration, forgetting curve and memory book', () => {
  const L = learner()
  // 40 words reviewed on a fixed ladder of gaps; every fourth spaced review fails.
  for (let i = 0; i < 40; i++) {
    const id = `w.c${i}`
    let t = at(2026, 8, 1, 9) + i * MIN
    L.add(id, 'word', t)
    L.answer(id, 'correct', t)
    for (let j = 0; j < 6; j++) {
      t += [1, 2, 4, 8, 3, 12][j]! * DAY_MS
      L.answer(id, (i + j) % 4 === 0 ? 'wrong' : 'correct', t)
    }
  }
  const ctx = prepare(L.data(), NOW)

  it('scores predicted recall against outcomes on spaced reviews', () => {
    const ev = spacedEvents(ctx)
    expect(ev).toHaveLength(240)
    const c = calibrationMetric(ctx)
    expect(c.n).toBe(240)
    expect(c.brier).toBeCloseTo(brier(ev.map((e) => e.predicted), ev.map((e) => e.correct)), 12)
    expect(c.meanObserved).toBeCloseTo(0.75, 10)
    expect(c.bins.reduce((s, b) => s + b.n, 0)).toBe(240)
    expect(c.verdict).toBe('over') // 75% observed is far below the ~90% the scheduler expects
  })
  it('bins recall by elapsed time on doubling edges', () => {
    const f = forgettingMetric(ctx)
    expect(f.bins.length).toBeGreaterThan(2)
    for (const b of f.bins) expect(b.t).toBeGreaterThanOrEqual(b.from)
    expect(f.n).toBe(240)
  })
  it('memory book: maturity, lapse rate and leeches', () => {
    const m = memoryBook(ctx)
    expect(m.reviewed).toBe(40)
    const lapsesInReview = ctx.replay.events.filter((e) => e.prevState === 2)
    expect(m.lapseRate.n).toBe(lapsesInReview.length)
    expect(m.lapseRate.k).toBe(lapsesInReview.filter((e) => !e.correct).length)
    const leeches = [...L.cards.values()].filter((c) => c.lapses >= 3).map((c) => c.id).sort()
    expect(m.leeches.map((l) => l.id).sort()).toEqual(leeches)
    expect(m.stabilityHist.reduce((s, b) => s + b.count, 0)).toBe(40)
  })
})

describe('workload, effort, consistency', () => {
  const today = todayKey(new Date(NOW))
  const mk = (id: string, dueDays: number, stability: number): CardRow => ({
    ...newCard(id, 'word', 'a1', 'l', [], new Date(NOW - 50 * DAY_MS)), state: 2, reps: 3, stability, due: NOW + dueDays * DAY_MS, last_review: NOW - DAY_MS,
  })
  const cards = [mk('w.a', -2, 3), mk('w.b', -0.1, 3), mk('w.c', 1, 3), mk('w.d', 1, 30), mk('w.e', 3, 30), mk('w.f', 40, 30)]
  const days: DayRow[] = []
  for (let i = 1; i <= 14; i++) days.push({ date: shiftDay(today, -i), xp: 10, reviews: 0, lessons: 1, newItems: 0, minutes: 10 })
  const data: AnalyticsData = { cards, reviews: [], days, lessons: [] }
  const ctx = prepare(data, NOW)

  it('forecasts the due ladder and the backlog', () => {
    const w = workloadMetric(ctx)
    expect(w.backlog).toBe(2)
    const tomorrow = w.forecast[1]!
    expect(tomorrow.young + tomorrow.mature).toBe(2)
    expect(tomorrow.mature).toBe(1)
    expect(w.forecast[3]!.mature).toBe(1)
    expect(w.forecast.reduce((s, d) => s + d.young + d.mature, 0)).toBe(3) // 40-day card is beyond the horizon
    expect(w.peak.total).toBe(2)
    expect(w.throughput).toBe(0)
    expect(w.daysToClear).toBe(Infinity)
  })
  it('days on the road and active share', () => {
    const c = consistencyMetric(ctx)
    expect(c.current).toBe(14) // today not yet practised, the run survives until midnight
    expect(c.longest).toBe(14)
    expect(c.active30).toEqual({ k: 14, n: 15, p: 14 / 15 })
  })
  it('effort aggregates minutes over the window', () => {
    const e = effortMetric(ctx, navSeries(ctx, 31))
    expect(e.minutes).toBe(140)
    expect(e.activeDays).toBe(14)
    expect(e.minutesPerDay).toBeCloseTo(140 / 30, 10)
    expect(e.totalMinutes).toBe(140)
  })
})

describe('throughput counts distinct already-seen cards', () => {
  it('a card answered four times in a day is one card reviewed, after its first exposure', () => {
    const L = learner()
    const t = at(2026, 10, 15, 9)
    L.add('w.t', 'word', t)
    for (let i = 0; i < 4; i++) L.answer('w.t', i === 1 ? 'wrong' : 'correct', t + i * 5 * MIN)
    L.add('w.u', 'word', t)
    L.answer('w.u', 'correct', t + 30 * MIN) // first exposure only
    const ctx = prepare(L.data(), NOW)
    expect(ctx.cardsReviewedByDay.get('2026-10-15')).toBe(1)
    expect(ctx.answersByDay.get('2026-10-15')).toBe(5)
    expect(ctx.newByDay.get('2026-10-15')).toBe(2)
    expect(workloadMetric(ctx).throughput).toBeCloseTo(1 / 14, 10)
  })
})

describe('fatigue', () => {
  const L = learner()
  // 20 sessions of 24 minutes, one answer every 20 s: 95% right before minute 12, 70% after.
  let n = 0
  for (let s = 0; s < 20; s++) {
    const start = at(2026, 9, 20 + (s % 10), s < 10 ? 9 : 19)
    for (let i = 0; i < 72; i++) {
      const ts = start + i * 20_000
      const id = `w.f${n++}`
      L.add(id, 'word', ts)
      const late = i * 20 >= 12 * 60
      L.answer(id, (late ? n % 10 < 7 : n % 20 !== 0) ? 'correct' : 'wrong', ts)
    }
  }
  const f = fatigueMetric(prepare(L.data(), NOW))
  it('finds the minute where accuracy breaks and recommends a length', () => {
    expect(f.sessions).toBe(20)
    expect(f.breakpoint!.minute).toBe(12)
    expect(f.breakpoint!.before.p).toBeCloseTo(0.95, 2)
    expect(f.breakpoint!.after.p).toBeCloseTo(0.7, 2)
    expect(f.recommendedMinutes).toBe(12)
    expect(f.buckets[0]!.from).toBe(0)
  })
})

describe('level ETA', () => {
  const L = learner()
  // One new word mastered every day for 20 days (four correct answers reach production).
  for (let d = 20; d >= 1; d--) {
    const t = NOW - d * DAY_MS - 2 * 3600_000
    const id = `w.e${d}`
    L.add(id, 'word', t)
    for (let k = 0; k < 4; k++) L.answer(id, 'correct', t + k * 60_000)
  }
  const ctx = prepare(L.data(), NOW)
  const e = etaMetric(ctx, META)

  it('tracks mastered items and projects the next level from the drift', () => {
    expect(e.series[e.series.length - 1]!.mastered).toBe(20)
    expect(e.drift).toBeCloseTo(1, 10)
    expect(e.driftSe).toBe(0)
    expect(e.reached).toBe('a1') // 20 ≥ 0.8 × 10
    expect(e.next!.level).toBe('a2')
    expect(e.next!.target).toBe(24) // 0.8 × 30
    expect(e.next!.remaining).toBe(4)
    expect(e.next!.days).toBeCloseTo(4, 10)
    expect(e.next!.date).toBe(shiftDay(todayKey(new Date(NOW)), 4))
    expect(e.levels[0]!.mastered).toBe(20)
  })
  it('course summary for the hub', () => {
    const lessons: LessonRow[] = [{ id: 'a1.u01.l1', unitId: 'a1.u01', level: 'a1', attempts: 2, completions: 1, bestAccuracy: 1, lastAccuracy: 1, xp: 30 }]
    const data = L.data(lessons)
    const s = courseSummary({ ...data, days: data.days.map((d) => ({ ...d, xp: 12 })) }, META, NOW)
    expect(s.km).toBe(12 * 20)
    expect(s.lessonsDone).toBe(1)
    expect(s.levelEstimate).toBe('Pre-A1') // fewer than 50 mastered items
    expect(s.navSeries30).toHaveLength(30)
    expect(s.daysOnRoad).toBe(20)
    expect(s.lastActive).toBe(shiftDay(todayKey(new Date(NOW)), -1))
  })
})
