/**
 * Suggestions: ranked, evidence-backed advice. Every rule has a minimum sample
 * size and a significance or magnitude gate, so noise does not produce advice.
 */
import type { Insights } from './insights'
import { ci, days, num, pct, pp, pval, shortDate, signed } from './format'
import type { CourseMeta } from './types'
import { EXERCISE_LABEL } from './recall'

export type Severity = 'high' | 'medium' | 'low'

export interface Suggestion {
  id: string
  severity: Severity
  title: string
  /** The numbers behind the advice (with intervals and sample sizes). */
  evidence: string
  action: { label: string; to: string }
  secondary?: { label: string; to: string }
  /** Ranking score (higher first). */
  score: number
}

const W: Record<Severity, number> = { high: 300, medium: 200, low: 100 }

export function suggestions(ins: Omit<Insights, 'suggestions'>, meta: CourseMeta): Suggestion[] {
  const out: Suggestion[] = []
  const add = (s: Omit<Suggestion, 'score'>, magnitude = 0) => out.push({ ...s, score: W[s.severity] + Math.min(99, magnitude) })
  const title = (g: string) => meta.grammarTitles?.[g] ?? g.replace(/^g\./, '').replace(/-/g, ' ')
  const { recall, calibration, workload, consistency, fatigue, nav, memory, eta, effort } = ins
  const nextLesson = meta.nextLessonId ? `/lesson/${meta.nextLessonId}` : '/'

  // 1. Grammar topics significantly below the learner's own baseline (FDR-controlled).
  recall.byGrammar.filter((g) => g.flag === 'below').sort((a, b) => a.z - b.z).slice(0, 3).forEach((g) => {
    const gap = g.restP - g.p
    add({
      id: `grammar:${g.id}`,
      severity: gap >= 0.15 ? 'high' : 'medium',
      title: `Shore up “${title(g.id)}”`,
      evidence: `${pct(g.p)} recall (95% CI ${ci(g.lo, g.hi)}, n = ${g.n}) versus ${pct(g.restP)} on everything else over ${recall.windowDays} days; z = ${num(g.z, 1)}, q ${g.qValue < 0.001 ? '< 0.001' : `= ${num(g.qValue, 3)}`}.`,
      action: { label: 'Drill this topic', to: `/review?grammar=${encodeURIComponent(g.id)}` },
      secondary: { label: 'Reread the note', to: `/grammar/${encodeURIComponent(g.id)}` },
    }, gap * 100)
  })

  // 2. Weak skills (modalities), e.g. listening below reading.
  for (const m of recall.byModality.filter((x) => x.flag === 'below')) {
    const kinds = recall.byExercise.filter((k) => k.flag === 'below').map((k) => EXERCISE_LABEL[k.id] ?? k.id)
    const reading = recall.byModality.find((x) => x.id === 'reading')
    const vs = reading && reading.id !== m.id ? `${pct(reading.p)} in reading (n = ${reading.n})` : `${pct(m.restP)} elsewhere`
    add({
      id: `skill:${m.id}`,
      severity: m.restP - m.p >= 0.1 ? 'high' : 'medium',
      title: `Your ${m.id} lags behind`,
      evidence: `${pct(m.p)} in ${m.id} (CI ${ci(m.lo, m.hi)}, n = ${m.n}) versus ${vs}; z = ${num(m.z, 1)}.${kinds.length ? ` Weakest formats: ${kinds.slice(0, 3).join(', ')}.` : ''}`,
      action: m.id === 'speaking' ? { label: 'More speaking in settings', to: '/settings' } : { label: `Review with ${m.id} in mind`, to: '/review' },
      secondary: m.id === 'listening' ? { label: 'Pronunciation drills', to: '/pronunciation' } : undefined,
    }, (m.restP - m.p) * 100)
  }

  // 3. Backlog growing faster than throughput.
  if (workload.backlog >= 20 && workload.backlogChange7 > 0 && workload.netDrain <= 0) {
    add({
      id: 'backlog:growing',
      severity: 'high',
      title: 'Your backlog is compounding',
      evidence: `${workload.backlog} cards due now, ${signed(workload.backlogChange7)} in 7 days. You review ${num(workload.throughput, 0)} a day (trailing ${workload.throughputDays} d) while ${num(workload.inflow7, 0)} a day fall due next week.`,
      action: { label: `Clear due cards`, to: '/review' },
    }, workload.backlog / 10)
  } else if (workload.backlog >= 30 && workload.daysToClear > 7) {
    add({
      id: 'backlog:large',
      severity: 'medium',
      title: 'Work the backlog down',
      evidence: `${workload.backlog} cards due; at your net drain of ${num(workload.netDrain, 1)} a day it clears in ${Number.isFinite(workload.daysToClear) ? `${Math.ceil(workload.daysToClear)} days` : 'never'}.`,
      action: { label: 'Review now', to: '/review' },
    }, workload.backlog / 10)
  }

  // 4. Upcoming load peak: smooth it by reviewing ahead.
  const base = Math.max(workload.inflow7, workload.throughput, 1)
  if (workload.peak.total >= 25 && workload.peak.total >= 1.6 * base) {
    add({
      id: 'load:peak',
      severity: workload.peak.total >= 2.5 * base ? 'medium' : 'low',
      title: `A review spike is coming on ${shortDate(workload.peak.date)}`,
      evidence: `${workload.peak.total} cards fall due that day, ${num(workload.peak.total / base, 1)}× your usual ${num(base, 0)}. Reviewing a few a day early flattens the ladder at almost no cost to retention.`,
      action: { label: 'Review ahead today', to: '/review' },
    }, workload.peak.total / base * 10)
  }

  // 5. Sharp time-of-day gap.
  if (consistency.significant && consistency.best && consistency.worst && consistency.test && consistency.test.diff >= 0.05) {
    const b = consistency.best
    const w = consistency.worst
    add({
      id: 'time:gap',
      severity: consistency.test.diff >= 0.1 ? 'medium' : 'low',
      title: `You are sharper at ${b.label} than at ${w.label}`,
      evidence: `${pct(b.p)} (CI ${ci(b.lo, b.hi)}, n = ${b.n}) at ${b.label} versus ${pct(w.p)} (CI ${ci(w.lo, w.hi)}, n = ${w.n}) at ${w.label}; ${pp(consistency.test.diff)}, ${pval(consistency.test.pValue)} (Bonferroni-adjusted gate).`,
      action: { label: 'Set a daily goal you can keep', to: '/settings' },
    }, consistency.test.diff * 100)
  }

  // 6. Fatigue: shorter sessions.
  if (fatigue.recommendedMinutes && fatigue.breakpoint && fatigue.medianMinutes > fatigue.recommendedMinutes) {
    const bp = fatigue.breakpoint
    add({
      id: 'fatigue',
      severity: bp.before.p - bp.after.p >= 0.08 ? 'medium' : 'low',
      title: `Stop at about ${fatigue.recommendedMinutes} minutes`,
      evidence: `Accuracy is ${pct(bp.before.p)} before minute ${bp.minute} (n = ${bp.before.n}) and ${pct(bp.after.p)} after (n = ${bp.after.n}); z = ${num(bp.z, 1)}. Your median session runs ${num(fatigue.medianMinutes, 0)} min.`,
      action: { label: 'Use shorter sessions', to: '/settings' },
    }, (bp.before.p - bp.after.p) * 100)
  }

  // 7. Breaks and drawdowns.
  const dd = nav.drawdown
  if (consistency.current === 0 && consistency.longest > 0 && nav.current > 5) {
    add({
      id: 'road:paused',
      severity: 'high',
      title: 'Get back on the road today',
      evidence: `No practice yesterday or today. Your postcards are fading: knowledge NAV ${num(nav.change7.abs, 1)} over 7 days.`,
      action: { label: 'A short review', to: '/review' },
    }, 50)
  } else if (dd.pct <= -0.03 && dd.peakDate) {
    const brk = consistency.breaks[0]
    add({
      id: 'drawdown',
      severity: dd.recoveryDate ? 'low' : 'medium',
      title: dd.recoveryDate ? 'Breaks cost you ground' : 'You are still below your peak',
      evidence: `Knowledge NAV fell ${pct(-dd.pct, 1)} (${num(dd.abs, 1)} postcards) from ${shortDate(dd.peakDate)} to ${shortDate(dd.troughDate)}${brk ? `, around a ${brk.days}-day break` : ''}; ${dd.recoveryDate ? `recovered on ${shortDate(dd.recoveryDate)}, ${dd.durationDays} days peak to recovery` : 'not yet recovered'}. A few minutes a day prevents most of it.`,
      action: { label: dd.recoveryDate ? 'Keep the run going' : 'Recover with a review', to: '/review' },
    }, -dd.pct * 100)
  }
  if (consistency.active30.n >= 14 && consistency.active30.p < 0.6) {
    add({
      id: 'road:consistency',
      severity: 'medium',
      title: 'Practise on more days, even briefly',
      evidence: `Active on ${consistency.active30.k} of the last ${consistency.active30.n} days (${pct(consistency.active30.p)}). On idle days NAV changes by ${num(effort.regression.intercept, 1)} postcards (regression intercept, n = ${effort.regression.n} days).`,
      action: { label: 'Set a daily goal', to: '/settings' },
    }, (0.6 - consistency.active30.p) * 100)
  }

  // 8. Calibration mismatch.
  const gap = calibration.meanObserved - calibration.meanPredicted
  if (calibration.n >= 150 && calibration.verdict !== 'calibrated' && calibration.verdict !== 'insufficient' && Math.abs(gap) >= 0.03) {
    const over = calibration.verdict === 'over'
    add({
      id: `calibration:${calibration.verdict}`,
      severity: over && gap <= -0.06 ? 'medium' : 'low',
      title: over ? 'You forget faster than the scheduler expects' : 'You remember more than the scheduler expects',
      evidence: `On ${calibration.n} spaced reviews the scheduler predicted ${pct(calibration.meanPredicted, 1)} recall; you got ${pct(calibration.meanObserved, 1)} (${pp(gap)}, z = ${num(calibration.z, 1)}). ECE ${num(calibration.ece * 100, 1)} pp.`,
      action: over ? { label: 'Review due cards on time', to: '/review' } : { label: 'Take on new material', to: nextLesson },
    }, Math.abs(gap) * 100)
  }

  // 9. Too many new items versus reviews (or too few).
  const last14 = effort.daily.slice(-14)
  const newN = last14.reduce((s, d) => s + d.newItems, 0)
  const revN = last14.reduce((s, d) => s + d.reviews, 0)
  if (revN >= 100 && newN / revN > 0.3 && (memory.lapseRate.p > 0.15 || workload.netDrain < 0)) {
    add({
      id: 'mix:too-new',
      severity: 'medium',
      title: 'Ease off new material for a few days',
      evidence: `${newN} new items against ${revN} review answers in 14 days (${num(newN / revN, 2)} per review). Lapse rate ${pct(memory.lapseRate.p, 1)} (CI ${ci(memory.lapseRate.lo, memory.lapseRate.hi)}); net drain ${num(workload.netDrain, 1)}/day.`,
      action: { label: 'Review instead of a new lesson', to: '/review' },
    }, (newN / revN) * 50)
  } else if (revN >= 50 && newN === 0 && workload.backlog < Math.max(10, workload.throughput)) {
    add({
      id: 'mix:too-few',
      severity: 'low',
      title: 'Room for new material',
      evidence: `No new items in 14 days while the backlog is just ${workload.backlog}. Your memory book is stable; the next lesson is cheap.`,
      action: { label: 'Next lesson', to: nextLesson },
    })
  }

  // 10. Leeches.
  if (memory.leeches.length >= 1) {
    const n = memory.leeches.length
    add({
      id: 'leeches',
      severity: n >= 8 ? 'medium' : 'low',
      title: `${n} ${n === 1 ? 'item keeps' : 'items keep'} slipping away`,
      evidence: `${n} cards with 3+ lapses (worst: ${memory.leeches.slice(0, 3).map((l) => `${meta.labelOf?.(l.id) ?? l.id} ×${l.lapses}`).join(', ')}). Each costs repeated reviews; a focused re-test or a mnemonic breaks the loop.`,
      action: { label: 'Pinned practice', to: '/review?tab=pinned' },
    }, n * 3)
  }

  // 11. ETA to the next level and what would speed it up.
  if (eta.next && eta.fitDays >= 7 && eta.drift > 0) {
    const e = eta.next
    const faster = e.remaining / (eta.drift + 5)
    add({
      id: 'eta',
      severity: 'low',
      title: `Complete ${e.level.toUpperCase()} around ${shortDate(e.date)}`,
      evidence: `${e.remaining} of ${e.target} items to master at ${num(eta.drift, 1)} a day (SE ${num(eta.driftSe, 1)}, last ${eta.fitDays} d): ${days(e.days)}, range ${shortDate(e.dateLo)} – ${e.dateHi ? shortDate(e.dateHi) : 'open'}. Five more mastered items a day would bring it to ${days(faster)}.`,
      action: { label: 'Continue the course', to: nextLesson },
    })
  }

  return out.sort((a, b) => b.score - a.score)
}
