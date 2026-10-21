/**
 * Verb duel: Luna, the opponent. She answers after a delay that follows the learner's own pace
 * (the median time of their recent right answers) and their accuracy, with a rubber band on the
 * score: she hurries when the learner pulls ahead and dawdles (and slips more) when they fall
 * behind, so a match is winnable but close.
 */
import type { Rng } from '../random'

export const DUEL_TARGET = 10
/** A match ends after this many prompts even if nobody reached the target (whoever leads wins). */
export const DUEL_MAX_TURNS = 30

export interface DuelHistory {
  /** Milliseconds the learner took for their recent right answers. */
  times: number[]
  /** Recent answers: true right, false wrong (or too slow to try). */
  results: boolean[]
  /** Learner points minus Luna's. */
  lead: number
  mode: 'type' | 'pick'
}

export interface LunaPlan {
  /** When Luna answers, in ms after the prompt appears. */
  delay: number
  /** Whether her answer is right. */
  correct: boolean
}

export const LUNA_MIN_MS = 1400
export const LUNA_MAX_MS = 14000

export function median(xs: readonly number[]): number | undefined {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** How well the learner has been doing lately, 0..1 (0.6 before there is anything to go on). */
export function recentAccuracy(results: readonly boolean[], window = 8): number {
  const r = results.slice(-window)
  if (!r.length) return 0.6
  return r.filter(Boolean).length / r.length
}

/** Luna's plan for the next prompt. */
export function lunaPlan(h: DuelHistory, rng: Rng): LunaPlan {
  const pace = median(h.times.slice(-6)) ?? (h.mode === 'type' ? 6500 : 3600)
  const acc = recentAccuracy(h.results)
  // a sharp learner gets a quicker Luna; a struggling one a gentler Luna
  let factor = 1.2 - (acc - 0.5) * 0.5
  // rubber band: ±7 % per point of lead, within reason
  factor -= Math.max(-4, Math.min(4, h.lead)) * 0.07
  factor = Math.max(0.65, Math.min(1.7, factor))
  const jitter = 0.85 + rng.next() * 0.3
  const delay = Math.round(Math.max(LUNA_MIN_MS, Math.min(LUNA_MAX_MS, pace * factor * jitter)))
  // she slips now and then, more when the learner is behind
  const slip = h.lead <= -3 ? 0.3 : h.lead < 0 ? 0.2 : h.lead >= 3 ? 0.06 : 0.12
  return { delay, correct: rng.next() >= slip }
}

/** Who has won, if anyone, after a turn. */
export function duelWinner(me: number, luna: number, turns: number): 'me' | 'luna' | 'draw' | undefined {
  if (me >= DUEL_TARGET) return 'me'
  if (luna >= DUEL_TARGET) return 'luna'
  if (turns >= DUEL_MAX_TURNS) return me > luna ? 'me' : luna > me ? 'luna' : 'draw'
  return undefined
}

/** Things the dogs say during a duel. `{form}` is replaced by the verb form. */
export const BANTER = {
  start: ['Luna: “Ready when you are. I have been practising my verbs all night.”', 'Leo: “Go on, show Luna how it is done!”', 'Bonchita: “First to ten wins the bone. No pressure.”'],
  meFirst: ['Leo: “Faster than a squirrel!”', 'Bonchita: “Luna did not even see that coming.”', 'Luna: “Hmph. Lucky guess.”', 'Leo: “That is how you conjugate!”'],
  lunaFirst: ['Luna: “{form}! Too slow, friend.”', 'Luna: “Paws are quicker than fingers.”', 'Bonchita: “Luna got that one. Next!”', 'Luna: “{form}. Easy peasy.”'],
  lunaWrong: ['Luna: “Oops, my paw slipped.”', 'Leo: “Ha! Luna got it wrong. Your turn.”', 'Luna: “That was a test. You passed.”'],
  meWrong: ['Bonchita: “Not quite. Try the next one!”', 'Leo: “Shake it off.”', 'Luna: “Want me to show you?”'],
  nobody: ['Leo: “Nobody? It was {form}.”', 'Bonchita: “A tough one: {form}.”'],
  win: ['Leo: “The bone is yours! 🦴”', 'Luna: “Well played. Rematch?”', 'Bonchita: “What a duel!”'],
  lose: ['Luna: “The bone is mine! 🦴 Rematch?”', 'Leo: “So close. Again!”', 'Bonchita: “Luna was on fire. Next time.”'],
} as const

export function banter(kind: keyof typeof BANTER, rng: Rng, form = ''): string {
  return rng.pick(BANTER[kind]).replace('{form}', form)
}
