/**
 * Tiny synthesized feedback sounds via the Web Audio API (no audio files), and light haptics.
 * Both respect the learner's settings (Sounds, Vibration), so callers never need to check.
 */
import { useSettings } from '../store/settings'

export type SoundKind = 'correct' | 'wrong' | 'combo' | 'tap' | 'finish'

let ctx: AudioContext | undefined
function audio(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return undefined
  ctx ??= new Ctor()
  return ctx
}

let master: GainNode | undefined
/** A shared output with a gentle compressor so stacked sounds never clip. */
function out(ac: AudioContext): AudioNode {
  if (master && master.context === ac) return master
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  master = ac.createGain()
  master.gain.value = 0.9
  master.connect(comp).connect(ac.destination)
  return master
}

interface Tone {
  freq: number
  /** Seconds after the sound starts. */
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
  /** Glide to this frequency over the note. */
  to?: number
  /** Soften with a low-pass filter at this cutoff (Hz). */
  lp?: number
}

function tone(ac: AudioContext, t0: number, { freq, at, dur, type = 'sine', gain = 0.16, to, lp }: Tone) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  const start = t0 + at
  o.frequency.setValueAtTime(freq, start)
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + dur)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.012, dur / 3))
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  let node: AudioNode = o
  if (lp) {
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lp
    node = node.connect(f)
  }
  node.connect(g).connect(out(ac))
  o.start(start)
  o.stop(start + dur + 0.03)
}

let noise: AudioBuffer | undefined
/** Filtered noise swept through a band-pass: a gust of wind. */
function whoosh(ac: AudioContext, t0: number, dur: number, from: number, to: number, gain: number) {
  if (!noise || noise.sampleRate !== ac.sampleRate) {
    const len = Math.ceil(ac.sampleRate * 0.6)
    noise = ac.createBuffer(1, len, ac.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }
  const src = ac.createBufferSource()
  src.buffer = noise
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.4
  bp.frequency.setValueAtTime(from, t0)
  bp.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.45)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(bp).connect(g).connect(out(ac))
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

const SOUNDS: Record<SoundKind, (ac: AudioContext, t: number) => void> = {
  // a bright two-step chime with a soft bell overtone
  correct: (ac, t) => {
    tone(ac, t, { freq: 784, at: 0, dur: 0.12, type: 'triangle', gain: 0.14 })
    tone(ac, t, { freq: 1175, at: 0.075, dur: 0.26, type: 'triangle', gain: 0.15 })
    tone(ac, t, { freq: 2350, at: 0.075, dur: 0.2, gain: 0.03 })
  },
  // a soft, low "hm-mm": two muffled notes falling, never a buzzer
  wrong: (ac, t) => {
    tone(ac, t, { freq: 330, at: 0, dur: 0.14, type: 'triangle', gain: 0.1, lp: 900 })
    tone(ac, t, { freq: 262, at: 0.11, dur: 0.24, type: 'triangle', gain: 0.09, to: 247, lp: 800 })
  },
  // a gust of wind sweeping up, with a little rising sparkle on top
  combo: (ac, t) => {
    whoosh(ac, t, 0.42, 380, 2600, 0.22)
    tone(ac, t, { freq: 988, at: 0.16, dur: 0.1, gain: 0.07 })
    tone(ac, t, { freq: 1319, at: 0.23, dur: 0.1, gain: 0.07 })
    tone(ac, t, { freq: 1976, at: 0.3, dur: 0.22, gain: 0.06 })
  },
  // a tiny wooden click
  tap: (ac, t) => {
    tone(ac, t, { freq: 1600, at: 0, dur: 0.035, type: 'triangle', gain: 0.06, to: 900 })
  },
  // a little fanfare
  finish: (ac, t) => {
    const notes: [number, number, number][] = [[523, 0, 0.11], [659, 0.1, 0.11], [784, 0.2, 0.11], [1047, 0.3, 0.32]]
    for (const [freq, at, dur] of notes) {
      tone(ac, t, { freq, at, dur, type: 'triangle', gain: 0.13 })
      tone(ac, t, { freq: freq * 2, at, dur: dur * 0.8, gain: 0.025 })
    }
    whoosh(ac, t + 0.28, 0.4, 1200, 4000, 0.05)
  },
}

export function playSound(kind: SoundKind): void {
  if (!useSettings.getState().sound) return
  const ac = audio()
  if (!ac) return
  try {
    if (ac.state === 'suspended') void ac.resume()
    SOUNDS[kind](ac, ac.currentTime + 0.005)
  } catch {
    /* ignore audio errors */
  }
}

const BUZZ = { correct: 14, combo: [10, 40, 18], tap: 6 } satisfies Record<string, number | number[]>

/** A light haptic tap, when the device supports it and Vibration is on in Settings. */
export function buzz(kind: keyof typeof BUZZ): void {
  if (!useSettings.getState().vibration) return
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(BUZZ[kind])
  } catch {
    /* ignore */
  }
}
