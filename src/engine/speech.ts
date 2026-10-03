/**
 * Browser speech: text-to-speech (speechSynthesis) and speech recognition
 * (webkitSpeechRecognition / SpeechRecognition). Free, on device or by the
 * browser vendor; no API keys. Everything degrades gracefully.
 */

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let voicesCache: SpeechSynthesisVoice[] = []
function loadVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return []
  const v = window.speechSynthesis.getVoices()
  if (v.length) voicesCache = v
  return voicesCache
}
if (ttsSupported()) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

export function spanishVoices(lang = 'es'): SpeechSynthesisVoice[] {
  return loadVoices().filter((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()))
}

export interface SpeakOptions {
  lang?: string
  rate?: number
  voiceURI?: string
  preferred?: string[]
}

export function pickVoice(opts: SpeakOptions): SpeechSynthesisVoice | undefined {
  const voices = loadVoices()
  if (opts.voiceURI) {
    const v = voices.find((x) => x.voiceURI === opts.voiceURI)
    if (v) return v
  }
  const lang = (opts.lang ?? 'es-ES').toLowerCase()
  const exact = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang)
  const any = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.split('-')[0]!))
  for (const name of opts.preferred ?? []) {
    const v = [...exact, ...any].find((x) => x.name.includes(name))
    if (v) return v
  }
  return exact.find((v) => v.localService) ?? exact[0] ?? any.find((v) => v.localService) ?? any[0]
}

export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported()) return Promise.resolve()
  return new Promise((resolve) => {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = opts.lang ?? 'es-ES'
    u.rate = opts.rate ?? 0.95
    const v = pickVoice(opts)
    if (v) u.voice = v
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}
export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

// ---- recognition
type RecognitionCtor = new () => SpeechRecognitionLike
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}
export function sttSupported(): boolean {
  return recognitionCtor() !== undefined
}

export interface ListenResult {
  transcript: string
  alternatives: string[]
}

/** Listen once and resolve with the best transcript (empty on failure). */
export function listenOnce(lang = 'es-ES', timeoutMs = 8000): Promise<ListenResult> {
  const Ctor = recognitionCtor()
  if (!Ctor) return Promise.resolve({ transcript: '', alternatives: [] })
  return new Promise((resolve) => {
    const rec = new Ctor()
    rec.lang = lang
    rec.interimResults = false
    rec.maxAlternatives = 5
    rec.continuous = false
    let done = false
    const finish = (r: ListenResult) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(r)
    }
    const timer = setTimeout(() => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
      finish({ transcript: '', alternatives: [] })
    }, timeoutMs)
    rec.onresult = (e) => {
      const first = e.results[0]
      const alts: string[] = []
      if (first) for (let i = 0; i < first.length; i++) alts.push(first[i]!.transcript)
      finish({ transcript: alts[0] ?? '', alternatives: alts })
    }
    rec.onerror = () => finish({ transcript: '', alternatives: [] })
    rec.onend = () => finish({ transcript: '', alternatives: [] })
    try {
      rec.start()
    } catch {
      finish({ transcript: '', alternatives: [] })
    }
  })
}
