import { describe, it, expect } from 'vitest'
import { explainConfig as C } from '@/lang/it/explain'
import type { VocabEntry } from '@/engine/schema'

const noun = (lemma: string, gender: 'm' | 'f'): VocabEntry => ({ id: `w.${lemma}`, lemma, pos: 'noun', gender, en: ['x'], level: 'a1', tags: [] }) as VocabEntry

describe('Italian explain config', () => {
  it('names the language and its marks', () => {
    expect(C.languageName).toBe('Italian')
    expect(C.marks).toBe('accents')
    expect(C.negation).toBe('non')
  })
  it('lists articles, articulated prepositions and prepositions', () => {
    for (const a of ['il', 'lo', 'la', "l'", 'i', 'gli', 'le', 'un', 'uno', 'una', "un'", 'del', 'dello', 'della', "dell'", 'dei', 'degli', 'delle', 'al', 'allo', "all'", 'agli', 'dal', 'nel', 'negli', 'sul', 'sulle']) {
      expect(C.articles.has(a), a).toBe(true)
    }
    for (const p of ['di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra']) expect(C.preps.has(p), p).toBe(true)
  })
  it('has the optional subject pronouns and emphatic forms', () => {
    for (const s of ['io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro']) expect(C.subjects.has(s), s).toBe(true)
    expect(C.subjects.has('il')).toBe(false)
    expect(C.notAfterSubject.has('e')).toBe(true)
    expect(C.emphatic.get('a me')).toBe('mi')
    expect(C.emphatic.get('a te')).toBe('ti')
    expect(C.emphatic.get('a lui')).toBe('gli')
    expect(C.emphatic.get('a lei')).toBe('le')
    expect(C.emphatic.get('a noi')).toBe('ci')
    expect(C.emphatic.get('a voi')).toBe('vi')
    for (const p of ['mi', 'ti', 'si', 'ci', 'vi', 'lo', 'la', 'li', 'le', 'gli', 'ne']) expect(C.objectPronouns.has(p), p).toBe(true)
  })
  it('explains essere vs avere as auxiliaries', () => {
    const pair = C.pairs.find((p) => p.a.has('sono') && p.b.has('ho'))!
    expect(pair).toBeDefined()
    expect(pair.a.has('siamo')).toBe(true)
    expect(pair.a.has('fossero')).toBe(true)
    expect(pair.b.has('avevamo')).toBe(true)
    expect(pair.useA('sono')).toMatch(/motion|reflexive/)
    expect(pair.useB('ho')).toMatch(/avere/)
  })
  it('explains da vs di and in vs a', () => {
    const da = C.pairs.find((p) => p.a.has('da') && p.b.has('di'))!
    expect(da.useA('da')).toMatch(/da Marco|from/)
    expect(da.useB('di')).toMatch(/sono di Roma/)
    const inA = C.pairs.find((p) => p.a.has('in') && p.b.has('a'))!
    expect(inA.useB('a')).toMatch(/Roma/)
  })
  it('gives hints for missing ci and ne', () => {
    expect(C.missingHint?.("c'", 'è')).toMatch(/c'è/)
    expect(C.missingHint?.('ne', 'voglio')).toMatch(/ne/)
    expect(C.missingHint?.('casa', undefined)).toBeUndefined()
  })
  it('explains accents', () => {
    expect(C.accentHint('e', 'è')).toMatch(/is/)
    expect(C.accentHint('perchè', 'perché')).toMatch(/acute/)
    expect(C.accentHint('citta', 'città')).toMatch(/città/)
  })
  it('describes agreement changes', () => {
    expect(C.agreement('rosso', 'rossa')).toEqual(['feminine'])
    expect(C.agreement('rossa', 'rosso')).toEqual(['masculine'])
    expect(C.agreement('rosso', 'rossi')).toEqual(['plural'])
    expect(C.agreement('rossa', 'rosse')).toEqual(['plural'])
    expect(C.agreement('rossi', 'rosso')).toEqual(['singular'])
    expect(C.agreement('rosso', 'rosse')).toEqual(['feminine', 'plural'])
    expect(C.agreement('bianco', 'bianche')).toEqual(['feminine', 'plural'])
    expect(C.agreement('verde', 'verdi')).toEqual([]) // ambiguous
    expect(C.agreement('casa', 'libro')).toEqual([])
  })
  it('explains article choice', () => {
    expect(C.articleHint('lo', noun('studente', 'm'), 'studente', 'il')).toMatch(/s \+ consonant/)
    expect(C.articleHint('gli', noun('amico', 'm'), 'amici', 'i')).toMatch(/vowel/)
    expect(C.articleHint("l'", noun('acqua', 'f'), 'acqua', 'la')).toMatch(/l'/)
    expect(C.articleHint("un'", noun('amica', 'f'), 'amica', 'un')).toMatch(/feminine/)
    expect(C.articleHint('un', noun('amico', 'm'), 'amico', "un'")).toMatch(/masculine/)
    expect(C.articleHint('la', noun('casa', 'f'), 'casa', 'il')).toMatch(/feminine/)
    expect(C.missingArticle('la')).toMatch(/possessives/)
    expect(C.missingArticle("dall'")).toMatch(/da \+ l'/)
    expect(C.missingArticle('negli')).toMatch(/in \+ gli/)
    expect(C.wordOrder).toMatch(/order/)
  })
  it('splits elisions for the feedback diff', () => {
    expect(C.tokens?.("L'amico è nell'acqua.")).toEqual(["L'", 'amico', 'è', "nell'", 'acqua'])
    expect(C.tokens?.("C'è un po' di pane")).toEqual(["C'", 'è', 'un', "po'", 'di', 'pane'])
    expect(C.tokens?.('L’amica')).toEqual(["L'", 'amica'])
  })
})
