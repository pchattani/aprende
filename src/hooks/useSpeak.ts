import { useCallback } from 'react'
import { useSettings } from '../store/settings'
import { languagePack } from '@lang'
import { speak, speakSequence, ttsSupported, type SpeakOptions } from '../engine/speech'
import { pack } from '../engine/loader'

/** The words of a text for slow playback: split on spaces, or by the language's segmenter when there are none (Cantonese). */
export function slowParts(text: string): string[] {
  const spaced = text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
  return spaced.length > 1 ? spaced : languagePack.words(text)
}

/**
 * Speak target-language text with the user's voice settings. `slow` is half the chosen rate, one word at a time with a gap;
 * `'slower'` is under a third of it (single words in listening games, where half speed still sounds quick).
 * `voice` overrides the voice or pitch for this line (a second speaker in a dialogue); `rateScale` nudges the rate.
 */
export function useSpeak() {
  const rate = useSettings((s) => s.ttsRate)
  const voiceURI = useSettings((s) => s.voiceURI)
  const sound = useSettings((s) => s.sound)
  const say = useCallback(
    (text: string, slow: boolean | 'slower' = false, voice: { voiceURI?: string; pitch?: number; rateScale?: number } = {}) => {
      if (!sound || !ttsSupported()) return Promise.resolve()
      const r = rate * (voice.rateScale ?? 1)
      const opts: SpeakOptions = { lang: pack.tts.lang, rate: slow ? Math.max(0.1, r * (slow === 'slower' ? 0.3 : 0.5)) : r, voiceURI: voice.voiceURI ?? voiceURI, preferred: pack.tts.preferredVoices, pitch: voice.pitch }
      const parts = slow ? slowParts(text) : []
      return parts.length > 1 ? speakSequence(parts, opts) : speak(text, opts)
    },
    [rate, voiceURI, sound],
  )
  return { say, supported: ttsSupported() && sound }
}
