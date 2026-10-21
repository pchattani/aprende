import { describe, it, expect } from 'vitest'
import { taughtIndex, makeTaughtGate, gateLesson, exchangeVerdict, TAUGHT_MIN } from '@/engine/taught'
import { addWords } from '@/lang/yue/lexicon'
import { tokenize } from '@/lang/yue/tokenize'
import { PackSchema, type Lesson, type VocabEntry } from '@/engine/schema'

// The taught-words gate on Cantonese text (pure: the Cantonese tokenizer is imported directly, so this runs in every course).
const V = (id: string, lemma: string, jp: string, pos: VocabEntry['pos'], en: string): VocabEntry => ({ id, lemma, jp, pos, en: [en], level: 'a1', tags: [] }) as VocabEntry
const words = [
  V('w.jat1', '一', 'jat1', 'num', 'one'), V('w.ji6', '二', 'ji6', 'num', 'two'), V('w.saam1', '三', 'saam1', 'num', 'three'),
  V('w.ng5', '五', 'ng5', 'num', 'five'), V('w.sap6', '十', 'sap6', 'num', 'ten'), V('w.nei5', '你', 'nei5', 'pron', 'you'),
  V('w.ngo5', '我', 'ngo5', 'pron', 'I'), V('w.hou2', '好', 'hou2', 'adj', 'good'), V('w.nei5-hou2', '你好', 'nei5 hou2', 'phrase', 'hello'),
  V('w.hai6', '係', 'hai6', 'verb', 'to be'), V('w.sik6', '食', 'sik6', 'verb', 'to eat'), V('w.zo2', '咗', 'zo2', 'particle', '(done)'),
  V('w.faan6', '飯', 'faan6', 'noun', 'rice'), V('w.ge3', '嘅', 'ge3', 'particle', "'s"),
]
const vocab = new Map(words.map((v) => [v.id, v]))
addWords(words)
const gate = (ids: string[], names: string[] = []) => makeTaughtGate(ids, vocab, tokenize, names)
const all = words.map((w) => w.id)

describe('taught coverage', () => {
  it('counts only words: punctuation, digits and Latin script (Leo, Jyutping) are left out', () => {
    const g = gate(['w.nei5-hou2', 'w.jat1', 'w.ji6'])
    expect(g.coverage('你好，Leo！').total).toBe(1)
    expect(g.coverage('你好，Leo！').ratio).toBe(1)
    expect(g.coverage('一、二、3、4！').total).toBe(2)
    expect(g.coverage('nei5 hou2').total).toBe(0)
    expect(g.ok('……！')).toBe(true)
  })
  it('leaves out proper nouns from known.yaml however the segmenter cuts them', () => {
    const g = gate(all, ['香港', '維多利亞港'])
    expect(g.coverage('我係香港人').unknownForms.has('人')).toBe(true)
    expect(g.coverage('我係香港人').total).toBe(3)
    expect(g.coverage('維多利亞港好好').ratio).toBe(1)
  })
  it('leaves out sentence-final particles, but not 呢 before a word nor grammar particles (嘅, 咗)', () => {
    const g = gate(['w.nei5-hou2', 'w.ngo5', 'w.hou2', 'w.nei5'])
    expect(g.ok('你好呀！')).toBe(true)
    expect(g.ok('我好好，你呢？')).toBe(true)
    expect(g.coverage('好啦喎。').total).toBe(1)
    expect(g.coverage('呢個好').unknownForms.size).toBeGreaterThan(0)
    expect(g.ok('我食咗飯。')).toBe(false)
    expect(gate(['w.ngo5', 'w.sik6', 'w.faan6']).coverage('我食咗飯。').unknownForms.has('咗')).toBe(true)
    expect(gate(['w.ngo5', 'w.sik6', 'w.faan6', 'w.zo2']).ok('我食咗飯呀。')).toBe(true)
    expect(gate(['w.ngo5', 'w.hou2']).coverage('我嘅').total).toBe(2)
  })
  it('cuts words kept whole by the segmenter into taught parts (十一 = 十 + 一)', () => {
    const g = gate(['w.jat1', 'w.sap6', 'w.ji6'])
    expect(g.ok('十一、十二、二十一。')).toBe(true)
    expect(g.ok('二加三係幾多呀？')).toBe(false)
    expect([...g.coverage('二加三係幾多呀？').unknownForms.keys()]).toEqual(expect.arrayContaining(['加', '三', '係', '幾多']))
  })
  it('needs TAUGHT_MIN of the words', () => {
    expect(TAUGHT_MIN).toBe(0.95)
    const g = gate(['w.jat1', 'w.ji6', 'w.saam1'])
    expect(g.ok('一、二、三。')).toBe(true)
    expect(g.ok('一、二、三、五。')).toBe(false) // 3 of 4
  })
})

describe('taught index', () => {
  const L = (id: string, vocab: string[]) => ({ id, vocab })
  const levels = [{ units: [{ id: 'a1.u13' }, { id: 'a1.u14' }, { id: 'a1.u01' }] }, { units: [{ id: 'a2.u01' }] }]
  const units = [
    { id: 'a1.u01', lessons: [L('a1.u01.l1', ['w.c']), L('a1.u01.l2', ['w.d'])] },
    { id: 'a2.u01', lessons: [L('a2.u01.l1', ['w.e'])] },
    { id: 'a1.u13', lessons: [L('a1.u13.l1', ['w.a']), L('a1.u13.l2', ['w.b'])] },
    { id: 'a1.u14', lessons: [L('a1.u14.l1', [])] },
  ]
  const index = taughtIndex(levels, units)
  it('orders lessons by level, then units as the syllabus lists them (starter units first), then lessons in file order', () => {
    expect(index.order).toEqual(['a1.u13.l1', 'a1.u13.l2', 'a1.u14.l1', 'a1.u01.l1', 'a1.u01.l2', 'a2.u01.l1'])
  })
  it('accumulates the words of the lesson and every earlier one', () => {
    expect([...index.at('a1.u13.l1')]).toEqual(['w.a'])
    expect([...index.at('a1.u14.l1')]).toEqual(['w.a', 'w.b'])
    expect([...index.at('a1.u01.l2')]).toEqual(['w.a', 'w.b', 'w.c', 'w.d'])
    expect(index.at('a2.u01.l1').size).toBe(5)
    expect(index.at('b1.u01.l1').size).toBe(0)
    expect(index.furthest(['a1.u01.l1', 'a1.u13.l2', 'zz'])).toBe('a1.u01.l1')
  })
})

describe('lesson items at the gate', () => {
  const g = gate(['w.jat1', 'w.ji6', 'w.saam1', 'w.ng5'])
  const x = (q: string, qen: string, a: string, aen: string) => ({ q: { es: q, en: qen, altEs: [], altEn: [] }, a: { es: a, en: aen, altEs: [], altEn: [] }, alt: [], grammar: [], vocab: [] })
  it('passes taught exchanges, asks the rest in English when the answer is taught, else skips them', () => {
    expect(exchangeVerdict(x('一、二……', 'One, two...', '三！', 'Three!'), g)).toBe('pass')
    expect(exchangeVerdict(x('二加三係幾多呀？', "What's two plus three?", '五。', 'Five.'), g)).toBe('english')
    expect(exchangeVerdict(x('你食咗飯未呀？', 'Have you eaten?', '食咗喇。', 'Yes.'), g)).toBe('skip')
  })
  it('reports passing, English-asked and skipped items with their blocking words', () => {
    const lesson = {
      id: 'a1.u13.l1',
      sentences: ['一。', '二。', '三。', '二同三。'].map((es) => ({ es, en: '-', altEs: [], altEn: [], grammar: [], vocab: [] })),
      exchanges: [x('二加三係幾多呀？', "What's two plus three?", '五。', 'Five.'), x('一加一係幾多呀？', "What's one plus one?", '二！', 'Two!')],
      texts: [{ es: ['一、二、三。', '五！'], en: ['One, two, three.', 'Five!'], grammar: [], vocab: [] }],
    } satisfies Pick<Lesson, 'id' | 'sentences' | 'exchanges' | 'texts'>
    const r = gateLesson(lesson, g)
    expect([r.pass, r.english, r.skip]).toEqual([4, 2, 1])
    expect(r.blocking[0]![0]).toMatch(/加|係|幾多/)
    expect(r.blocking.map(([w]) => w)).toContain('同')
  })
})

describe('the features.taughtOnly flag', () => {
  const packs = import.meta.glob('/content/*/pack.yaml', { eager: true, import: 'default' }) as Record<string, unknown>
  it('is on for Cantonese only (every other course generates as before)', () => {
    expect(Object.keys(packs).length).toBeGreaterThanOrEqual(5)
    for (const [path, raw] of Object.entries(packs)) expect(PackSchema.parse(raw).features.taughtOnly, path).toBe(path.includes('/yue/'))
  })
})
