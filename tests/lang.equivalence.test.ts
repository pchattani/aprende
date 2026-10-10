import { describe, it, expect } from 'vitest'
import { buildEquivalence, canonicalize, equivalent } from '@/lang/equivalence'
import { spanishSynonymGroups, englishSynonymGroups } from '@/engine/loader'
import { grade, type GradeDeps } from '@/engine/grade'
import { spanish } from '@/lang/es'
import type { TypeExercise } from '@/engine/types'

const eqEs = buildEquivalence(spanishSynonymGroups())
const eqEn = buildEquivalence(englishSynonymGroups)
const deps: GradeDeps = { pack: spanish, canonEs: (t) => canonicalize(t, eqEs, 'es'), canonEn: (t) => canonicalize(t, eqEn, 'en') }
const typeEs = (answers: string[]): TypeExercise => ({ kind: 'typeEs', items: [], grammar: [], prompt: '', answers })
const typeEn = (answers: string[]): TypeExercise => ({ kind: 'typeEn', items: [], grammar: [], prompt: '', answers })

describe('equivalence canonicalisation', () => {
  it('maps regional synonyms and multi-word phrases to one form', () => {
    expect(canonicalize('Tengo un carro nuevo', eqEs)).toBe('tengo un coche nuevo')
    expect(canonicalize('Mi celular no tiene batería', eqEs)).toBe('mi móvil no tiene batería')
    expect(canonicalize('Vivo en un departamento', eqEs)).toBe('vivo en un piso')
    expect(equivalent('Echo de menos a mi familia', 'Extraño a mi familia', eqEs)).toBe(true)
  })
  it('drops optional subject pronouns and emphatic a mí', () => {
    expect(equivalent('Yo tengo dos hermanos', 'Tengo dos hermanos', eqEs)).toBe(true)
    expect(equivalent('A mí me gusta el café', 'Me gusta el café', eqEs)).toBe(true)
    // the article "el" is never stripped
    expect(canonicalize('El coche es rojo', eqEs)).toBe('el coche es rojo')
  })
  it('uses vocabulary es-419 variants automatically', () => {
    expect(equivalent('Quiero un jugo de naranja', 'Quiero un zumo de naranja', eqEs)).toBe(true)
  })
  it('folds English spelling and vocabulary variants', () => {
    expect(equivalent('my favourite colour', 'my favorite color', eqEn, 'en')).toBe(true)
    expect(equivalent('I live in a flat', 'I live in an apartment', eqEn, 'en')).toBe(true)
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
  it('accepts British spelling in English answers', () => {
    expect(grade(typeEn(['My favorite color is red.']), 'my favourite colour is red', deps).verdict).toBe('correct')
  })
})
