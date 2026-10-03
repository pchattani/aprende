import { create } from 'zustand'

/** UI state for the current session: `immersive` hides the tab bar while an exercise session runs. */
interface SessionState {
  immersive: boolean
  setImmersive: (v: boolean) => void
}

export const useSession = create<SessionState>((set) => ({
  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
}))
