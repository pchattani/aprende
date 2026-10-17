import { useCallback } from 'react'
import { useSettings } from '../store/settings'
import { languagePack } from '@lang'
import { speak, speakSequence, ttsSupported } from '../engine/speech'
import { pack } from '../engine/loader'

/** The words of a text for slow playback: split on spaces, or by the language's segmenter when there are none (Cantonese). */
export function slowParts(text: string): string[] {
  const spaced = text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
  return spaced.length > 1 ? spaced : languagePack.words(text)
}

/** Speak target-language text with the user's voice settings. `slow` is half the chosen rate, one word at a time with a gap. */
export function useSpeak() {
  const rate = useSettings((s) => s.ttsRate)
  const voiceURI = useSettings((s) => s.voiceURI)
  const sound = useSettings((s) => s.sound)
  const say = useCallback(
    (text: string, slow = false) => {
      if (!sound || !ttsSupported()) return Promise.resolve()
      const opts = { lang: pack.tts.lang, rate: slow ? Math.max(0.1, rate * 0.5) : rate, voiceURI, preferred: pack.tts.preferredVoices }
      const parts = slow ? slowParts(text) : []
      return parts.length > 1 ? speakSequence(parts, opts) : speak(text, opts)
    },
    [rate, voiceURI, sound],
  )
  return { say, supported: ttsSupported() && sound }
}
