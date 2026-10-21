/**
 * Word rain: target-language words fall in lanes and the learner taps the one that means
 * the English prompt. Pure scheduling only: fall speed and spawn gaps that ramp up gently,
 * which word falls next (the answer comes early in every wave), which lane it takes (never
 * on top of a word that has only just started falling) and the per-frame step. The page
 * renders the state with transforms and owns lives, score and recording.
 */
import type { Rng } from '../random'

export const RAIN_LANES = 3
export const RAIN_LIVES = 3
/** A lane takes a new word once its last one has fallen this far (fractions of the field). */
export const LANE_CLEAR = 0.3

export interface RainDrop {
  /** Unique per drop (React key, DOM lookup). */
  key: number
  /** Vocab id of the falling word. */
  id: string
  lane: number
  /** 0 = top of the field, 1 = landed. */
  y: number
}

export interface RainState {
  /** Seconds played, pauses excluded (drives the ramp). */
  elapsed: number
  drops: RainDrop[]
  /** Seconds until the next word may fall. */
  wait: number
  /** Vocab id the prompt asks for. */
  target: string
  /** Words still to fall for this prompt, in order. */
  queue: string[]
  /** Distractors that refill the queue once it is empty. */
  pool: string[]
  nextKey: number
  /** Lane of the last word that started falling (the next one prefers another). */
  lastLane: number
}

const ramp = (elapsed: number) => Math.min(1, Math.max(0, elapsed) / 150)

/**
 * Fall speed in field heights per second: about 9 s to land at first, 3.8 s after two and a
 * half minutes. Reduced motion falls far slower (22 s, then 14 s).
 */
export function rainSpeed(elapsed: number, reduced = false): number {
  const r = ramp(elapsed)
  return reduced ? 0.045 + 0.025 * r : 0.11 + 0.15 * r
}

/** Seconds between two falling words (shorter as the game speeds up). */
export function spawnGap(elapsed: number, reduced = false): number {
  const r = ramp(elapsed)
  return reduced ? 3.4 - 1.2 * r : 1.8 - 0.8 * r
}

/**
 * The words for one prompt: the answer first or second, then the distractors in a random
 * order. Duplicates and the answer are dropped from the distractors.
 */
export function rainWave(target: string, distractors: readonly string[], rng: Rng): string[] {
  const ds = rng.shuffle([...new Set(distractors)].filter((d) => d !== target))
  const at = ds.length ? rng.int(2) : 0
  return [...ds.slice(0, at), target, ...ds.slice(at)]
}

/**
 * A lane for the next word: one whose words have all fallen past LANE_CLEAR, preferring a
 * different lane from the last one; -1 when every lane is still busy at the top.
 */
export function pickLane(drops: readonly RainDrop[], lanes: number, rng: Rng, last = -1, clear = LANE_CLEAR): number {
  const free: number[] = []
  for (let l = 0; l < lanes; l++) if (drops.every((d) => d.lane !== l || d.y >= clear)) free.push(l)
  if (!free.length) return -1
  const other = free.filter((l) => l !== last)
  return rng.pick(other.length ? other : free)
}

/** A fresh game: nothing on screen, the first word falls almost at once. */
export function startRain(target: string, distractors: readonly string[], rng: Rng): RainState {
  return { elapsed: 0, drops: [], wait: 0.3, target, queue: rainWave(target, distractors, rng), pool: [...distractors], nextKey: 1, lastLane: -1 }
}

/**
 * A new prompt (after a catch or a landed answer): its wave replaces the queue and the
 * next word falls soon. Words already on screen keep falling as distractors.
 */
export function nextPrompt(s: RainState, target: string, distractors: readonly string[], rng: Rng): RainState {
  const onScreen = new Set(s.drops.map((d) => d.id))
  const pool = distractors.filter((d) => d !== target)
  // the answer must not be on screen already (pickPrompt avoids it); its distractors may be
  const queue = rainWave(target, pool, rng).filter((id) => id === target || !onScreen.has(id))
  return { ...s, target, queue, pool, wait: Math.min(s.wait, 0.5) }
}

/** Remove one drop (caught, or tapped wrongly and burst). */
export function removeDrop(s: RainState, key: number): RainState {
  return { ...s, drops: s.drops.filter((d) => d.key !== key) }
}

/**
 * The next prompt: the first candidate that is not on screen, was not asked in the last
 * `gap` prompts and passes `ok` (no synonym of a word still falling). Falls back to any
 * candidate not on screen, then to the first.
 */
export function pickPrompt(candidates: readonly string[], onScreen: ReadonlySet<string>, recent: readonly string[], ok: (id: string) => boolean = () => true, gap = 3): string | undefined {
  const last = new Set(recent.slice(-gap))
  return candidates.find((id) => !onScreen.has(id) && !last.has(id) && ok(id)) ?? candidates.find((id) => !onScreen.has(id) && ok(id)) ?? candidates.find((id) => !onScreen.has(id)) ?? candidates[0]
}

export interface RainStep {
  state: RainState
  /** Drops that reached the ground this frame (already removed from the state). */
  landed: RainDrop[]
  /** A drop that started falling this frame. */
  spawned?: RainDrop
}

/**
 * Advance the game by `dt` seconds (clamped to 0.1 s so a stalled frame never teleports
 * words): move every word down, land the ones that reach the ground and start a new one
 * when it is time and a lane is free. The answer is never on screen twice.
 */
export function stepRain(s: RainState, dt: number, rng: Rng, opts: { lanes?: number; reduced?: boolean } = {}): RainStep {
  const lanes = opts.lanes ?? RAIN_LANES
  const step = Math.min(Math.max(dt, 0), 0.1)
  const elapsed = s.elapsed + step
  const v = rainSpeed(elapsed, opts.reduced) * step
  const moved = s.drops.map((d) => ({ ...d, y: d.y + v }))
  const landed = moved.filter((d) => d.y >= 1)
  let drops = moved.filter((d) => d.y < 1)
  let { queue, nextKey, lastLane } = s
  let wait = s.wait - step
  let spawned: RainDrop | undefined
  if (wait <= 0) {
    const onScreen = new Set(drops.map((d) => d.id))
    // skip words already falling (and the answer while it is on screen); refill from the distractors
    let q = queue.filter((id) => !onScreen.has(id))
    if (!q.length) q = rng.shuffle(s.pool.filter((id) => !onScreen.has(id) && id !== s.target))
    if (!onScreen.has(s.target) && !q.includes(s.target)) q = [s.target, ...q]
    const lane = q.length ? pickLane(drops, lanes, rng, lastLane) : -1
    if (lane < 0) {
      // every lane busy (or nothing to drop): try again shortly
      queue = q
      wait = 0.15
    } else {
      spawned = { key: nextKey, id: q[0]!, lane, y: 0 }
      drops = [...drops, spawned]
      queue = q.slice(1)
      nextKey++
      lastLane = lane
      wait = spawnGap(elapsed, opts.reduced)
    }
  }
  return { state: { ...s, elapsed, drops, wait, queue, nextKey, lastLane }, landed, spawned }
}
