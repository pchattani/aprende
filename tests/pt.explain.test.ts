import { describe, it, expect } from 'vitest'
import { explainConfig as C } from '@/lang/pt/explain'
import { allForms } from '@/lang/pt/verbs'
import { contract } from '@/lang/pt/_contract'
import type { VocabEntry } from '@/engine/schema'

const noun = (gender: VocabEntry['gender']) => ({ id: 'w.x', lemma: 'x', pos: 'noun', gender, en: ['x'], level: 'a1', tags: [] }) as VocabEntry

describe('Portuguese explain config', () => {
  it('names the language and its marks', () => {
    expect(C.languageName).toBe('Portuguese')
    expect(C.marks).toBe('accents')
    expect(C.negation).toBe('não')
  })
  it('lists articles with contractions, prepositions and pronouns', () => {
    for (const a of ['o', 'a', 'os', 'as', 'um', 'uma', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'ao', 'à', 'aos', 'às', 'pelo', 'pela', 'num', 'numa']) expect(C.articles.has(a)).toBe(true)
    for (const p of ['de', 'em', 'com', 'por', 'para', 'sem', 'até']) expect(C.preps.has(p)).toBe(true)
    for (const s of ['eu', 'tu', 'ele', 'ela', 'você', 'nós', 'a gente', 'vós', 'eles', 'elas', 'vocês']) expect(C.subjects.has(s)).toBe(true)
    expect(C.subjects.has('o')).toBe(false)
    expect(C.notAfterSubject.has('e')).toBe(true)
    expect(C.emphatic.get('a mim')).toBe('me')
    expect(C.emphatic.get('a ele')).toBe('lhe')
    expect(C.objectPronouns.has('lhe')).toBe(true)
  })
  it('ser/estar sets contain only real forms of each verb', () => {
    const [estar, ser] = [C.pairs[0]!.a, C.pairs[0]!.b]
    const serForms = allForms('ser')
    const estarForms = allForms('estar')
    for (const f of ser) expect(serForms.has(f), f).toBe(true)
    for (const f of estar) expect(estarForms.has(f), f).toBe(true)
    expect(C.pairs[0]!.useA('está')).toMatch(/estar/)
    expect(C.pairs[0]!.useB('é')).toMatch(/ser/)
  })
  it('has por/para, ficar and ter/haver pairs', () => {
    const find = (w: string) => C.pairs.find((p) => p.a.has(w) || p.b.has(w))
    expect(find('para')?.useA('para')).toMatch(/purpose/)
    expect(find('pelo')?.useB('por')).toMatch(/por/)
    expect(C.pairs.some((p) => p.a.has('ficou'))).toBe(true)
    expect(C.pairs.some((p) => p.a.has('há') && p.b.has('tem'))).toBe(true)
  })
  it('explains accents, cedilla and agreement', () => {
    expect(C.accentHint('voce', 'você')).toMatch(/^Accent: write “você”/)
    expect(C.accentHint('comeco', 'começo')).toMatch(/^Cedilla/)
    expect(C.agreement('bonito', 'bonita')).toEqual(['feminine'])
    expect(C.agreement('bonita', 'bonitos')).toEqual(['masculine', 'plural'])
    expect(C.agreement('alemão', 'alemã')).toEqual(['feminine'])
    expect(C.agreement('livros', 'livro')).toEqual(['singular'])
  })
  it('builds article hints from the noun gender', () => {
    expect(C.articleHint('a', noun('f'), 'casa', 'o')).toBe('Article: “a”, because “casa” is feminine.')
    expect(C.articleHint('os', noun('m'), 'livros', 'as')).toBe('Article: “os”, because “livros” is masculine plural.')
    expect(C.articleHint('o', undefined, 'xyz', 'a')).toBe('Article: “o”, not “a”.')
    expect(C.missingArticle('o')).toMatch(/Missing “o”/)
    expect(C.missingHint?.('que', undefined)).toMatch(/que/)
    expect(C.missingHint?.('casa', undefined)).toBeUndefined()
    expect(C.wordOrder).toMatch(/different order/)
  })
  it('satisfies the language-pack contract', () => {
    expect(contract).toHaveLength(8)
    expect(contract[7].id).toBe('pt')
  })
})
