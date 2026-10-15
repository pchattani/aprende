import { describe, it, expect } from 'vitest'
import { parseRun, stripTones, looksLikeJyutping } from '@/lang/yue/jyutping'
import { toSyllables, addWords, romanize, validateReading, validateText, wordsOf, useSentenceReadings } from '@/lang/yue/lexicon'
import { match, normalize } from '@/lang/yue/normalize'
import { chineseToNumber, numberWordsToDigits, hasNumberWord } from '@/lang/yue/numbers'
import { check } from '@/lang/yue/checker'
import { buildDictionary, lookup } from '@/lang/yue/inflect'
import { tokenize } from '@/lang/yue/tokenize'
import type { VocabEntry } from '@/engine/schema'

const V = (id: string, lemma: string, jp: string, pos: VocabEntry['pos'], en: string, extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id, lemma, jp, pos, en: [en], level: 'a1', tags: [], ...extra }) as VocabEntry

addWords([
  { lemma: '銀行', jp: 'ngan4 hong4' },
  { lemma: '你好', jp: 'nei5 hou2' },
  { lemma: '多謝', jp: 'do1 ze6' },
  { lemma: '唔該', jp: 'm4 goi1' },
])

describe('Jyutping', () => {
  it('parses syllables with and without spaces and tones', () => {
    expect(parseRun('nei5hou2')).toEqual(['nei5', 'hou2'])
    expect(parseRun('neihou')).toEqual(['nei', 'hou'])
    expect(parseRun('ngo5')).toEqual(['ngo5'])
    expect(parseRun('xyzzy')).toBeUndefined()
    expect(stripTones('nei5 hou2')).toBe('nei hou')
    expect(looksLikeJyutping('nei5 hou2')).toBe(true)
    expect(looksLikeJyutping('你好')).toBe(false)
  })
  it('romanises characters, preferring course words for polyphones', () => {
    expect(toSyllables('你好')).toEqual(['nei5', 'hou2'])
    expect(toSyllables('我去銀行。')).toEqual(['ngo5', 'heoi3', 'ngan4', 'hong4'])
    expect(toSyllables('nei5 hou2!')).toEqual(['nei5', 'hou2'])
    expect(normalize('你好', { accentInsensitive: true })).toBe('nei hou')
  })
  it('gives ruby readings per character', () => {
    expect(romanize('你好！')).toEqual([{ text: '你', reading: 'nei5' }, { text: '好', reading: 'hou2' }, { text: '！' }])
  })
  it('reads characters standing alone colloquially and segments into the fewest words', () => {
    addWords([{ lemma: '時間', jp: 'si4 gaan3' }])
    expect(toSyllables('好平')).toEqual(['hou2', 'peng4'])
    expect(toSyllables('好近')).toEqual(['hou2', 'kan5'])
    expect(toSyllables('我冇時間')).toEqual(['ngo5', 'mou5', 'si4', 'gaan3'])
    expect(toSyllables('呢位')).toEqual(['nei1', 'wai2'])
    expect(toSyllables('你呢')).toEqual(['nei5', 'ne1'])
    expect(toSyllables('二十分鐘')).toEqual(['ji6', 'sap6', 'fan1', 'zung1'])
  })
  it('uses an authored sentence reading over the automatic one', () => {
    useSentenceReadings([{ es: '陳太請我飲茶。', jp: 'can4 taai2 ceng2 ngo5 jam2 caa4' }])
    expect(toSyllables('陳太請我飲茶')).toEqual(['can4', 'taai2', 'ceng2', 'ngo5', 'jam2', 'caa4'])
    expect(romanize('陳太請我飲茶！')[1]).toEqual({ text: '太', reading: 'taai2' })
    expect(validateReading('睇吓', 'tai2 haa5')).toEqual([])
  })
  it('segments words for tiles and tokens', () => {
    expect(wordsOf('多謝你！')).toEqual(['多謝', '你'])
    expect(tokenize('我去銀行').filter((t) => t.kind === 'word').map((t) => t.text)).toEqual(['我', '去', '銀行'])
  })
  it('validates vocabulary readings against the dictionary', () => {
    expect(validateReading('銀行', 'ngan4 hong4')).toEqual([])
    expect(validateReading('好', 'hou5')[0]).toMatch(/not hou5/)
    expect(validateReading('你好', 'nei5')[0]).toMatch(/syllables/)
    expect(validateText('你好')).toEqual([])
    // changed tones (變調) and particle tones are accepted
    expect(validateReading('陳太', 'can4 taai2')).toEqual([])
    expect(validateReading('呀', 'aa3')).toEqual([])
    expect(validateReading('爸爸', 'baa4 baa1')).toEqual([])
    expect(validateReading('好', 'hou4')[0]).toMatch(/not hou4/)
  })
})

describe('Cantonese answer matching', () => {
  it('accepts Jyutping or characters for the same answer', () => {
    expect(match('nei5 hou2', ['你好。']).verdict).toBe('correct')
    expect(match('nei5hou2', ['你好']).verdict).toBe('correct')
    expect(match('你好', ['你好！']).verdict).toBe('correct')
  })
  it('treats missing or wrong tones like missing accents', () => {
    const r = match('nei hou', ['你好'])
    expect(r.verdict).toBe('almost')
    expect(r.reason).toBe('accents')
    expect(match('nei5 hou3', ['你好']).reason).toBe('accents')
  })
  it('rejects a different answer', () => {
    expect(match('do1 ze6', ['唔該']).verdict).toBe('wrong')
  })
})

describe('Chinese numerals', () => {
  it('reads numerals', () => {
    const cases: [string, number][] = [['十五', 15], ['二十一', 21], ['廿一', 21], ['一百零五', 105], ['二百五', 250], ['三千二', 3200], ['一萬', 10000], ['萬五', 15000], ['一九九七', 1997], ['兩', 2], ['十五萬', 150000]]
    for (const [c, n] of cases) expect(chineseToNumber(c), c).toBe(n)
  })
  it('converts characters and Jyutping numerals, leaving other words alone', () => {
    expect(numberWordsToDigits('我有十五歲')).toBe('我有15歲')
    expect(numberWordsToDigits('ngo5 jau5 sap6 ng5 seoi3')).toBe('ngo5 jau5 15 seoi3')
    expect(numberWordsToDigits('慢慢行')).toBe('慢慢行')
    expect(numberWordsToDigits('maan6 maan2 haang4')).toBe('maan6 maan2 haang4')
    expect(hasNumberWord('十五')).toBe(true)
    expect(hasNumberWord('慢慢')).toBe(false)
  })
})

describe('Cantonese checker and dictionary', () => {
  const entries = [V('w.go3', '個', 'go3', 'classifier', 'general measure word'), V('w.zek3', '隻', 'zek3', 'classifier', 'measure word for animals'), V('w.gau2', '狗', 'gau2', 'noun', 'dog', { cl: '隻' }), V('w.jan4', '人', 'jan4', 'noun', 'person', { cl: '個' })]
  addWords(entries)
  const dict = buildDictionary(entries)
  it('looks up characters and Jyutping', () => {
    expect(lookup(dict, '狗')?.[0]?.id).toBe('w.gau2')
    expect(lookup(dict, 'gau2')?.[0]?.id).toBe('w.gau2')
    expect(lookup(dict, 'gau')?.[0]?.id).toBe('w.gau2')
  })
  it('flags the wrong measure word', () => {
    const f = check('我有一個狗。', { dict, rules: [] })
    expect(f[0]?.code).toBe('agreement')
    expect(f[0]?.message).toMatch(/隻/)
    expect(check('我有一隻狗。', { dict, rules: [] })).toEqual([])
  })
})
