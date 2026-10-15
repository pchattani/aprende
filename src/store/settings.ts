import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SETTINGS_KEY } from '../engine/course'

export interface Settings {
  sound: boolean
  ttsRate: number
  voiceURI?: string
  /** Kept for older saved settings; `speaking` is the source of truth. */
  speech: boolean
  /** How many speaking exercises a session includes. */
  speaking: 'off' | 'some' | 'lots'
  theme: 'system' | 'light' | 'dark'
  /** Daily practice goal in minutes. */
  dailyMinutes: number
  /** Regional variety code from pack.yaml (es-ES, es-419, pt-BR, pt-PT…). */
  variety: string
  /** Exercises per lesson session. */
  sessionLength: 'short' | 'normal' | 'long'
  /** Keep wrong answers for a focused re-test automatically. */
  autoPin: boolean
  /** Modo picante: cheeky, flirty sentences mixed into lessons. */
  spicy: boolean
  setSound: (v: boolean) => void
  setTtsRate: (v: number) => void
  setVoice: (v?: string) => void
  setSpeech: (v: boolean) => void
  setSpeaking: (v: Settings['speaking']) => void
  setSessionLength: (v: Settings['sessionLength']) => void
  setAutoPin: (v: boolean) => void
  setSpicy: (v: boolean) => void
  setTheme: (v: Settings['theme']) => void
  setDailyMinutes: (v: number) => void
  setVariety: (v: string) => void
  /** Show romanisation (Jyutping) above characters. */
  romanization: boolean
  setRomanization: (v: boolean) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      sound: true,
      ttsRate: 0.95,
      voiceURI: undefined,
      speech: true,
      speaking: 'some',
      theme: 'system',
      dailyMinutes: 10,
      variety: '',
      romanization: true,
      sessionLength: 'normal',
      autoPin: true,
      spicy: false,
      setSound: (sound) => set({ sound }),
      setTtsRate: (ttsRate) => set({ ttsRate }),
      setVoice: (voiceURI) => set({ voiceURI }),
      setSpeech: (speech) => set({ speech, speaking: speech ? 'some' : 'off' }),
      setSpeaking: (speaking) => set({ speaking, speech: speaking !== 'off' }),
      setSessionLength: (sessionLength) => set({ sessionLength }),
      setAutoPin: (autoPin) => set({ autoPin }),
      setSpicy: (spicy) => set({ spicy }),
      setTheme: (theme) => set({ theme }),
      setDailyMinutes: (dailyMinutes) => set({ dailyMinutes }),
      setVariety: (variety) => set({ variety }),
      setRomanization: (romanization) => set({ romanization }),
    }),
    {
      name: SETTINGS_KEY,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>
        const speaking = p.speaking ?? (p.speech === false ? 'off' : current.speaking)
        return { ...current, ...p, speaking, speech: speaking !== 'off' }
      },
    },
  ),
)

/** Exercises per session for each length setting. */
export const SESSION_COUNT: Record<Settings['sessionLength'], number> = { short: 9, normal: 12, long: 16 }

export function applyTheme(theme: Settings['theme']): void {
  if (typeof document === 'undefined') return
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}
