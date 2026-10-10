import { describe, it, expect } from 'vitest'
import { explainAnswer, diffWords } from '@/engine/explain'
import { buildDictionary, lookup } from '@/lang/es/inflect'
import { vocab } from '@/engine/loader'
import { IRREGULAR, conjugate } from '@/lang/es/verbs'
import type { TypeExercise, ChoiceExercise } from '@/engine/types'

const dict = buildDictionary(vocab.values(), IRREGULAR)
const deps = { lookup: (w: string) => lookup(dict, w), conjugate }
const typeEs = (a: string): TypeExercise => ({ kind: 'typeEs', items: [], grammar: [], prompt: '', answers: [a] })

describe('explain', () => {
  it('diffs words with replacements, missing and extra words', () => {
    const d = diffWords(['yo', 'tengo', 'un', 'casa'], ['tengo', 'una', 'casa'])
    expect(d.map((t) => t.kind)).toEqual(['extra', 'same', 'wrong', 'same'])
    expect(d[2]!.fix).toBe('una')
  })
  it('explains the verb person', () => {
    const e = explainAnswer(typeEs('Ella habla español.'), 'Ella hablo español', deps)
    expect(e.hints.join(' ')).toMatch(/Verb person: “hablo” is the yo form of hablar/)
  })
  it('explains the article from the noun gender', () => {
    const e = explainAnswer(typeEs('Tengo una casa.'), 'Tengo un casa', deps)
    expect(e.hints.join(' ')).toMatch(/Article: “una”, because “casa” is feminine/)
  })
  it('explains ser vs estar', () => {
    const e = explainAnswer(typeEs('Madrid está en España.'), 'Madrid es en España', deps)
    expect(e.hints.join(' ')).toMatch(/Use estar/)
  })
  it('spots a word-order mistake', () => {
    const e = explainAnswer(typeEs('Tengo un coche rojo.'), 'Tengo un rojo coche', deps)
    expect(e.hints[0]).toMatch(/Right words, different order/)
  })
  it('explains a wrong choice with the meaning', () => {
    const ex: ChoiceExercise = { kind: 'choiceEs', items: [], grammar: [], prompt: 'Hasta luego', options: ['See you later', 'Good morning'], answer: 0 }
    expect(explainAnswer(ex, 1, deps).hints[0]).toMatch(/You picked “Good morning”, but it means “See you later”/)
  })
})
