import { describe, it, expect } from 'vitest'
import { pluralize, adjectiveForms, inflections } from '@/lang/es/inflect'
import { IRREGULAR } from '@/lang/es/verbs'
import type { VocabEntry } from '@/engine/schema'

describe('pluralize', () => {
  const cases: [string, string][] = [
    ['casa', 'casas'], ['coche', 'coches'], ['sofá', 'sofás'], ['café', 'cafés'], ['rubí', 'rubíes'],
    ['luz', 'luces'], ['lápiz', 'lápices'], ['canción', 'canciones'], ['examen', 'exámenes'], ['joven', 'jóvenes'],
    ['rey', 'reyes'], ['ciudad', 'ciudades'], ['autobús', 'autobuses'], ['mes', 'meses'], ['lunes', 'lunes'],
    ['crisis', 'crisis'], ['árbol', 'árboles'], ['imagen', 'imágenes'], ['pez', 'peces'], ['actriz', 'actrices'],
    ['país', 'países'], ['fin de semana', 'fines de semana'], ['feliz', 'felices'], ['inglés', 'ingleses'],
  ]
  for (const [s, p] of cases) {
    it(`${s} -> ${p}`, () => expect(pluralize(s)[0]).toBe(p))
  }
})

describe('adjectiveForms', () => {
  it('o-adjectives', () => expect(adjectiveForms('rojo').sort()).toEqual(['roja', 'rojas', 'rojo', 'rojos']))
  it('invariant', () => expect(adjectiveForms('grande').sort()).toEqual(['grande', 'grandes']))
  it('-or', () => expect(adjectiveForms('trabajador')).toContain('trabajadora'))
  it('mejor is invariant', () => expect(adjectiveForms('mejor')).toEqual(['mejor', 'mejores']))
  it('nationalities', () => {
    expect(adjectiveForms('español', { nationality: true }).sort()).toEqual(['español', 'española', 'españolas', 'españoles'])
    expect(adjectiveForms('francés', { nationality: true })).toContain('francesa')
    expect(adjectiveForms('alemán', { nationality: true })).toContain('alemana')
    expect(adjectiveForms('alemán', { nationality: true })).toContain('alemanes')
  })
})

describe('inflections', () => {
  const base = { level: 'a1', tags: [] as string[] } as const
  it('verbs include all conjugated forms', () => {
    const e: VocabEntry = { id: 'w.tener', lemma: 'tener', pos: 'verb', en: ['to have'], ...base, tags: [] }
    const f = inflections(e, IRREGULAR)
    expect(f).toContain('tengo')
    expect(f).toContain('tuvieron')
    expect(f).toContain('tendríamos')
    expect(f).toContain('tenido')
    expect(f).toContain('ten')
  })
  it('reflexive verbs use the base verb', () => {
    const e: VocabEntry = { id: 'w.levantarse', lemma: 'levantarse', pos: 'verb', en: ['to get up'], ...base, tags: [] }
    expect(inflections(e, IRREGULAR)).toContain('levanto')
  })
  it('nouns with explicit forms', () => {
    const e: VocabEntry = { id: 'w.el', lemma: 'el', pos: 'det', en: ['the'], forms: ['el', 'la', 'los', 'las'], ...base, tags: [] }
    expect(inflections(e, IRREGULAR).sort()).toEqual(['el', 'la', 'las', 'los'])
  })
  it('phrases register their words', () => {
    const e: VocabEntry = { id: 'w.buenos-dias', lemma: 'buenos días', pos: 'phrase', en: ['good morning'], ...base, tags: [] }
    expect(inflections(e, IRREGULAR)).toEqual(expect.arrayContaining(['buenos días', 'buenos', 'días']))
  })
})
