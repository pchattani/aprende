import { describe, it, expect } from 'vitest'
import { grade, matchSpanish, matchEnglish } from '@/engine/grade'
import { spanish } from '@/lang/es'
import type { Exercise } from '@/engine/types'

const deps = { pack: spanish, isWord: (w: string) => ['gusta', 'gustan', 'casa', 'como', 'cómo', 'estas', 'estás'].includes(w.toLowerCase()) }
const typeEs = (answers: string[]): Exercise => ({ kind: 'typeEs', items: [], grammar: [], prompt: '', answers })

describe('numbers in answers', () => {
  it('accepts digits for Spanish number words and vice versa', () => {
    expect(grade(typeEs(['Tengo quince años.']), 'Tengo 15 años', deps).verdict).toBe('correct')
    expect(grade(typeEs(['Tengo 15 años.']), 'tengo quince años', deps).verdict).toBe('correct')
    expect(grade(typeEs(['Son las tres y media.']), 'son las 3 y media', deps).verdict).toBe('correct')
    expect(grade(typeEs(['Tengo quince años.']), 'Tengo 16 años', deps).verdict).toBe('wrong')
  })
  it('leaves articles alone', () => {
    expect(grade(typeEs(['una casa']), '1 casa', deps).verdict).toBe('wrong')
    expect(grade(typeEs(['una casa']), 'una casa', deps).verdict).toBe('correct')
  })
  it('accepts digits in English answers', () => {
    expect(matchEnglish('I am 15', ['I am fifteen.']).verdict).toBe('correct')
    expect(matchEnglish('I am fifteen years old', ['I am 15 years old.']).verdict).toBe('correct')
    expect(matchEnglish('I am 14', ['I am fifteen.']).verdict).toBe('wrong')
  })
})

describe('leniency', () => {
  it('counts missing accents as correct with a reminder (translation)', () => {
    const r = grade(typeEs(['¿Cómo estás?']), 'como estas', deps)
    expect(r.verdict).toBe('correct')
    expect(r.lenient).toBe('accents')
    expect(r.notes.join(' ')).toMatch(/accent/i)
  })
  it('keeps dictation strict about accents', () => {
    const ex: Exercise = { kind: 'dictation', items: [], grammar: [], prompt: '', audio: '¿Cómo estás?', answers: ['¿Cómo estás?'] }
    expect(grade(ex, 'como estas', deps).verdict).toBe('almost')
  })
  it('forgives one typo in translation but not a real-word grammar slip', () => {
    expect(grade(typeEs(['Me gustan los perros.']), 'Me gustann los perros', deps).verdict).toBe('correct')
    expect(grade(typeEs(['Me gustan los perros.']), 'Me gusta los perros', deps).verdict).toBe('wrong')
  })
  it('ignores capitalisation and punctuation', () => {
    expect(grade(typeEs(['¡Hola, buenos días!']), 'hola buenos dias', deps).verdict).toBe('correct')
  })
  it('matchSpanish reports the matched answer for numeric variants', () => {
    const m = matchSpanish('tengo 15 años', ['Tengo quince años.', 'Yo tengo quince años.'], deps)
    expect(m.verdict).toBe('correct')
    expect(m.matched).toBe('Tengo quince años.')
  })
  it('English typos and optional articles count as correct', () => {
    const ex: Exercise = { kind: 'typeEn', items: [], grammar: [], prompt: '', answers: ['The house is small.'] }
    expect(grade(ex, 'house is small', deps).verdict).toBe('correct')
    expect(grade(ex, 'the house is smal', deps).verdict).toBe('correct')
    expect(grade(ex, 'the house is big', deps).verdict).toBe('wrong')
  })
})

describe('English synonyms shared by every course', () => {
  it('accepts smart for intelligent and pretty for beautiful, both ways', async () => {
    const { equivEn } = await import('@/hooks/useDeps')
    expect(matchEnglish('She is smart.', ['She is intelligent.'], equivEn).verdict).toBe('correct')
    expect(matchEnglish('He is intelligent', ['He is smart.'], equivEn).verdict).toBe('correct')
    expect(matchEnglish('The house is pretty.', ['The house is beautiful.'], equivEn).verdict).toBe('correct')
    expect(matchEnglish('a beautiful city', ['a pretty city'], equivEn).verdict).toBe('correct')
    expect(matchEnglish('She is tall.', ['She is intelligent.'], equivEn).verdict).toBe('wrong')
  })
})
