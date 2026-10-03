import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Settings {
  sound: boolean
  ttsRate: number
  voiceURI?: string
  speech: boolean
  theme: 'system' | 'light' | 'dark'
  dailyGoal: number
  hearts: boolean
  variety: 'es-ES' | 'es-419'
  setSound: (v: boolean) => void
  setTtsRate: (v: number) => void
  setVoice: (v?: string) => void
  setSpeech: (v: boolean) => void
  setTheme: (v: Settings['theme']) => void
  setDailyGoal: (v: number) => void
  setHearts: (v: boolean) => void
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
      dailyGoal: 30,
      hearts: true,
      variety: 'es-ES',
      setSound: (sound) => set({ sound }),
      setTtsRate: (ttsRate) => set({ ttsRate }),
      setVoice: (voiceURI) => set({ voiceURI }),
      setSpeech: (speech) => set({ speech }),
      setTheme: (theme) => set({ theme }),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      setHearts: (hearts) => set({ hearts }),
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
