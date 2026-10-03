/** Tiny synthesized feedback sounds via the Web Audio API (no audio files). */
let ctx: AudioContext | undefined
function audio(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return undefined
  ctx ??= new Ctor()
  return ctx
}

export function playSound(kind: 'correct' | 'wrong' | 'finish'): void {
  const ac = audio()
  if (!ac) return
  try {
    if (ac.state === 'suspended') void ac.resume()
    const notes = kind === 'correct' ? [[660, 0, 0.09], [880, 0.09, 0.14]] : kind === 'wrong' ? [[220, 0, 0.18], [180, 0.12, 0.2]] : [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.25]]
    for (const [freq, start, dur] of notes as [number, number, number][]) {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = kind === 'wrong' ? 'sawtooth' : 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, ac.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur)
      o.connect(g).connect(ac.destination)
      o.start(ac.currentTime + start)
      o.stop(ac.currentTime + start + dur + 0.02)
    }
  } catch {
    /* ignore audio errors */
  }
}
