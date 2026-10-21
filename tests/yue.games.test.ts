import { describe, it, expect } from 'vitest'
import { Rng } from '@/engine/random'
import type { VocabEntry } from '@/engine/schema'
import { CLASSIFIERS, COUNT_WORDS, acceptableClassifiers, classifierOf, distractorClassifiers, isWrongFor, measureQuestion, measureRound, sortBoard } from '@/engine/games/measureWords'
import { MINIMAL_SETS, TONES, TONE_ITEMS, TONE_LIST, parseJyutping, parseSyllable, plainReading, sameOrDifferentRound, toneLabel, toneless, tonesOf, toneWords, whichToneRound, wordToneRound } from '@/engine/games/tones'
import { charReadings } from '@/lang/yue/jyutping'

const N = (lemma: string, jp: string, cl: string | undefined, en: string, topic?: string): VocabEntry =>
  ({ id: `w.${jp.replace(/ /g, '-')}`, lemma, jp, pos: 'noun', cl, en: [en], level: 'a1', tags: [], topic }) as VocabEntry

const NOUNS = [
  N('狗', 'gau2', '隻', 'dog', 'animals'),
  N('貓', 'maau1', '隻', 'cat', 'animals'),
  N('魚', 'jyu2', '條', 'fish', 'animals'),
  N('褲', 'fu3', '條', 'trousers', 'clothing'),
  N('書', 'syu1', '本', 'book', 'school'),
  N('雜誌', 'zaap6 zi3', '本', 'magazine', 'media'),
  N('紙', 'zi2', '張', 'paper', 'school'),
  N('枱', 'toi2', '張', 'table', 'furniture'),
  N('椅', 'ji2', '張', 'chair', 'furniture'),
  N('車', 'ce1', '架', 'car', 'transport'),
  N('巴士', 'baa1 si2', '架', 'bus', 'transport'),
  N('手機', 'sau2 gei1', '部', 'mobile phone', 'tech'),
  N('屋', 'uk1', '間', 'house', 'house'),
  N('學校', 'hok6 haau6', '間', 'school', 'school'),
  N('衫', 'saam1', '件', 'clothes', 'clothing'),
  N('筆', 'bat1', '枝', 'pen', 'school'),
  N('雞蛋', 'gai1 daan2', '隻', 'egg', 'food'),
  N('粥', 'zuk1', '碗', 'congee', 'food'),
  N('茶', 'caa4', undefined, 'tea', 'food'),
  N('朋友', 'pang4 jau5', '個', 'friend', 'relationships'),
  N('蘋果', 'ping4 gwo2', '個', 'apple', 'food'),
  N('鞋', 'haai4', '對', 'shoe', 'clothing'),
  N('日', 'jat6', '日', 'day', 'time'),
]

describe('measure words', () => {
  it('takes the classifier from `cl`, cups for drinks, and skips self-counting nouns', () => {
    expect(classifierOf(NOUNS[0]!)).toBe('隻')
    expect(classifierOf(N('茶', 'caa4', undefined, 'tea'))).toBe('杯')
    expect(classifierOf(N('日', 'jat6', '日', 'day'))).toBeUndefined()
    expect(classifierOf({ ...NOUNS[0]!, pos: 'verb' })).toBeUndefined()
  })

  it('always asks for the noun’s own classifier and never offers an acceptable one as wrong', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const v of NOUNS) {
        const q = measureQuestion(v, new Rng(seed))
        if (!classifierOf(v)) {
          expect(q).toBeUndefined()
          continue
        }
        expect(q).toBeDefined()
        expect(q!.options[q!.answer]).toBe(classifierOf(v))
        expect(q!.cl).toBe(v.cl ?? '杯')
        expect(new Set(q!.options).size).toBe(4)
        const wrong = q!.options.filter((_, i) => i !== q!.answer)
        for (const c of wrong) {
          expect(c).not.toBe(q!.cl)
          expect(acceptableClassifiers(v).has(c)).toBe(false)
          expect(CLASSIFIERS[c]).toBeDefined()
        }
      }
    }
  })

  it('keeps look-alike classifiers out of the wrong options', () => {
    const phone = NOUNS.find((v) => v.lemma === '手機')!
    const egg = NOUNS.find((v) => v.lemma === '雞蛋')!
    const pen = NOUNS.find((v) => v.lemma === '筆')!
    const tea = N('茶', 'caa4', undefined, 'tea')
    expect(isWrongFor('架', phone)).toBe(false) // 部/架 both count machines
    expect(isWrongFor('個', phone)).toBe(false) // 個手機 is everyday speech
    expect(isWrongFor('個', egg)).toBe(false)
    expect(isWrongFor('支', pen)).toBe(false)
    expect(isWrongFor('碗', tea)).toBe(false) // containers fit any drink
    expect(isWrongFor('種', NOUNS[0]!)).toBe(false) // 三種狗 "three kinds of dog" is fine
    expect(isWrongFor('本', NOUNS[0]!)).toBe(true)
    for (let seed = 1; seed < 30; seed++) expect(distractorClassifiers(phone, new Rng(seed))).not.toContain('架')
  })

  it('says 兩, not 二, for two', () => {
    const two = COUNT_WORDS.find((c) => c.n === 2)!
    expect(two.ch).toBe('兩')
    expect(two.jp).toBe('loeng5')
    const q = measureQuestion(NOUNS[0]!, new Rng(1), two)!
    expect(q.phrase).toBe('兩隻狗')
    expect(q.phraseJp).toBe('loeng5 zek3 gau2')
  })

  it('builds a 12-noun round of varied classifiers, learner words first', () => {
    const learner = NOUNS.slice(0, 4)
    const round = measureRound(learner, NOUNS, new Rng(7), 12)
    expect(round.length).toBe(12)
    for (const v of learner) expect(round.map((q) => q.noun.lemma)).toContain(v.lemma)
    const per = new Map<string, number>()
    for (const q of round) per.set(q.cl, (per.get(q.cl) ?? 0) + 1)
    for (const [cl, n] of per) expect(n).toBeLessThanOrEqual(cl === '個' ? 3 : 2)
  })

  it('makes a sorting board where each noun fits exactly one basket', () => {
    for (let seed = 1; seed < 30; seed++) {
      const board = sortBoard(NOUNS.slice(0, 6), NOUNS, new Rng(seed))
      expect(board).toBeDefined()
      expect(board!.bins.length).toBe(3)
      expect(board!.nouns.length).toBe(6)
      expect(board!.bins).not.toContain('個')
      for (const v of board!.nouns) {
        const fits = board!.bins.filter((b) => !isWrongFor(b, v))
        expect(fits).toEqual([classifierOf(v)])
      }
    }
  })
})

describe('tones', () => {
  it('parses tones from Jyutping', () => {
    expect(parseSyllable('si4')).toEqual({ base: 'si', tone: 4 })
    expect(parseSyllable('ng5')).toEqual({ base: 'ng', tone: 5 })
    expect(parseSyllable('si')).toBeUndefined()
    expect(parseJyutping('nei5 hou2')).toEqual([
      { base: 'nei', tone: 5 },
      { base: 'hou', tone: 2 },
    ])
    expect(parseJyutping('nei5 hou')).toBeUndefined()
    expect(tonesOf('saam1 gau2 sei3 ling4 ng5 ji6')).toEqual([1, 2, 3, 4, 5, 6])
    expect(toneless('gwong2 dung1 waa2')).toBe('gwong dung waa')
  })

  it('describes the six contours and labels the buttons', () => {
    expect(TONE_LIST.map((t) => TONES[t].name)).toEqual(['high level', 'high rising', 'mid level', 'low falling', 'low rising', 'low level'])
    expect(toneLabel(4)).toBe('tone 4, low falling')
    for (const t of TONE_LIST) {
      const [a, b] = TONES[t].pitch
      if (t === 2 || t === 5) expect(b).toBeGreaterThan(a)
      else if (t === 4) expect(b).toBeLessThan(a)
      else expect(a).toBe(b)
    }
  })

  it('has minimal sets that differ only in tone, each character read exactly as listed', () => {
    for (const set of MINIMAL_SETS) {
      expect(Object.keys(set.tones).length).toBeGreaterThanOrEqual(2)
      for (const t of TONE_LIST)
        for (const [ch] of set.tones[t] ?? []) {
          expect([...ch].length).toBe(1)
          // the character's usual reading is this syllable, so speech says what the game expects
          expect(charReadings(ch)?.[0], ch).toBe(`${set.base}${t}`)
        }
    }
    expect(new Set(TONE_ITEMS.map((x) => x.ch)).size).toBe(TONE_ITEMS.length)
  })

  it('makes same/different pairs on one syllable', () => {
    for (let seed = 1; seed < 40; seed++) {
      const round = sameOrDifferentRound(new Rng(seed), 10)
      expect(round.length).toBe(10)
      const same = round.filter((q) => q.same).length
      expect(same).toBeGreaterThanOrEqual(3)
      expect(same).toBeLessThanOrEqual(5)
      for (const q of round) {
        const a = parseSyllable(q.a.jp)!
        const b = parseSyllable(q.b.jp)!
        expect(a.base).toBe(b.base)
        expect(a.tone === b.tone).toBe(q.same)
      }
    }
  })

  it('only plays learner words whose usual readings match their Jyutping', () => {
    expect(plainReading('你好', 'nei5 hou2', charReadings)).toBe(true)
    expect(plainReading('電話', 'din6 waa2', charReadings)).toBe(false) // changed tone
    expect(plainReading('你好嗎', 'nei5 hou2', charReadings)).toBe(false)
    const words = [N('你好', 'nei5 hou2', undefined, 'hello'), N('電話', 'din6 waa2', '部', 'phone'), N('狗', 'gau2', '隻', 'dog'), N('ABC', 'ei1', undefined, 'abc')]
    expect(toneWords(words, 2, charReadings).map((v) => v.lemma)).toEqual(['你好'])
    expect(toneWords(words, 1, charReadings).map((v) => v.lemma)).toEqual(['狗'])
  })

  it('builds which-tone and word rounds of ten with every tone heard', () => {
    const learner = [N('狗', 'gau2', '隻', 'dog'), N('貓', 'maau1', '隻', 'cat')]
    for (let seed = 1; seed < 20; seed++) {
      const round = whichToneRound(learner, new Rng(seed), 10)
      expect(round.length).toBe(10)
      expect(new Set(round.map((q) => q.tones[0])).size).toBe(6)
      expect(new Set(round.map((q) => q.text)).size).toBe(10)
      for (const q of round) expect(q.tones).toEqual(tonesOf(q.jp))
    }
    const two = [N('你好', 'nei5 hou2', undefined, 'hello'), N('多謝', 'do1 ze6', undefined, 'thanks'), N('早晨', 'zou2 san4', undefined, 'good morning')]
    const words = wordToneRound(two, two, new Rng(3), 10)
    expect(words.length).toBe(3)
    for (const q of words) expect(q.tones.length).toBe(2)
  })
})
