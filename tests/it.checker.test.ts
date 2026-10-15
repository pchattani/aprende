import { describe, it, expect } from 'vitest'
import { check, onsetOf, definiteArticle, indefiniteArticle, articulate } from '@/lang/it/checker'
import { buildDictionary } from '@/lang/it/inflect'
import { IRREGULAR } from '@/lang/it/verbs'
import type { VocabEntry, ErrorRule } from '@/engine/schema'

const V = (lemma: string, pos: VocabEntry['pos'], extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id: `w.${lemma}`, lemma, pos, en: ['x'], level: 'a1', tags: [], ...extra }) as VocabEntry

const entries: VocabEntry[] = [
  V('casa', 'noun', { gender: 'f' }), V('libro', 'noun', { gender: 'm' }), V('studente', 'noun', { gender: 'm', feminine: 'studentessa' }),
  V('amico', 'noun', { gender: 'mf' }), V('zaino', 'noun', { gender: 'm' }), V('acqua', 'noun', { gender: 'f' }), V('problema', 'noun', { gender: 'm' }),
  V('città', 'noun', { gender: 'f' }), V('uovo', 'noun', { gender: 'm', plural: 'uova' }), V('psicologo', 'noun', { gender: 'm' }),
  V('aereo', 'noun', { gender: 'm' }), V('ragazza', 'noun', { gender: 'f' }), V('gnomo', 'noun', { gender: 'm' }), V('uomo', 'noun', { gender: 'm' }),
  V('bianco', 'adj'), V('grande', 'adj'), V('bello', 'adj'), V('simpatico', 'adj'), V('rosa', 'adj'), V('italiano', 'adj'), V('alto', 'adj'),
  V('il', 'det', { forms: ['il', 'lo', 'la', 'i', 'gli', 'le'] }), V('un', 'det', { forms: ['un', 'uno', 'una'] }), V('di', 'prep'), V('in', 'prep'),
  V('essere', 'verb'), V('avere', 'verb'), V('andare', 'verb'), V('mangiare', 'verb'), V('arrivare', 'verb'), V('parlare', 'verb'), V('venire', 'verb'),
  V('molto', 'adv'), V('perché', 'conj'), V('e', 'conj'), V('io', 'pron'), V('lui', 'pron'), V('lei', 'pron'), V('noi', 'pron'), V('ieri', 'adv'),
  V('qui', 'adv'), V('vero', 'adj'), V('mio', 'det'), V('non', 'adv'), V('ci', 'pron'), V('dove', 'adv'), V('successo', 'noun', { gender: 'm' }), V('già', 'adv'),
]
const rules: ErrorRule[] = [
  { id: 'essere-age', pattern: '\\b(sono|sei|è|siamo|siete) \\d+ anni\\b', message: 'Age uses avere.', level: 'a1', example: { wrong: 'sono 20 anni', right: 'ho 20 anni' } },
]
const deps = { dict: buildDictionary(entries, IRREGULAR), rules, verbs: IRREGULAR }
const codes = (t: string) => check(t, deps).map((f) => f.code)

describe('article helpers', () => {
  it('classifies word onsets', () => {
    expect(onsetOf('libro')).toBe('cons')
    expect(onsetOf('studente')).toBe('lo')
    expect(onsetOf('zaino')).toBe('lo')
    expect(onsetOf('gnomo')).toBe('lo')
    expect(onsetOf('psicologo')).toBe('lo')
    expect(onsetOf('yogurt')).toBe('lo')
    expect(onsetOf('amico')).toBe('vowel')
    expect(onsetOf('hotel')).toBe('vowel')
  })
  it('chooses the article', () => {
    expect(definiteArticle('m', 'sg', 'libro')).toBe('il')
    expect(definiteArticle('m', 'sg', 'studente')).toBe('lo')
    expect(definiteArticle('m', 'sg', 'amico')).toBe("l'")
    expect(definiteArticle('m', 'pl', 'amici')).toBe('gli')
    expect(definiteArticle('m', 'pl', 'zaini')).toBe('gli')
    expect(definiteArticle('m', 'pl', 'libri')).toBe('i')
    expect(definiteArticle('f', 'sg', 'acqua')).toBe("l'")
    expect(definiteArticle('f', 'pl', 'amiche')).toBe('le')
    expect(indefiniteArticle('m', 'zaino')).toBe('uno')
    expect(indefiniteArticle('m', 'amico')).toBe('un')
    expect(indefiniteArticle('f', 'amica')).toBe("un'")
    expect(indefiniteArticle('f', 'casa')).toBe('una')
    expect(articulate('di', 'il')).toBe('del')
    expect(articulate('di', "l'")).toBe("dell'")
    expect(articulate('in', 'gli')).toBe('negli')
    expect(articulate('a', 'lo')).toBe('allo')
    expect(articulate('su', 'le')).toBe('sulle')
    expect(articulate('da', 'i')).toBe('dai')
  })
})

describe('checker', () => {
  it('accepts correct sentences', () => {
    expect(check('La casa è molto grande.', deps)).toEqual([])
    expect(check("Lo studente mangia un uovo.", deps)).toEqual([])
    expect(check("L'amico di Lei è italiano.", deps)).toEqual([])
    expect(check('Gli amici sono andati.', deps)).toEqual([])
    expect(check('Le uova sono bianche.', deps)).toEqual([])
    expect(check('Il problema è grande.', deps)).toEqual([])
    expect(check("Uno zaino rosa e un'amica simpatica.", deps)).toEqual([])
    expect(check('Ieri sono arrivata.', deps)).toEqual([])
    expect(check("C'è un problema.", deps)).toEqual([])
  })
  it('flags wrong article forms (lo, gli, l\')', () => {
    const f = check('Il studente è qui.', deps)
    expect(f.find((x) => x.code === 'article')?.suggestion).toBe('lo')
    expect(check('I amici sono qui.', deps).find((x) => x.code === 'article')?.suggestion).toBe('gli')
    expect(check('Gli libri sono qui.', deps).find((x) => x.code === 'article')?.suggestion).toBe('i')
    expect(check('Il amico è qui.', deps).find((x) => x.code === 'article')?.suggestion).toBe("l'")
    expect(check('Un zaino', deps).find((x) => x.code === 'article')?.suggestion).toBe('uno')
    expect(check('Il psicologo', deps).find((x) => x.code === 'article')?.suggestion).toBe('lo')
    expect(check('Il gnomo', deps).find((x) => x.code === 'article')?.suggestion).toBe('lo')
    expect(check('Del aereo', deps).find((x) => x.code === 'article')?.suggestion).toBe("dell'")
    expect(check('Nei zaini', deps).find((x) => x.code === 'article')?.suggestion).toBe('negli')
    expect(check('Quel amico', deps).find((x) => x.code === 'article')?.suggestion).toBe("quell'")
  })
  it("flags un'amico and un amica", () => {
    const a = check("Un'amico è qui.", deps).find((x) => x.code === 'article')
    expect(a?.suggestion).toBe('un')
    expect(a?.message).toMatch(/apostrophe/)
    expect(check('Un amica è qui.', deps).find((x) => x.code === 'article')?.suggestion).toBe("un'")
  })
  it('flags article and adjective agreement', () => {
    const f = check('Il casa bianco', deps)
    expect(f.filter((x) => x.code === 'agreement').length).toBe(2)
    expect(check('La problema è grande.', deps).some((x) => x.code === 'agreement')).toBe(true)
    expect(check('Le libri', deps).some((x) => x.code === 'agreement')).toBe(true)
    expect(check('I uova', deps).some((x) => x.code === 'agreement')).toBe(true)
    expect(check('Una ragazza molto simpatico.', deps).some((x) => x.code === 'agreement')).toBe(true)
    expect(check('Il mia libro', deps).some((x) => x.code === 'agreement')).toBe(true)
  })
  it('flags predicate adjectives that do not agree', () => {
    expect(check('La ragazza è alto.', deps).some((x) => x.code === 'agreement')).toBe(true)
    expect(check('La ragazza è alta.', deps)).toEqual([])
    expect(check('I libri sono bianco.', deps).some((x) => x.code === 'agreement')).toBe(true)
  })
  it('flags missing accents', () => {
    const f = check('Perche la citta è grande?', deps)
    const acc = f.filter((x) => x.code === 'accent').map((x) => x.suggestion)
    expect(acc).toEqual(['perché', 'città'])
    expect(f[0]!.message).toMatch(/acute/)
  })
  it('flags e for è', () => {
    expect(check('Lui e italiano.', deps).find((x) => x.code === 'accent')?.suggestion).toBe('è')
    expect(check("Dov'e il libro?", deps).find((x) => x.code === 'accent')?.suggestion).toBe('è')
    expect(check("C'e un problema.", deps).find((x) => x.code === 'accent')?.suggestion).toBe('è')
    expect(check('Non e vero.', deps).find((x) => x.code === 'accent')?.suggestion).toBe('è')
    expect(codes('Lui e lei sono qui.')).not.toContain('accent')
    expect(codes('Io e lui')).not.toContain('accent')
  })
  it('flags accents typed as apostrophes', () => {
    const f = check("Perche' la citta' è grande?", deps).filter((x) => x.code === 'accent')
    expect(f.map((x) => x.suggestion)).toEqual(['perché', 'città'])
  })
  it("flags qual'è", () => {
    expect(check("Qual'è il problema?", deps).find((x) => x.code === 'spelling')?.suggestion).toBe('qual è')
  })
  it('flags avere with an essere verb', () => {
    const f = check('Io ho andato a casa.', deps)
    const a = f.find((x) => x.code === 'auxiliary')
    expect(a?.suggestion).toBe('sono andato')
    expect(a?.message).toMatch(/essere/)
    expect(check('Abbiamo arrivato ieri.', deps).find((x) => x.code === 'auxiliary')?.suggestion).toBe('siamo arrivati')
    expect(check('Ha già venuto.', deps).find((x) => x.code === 'auxiliary')?.suggestion).toBe('è venuto')
    expect(check('Ho stato a casa.', deps).find((x) => x.code === 'auxiliary')?.suggestion).toBe('sono stato')
    expect(codes('Ho mangiato un uovo.')).toEqual([])
    expect(codes('Ho successo.')).not.toContain('auxiliary')
  })
  it('flags subject-verb agreement', () => {
    const f = check('Io parla italiano.', deps)
    const v = f.find((x) => x.code === 'verb-agreement')
    expect(v?.suggestion).toBe('parlo')
    expect(check('Io sei qui.', deps).find((x) => x.code === 'verb-agreement')?.suggestion).toBe('sono')
    expect(check('Noi ha un libro.', deps).find((x) => x.code === 'verb-agreement')?.suggestion).toBe('abbiamo')
    expect(codes('Io non ci vado.')).not.toContain('verb-agreement')
    expect(codes('Io e lei parliamo.')).not.toContain('verb-agreement')
  })
  it('applies learner-error rules', () => {
    expect(codes('Sono 20 anni.')).toContain('learner-error')
  })
  it('suggests spelling fixes and reports unknown words', () => {
    expect(check('La csaa è grande.', deps).find((x) => x.code === 'spelling')?.suggestion).toBe('casa')
    expect(codes('La casa è xyzzy.')).toContain('unknown')
    expect(codes('Lui è Marco.')).toEqual([])
  })
  it('knows elided words', () => {
    expect(check("L'acqua è qui.", deps)).toEqual([])
    expect(check("Un'acqua", deps)).toEqual([])
  })
})
