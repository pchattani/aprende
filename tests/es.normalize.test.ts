import { describe, it, expect } from 'vitest'
import { normalize, stripAccents, match, editDistance } from '@/lang/es/normalize'
import { tokenize } from '@/lang/es/tokenize'

describe('stripAccents', () => {
  it('removes vowel accents but keeps ñ', () => {
    expect(stripAccents('canción')).toBe('cancion')
    expect(stripAccents('año')).toBe('año')
    expect(stripAccents('pingüino')).toBe('pinguino')
    expect(stripAccents('ÑANDÚ')).toBe('ÑANDU')
  })
})

describe('normalize', () => {
  it('lowercases, strips punctuation and collapses spaces', () => {
    expect(normalize('¿Cómo   estás?')).toBe('cómo estás')
    expect(normalize('¡Hola, Juan!')).toBe('hola juan')
    expect(normalize('  El  niño.  ')).toBe('el niño')
  })
  it('optionally strips accents', () => {
    expect(normalize('¿Cómo estás?', { accentInsensitive: true })).toBe('como estas')
  })
})

describe('match', () => {
  it('accepts exact answers ignoring case and punctuation', () => {
    expect(match('hola, ¿cómo estás?', ['Hola, ¿cómo estás?']).verdict).toBe('correct')
    expect(match('Hola como estas', ['Hola, ¿cómo estás?']).verdict).toBe('almost')
  })
  it('accepts alternatives', () => {
    expect(match('buenos dias', ['Buenos días', 'Buen día']).verdict).toBe('almost')
    expect(match('buen día', ['Buenos días', 'Buen día']).verdict).toBe('correct')
  })
  it('flags accent-only mistakes as almost with a note', () => {
    const r = match('el nino come', ['El niño come'])
    expect(r.verdict).toBe('wrong') // ñ is not an accent
    const r2 = match('la cancion es bonita', ['La canción es bonita'])
    expect(r2.verdict).toBe('almost')
    expect(r2.notes[0]).toMatch(/canción/)
  })
  it('tolerates one typo in a long word only', () => {
    expect(match('me gusta la bibloteca', ['Me gusta la biblioteca']).verdict).toBe('almost')
    expect(match('me gustan la biblioteca', ['Me gusta la biblioteca']).verdict).toBe('wrong')
    expect(match('el gato es negra', ['El gato es negro']).verdict).toBe('wrong') // short word, grammar error
  })
  it('rejects wrong answers and empty input', () => {
    expect(match('', ['Hola']).verdict).toBe('wrong')
    expect(match('adiós', ['Hola']).verdict).toBe('wrong')
  })
})

describe('editDistance', () => {
  it('counts transpositions as one edit', () => {
    expect(editDistance('casa', 'caas')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('abc', 'xyz')).toBe(3)
  })
})

describe('tokenize', () => {
  it('splits words, numbers, spaces and punctuation', () => {
    const t = tokenize('¿Tienes 2 niños?')
    expect(t.map((x) => [x.text, x.kind])).toEqual([
      ['¿', 'punct'], ['Tienes', 'word'], [' ', 'space'], ['2', 'number'], [' ', 'space'], ['niños', 'word'], ['?', 'punct'],
    ])
    expect(t[1]!.start).toBe(1)
    expect(t[1]!.end).toBe(7)
  })
})
