import { describe, it, expect } from 'vitest'
import { numberWordsToDigits, hasNumberWord } from '@/lang/es/numbers'

describe('Spanish number words', () => {
  it('converts simple numbers and compounds', () => {
    expect(numberWordsToDigits('quince')).toBe('15')
    expect(numberWordsToDigits('Tengo quince años.')).toBe('Tengo 15 años.')
    expect(numberWordsToDigits('dieciséis')).toBe('16')
    expect(numberWordsToDigits('veintiún libros')).toBe('21 libros')
    expect(numberWordsToDigits('treinta y cinco')).toBe('35')
    expect(numberWordsToDigits('ciento uno')).toBe('101')
    expect(numberWordsToDigits('doscientas cuarenta y dos personas')).toBe('242 personas')
    expect(numberWordsToDigits('mil novecientos noventa y nueve')).toBe('1999')
    expect(numberWordsToDigits('dos millones trescientos mil')).toBe('2300000')
    expect(numberWordsToDigits('cien')).toBe('100')
    expect(numberWordsToDigits('cero')).toBe('0')
  })
  it('keeps the rest of the sentence intact', () => {
    expect(numberWordsToDigits('Son las tres y media.')).toBe('Son las 3 y media.')
    expect(numberWordsToDigits('Tengo dos perros y tres gatos')).toBe('Tengo 2 perros y 3 gatos')
    expect(numberWordsToDigits('¿Cuántos años tienes? Quince.')).toBe('¿Cuántos años tienes? 15.')
  })
  it('never touches articles or a lone uno inside a sentence', () => {
    expect(numberWordsToDigits('una casa')).toBe('una casa')
    expect(numberWordsToDigits('un perro')).toBe('un perro')
    expect(numberWordsToDigits('Tengo uno.')).toBe('Tengo uno.')
    expect(numberWordsToDigits('uno')).toBe('1')
    expect(numberWordsToDigits('treinta y uno')).toBe('31')
  })
  it('does not fold y between two non-number words', () => {
    expect(numberWordsToDigits('tres y tres')).toBe('3 y 3')
    expect(numberWordsToDigits('y')).toBe('y')
  })
  it('detects number words', () => {
    expect(hasNumberWord('tengo quince años')).toBe(true)
    expect(hasNumberWord('tengo una casa')).toBe(false)
  })
})
