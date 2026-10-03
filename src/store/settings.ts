import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Settings {
  sound: boolean
  ttsRate: number
  voiceURI?: string
  speech: boolean
  theme: 'system' | 'light' | 'dark'
  /** Daily practice goal in minutes. */
  dailyMinutes: number
  variety: 'es-ES' | 'es-419'
  setSound: (v: boolean) => void
  setTtsRate: (v: number) => void
  setVoice: (v?: string) => void
  setSpeech: (v: boolean) => void
  setTheme: (v: Settings['theme']) => void
  setDailyMinutes: (v: number) => void
  setVariety: (v: Settings['variety']) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      sound: true,
      ttsRate: 0.95,
      voiceURI: undefined,
      speech: true,
      theme: 'system',
      dailyMinutes: 10,
      variety: 'es-ES',
      setSound: (sound) => set({ sound }),
      setTtsRate: (ttsRate) => set({ ttsRate }),
      setVoice: (voiceURI) => set({ voiceURI }),
      setSpeech: (speech) => set({ speech }),
      setTheme: (theme) => set({ theme }),
      setDailyMinutes: (dailyMinutes) => set({ dailyMinutes }),
      setVariety: (variety) => set({ variety }),
    }),
    { name: 'aprende-settings' },
  ),
)

export function applyTheme(theme: Settings['theme']): void {
  if (typeof document === 'undefined') return
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}
