import { describe, it, expect } from 'vitest'
import { normalize, stripAccents, match, editDistance, words } from '@/lang/pt/normalize'
import { tokenize } from '@/lang/pt/tokenize'
import { languagePack } from '@/lang/pt'

describe('stripAccents', () => {
  it('removes every accent and the cedilla', () => {
    expect(stripAccents('não')).toBe('nao')
    expect(stripAccents('você está à vontade')).toBe('voce esta a vontade')
    expect(stripAccents('começo')).toBe('comeco')
    expect(stripAccents('pôr, três, avô, avó, lá, aí, ônibus')).toBe('por, tres, avo, avo, la, ai, onibus')
    expect(stripAccents('CORAÇÕES')).toBe('CORACOES')
    expect(stripAccents('lingüiça')).toBe('linguica')
  })
})

describe('normalize', () => {
  it('lowercases, strips punctuation and collapses spaces', () => {
    expect(normalize('Como   vai você?')).toBe('como vai você')
    expect(normalize('Olá, João!')).toBe('olá joão')
    expect(normalize('  «Obrigada.»  ')).toBe('obrigada')
  })
  it('keeps hyphenated clitic forms and compounds', () => {
    expect(normalize('Dá-me o guarda-chuva, por favor.')).toBe('dá-me o guarda-chuva por favor')
    expect(normalize('Levantei-me cedo - muito cedo.')).toBe('levantei-me cedo muito cedo')
    expect(normalize('Dir-lhe-ei amanhã.')).toBe('dir-lhe-ei amanhã')
    expect(normalize('um copo d’água')).toBe("um copo d'água")
  })
  it('optionally strips accents and cedilla', () => {
    expect(normalize('Você começou?', { accentInsensitive: true })).toBe('voce comecou')
  })
})

describe('match', () => {
  it('accepts exact answers ignoring case and punctuation', () => {
    expect(match('olá, tudo bem?', ['Olá, tudo bem?']).verdict).toBe('correct')
    expect(match('Ola tudo bem', ['Olá, tudo bem?']).verdict).toBe('almost')
  })
  it('accepts alternatives', () => {
    expect(match('bom dia', ['Boa tarde', 'Bom dia']).verdict).toBe('correct')
    expect(match('bom dia', ['Boa tarde', 'Bom dia']).matched).toBe('Bom dia')
  })
  it('flags accent-only and cedilla-only mistakes as almost/accents', () => {
    const r = match('voce nao esta aqui', ['Você não está aqui.'])
    expect(r.verdict).toBe('almost')
    expect(r.reason).toBe('accents')
    expect(r.notes).toHaveLength(3)
    expect(r.notes[0]).toMatch(/você/)
    const c = match('eu comeco amanha', ['Eu começo amanhã.'])
    expect(c.verdict).toBe('almost')
    expect(c.reason).toBe('accents')
    expect(c.notes[0]).toMatch(/cedilla/)
    expect(c.notes[1]).toMatch(/accent/)
  })
  it('tolerates one typo in a word of 5+ letters', () => {
    const r = match('eu gosto de chocolte', ['Eu gosto de chocolate'])
    expect(r.verdict).toBe('almost')
    expect(r.reason).toBe('typo')
    expect(r.notes[0]).toMatch(/chocolate/)
    expect(match('eu gosto de chocolte e de cafe', ['Eu gosto de chocolate e de café']).reason).toBe('typo') // accents are compared loosely here, as in Spanish
    expect(match('eu gosta de chocolate', ['Eu gosto de chocolate']).verdict).toBe('wrong') // short word: grammar
    expect(match('o gato é preta', ['O gato é preto']).verdict).toBe('wrong') // final letter: agreement
    expect(match('eu gosto de chocolte e de bolsa', ['Eu gosto de chocolate e de bolos']).verdict).toBe('wrong') // two errors
  })
  it('rejects wrong answers and empty input', () => {
    expect(match('', ['Olá']).verdict).toBe('wrong')
    expect(match('tchau', ['Olá']).verdict).toBe('wrong')
  })
})

describe('words', () => {
  it('returns tiles with accents and hyphenated forms', () => {
    expect(words('Dá-me isso, por favor!')).toEqual(['dá-me', 'isso', 'por', 'favor'])
    expect(words('Ela levantou-se às sete.')).toEqual(['ela', 'levantou-se', 'às', 'sete'])
  })
})

describe('editDistance', () => {
  it('counts transpositions as one edit', () => {
    expect(editDistance('casa', 'caas')).toBe(1)
    expect(editDistance('mão', 'mão')).toBe(0)
    expect(editDistance('abc', 'xyz')).toBe(3)
  })
})

describe('tokenize', () => {
  it('splits words, numbers, spaces and punctuation', () => {
    const t = tokenize('Você tem 2 irmãos?')
    expect(t.map((x) => [x.text, x.kind])).toEqual([
      ['Você', 'word'], [' ', 'space'], ['tem', 'word'], [' ', 'space'], ['2', 'number'], [' ', 'space'], ['irmãos', 'word'], ['?', 'punct'],
    ])
    expect(t[6]!.start).toBe(11)
    expect(t[6]!.end).toBe(17)
  })
  it('keeps clitic forms, mesoclisis and compounds as one word', () => {
    const ws = (s: string) => tokenize(s).filter((x) => x.kind === 'word').map((x) => x.text)
    expect(ws('Levantei-me e dá-lo-ei a ele.')).toEqual(['Levantei-me', 'e', 'dá-lo-ei', 'a', 'ele'])
    expect(ws('Quero falar-lhe do guarda-chuva.')).toEqual(['Quero', 'falar-lhe', 'do', 'guarda-chuva'])
    expect(ws('Um copo d’água - agora.')).toEqual(['Um', 'copo', 'd’água', 'agora'])
    expect(tokenize('a - b').map((x) => x.kind)).toEqual(['word', 'space', 'punct', 'space', 'word'])
  })
})

describe('language pack', () => {
  it('exposes the Portuguese pack', () => {
    expect(languagePack.id).toBe('pt')
    expect(languagePack.locale).toBe('pt-BR')
    expect(languagePack.stripMarks('ação')).toBe('acao')
    expect(languagePack.comparable('Olá')).toBe('Olá')
    expect(languagePack.match('olá', ['Olá!']).verdict).toBe('correct')
    expect(languagePack.words('Olá, mundo')).toEqual(['olá', 'mundo'])
  })
})
