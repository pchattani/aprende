import { describe, it, expect } from 'vitest'
import { check } from '@/lang/es/checker'
import { buildDictionary } from '@/lang/es/inflect'
import { IRREGULAR } from '@/lang/es/verbs'
import type { VocabEntry, ErrorRule } from '@/engine/schema'

const V = (id: string, lemma: string, pos: VocabEntry['pos'], extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id, lemma, pos, en: ['x'], level: 'a1', tags: [], ...extra }) as VocabEntry

const entries: VocabEntry[] = [
  V('w.casa', 'casa', 'noun', { gender: 'f' }),
  V('w.blanco', 'blanco', 'adj'),
  V('w.grande', 'grande', 'adj'),
  V('w.agua', 'agua', 'noun', { gender: 'f' }),
  V('w.problema', 'problema', 'noun', { gender: 'm' }),
  V('w.cancion', 'canción', 'noun', { gender: 'f' }),
  V('w.tener', 'tener', 'verb'),
  V('w.comer', 'comer', 'verb'),
  V('w.ser', 'ser', 'verb'),
  V('w.el', 'el', 'det', { forms: ['el', 'la', 'los', 'las'] }),
  V('w.muy', 'muy', 'adv'),
  V('w.yo', 'yo', 'pron'),
  V('w.que', 'qué', 'pron'),
  V('w.como', 'cómo', 'adv'),
  V('w.estar', 'estar', 'verb'),
  V('w.persona', 'persona', 'noun', { gender: 'f' }),
  V('w.simpatico', 'simpático', 'adj'),
  V('w.bien', 'bien', 'adv'),
  V('w.anos', 'año', 'noun', { gender: 'm' }),
]
const rules: ErrorRule[] = [
  { id: 'ser-age', pattern: '\\b(soy|eres|es|somos|sois|son) \\d+ años\\b', message: 'Age uses tener.', level: 'a1', example: { wrong: 'soy 20 años', right: 'tengo 20 años' } },
]
const deps = { dict: buildDictionary(entries, IRREGULAR), rules, verbs: IRREGULAR }

describe('checker', () => {
  it('accepts a correct sentence', () => {
    expect(check('La casa es muy grande.', deps)).toEqual([])
  })
  it('flags missing ¿', () => {
    const f = check('Cómo estás?', deps)
    expect(f.some((x) => x.code === 'punctuation')).toBe(true)
  })
  it('flags accent errors with the rule', () => {
    const f = check('La cancion es grande.', deps)
    const a = f.find((x) => x.code === 'accent')
    expect(a?.suggestion).toBe('canción')
    expect(a?.message).toMatch(/aguda/)
  })
  it('flags article and adjective agreement', () => {
    const f = check('El casa blanco', deps)
    expect(f.filter((x) => x.code === 'agreement').length).toBe(2)
  })
  it('accepts el agua and el problema', () => {
    expect(check('El agua está muy blanca.', deps).filter((x) => x.code === 'agreement')).toEqual([])
    expect(check('El problema es grande.', deps)).toEqual([])
    expect(check('La problema es grande.', deps).some((x) => x.code === 'agreement')).toBe(true)
  })
  it('flags adjective after adverb', () => {
    expect(check('Una persona muy simpático.', deps).some((x) => x.code === 'agreement')).toBe(true)
  })
  it('flags subject-verb agreement', () => {
    const f = check('Yo tienes una casa.', deps)
    const v = f.find((x) => x.code === 'verb-agreement')
    expect(v?.suggestion).toBe('tengo')
    expect(check('Yo no tengo una casa.', deps).filter((x) => x.code === 'verb-agreement')).toEqual([])
  })
  it('applies learner-error rules', () => {
    const f = check('Soy 20 años.', deps)
    expect(f.some((x) => x.code === 'learner-error')).toBe(true)
  })
  it('suggests spelling fixes', () => {
    const f = check('La csaa es grande.', deps)
    expect(f.find((x) => x.code === 'spelling')?.suggestion).toBe('casa')
  })
})
