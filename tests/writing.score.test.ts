/**
 * The writing scorer (engine/writing.ts) in every course language, on the real course vocabulary,
 * error rules and known words, with fixture prompts (tests/fixtures/writing/<lang>.yaml): a model
 * answer scores high and clean; misspellings, wrong gender, wrong person, English, too-short
 * answers and (Cantonese) Jyutping, simplified characters and measure words are caught.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { z } from 'zod'
import { VocabFileSchema, ErrorsFileSchema, WritingPrompt, type VocabEntry, type LevelId } from '@/engine/schema'
import { makeWritingKit, scoreWriting, applySuggestion, boundedDistance, sentences, checkWritingPrompts, starsFor, WRITING_PASS, type WritingKit, type WritingResult } from '@/engine/writing'
import type { InflectModule, TokenizeModule, NormalizeModule, CheckerModule, AnyVerbTable } from '@/lang/contract'
import * as esI from '@/lang/es/inflect'
import * as esT from '@/lang/es/tokenize'
import * as esN from '@/lang/es/normalize'
import * as esC from '@/lang/es/checker'
import { IRREGULAR as esV } from '@/lang/es/verbs'
import * as ptI from '@/lang/pt/inflect'
import * as ptT from '@/lang/pt/tokenize'
import * as ptN from '@/lang/pt/normalize'
import * as ptC from '@/lang/pt/checker'
import { IRREGULAR as ptV } from '@/lang/pt/verbs'
import * as itI from '@/lang/it/inflect'
import * as itT from '@/lang/it/tokenize'
import * as itN from '@/lang/it/normalize'
import * as itC from '@/lang/it/checker'
import { IRREGULAR as itV } from '@/lang/it/verbs'
import * as frI from '@/lang/fr/inflect'
import * as frT from '@/lang/fr/tokenize'
import * as frN from '@/lang/fr/normalize'
import * as frC from '@/lang/fr/checker'
import { IRREGULAR as frV } from '@/lang/fr/verbs'
import * as yueI from '@/lang/yue/inflect'
import * as yueT from '@/lang/yue/tokenize'
import * as yueN from '@/lang/yue/normalize'
import * as yueC from '@/lang/yue/checker'
import { languagePack as yuePack } from '@/lang/yue'

type Lang = 'es' | 'pt' | 'it' | 'fr' | 'yue'
interface PackMods { inflect: InflectModule; tokenize: TokenizeModule; normalize: NormalizeModule; checker: CheckerModule; verbs: AnyVerbTable }
const PACKS: Record<Lang, PackMods> = {
  es: { inflect: esI, tokenize: esT, normalize: esN, checker: esC as unknown as CheckerModule, verbs: esV },
  pt: { inflect: ptI, tokenize: ptT, normalize: ptN, checker: ptC as unknown as CheckerModule, verbs: ptV },
  it: { inflect: itI, tokenize: itT, normalize: itN, checker: itC as unknown as CheckerModule, verbs: itV },
  fr: { inflect: frI, tokenize: frT, normalize: frN, checker: frC as unknown as CheckerModule, verbs: frV },
  yue: { inflect: yueI, tokenize: yueT, normalize: yueN, checker: yueC as unknown as CheckerModule, verbs: new Map() },
}

// every course's content (the YAML plugin parses the files), and the fixture prompts
const CONTENT = import.meta.glob(['/content/*/vocab/*.yaml', '/content/*/errors/common-errors.yaml', '/content/*/known.yaml'], { eager: true, import: 'default' }) as Record<string, unknown>
const FIXTURES = import.meta.glob('./fixtures/writing/*.yaml', { eager: true, import: 'default' }) as Record<string, unknown>
const file = (lang: Lang, rest: string) => CONTENT[`/content/${lang}/${rest}`]
const Fixture = z.object({ level: z.string(), unitWords: z.array(z.string()), writing: z.array(WritingPrompt) })

interface Course {
  kit: WritingKit
  prompt: WritingPrompt
  level: LevelId
  unitWords: Set<string>
  score: (text: string, seenModel?: boolean) => WritingResult
}
const courses = {} as Record<Lang, Course>

function load_(lang: Lang): Course {
  const entries: VocabEntry[] = Object.entries(CONTENT).filter(([p]) => p.startsWith(`/content/${lang}/vocab/`)).flatMap(([, data]) => VocabFileSchema.parse(data))
  if (lang === 'yue') yuePack.useVocabulary!(entries)
  const m = PACKS[lang]
  const dict = m.inflect.buildDictionary(entries, m.verbs)
  const rules = ErrorsFileSchema.parse(file(lang, 'errors/common-errors.yaml')).rules
  const known = (file(lang, 'known.yaml') ?? {}) as { always?: string[]; names?: string[] }
  const kit = makeWritingKit(
    {
      id: lang, tokenize: m.tokenize.tokenize, stripAccents: m.normalize.stripAccents, lookup: (f: string) => m.inflect.lookup(dict, f), forms: dict.keys(),
      check: (t: string) => m.checker.check(t, { dict, rules, verbs: m.verbs }),
      hasReading: lang === 'yue' ? (c: string) => yuePack.validateText(c).length === 0 : undefined,
    },
    { vocab: new Map(entries.map((e) => [e.id, e])), known: { always: known.always ?? [], names: known.names ?? [] } },
  )
  const fx = Fixture.parse(FIXTURES[`./fixtures/writing/${lang}.yaml`])
  const level = fx.level as LevelId
  const unitWords = new Set(fx.unitWords)
  const prompt = fx.writing[0]!
  return { kit, prompt, level, unitWords, score: (text, seenModel = false) => scoreWriting(text, prompt, kit, { level, unitWords, seenModel }) }
}

beforeAll(() => {
  for (const l of Object.keys(PACKS) as Lang[]) courses[l] = load_(l)
}, 60_000)

const codes = (r: WritingResult) => r.issues.map((x) => x.code)
const issueAt = (r: WritingResult, text: string, word: string) => r.issues.find((x) => text.slice(x.start, x.end).includes(word))

describe('helpers', () => {
  it('bounded edit distance (with transpositions) stops early', () => {
    expect(boundedDistance('casa', 'csaa', 2)).toBe(1)
    expect(boundedDistance('hola', 'hola', 1)).toBe(0)
    expect(boundedDistance('perro', 'gato', 1)).toBe(2)
    expect(boundedDistance('a', 'abcd', 1)).toBe(2)
  })
  it('splits sentences, not decimals', () => {
    const t = 'Tengo 3.5 euros. ¿Y tú? Bien'
    expect(sentences(t).map((s) => t.slice(s.start, s.end).trim())).toEqual(['Tengo 3.5 euros.', '¿Y tú?', 'Bien'])
  })
  it('stamps from the overall score', () => {
    expect([starsFor(95), starsFor(80), starsFor(50), starsFor(20)]).toEqual([3, 2, 1, 0])
  })
})

describe.each(['es', 'pt', 'it', 'fr', 'yue'] as Lang[])('%s: model answer', (lang) => {
  it('scores 90+ with nothing flagged', () => {
    const c = courses[lang]
    const r = c.score(c.prompt.model.es)
    expect(r.issues.map((x) => `${x.code}: ${c.prompt.model.es.slice(x.start, x.end)}`)).toEqual([])
    expect(r.overall).toBeGreaterThanOrEqual(90)
    expect(r.stars).toBe(3)
    expect(r.task.expectMet.length).toBeGreaterThan(0)
    expect(r.task.used.length).toBeGreaterThanOrEqual(r.task.useNeed)
    expect(r.wentWell.length).toBeGreaterThan(0)
  })
  it('counts a copy of the model answer once it has been seen', () => {
    const c = courses[lang]
    const r = c.score(c.prompt.model.es, true)
    expect(r.task.copied).toBe(true)
    expect(r.overall).toBeLessThan(80)
  })
  it('an empty answer scores nothing', () => {
    const r = courses[lang].score('   ')
    expect(r.overall).toBe(0)
    expect(r.stars).toBe(0)
  })
})

describe.each([
  ['es', 'My family is small and my father is called John. He is fifty and my mother is nice.'],
  ['pt', 'My family is small and my father is called John. He is fifty and my mother is nice.'],
  ['it', 'My family is small and my father is called John. He is fifty and my mother is nice.'],
  ['fr', 'My family is small and my father is called John. He is fifty and my mother is nice.'],
  ['yue', 'I have two dogs and no cat. I live in Hong Kong.'],
] as [Lang, string][])('%s: an answer in English', (lang, text) => {
  it('is recognised and scores low', () => {
    const r = courses[lang].score(text)
    expect(r.task.english).toBe(true)
    expect(r.overall).toBeLessThanOrEqual(25)
    expect(r.notes.task[0]).toMatch(/English/)
  })
})

describe.each([
  ['es', 'Mi padre.'],
  ['pt', 'Meu pai.'],
  ['it', 'Mio padre.'],
  ['fr', 'Mon père.'],
  ['yue', '我有狗。'],
] as [Lang, string][])('%s: a too-short answer', (lang, text) => {
  it('loses task and stamps', () => {
    const r = courses[lang].score(text)
    expect(r.task.length).toBeLessThan(courses[lang].prompt.min)
    expect(r.notes.task.some((n) => /Write a little more/.test(n))).toBe(true)
    expect(r.overall).toBeLessThan(60)
    expect(r.stars).toBeLessThanOrEqual(1)
  })
})

describe('Spanish', () => {
  const s = () => courses.es
  it('flags a misspelling with the closest word, and spelling by ear', () => {
    const t = 'Mi familia es pequeña. Mi padre se yama Juan y tiene cincuenta anos. Tengo una hermana.'
    const r = s().score(t)
    expect(issueAt(r, t, 'yama')).toMatchObject({ category: 'spelling', code: 'typo', suggestion: 'llama' })
    expect(issueAt(r, t, 'anos')).toMatchObject({ category: 'spelling', code: 'typo', suggestion: 'años' })
    expect(r.scores.spelling).toBeLessThan(80)
  })
  it('flags a wrong gender and a wrong person as "Check:" grammar points', () => {
    const t = 'Mi familia es pequeña. La padre se llama Juan y tiene cincuenta años. Yo tiene una hermana.'
    const r = s().score(t)
    const g = issueAt(r, t, 'La padre')
    expect(g).toMatchObject({ category: 'grammar', code: 'agreement' })
    expect(g!.message).toMatch(/^Check: /)
    const v = issueAt(r, t, 'Yo tiene')
    expect(v).toMatchObject({ category: 'grammar', code: 'verb-agreement', suggestion: 'tengo' })
    expect(r.stars).toBeLessThanOrEqual(2)
  })
  it('missing accents are minor and fixable', () => {
    const t = 'Mi familia es pequeña. Mi padre se llama Juan y tiene cincuenta años. Mi madre tambien.'
    const r = s().score(t)
    const a = issueAt(r, t, 'tambien')!
    expect(a).toMatchObject({ code: 'accent', severity: 'minor', suggestion: 'también', safe: true })
    expect(applySuggestion(t, a)).toContain('Mi madre también.')
  })
  it('mechanics: a capital to start, a full stop to end, ¿…?', () => {
    const t = 'mi familia es pequeña. Mi padre se llama Juan y tiene cincuenta años. Cómo se llama tu madre?'
    const r = s().score(t)
    const cap = issueAt(r, t, 'mi')!
    expect(cap).toMatchObject({ code: 'capital', suggestion: 'Mi', safe: true })
    expect(applySuggestion(t, cap).startsWith('Mi familia')).toBe(true)
    expect(codes(r)).toContain('inverted')
    const r2 = s().score('Mi familia es pequeña. Mi padre se llama Juan y tiene cincuenta años')
    expect(codes(r2)).toContain('end-punct')
  })
  it('names, numbers and words above the level are not spelling mistakes', () => {
    const t = 'Mi familia vive en Rosario. Mi padre se llama Bartolomé y tiene 52 años. Mi madre es arquitecta.'
    const r = s().score(t)
    expect(r.issues.filter((x) => x.category === 'spelling')).toEqual([])
    expect(r.vocabulary.ambitious.length).toBeGreaterThan(0)
  })
  it('shows the hint of an unmet expectation', () => {
    const r = s().score('La familia de Juan es pequeña. El padre se llama Juan y la madre se llama Rosa. Son muy simpáticos.')
    expect(r.task.expectMet).toEqual([])
    expect(r.notes.task).toEqual(expect.arrayContaining(['Use possessives: mi padre, mis hermanos …', 'Give an age: tiene … años.']))
    expect(r.scores.task).toBeLessThan(70)
  })
})

describe('Portuguese', () => {
  it('flags spelling, gender and person', () => {
    const t = 'Minha família é pequena. O mãe se chama Rita. Eu tem uma irmã e um irmao.'
    const r = courses.pt.score(t)
    expect(issueAt(r, t, 'O mãe')).toMatchObject({ category: 'grammar', code: 'agreement' })
    expect(issueAt(r, t, 'Eu tem')).toMatchObject({ code: 'verb-agreement', suggestion: 'tenho' })
    expect(issueAt(r, t, 'irmao')).toMatchObject({ category: 'spelling', suggestion: 'irmão' })
  })
})

describe('Italian', () => {
  it('flags spelling, gender and person', () => {
    const t = 'La mia famiglia è piccola. Il madre si chiama Anna. Io hai un fratelo.'
    const r = courses.it.score(t)
    expect(issueAt(r, t, 'Il madre')).toMatchObject({ category: 'grammar', code: 'agreement' })
    expect(issueAt(r, t, 'Io hai')).toMatchObject({ code: 'verb-agreement', suggestion: 'ho' })
    expect(issueAt(r, t, 'fratelo')).toMatchObject({ code: 'typo', suggestion: 'fratello' })
  })
  it('does not crash on elisions the checker used to trip on', () => {
    expect(() => courses.it.score("È un ipocrita: pensavo che avesse cambiato idea, invece dice una cosa e ne fa un'altra.")).not.toThrow()
  })
})

describe('French', () => {
  it('flags spelling, gender and person', () => {
    const t = "Ma famille est petite. Un ville anglaise. Je parlez français et mon pere s'appelle Paul."
    const r = courses.fr.score(t)
    expect(issueAt(r, t, 'Un ville')).toMatchObject({ category: 'grammar' })
    expect(issueAt(r, t, 'Je parlez')).toMatchObject({ code: 'verb-agreement', suggestion: 'parle' })
    expect(issueAt(r, t, 'pere')).toMatchObject({ category: 'spelling', suggestion: 'père' })
  })
  it('does not count a copy of the question as an answer', () => {
    const r = courses.fr.score('Tu as une grande famille ?')
    expect(r.task.copied).toBe(true)
  })
})

describe('Cantonese', () => {
  const y = () => courses.yue
  it('counts characters, not words', () => {
    expect(y().score('我有兩隻狗。').task.length).toBe(5)
  })
  it('flags a wrong measure word, 唔有, 二 before a measure word and 嗎 after A-not-A', () => {
    const r1 = y().score('我有一個狗，冇貓。我住喺香港。')
    expect(r1.issues.some((x) => x.category === 'grammar' && /隻/.test(x.message))).toBe(true)
    const r2 = y().score('我有兩隻狗，唔有貓。我住喺香港。')
    expect(r2.issues.some((x) => x.code === 'learner-error' && /冇/.test(x.message))).toBe(true)
    const r3 = y().score('我有二隻狗，冇貓。我住喺香港。')
    expect(r3.issues.some((x) => x.code === 'learner-error' && /兩/.test(x.message))).toBe(true)
    const r4 = y().score('你有冇狗嗎？我有兩隻狗，冇貓。')
    expect(r4.issues.some((x) => x.code === 'learner-error' && /A-not-A/.test(x.message))).toBe(true)
  })
  it('a 嗎 question ends with ？', () => {
    const t = '你有貓嗎。我有兩隻狗，冇貓。'
    const r = y().score(t)
    const q = r.issues.find((x) => x.code === 'question-mark')!
    expect(applySuggestion(t, q)).toBe('你有貓嗎？我有兩隻狗，冇貓。')
  })
  it('Jyutping-only gets a gentle nudge towards characters, not a fail', () => {
    const t = 'ngo5 jau5 loeng5 zek3 gau2, mou5 maau1. ngo5 zyu6 hai2 hoeng1 gong2.'
    const r = y().score(t)
    expect(r.issues.every((x) => x.code !== 'script' || x.severity === 'minor')).toBe(true)
    expect(r.issues.find((x) => t.slice(x.start, x.end) === 'gau2')?.suggestion).toBe('狗')
    expect(r.task.used.length).toBeGreaterThanOrEqual(3)
    expect(r.notes.spelling[0]).toMatch(/Jyutping/)
    expect(r.overall).toBeGreaterThanOrEqual(45)
  })
  it('suggests traditional characters for simplified ones', () => {
    const t = '我有两只狗，冇猫。'
    const r = y().score(t)
    const s = r.issues.filter((x) => x.code === 'simplified')
    expect(s.map((x) => x.suggestion)).toEqual(expect.arrayContaining(['兩', '貓']))
  })
  it('names in Latin letters are fine', () => {
    const r = y().score('我叫Leo。我有兩隻狗，冇貓。')
    expect(r.issues.filter((x) => x.category === 'spelling')).toEqual([])
  })
})

describe('content check of writing prompts', () => {
  const unit = (writing: WritingPrompt[]) => ({ id: 'a1.u03', lessons: [{ vocab: [...courses.es.unitWords] }], writing })
  const refs = () => ({ level: 'a1' as LevelId, vocab: (id: string) => courses.es.kit.vocab.has(id), grammar: (id: string) => id === 'g.possessives' })
  it('accepts a good set', () => {
    const p = courses.es.prompt
    const r = checkWritingPrompts(unit([p, p, p]), courses.es.kit, refs())
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
  })
  it('reports broken prompts and a model answer that misses its own task', () => {
    const p = courses.es.prompt
    const bad: WritingPrompt = { ...p, min: 50, max: 40, use: ['w.nope', ...p.use], useAtLeast: 9, grammar: ['g.nope'], expect: [{ pattern: '(unclosed', hint: 'x' }] }
    const r = checkWritingPrompts(unit([bad, p]), courses.es.kit, refs())
    const all = r.errors.join('\n')
    expect(all).toMatch(/2 writing prompts/)
    expect(all).toMatch(/min 50 is more than max 40/)
    expect(all).toMatch(/unknown vocab w.nope/)
    expect(all).toMatch(/useAtLeast 9/)
    expect(all).toMatch(/unknown grammar g.nope/)
    expect(all).toMatch(/does not compile/)
    expect(all).toMatch(/the model answer has \d+ words/)
    expect(all).toMatch(/matches none of its expect patterns/)
  })
  it('warns about a model answer the scorer flags', () => {
    const p = { ...courses.es.prompt, model: { es: 'Mi familia es pequena. La padre tiene cincuenta años y mi madre tiene cuarenta.', en: '' } }
    const r = checkWritingPrompts(unit([p, p, p]), courses.es.kit, refs())
    expect(r.warnings.join('\n')).toMatch(/flags the model answer/)
  })
  it('passes from 60', () => {
    expect(WRITING_PASS).toBe(60)
  })
})

describe('writing rewards', async () => {
  const { writingCoins, WRITING_PROMPT_COINS, WRITING_STARS_BONUS, WRITING_SET_BONUS } = await import('@/engine/economy')
  const { writingXp } = await import('@/engine/xp')
  it('pays a first pass, a first three stars and the whole set once', () => {
    expect(writingCoins({ firstPass: true, firstThreeStars: false, setDone: false })).toBe(WRITING_PROMPT_COINS)
    expect(writingCoins({ firstPass: true, firstThreeStars: true, setDone: true })).toBe(WRITING_PROMPT_COINS + WRITING_STARS_BONUS + WRITING_SET_BONUS)
    expect(writingCoins({ firstPass: false, firstThreeStars: false, setDone: false })).toBe(0)
  })
  it('gives km for a first pass and a little for a new best', () => {
    expect(writingXp(90, true, false)).toBe(19)
    expect(writingXp(70, false, true)).toBe(2)
    expect(writingXp(70, false, false)).toBe(0)
  })
})

describe('mechanics stay quiet on correct writing', () => {
  const mech = (lang: Lang, t: string) => courses[lang].score(t).issues.filter((x) => ['capital', 'end-punct', 'inverted', 'question-mark'].includes(x.code)).map((x) => `${x.code} ${t.slice(x.start, x.end)}`)
  it('dialogue tags, dates, decimals and signatures', () => {
    expect(mech('es', '¡Qué bien! —dijo mi madre. Tengo 3.5 euros.')).toEqual([])
    expect(mech('fr', '« Toujours ton navire ! s\'écria-t-elle. » Le 6 juin 1944. Bonne journée, Marius')).toEqual([])
    expect(mech('it', 'Ciao Marco,\nla mia famiglia è piccola.\nUn abbraccio,\nTom')).toEqual([])
    expect(mech('yue', '我想訂一千個餅盒。此致 貴公司 陳小姐謹上')).toEqual([])
  })
  it('a Spanish question opened mid-sentence', () => {
    expect(mech('es', 'Y tú, ¿cómo te llamas?')).toEqual([])
  })
})

describe('when unsure, no flag (content agents’ reports)', () => {
  const at = (lang: Lang, text: string, level: LevelId = 'a1') => scoreWriting(text, courses[lang].prompt, courses[lang].kit, { level, unitWords: courses[lang].unitWords })
  const grammarIn = (lang: Lang, text: string, level?: LevelId) => at(lang, text, level).issues.filter((x) => x.category === 'grammar' && !['capital', 'end-punct'].includes(x.code)).map((x) => text.slice(x.start, x.end))
  const spellingIn = (lang: Lang, text: string, level?: LevelId) => at(lang, text, level).issues.filter((x) => x.category === 'spelling').map((x) => text.slice(x.start, x.end))
  it('Cantonese: 結他, modifiers before the counted noun, homophones, 本 = "this", code-mixing', () => {
    expect(grammarIn('yue', '我識彈結他，仲識唱歌。')).toEqual([])
    expect(grammarIn('yue', '我哋去咗一間網紅餐廳。')).toEqual([])
    expect(grammarIn('yue', '佢喺一間珠寶店做嘢。')).toEqual([])
    expect(grammarIn('yue', '本公園十點關門。')).toEqual([])
    const mixed = at('yue', '我聽日要present個project，仲要寫report同book枱。', 'b2')
    expect(mixed.task.english).toBe(false)
    expect(mixed.issues.filter((x) => x.category === 'spelling')).toEqual([])
    // still caught: a measure word that ends the phrase, and Mandarin 他
    expect(grammarIn('yue', '我有一個狗。')).not.toEqual([])
    expect(grammarIn('yue', '他是我的朋友。')).not.toEqual([])
  })
  it('Portuguese: o caixa eletrônico, muito as an adverb, compounds, de + o before an infinitive, "!,"', () => {
    expect(grammarIn('pt', 'Fui ao caixa eletrônico.')).toEqual([])
    expect(grammarIn('pt', 'Ele é muito gente boa e chegou muito tarde.')).toEqual([])
    expect(grammarIn('pt', 'Vou todas as terças ao mercado.')).toEqual([])
    expect(grammarIn('pt', 'Deixei de o detestar.')).toEqual([])
    const t = 'Ela disse “Aparece lá em casa!”, nem mais nem menos.'
    expect(at('pt', t).issues.filter((x) => x.code === 'capital')).toEqual([])
    expect(grammarIn('pt', 'O mãe se chama Rita.')).toEqual(['O mãe'])
  })
  it('Portuguese spelling: derivations, compounds, accents typed on purpose', () => {
    expect(spellingIn('pt', 'A criação e a transformação da cidade foram rápidas.')).toEqual([])
    expect(spellingIn('pt', 'Moro no rés-do-chão, perto do castelo.', 'b1')).toEqual([])
    expect(spellingIn('pt', 'A matrícula está paga.')).toEqual([])
  })
  it('French: names, à la + noun, à la fois, inclusive writing', () => {
    expect(grammarIn('fr', "J'aime la Bourgogne.")).toEqual([])
    expect(grammarIn('fr', 'Les Corses sont fiers.')).toEqual([])
    expect(grammarIn('fr', 'On boit un digestif à la myrte.')).toEqual([])
    expect(grammarIn('fr', "C'est à la fois très ancien et moderne.")).toEqual([])
    const t = 'Les étudiant·es sont là.'
    expect(at('fr', t).issues).toEqual([])
    expect(grammarIn('fr', 'Un ville anglaise.')).not.toEqual([])
  })
  it('advanced writing: a real word near another is not a typo, a slip still is', () => {
    expect(spellingIn('fr', "C'est une vaste région, très banale.", 'c2')).toEqual([])
    expect(spellingIn('it', 'Ho un fratelo.', 'b2')).toEqual(['fratelo'])
    expect(spellingIn('es', 'La ciudad tiene una estación nueva y la situación es tranquila.', 'b1')).toEqual([])
  })
})

describe('Italian: when unsure, no flag', () => {
  const at = (text: string, level: LevelId = 'a2') => scoreWriting(text, courses.it.prompt, courses.it.kit, { level, unitWords: courses.it.unitWords })
  const flags = (text: string) => at(text).issues.filter((x) => !['capital', 'end-punct'].includes(x.code)).map((x) => `${x.code} ${text.slice(x.start, x.end)}`)
  it('adverbs, names, mentioned words, homographs, dish names', () => {
    for (const t of ['I cannoli sono molto dolci.', 'Sono parole molto comuni.', 'La signora Rossi è qui.', 'Andiamo alla spiaggia privata Sole.', 'Mi piace la parola petaloso.', 'Mi piace il nome onestà.', 'Ordino la cacio e pepe.', 'Siamo nelle sale del museo.']) expect(flags(t), t).toEqual([])
  })
  it('spelling: pure, part-time, luoghi, me and te', () => {
    for (const t of ['Vengo pure io.', 'Lavoro part-time.', 'Ci sono molti luoghi belli.', 'Dico a te e a me.']) expect(flags(t), t).toEqual([])
  })
  it('sign-offs and questions inside guillemets', () => {
    expect(at('Ci vediamo domani. A presto, Tom').issues.filter((x) => x.code === 'end-punct')).toEqual([])
    expect(at('Mi ha chiesto: «Vieni? disse lei» e sono andato.').issues.filter((x) => x.code === 'capital')).toEqual([])
  })
  it('a pronominal verb counts with its clitics apart', () => {
    const p = { ...courses.it.prompt, use: ['w.prendersela'], useAtLeast: 1, expect: [] }
    if (!courses.it.kit.vocab.has('w.prendersela')) return
    const r = scoreWriting('Non me la sono presa.', p, courses.it.kit, { level: 'b1', unitWords: new Set() })
    expect(r.task.used).toEqual(['w.prendersela'])
  })
  it('still catches real errors', () => {
    expect(flags('Il madre si chiama Anna.')).toEqual(['agreement Il madre'])
  })
})

describe('Spanish: when unsure, no flag', () => {
  const at = (text: string, level: LevelId = 'b1') => scoreWriting(text, courses.es.prompt, courses.es.kit, { level, unitWords: courses.es.unitWords })
  const flags = (text: string, level?: LevelId) => at(text, level).issues.filter((x) => !['end-punct'].includes(x.code)).map((x) => `${x.code} ${text.slice(x.start, x.end)}`)
  it('accents typed on purpose, adverbs, names, ellipses', () => {
    for (const t of [
      'Luis insinúa que el error fue mío.',
      'Lo tituló así y llenó la página.',
      'La torre es un poco alta.',
      'Quiero dejar la oficina justo ahora.',
      'El árabe dejó en el español palabras como almohada.',
      'Viajamos de El Bolsón a El Chaltén.',
      'Es responsable para garantizar la seguridad.',
      'Pues... no sé qué decir.',
      'Mi hermano entretiene a los niños y ellos se entretienen.',
    ]) expect(flags(t), t).toEqual([])
  })
  it('words the course writes about are not spelling mistakes', () => {
    for (const t of ['Bailamos en el carnaval con un gaucho.', 'Comimos una empanada y un alfajor cerca de las cataratas.', 'Vimos una ballena y un pingüino en el sur.']) expect(flags(t, 'a2').filter((x) => x.startsWith('typo')), t).toEqual([])
  })
  it('the expect patterns use Unicode word boundaries', () => {
    const p = { ...courses.es.prompt, expect: [{ pattern: '\\ba[nñ]os\\b', hint: 'x' }] }
    expect(scoreWriting('Tengo veinte años.', p, courses.es.kit, { level: 'a1' }).task.expectMet).toEqual([0])
  })
})
