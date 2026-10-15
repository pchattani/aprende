import { describe, it, expect } from 'vitest'
import { load } from 'js-yaml'
import { Reader } from '@/engine/schema'

describe('reader schema', () => {
  it('keeps a glossary gloss whole when it has unquoted commas', () => {
    const raw = load(`
id: r.a1.x
level: a1
title: X
kind: text
paragraphs: [{ es: Hola., en: Hello. }]
glossary:
  - { es: excursión, en: trip, excursion }
  - { es: casa, en: "house, home" }
`)
    const r = Reader.parse(raw)
    expect(r.glossary).toEqual([{ es: 'excursión', en: 'trip, excursion' }, { es: 'casa', en: 'house, home' }])
  })
})
