/** Helpers shared by the Palabras games: best scores, minutes, audio availability and the e2e hook. */
import { useEffect, useState } from 'react'
import { bumpDay, getKv, setKv } from '../../db/progress'
import { todayKey } from '../../engine/mastery'
import { targetVoices, ttsSupported } from '../../engine/speech'
import { pack } from '../../engine/loader'
import { useSettings } from '../../store/settings'
import { isE2E } from '../../components/game/motion'

export interface Best {
  memoryMs?: number
  rapid?: number
  /** Fastest crossword solved without revealing a letter. */
  crosswordMs?: number
  /** Crosswords finished. */
  crosswords?: number
  listenPick?: number
  listenType?: number
  soundMatch?: number
}
export const BEST_KEY = 'palabrasBest'

export async function updateBest(f: (b: Best) => Best): Promise<void> {
  const b = await getKv<Best>(BEST_KEY, {})
  await setKv(BEST_KEY, f(b))
}

/** Add the time spent playing to today's minutes (at least one). */
export async function addMinutes(ms: number): Promise<void> {
  await bumpDay(todayKey(), { minutes: Math.max(1, Math.round(ms / 60000)) })
}

/** 42.3 s, or 1:05 from a minute on. */
export function formatTime(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** End-to-end tests read the answers here (window.__palabras), since they cannot hear the audio. */
export function e2eHook(name: string, value: unknown): void {
  if (!isE2E()) return
  const w = window as unknown as { __palabras?: Record<string, unknown> }
  w.__palabras = { ...w.__palabras, [name]: value }
}

export type Audio = 'ok' | 'unsupported' | 'muted'
/** Whether the listening games can play: speech synthesis exists and sound is on. */
export function useAudio(): Audio {
  const sound = useSettings((s) => s.sound)
  if (!ttsSupported()) return 'unsupported'
  return sound ? 'ok' : 'muted'
}

/** True once voices have loaded and none speaks the course language (they load asynchronously). */
export function useNoVoice(): boolean {
  const [none, setNone] = useState(false)
  useEffect(() => {
    if (!ttsSupported()) return
    const check = () => setNone(window.speechSynthesis.getVoices().length > 0 && targetVoices(pack.tts.lang).length === 0)
    check()
    window.speechSynthesis.addEventListener?.('voiceschanged', check)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', check)
  }, [])
  return none
}

export type ListenMode = 'pick' | 'type'
export const LISTEN_ROUND = 10
export const LISTEN_LABEL: Record<ListenMode, string> = { pick: 'Pick the meaning', type: 'Type what you hear' }
