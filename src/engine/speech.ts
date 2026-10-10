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
interface RecognitionResultList {
  length: number
  [i: number]: { isFinal: boolean; length: number; [j: number]: { transcript: string; confidence: number } }
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onaudiostart?: (() => void) | null
}
function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}
export function sttSupported(): boolean {
  return recognitionCtor() !== undefined
}

/** iOS home-screen apps (standalone PWAs) cannot use speech recognition even though the API exists. */
export function isIosStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  return ios && (nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)
}

export type ListenError = 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'unsupported' | 'aborted' | 'other'

export interface ListenResult {
  transcript: string
  alternatives: string[]
  error?: ListenError
}

/** A short explanation for each recognition failure, with what to do next. */
export function listenErrorMessage(e: ListenError): string {
  switch (e) {
    case 'not-allowed':
      return isIosStandalone()
        ? 'Speech recognition does not work in iPhone home-screen apps. Open the course in Safari to use the microphone, or tap “I said it”.'
        : 'Microphone access is blocked. Allow the microphone for this site in your browser settings (and Siri & Dictation on iPhone), then try again.'
    case 'no-speech':
      return "I didn't hear anything. Tap the microphone, wait for the red light, and speak clearly."
    case 'audio-capture':
      return 'No microphone was found. Check that one is connected and not used by another app.'
    case 'network':
      return 'Speech recognition needs an internet connection in this browser. Try again online, or tap “I said it”.'
    case 'unsupported':
      return 'Speech recognition is not available in this browser. Chrome, Edge and Safari support it.'
    case 'aborted':
      return 'Listening stopped. Tap the microphone to try again.'
    default:
      return 'Something went wrong with speech recognition. Try again, or tap “I said it”.'
  }
}

/** Ask for microphone permission up front so the browser shows its prompt; releases the stream at once. */
export async function ensureMicPermission(): Promise<ListenError | undefined> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return undefined
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return undefined
  } catch (e) {
    const name = (e as { name?: string }).name
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'not-allowed'
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'audio-capture'
    return undefined // let recognition try anyway
  }
}

function mapError(code: string): ListenError {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'not-allowed'
  if (code === 'no-speech') return 'no-speech'
  if (code === 'audio-capture') return 'audio-capture'
  if (code === 'network') return 'network'
  if (code === 'aborted') return 'aborted'
  return 'other'
}

let active: SpeechRecognitionLike | undefined

/**
 * Listen once. `onInterim` receives the live transcript while the learner speaks.
 * Resolves with the final transcript and alternatives, or an error code.
 */
export function listenOnce(lang = 'es-ES', timeoutMs = 10000, onInterim?: (text: string) => void): Promise<ListenResult> {
  const Ctor = recognitionCtor()
  if (!Ctor) return Promise.resolve({ transcript: '', alternatives: [], error: 'unsupported' })
  active?.abort()
  return new Promise((resolve) => {
    const rec = new Ctor()
    active = rec
    rec.lang = lang
    rec.interimResults = true
    rec.maxAlternatives = 5
    rec.continuous = false
    let done = false
    let finalAlts: string[] = []
    let interim = ''
    let error: ListenError | undefined
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (active === rec) active = undefined
      const alts = finalAlts.length ? finalAlts : interim ? [interim] : []
      resolve({ transcript: alts[0] ?? '', alternatives: alts, error: alts.length ? undefined : error ?? 'no-speech' })
    }
    const timer = setTimeout(() => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
      setTimeout(finish, 600)
    }, timeoutMs)
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]!
        if (r.isFinal) {
          finalAlts = []
          for (let j = 0; j < r.length; j++) finalAlts.push(r[j]!.transcript.trim())
        } else text += r[0]!.transcript
      }
      interim = (finalAlts[0] ?? text).trim()
      onInterim?.(interim)
    }
    rec.onerror = (e) => {
      error = mapError(e.error)
    }
    rec.onend = () => finish()
    try {
      rec.start()
    } catch {
      error = 'other'
      finish()
    }
  })
}

export function stopListening(): void {
  try {
    active?.stop()
  } catch {
    /* ignore */
  }
}
