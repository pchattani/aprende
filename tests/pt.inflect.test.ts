import { describe, it, expect } from 'vitest'
import { pluralize, adjectiveForms, inflections, buildDictionary, lookup } from '@/lang/pt/inflect'
import { IRREGULAR } from '@/lang/pt/verbs'
import type { VocabEntry } from '@/engine/schema'

describe('pluralize', () => {
  const cases: [string, string][] = [
    ['casa', 'casas'], ['carro', 'carros'], ['café', 'cafés'], ['sofá', 'sofás'], ['avó', 'avós'], ['irmã', 'irmãs'],
    ['chapéu', 'chapéus'], ['pai', 'pais'], ['mulher', 'mulheres'], ['flor', 'flores'], ['açúcar', 'açúcares'],
    ['luz', 'luzes'], ['rapaz', 'rapazes'], ['vez', 'vezes'], ['animal', 'animais'], ['jornal', 'jornais'],
    ['papel', 'papéis'], ['hotel', 'hotéis'], ['nível', 'níveis'], ['móvel', 'móveis'], ['espanhol', 'espanhóis'],
    ['lençol', 'lençóis'], ['álcool', 'álcoois'], ['azul', 'azuis'], ['funil', 'funis'], ['barril', 'barris'],
    ['fóssil', 'fósseis'], ['fácil', 'fáceis'], ['difícil', 'difíceis'], ['homem', 'homens'], ['jardim', 'jardins'],
    ['som', 'sons'], ['armazém', 'armazéns'], ['mão', 'mãos'], ['irmão', 'irmãos'], ['pão', 'pães'], ['cão', 'cães'],
    ['alemão', 'alemães'], ['avião', 'aviões'], ['coração', 'corações'], ['lápis', 'lápis'], ['ônibus', 'ônibus'],
    ['vírus', 'vírus'], ['tênis', 'tênis'], ['pires', 'pires'], ['país', 'países'], ['gás', 'gases'], ['mês', 'meses'],
    ['português', 'portugueses'], ['inglês', 'ingleses'], ['deus', 'deuses'], ['tórax', 'tórax'], ['hífen', 'hifens'],
    ['mal', 'males'], ['fim de semana', 'fins de semana'], ['guarda-chuva', 'guarda-chuvas'], ['qualquer', 'quaisquer'],
  ]
  for (const [s, p] of cases) it(`${s} -> ${p}`, () => expect(pluralize(s)[0]).toBe(p))
  it('accepts alternative plurals', () => {
    expect(pluralize('verão')).toEqual(['verões', 'verãos'])
    expect(pluralize('couve-flor')).toContain('couves-flores')
  })
})

describe('adjectiveForms', () => {
  const sorted = (xs: string[]) => [...xs].sort()
  it('-o adjectives', () => expect(sorted(adjectiveForms('bonito'))).toEqual(['bonita', 'bonitas', 'bonito', 'bonitos']))
  it('-ês', () => expect(sorted(adjectiveForms('português'))).toEqual(['portuguesa', 'portuguesas', 'portugueses', 'português']))
  it('-ol', () => expect(sorted(adjectiveForms('espanhol'))).toEqual(['espanhol', 'espanhola', 'espanholas', 'espanhóis']))
  it('-ão', () => expect(sorted(adjectiveForms('alemão'))).toEqual(['alemã', 'alemães', 'alemão', 'alemãs']))
  it('-or', () => expect(sorted(adjectiveForms('trabalhador'))).toEqual(['trabalhador', 'trabalhadora', 'trabalhadoras', 'trabalhadores']))
  it('-eu', () => expect(adjectiveForms('europeu')).toEqual(expect.arrayContaining(['europeia', 'europeus', 'europeias'])))
  it('irregular feminines', () => {
    expect(adjectiveForms('bom')).toEqual(expect.arrayContaining(['boa', 'bons', 'boas']))
    expect(adjectiveForms('mau')).toEqual(expect.arrayContaining(['má', 'maus', 'más']))
  })
  it('invariable in gender', () => {
    expect(sorted(adjectiveForms('feliz'))).toEqual(['feliz', 'felizes'])
    expect(sorted(adjectiveForms('grande'))).toEqual(['grande', 'grandes'])
    expect(sorted(adjectiveForms('azul'))).toEqual(['azuis', 'azul'])
    expect(sorted(adjectiveForms('melhor'))).toEqual(['melhor', 'melhores'])
    expect(sorted(adjectiveForms('jovem'))).toEqual(['jovem', 'jovens'])
  })
  it('explicit feminine', () => expect(adjectiveForms('ateu', { feminine: 'ateia' })).toContain('ateias'))
})

const V = (id: string, lemma: string, pos: VocabEntry['pos'], extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id, lemma, pos, en: ['x'], level: 'a1', tags: [], ...extra }) as VocabEntry

describe('inflections', () => {
  it('verbs include every conjugated form and participle agreement', () => {
    const f = inflections(V('w.ter', 'ter', 'verb'), IRREGULAR)
    for (const x of ['ter', 'tenho', 'têm', 'tiveram', 'teríamos', 'tivéssemos', 'tiver', 'tido', 'tidas', 'tendo', 'tende', 'teres']) expect(f).toContain(x)
    const p = inflections(V('w.pagar', 'pagar', 'verb'), IRREGULAR)
    for (const x of ['pago', 'pagas', 'pagado', 'paguei', 'pague']) expect(p).toContain(x)
    expect(inflections(V('w.abrir', 'abrir', 'verb'), IRREGULAR)).toContain('abertas')
  })
  it('reflexive verbs use the base verb', () => {
    const f = inflections(V('w.levantar-se', 'levantar-se', 'verb'), IRREGULAR)
    expect(f).toContain('levantar-se')
    expect(f).toContain('levanto')
    expect(f).toContain('levantemos')
  })
  it('nouns: plural, explicit plural and gendered nouns', () => {
    expect(inflections(V('w.pao', 'pão', 'noun', { gender: 'm' }), IRREGULAR)).toEqual(['pão', 'pães'])
    expect(inflections(V('w.cidadao', 'cidadão', 'noun', { gender: 'm', plural: 'cidadãos' }), IRREGULAR)).toContain('cidadãos')
    const prof = inflections(V('w.professor', 'professor', 'noun', { gender: 'mf' }), IRREGULAR)
    expect(prof).toEqual(expect.arrayContaining(['professor', 'professora', 'professores', 'professoras']))
  })
  it('adjectives and explicit forms', () => {
    expect(inflections(V('w.alemao', 'alemão', 'adj', { tags: ['nationality'] }), IRREGULAR)).toContain('alemã')
    const o = inflections(V('w.o', 'o', 'det', { forms: ['o', 'a', 'os', 'as'] }), IRREGULAR)
    expect([...o].sort()).toEqual(['a', 'as', 'o', 'os'])
  })
  it('phrases register their words', () => {
    const e = V('w.bom-dia', 'bom dia', 'phrase')
    expect(inflections(e, IRREGULAR)).toEqual(expect.arrayContaining(['bom dia', 'bom', 'dia']))
  })
})

describe('buildDictionary + lookup', () => {
  const entries = [
    V('w.dar', 'dar', 'verb'), V('w.comprar', 'comprar', 'verb'), V('w.fazer', 'fazer', 'verb'), V('w.dizer', 'dizer', 'verb'),
    V('w.levantar-se', 'levantar-se', 'verb'), V('w.pôr', 'pôr', 'verb'), V('w.partir', 'partir', 'verb'), V('w.querer', 'querer', 'verb'),
    V('w.sentar-se', 'sentar-se', 'verb'), V('w.casa', 'casa', 'noun', { gender: 'f' }), V('w.guarda-chuva', 'guarda-chuva', 'noun', { gender: 'm' }),
    V('w.por', 'por', 'prep'), V('w.do', 'do', 'prep', { forms: ['do', 'da', 'dos', 'das'] }),
  ]
  const dict = buildDictionary(entries, IRREGULAR)
  const lemma = (w: string) => lookup(dict, w)?.[0]?.lemma
  it('finds direct forms', () => {
    expect(lemma('casas')).toBe('casa')
    expect(lemma('guarda-chuvas')).toBe('guarda-chuva')
    expect(lemma('Fizeram')).toBe('fazer')
    expect(lemma('das')).toBe('do')
  })
  it('understands enclisis', () => {
    expect(lemma('dá-me')).toBe('dar')
    expect(lemma('levantei-me')).toBe('levantar-se')
    expect(lemma('levanto-me')).toBe('levantar-se')
    expect(lemma('comprá-lo')).toBe('comprar')
    expect(lemma('comprei-as')).toBe('comprar')
    expect(lemma('fazê-lo')).toBe('fazer')
    expect(lemma('fá-lo')).toBe('fazer')
    expect(lemma('fi-lo')).toBe('fazer')
    expect(lemma('di-lo')).toBe('dizer')
    expect(lemma('qui-lo')).toBe('querer')
    expect(lemma('parti-lo')).toBe('partir')
    expect(lemma('pô-lo')).toBe('pôr')
    expect(lemma('compramo-lo')).toBe('comprar')
    expect(lemma('sentemo-nos')).toBe('sentar-se')
    expect(lemma('dão-no')).toBe('dar')
    expect(lemma('dá-mo')).toBe('dar')
  })
  it('understands mesoclisis', () => {
    expect(lemma('dir-lhe-ei')).toBe('dizer')
    expect(lemma('fá-lo-ia')).toBe('fazer')
    expect(lemma('levantar-me-ei')).toBe('levantar-se')
    expect(lemma('comprá-lo-emos')).toBe('comprar')
    expect(lemma('dar-te-ia')).toBe('dar')
  })
  it('returns undefined for unknown words', () => {
    expect(lookup(dict, 'xyz')).toBeUndefined()
    expect(lookup(dict, 'beija-flor')).toBeUndefined()
    expect(lookup(dict, 'xyz-me')).toBeUndefined()
  })
})
