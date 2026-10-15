import { describe, it, expect } from 'vitest'
import { check } from '@/lang/pt/checker'
import { buildDictionary } from '@/lang/pt/inflect'
import { IRREGULAR } from '@/lang/pt/verbs'
import type { VocabEntry, ErrorRule } from '@/engine/schema'

const V = (id: string, lemma: string, pos: VocabEntry['pos'], extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id, lemma, pos, en: ['x'], level: 'a1', tags: [], ...extra }) as VocabEntry

const entries: VocabEntry[] = [
  V('w.casa', 'casa', 'noun', { gender: 'f' }),
  V('w.livro', 'livro', 'noun', { gender: 'm' }),
  V('w.dia', 'dia', 'noun', { gender: 'm' }),
  V('w.problema', 'problema', 'noun', { gender: 'm' }),
  V('w.mao', 'mão', 'noun', { gender: 'f' }),
  V('w.cancao', 'canção', 'noun', { gender: 'f' }),
  V('w.estudante', 'estudante', 'noun', { gender: 'mf' }),
  V('w.professor', 'professor', 'noun', { gender: 'mf' }),
  V('w.lapis', 'lápis', 'noun', { gender: 'm' }),
  V('w.pe', 'pé', 'noun', { gender: 'm' }),
  V('w.gente', 'gente', 'noun', { gender: 'f' }),
  V('w.branco', 'branco', 'adj'),
  V('w.bonito', 'bonito', 'adj'),
  V('w.grande', 'grande', 'adj'),
  V('w.portugues', 'português', 'adj', { tags: ['nationality'] }),
  V('w.ter', 'ter', 'verb'),
  V('w.ser', 'ser', 'verb'),
  V('w.estar', 'estar', 'verb'),
  V('w.ir', 'ir', 'verb'),
  V('w.comecar', 'começar', 'verb'),
  V('w.levantar-se', 'levantar-se', 'verb'),
  V('w.o', 'o', 'det', { forms: ['o', 'a', 'os', 'as'] }),
  V('w.um', 'um', 'det', { forms: ['um', 'uma', 'uns', 'umas'] }),
  V('w.de', 'de', 'prep'),
  V('w.em', 'em', 'prep'),
  V('w.do', 'do', 'prep', { forms: ['do', 'da', 'dos', 'das'] }),
  V('w.muito', 'muito', 'adv'),
  V('w.nao', 'não', 'adv'),
  V('w.eu', 'eu', 'pron'),
  V('w.ele', 'ele', 'pron', { forms: ['ele', 'ela', 'eles', 'elas'] }),
  V('w.voce', 'você', 'pron'),
  V('w.nos', 'nós', 'pron'),
  V('w.hoje', 'hoje', 'adv'),
  V('w.cedo', 'cedo', 'adv'),
  V('w.e', 'e', 'conj'),
  V('w.aqui', 'aqui', 'adv'),
  V('w.a', 'a', 'prep'),
]
const rules: ErrorRule[] = [
  { id: 'ser-age', pattern: '\\b(sou|é|somos|são) \\d+ anos\\b', message: 'Age uses ter.', level: 'a1', example: { wrong: 'sou 20 anos', right: 'tenho 20 anos' } },
]
const deps = { dict: buildDictionary(entries, IRREGULAR), rules, verbs: IRREGULAR }
const codes = (t: string) => check(t, deps).map((f) => f.code)

describe('checker', () => {
  it('accepts correct sentences', () => {
    expect(check('A casa é muito grande.', deps)).toEqual([])
    expect(check('O problema é grande.', deps)).toEqual([])
    expect(check('Eu tenho um livro branco.', deps)).toEqual([])
    expect(check('A mão branca.', deps)).toEqual([])
    expect(check('O dia é bonito.', deps)).toEqual([])
    expect(check('Os lápis brancos.', deps)).toEqual([])
    expect(check('A estudante e o estudante.', deps)).toEqual([])
    expect(check('A professora é portuguesa.', deps)).toEqual([])
    expect(check('Eu levantei-me cedo.', deps)).toEqual([])
    expect(check('Nós começamos hoje.', deps)).toEqual([])
  })
  it('flags missing accents with an explanation', () => {
    const f = check('A cancao é bonita.', deps)
    const a = f.find((x) => x.code === 'accent')
    expect(a?.suggestion).toBe('canção')
    expect(a?.message).toMatch(/tilde/)
    const e = check('Voce tera um livro.', deps).filter((x) => x.code === 'accent')
    expect(e.map((x) => x.suggestion)).toEqual(['você', 'terá'])
    expect(codes('Esta casa é grande.')).not.toContain('accent') // esta (this) is a word too
  })
  it('flags a missing cedilla', () => {
    const f = check('Nós comecamos hoje.', deps).find((x) => x.code === 'accent')
    expect(f?.suggestion).toBe('começamos')
    expect(f?.message).toMatch(/^Cedilla/)
  })
  it('flags article and adjective agreement', () => {
    const f = check('O casa branco', deps)
    expect(f.filter((x) => x.code === 'agreement').length).toBe(2)
    expect(codes('A problema é grande.')).toContain('agreement')
    expect(codes('Um casa.')).toContain('agreement')
    expect(codes('Os casa.')).toContain('agreement')
    expect(codes('Uma casa muito bonito.')).toContain('agreement')
  })
  it('checks predicate adjectives', () => {
    expect(codes('A casa é bonito.')).toContain('agreement')
    expect(codes('A casa é muito bonita.')).not.toContain('agreement')
  })
  it('agrees contractions with the noun', () => {
    expect(codes('Eu estou na casa.')).not.toContain('agreement')
    expect(codes('Eu estou no casa.')).toContain('agreement')
    expect(codes('Eu tenho o livro da professora.')).not.toContain('agreement')
  })
  it('does not treat the preposition a as an article', () => {
    expect(codes('Eu vou a pé.')).not.toContain('agreement')
    expect(codes('Eu vou de a pé.')).toContain('agreement')
  })
  it('flags subject-verb agreement', () => {
    const f = check('Eu tens uma casa.', deps)
    const v = f.find((x) => x.code === 'verb-agreement')
    expect(v?.suggestion).toBe('tenho')
    expect(codes('Eu não tenho uma casa.')).not.toContain('verb-agreement')
    expect(codes('Você tem uma casa.')).not.toContain('verb-agreement')
    expect(codes('Ela e eu somos estudantes.')).not.toContain('verb-agreement')
    const g = check('A gente vamos hoje.', deps).find((x) => x.code === 'verb-agreement')
    expect(g?.suggestion).toBe('vai')
  })
  it('applies learner-error rules', () => {
    expect(codes('Eu sou 20 anos.')).toContain('learner-error')
    expect(check('Eu tenho 20 anos.', { ...deps, rules: [] }).filter((x) => x.code === 'learner-error')).toEqual([])
  })
  it('suggests spelling fixes and reports unknown words', () => {
    expect(check('A csaa é grande.', deps).find((x) => x.code === 'spelling')?.suggestion).toBe('casa')
    expect(codes('A casa é xyzzyq.')).toContain('unknown')
    expect(codes('Eu vou com Maria.')).not.toContain('spelling') // proper noun
  })
  it('returns findings in text order with spans', () => {
    const f = check('O casa é bonito.', deps)
    expect(f.map((x) => x.start)).toEqual([...f.map((x) => x.start)].sort((a, b) => a - b))
    expect('O casa é bonito.'.slice(f[0]!.start, f[0]!.end)).toBe('O casa')
  })
  it('does not flag correct Portuguese (real-course false positives)', () => {
    const more = [
      ...entries, V('w.avô', 'avô', 'noun', { gender: 'm', plural: 'avós' }), V('w.avó', 'avó', 'noun', { gender: 'f' }), V('w.morar', 'morar', 'verb'),
      V('w.pai', 'pai', 'noun', { gender: 'm' }), V('w.são', 'são', 'adj'), V('w.menino', 'menino', 'noun', { gender: 'mf' }), V('w.pequeno', 'pequeno', 'adj'),
      V('w.namorado', 'namorado', 'noun', { gender: 'mf' }), V('w.primo', 'primo', 'noun', { gender: 'mf' }), V('w.argentino', 'argentino', 'adj'),
      V('w.ano', 'ano', 'noun', { gender: 'm' }), V('w.ter', 'ter', 'verb'), V('w.vinte', 'vinte', 'num'), V('w.estrela', 'estrela', 'noun', { gender: 'f' }),
      V('w.claro', 'claro', 'adj'), V('w.olhar', 'olhar', 'verb'), V('w.camisa', 'camisa', 'noun', { gender: 'f' }), V('w.laranja', 'laranja', 'adj', { plural: 'laranja' }),
      V('w.ir', 'ir', 'verb'), V('w.festa', 'festa', 'noun', { gender: 'f' }), V('w.tu', 'tu', 'pron'), V('w.você', 'você', 'pron'), V('w.perder', 'perder', 'verb'),
      V('w.trem', 'trem', 'noun', { gender: 'm' }), V('w.graças', 'graças', 'noun', { gender: 'f' }), V('w.lindo', 'lindo', 'adj'),
    ]
    const d2 = { dict: buildDictionary(more, IRREGULAR), rules: [], verbs: IRREGULAR }
    const ok = (t: string) => expect(check(t, d2).filter((f) => f.code !== 'unknown'), t).toEqual([])
    ok('Os meninos são pequenos.')
    ok('Meus avós moram com os meus pais.')
    ok('O namorado da minha prima é argentino.')
    ok('Tenho vinte e um anos.')
    ok('Quero olhar as estrelas, claro.')
    ok('As camisas laranja são lindas.')
    ok('Tu vai na festa?')
    ok('Graças a você, perdi o trem.')
    ok('Salvador é linda.')
    // and still catches the real mistakes
    expect(check('O casa é linda.', d2).map((f) => f.code)).toContain('agreement')
    expect(check('A casa é lindo.', d2).map((f) => f.code)).toContain('agreement')
    expect(check('Eu vai na festa.', d2).map((f) => f.code)).toContain('verb-agreement')
  })
})
