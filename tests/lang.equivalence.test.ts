import { describe, it, expect } from 'vitest'
import { buildEquivalence, canonicalize, equivalent, compareEquivalent, expandAnswers, typoMatch } from '@/lang/equivalence'
import { spanishSynonymGroups, englishSynonymGroups } from '@/engine/loader'
import { grade, type GradeDeps } from '@/engine/grade'
import { spanish } from '@/lang/es'
import type { TypeExercise } from '@/engine/types'

const eqEs = buildEquivalence(spanishSynonymGroups())
const eqEn = buildEquivalence(englishSynonymGroups)
const isWord = (w: string) => ['gusta', 'gustan', 'tengo', 'casa', 'coche', 'rojo', 'roja', 'una', 'un'].includes(w.toLowerCase())
const deps: GradeDeps = { pack: spanish, equivEs: (g, e) => compareEquivalent(g, e, eqEs, 'es'), equivEn: (g, e) => compareEquivalent(g, e, eqEn, 'en'), isWord }
const typeEs = (answers: string[]): TypeExercise => ({ kind: 'typeEs', items: [], grammar: [], prompt: '', answers })
const typeEn = (answers: string[]): TypeExercise => ({ kind: 'typeEn', items: [], grammar: [], prompt: '', answers })

describe('equivalence canonicalisation', () => {
  it('maps regional synonyms and multi-word phrases to one form', () => {
    expect(equivalent('Tengo un carro nuevo', 'Tengo un coche nuevo', eqEs)).toBe(true)
    expect(equivalent('Mi celular no tiene batería', 'Mi móvil no tiene batería', eqEs)).toBe(true)
    expect(equivalent('Vivo en un departamento', 'Vivo en un piso', eqEs)).toBe(true)
    expect(equivalent('Echo de menos a mi familia', 'Extraño a mi familia', eqEs)).toBe(true)
    // a word in two groups matches through either
    expect(equivalent('el chico', 'el niño', eqEs)).toBe(true)
    expect(equivalent('un perro chico', 'un perro pequeño', eqEs)).toBe(true)
    expect(equivalent('Tengo un carro nuevo', 'Tengo una casa nueva', eqEs)).toBe(false)
  })
  it('drops optional subject pronouns and emphatic a mí', () => {
    expect(equivalent('Yo tengo dos hermanos', 'Tengo dos hermanos', eqEs)).toBe(true)
    expect(equivalent('A mí me gusta el café', 'Me gusta el café', eqEs)).toBe(true)
    // the article "el" is never stripped
    expect(canonicalize('El coche es rojo', eqEs).startsWith('el ')).toBe(true)
  })
  it('uses vocabulary es-419 variants automatically', () => {
    expect(equivalent('Quiero un jugo de naranja', 'Quiero un zumo de naranja', eqEs)).toBe(true)
  })
  it('folds English spelling and vocabulary variants', () => {
    expect(equivalent('my favourite colour', 'my favorite color', eqEn, 'en')).toBe(true)
    expect(equivalent('I live in a flat', 'I live in an apartment', eqEn, 'en')).toBe(true)
  })
})

describe('answer expansion and typos', () => {
  it('accepts answers with or without bracketed text and either side of a slash', () => {
    expect(expandAnswers(['to be (very) tired'])).toEqual(expect.arrayContaining(['to be (very) tired', 'to be tired', 'to be very tired']))
    expect(expandAnswers(['he/she is tall'])).toEqual(expect.arrayContaining(['he is tall', 'she is tall']))
  })
  it('forgives a small typo unless it forms another real word', () => {
    expect(typoMatch('Me gustann los perros', 'Me gustan los perros', isWord).ok).toBe(true)
    expect(typoMatch('Me gusta los perros', 'Me gustan los perros', isWord).ok).toBe(false)
    expect(typoMatch('Tnego un coche', 'Tengo un coche', isWord).ok).toBe(true)
  })
  it('chau and chao are accepted for adiós', () => {
    expect(equivalent('Chau', 'Adiós', eqEs)).toBe(true)
    expect(equivalent('chao, hasta mañana', 'adiós, hasta mañana', eqEs)).toBe(true)
  })
})

describe('grading with equivalence', () => {
  it('accepts a synonym in a typed Spanish translation and says so', () => {
    const r = grade(typeEs(['Tengo un coche rojo.']), 'Yo tengo un carro rojo', deps)
    expect(r.verdict).toBe('correct')
    expect(r.notes.join(' ')).toMatch(/Another way to say it/)
  })
  it('still rejects a different meaning', () => {
    expect(grade(typeEs(['Tengo un coche rojo.']), 'Tengo una casa roja', deps).verdict).toBe('wrong')
  })
  it('requires the exact form for dictation', () => {
    const ex: TypeExercise = { kind: 'dictation', items: [], grammar: [], prompt: '', answers: ['Tengo un coche rojo.'] }
    expect(grade(ex, 'Tengo un carro rojo', deps).verdict).toBe('wrong')
  })
  it('accepts English answers without the bracketed part and with small typos', () => {
    expect(grade(typeEn(['I am (very) tired.']), 'I am tired', deps).verdict).toBe('correct')
    expect(grade(typeEn(['The museum is closed.']), 'the musuem is closed', deps).verdict).toBe('almost')
  })
  it('accepts a Spanish typo that is not another word, rejects one that is', () => {
    expect(grade(typeEs(['Me gustan los perros.']), 'Me gustann los perros', deps).verdict).toBe('almost')
    expect(grade(typeEs(['Me gustan los perros.']), 'Me gusta los perros', deps).verdict).toBe('wrong')
  })
  it('accepts British spelling in English answers', () => {
    expect(grade(typeEn(['My favorite color is red.']), 'my favourite colour is red', deps).verdict).toBe('correct')
  })
})
