import { describe, it, expect, vi, beforeEach } from 'vitest'
import { speakSequence, speak } from '@/engine/speech'

const spoken: { text: string; rate: number }[] = []
beforeEach(() => {
  spoken.length = 0
  class Utterance {
    text: string
    rate = 1
    lang = ''
    voice: unknown
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(t: string) { this.text = t }
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  vi.stubGlobal('speechSynthesis', {
    cancel: () => {},
    getVoices: () => [],
    speak: (u: Utterance) => { spoken.push({ text: u.text, rate: u.rate }); setTimeout(() => u.onend?.(), 0) },
  })
})

describe('word-by-word slow speech', () => {
  it('speaks each word separately at the given rate', async () => {
    await speakSequence(['Tiene', 'doce', 'años.'], { rate: 0.5 }, 1)
    expect(spoken).toEqual([{ text: 'Tiene', rate: 0.5 }, { text: 'doce', rate: 0.5 }, { text: 'años.', rate: 0.5 }])
  })
  it('stops the sequence when something else is spoken', async () => {
    const seq = speakSequence(['uno', 'dos', 'tres'], { rate: 0.5 }, 20)
    await new Promise((r) => setTimeout(r, 5))
    await speak('hola')
    await seq
    expect(spoken.map((s) => s.text)).toEqual(['uno', 'hola'])
  })
})
