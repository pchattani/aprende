import { useCallback } from 'react'
import { useSettings } from '../store/settings'
import { speak, ttsSupported } from '../engine/speech'
import { pack } from '../engine/loader'

/** Speak Spanish text with the user's voice settings. `slow` is half the normal rate (never below 0.3). */
export function useSpeak() {
  const rate = useSettings((s) => s.ttsRate)
  const voiceURI = useSettings((s) => s.voiceURI)
  const sound = useSettings((s) => s.sound)
  const say = useCallback(
    (text: string, slow = false) => {
      if (!sound || !ttsSupported()) return Promise.resolve()
      return speak(text, { lang: pack.tts.lang, rate: slow ? Math.max(0.3, rate * 0.5) : rate, voiceURI, preferred: pack.tts.preferredVoices })
    },
    [rate, voiceURI, sound],
  )
  return { say, supported: ttsSupported() && sound }
}
