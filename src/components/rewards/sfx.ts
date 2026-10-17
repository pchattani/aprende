/**
 * Reward sounds (coins landing, the chest opening, a level-up fanfare), synthesized with the
 * Web Audio API like engine/sounds.ts and silenced by the Sound setting.
 */
import { useSettings } from '../../store/settings'

let ctx: AudioContext | undefined
function audio(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return undefined
  try {
    ctx ??= new Ctor()
  } catch {
    return undefined
  }
  return ctx
}

type Note = [freq: number, start: number, dur: number, type?: OscillatorType, gain?: number]
const SFX: Record<'coin' | 'chest' | 'levelup' | 'buy', Note[]> = {
  coin: [[1319, 0, 0.05, 'triangle', 0.08], [1976, 0.045, 0.11, 'triangle', 0.07]],
  buy: [[988, 0, 0.06, 'triangle', 0.09], [1319, 0.06, 0.06, 'triangle', 0.09], [1976, 0.12, 0.16, 'triangle', 0.08]],
  chest: [[392, 0, 0.08, 'square', 0.04], [523, 0.08, 0.08, 'square', 0.04], [659, 0.16, 0.08, 'triangle', 0.08], [1047, 0.24, 0.35, 'sine', 0.12]],
  levelup: [[523, 0, 0.12, 'triangle', 0.1], [659, 0.12, 0.12, 'triangle', 0.1], [784, 0.24, 0.12, 'triangle', 0.1], [1047, 0.36, 0.18, 'triangle', 0.11], [784, 0.54, 0.1, 'triangle', 0.08], [1047, 0.64, 0.45, 'sine', 0.13]],
}

export function playReward(kind: keyof typeof SFX): void {
  if (!useSettings.getState().sound) return
  const ac = audio()
  if (!ac) return
  try {
    if (ac.state === 'suspended') void ac.resume()
    for (const [freq, start, dur, type = 'sine', peak = 0.1] of SFX[kind]) {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = type
      o.frequency.value = freq
      const t = ac.currentTime + start
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ac.destination)
      o.start(t)
      o.stop(t + dur + 0.02)
    }
  } catch {
    /* ignore audio errors */
  }
}
