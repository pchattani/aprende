import { describe, it, expect } from 'vitest'
import { stepRain, startRain, nextPrompt, pickLane, pickPrompt, rainSpeed, spawnGap, rainWave, removeDrop, LANE_CLEAR, type RainDrop, type RainState } from '@/engine/games/wordRain'
import { sortRound, belongsToOne, topicsClash, TOPIC_BASKETS, SORT_MIN, type SortRound } from '@/engine/games/sortIt'
import { scoreGuess, keyStates, wordOfDay, dailyLetters, foldWord, guessList, nextStreak, liveStreak, previousDay, msToTomorrow, formatCountdown } from '@/engine/games/dailyWord'
import { vocab, vocabUpTo } from '@/engine/loader'
import { languagePack } from '@lang'
import { Rng } from '@/engine/random'
import type { VocabEntry } from '@/engine/schema'

const V = (id: string, lemma: string, en: string, extra: Partial<VocabEntry> = {}): VocabEntry => ({ id, lemma, pos: 'noun', en: [en], level: 'a1', tags: [], ...extra }) as VocabEntry
const fold = (s: string) => languagePack.stripMarks(languagePack.normalize(s))

// ---------------------------------------------------------------------------- word rain

describe('word rain', () => {
  const ids = ['w.a', 'w.b', 'w.c', 'w.d']
  /** Run the game for `secs` seconds at 60 fps, collecting what landed and what spawned. */
  const run = (s: RainState, secs: number, rng: Rng, reduced = false) => {
    const landed: RainDrop[] = []
    const spawned: RainDrop[] = []
    for (let t = 0; t < secs * 60; t++) {
      const r = stepRain(s, 1 / 60, rng, { reduced })
      s = r.state
      landed.push(...r.landed)
      if (r.spawned) spawned.push(r.spawned)
      // never two words near the top of one lane
      for (let l = 0; l < 3; l++) expect(s.drops.filter((d) => d.lane === l && d.y < LANE_CLEAR * 0.9).length).toBeLessThanOrEqual(1)
      // the answer is on screen at most once
      expect(s.drops.filter((d) => d.id === s.target).length).toBeLessThanOrEqual(1)
    }
    return { s, landed, spawned }
  }

  it('ramps up gently and stays slow with reduced motion', () => {
    expect(rainSpeed(0)).toBeLessThan(rainSpeed(60))
    expect(rainSpeed(60)).toBeLessThan(rainSpeed(150))
    expect(rainSpeed(150)).toBe(rainSpeed(1000))
    expect(1 / rainSpeed(0)).toBeGreaterThan(8) // about 9 s to land at first
    expect(rainSpeed(1000, true)).toBeLessThan(rainSpeed(0) * 0.7)
    expect(spawnGap(0)).toBeGreaterThan(spawnGap(150))
    expect(spawnGap(150, true)).toBeGreaterThan(spawnGap(0))
  })

  it('drops the answer first or second in every wave, distractors deduplicated', () => {
    for (let seed = 1; seed < 40; seed++) {
      const w = rainWave('w.a', ['w.b', 'w.c', 'w.b', 'w.a', 'w.d'], new Rng(seed))
      expect(w.indexOf('w.a')).toBeLessThan(2)
      expect(w.filter((x) => x === 'w.a').length).toBe(1)
      expect([...w].sort()).toEqual(ids)
    }
  })

  it('picks a free lane, avoiding the last one, or none while all are busy at the top', () => {
    const d = (lane: number, y: number, key = lane): RainDrop => ({ key, id: `w.${key}`, lane, y })
    expect(pickLane([d(0, 0.1), d(1, 0.2)], 3, new Rng(1))).toBe(2)
    expect(pickLane([d(0, 0.1), d(1, 0.2), d(2, 0.05)], 3, new Rng(1))).toBe(-1)
    for (let seed = 1; seed < 20; seed++) expect(pickLane([], 3, new Rng(seed), 1)).not.toBe(1)
    expect(pickLane([d(0, 0.9), d(1, 0.1), d(2, 0.1)], 3, new Rng(3), 0)).toBe(0)
  })

  it('spawns the answer soon after each prompt and lands words that are not caught', () => {
    const rng = new Rng(7)
    let s = startRain('w.a', ['w.b', 'w.c', 'w.d'], rng)
    const first = run(s, 4, rng)
    expect(first.spawned.slice(0, 2).map((d) => d.id)).toContain('w.a')
    // left alone, everything lands within ~10 s and the answer is among them
    const later = run(first.s, 12, rng)
    expect(later.landed.length + first.landed.length).toBeGreaterThan(3)
    expect([...first.landed, ...later.landed].some((d) => d.id === 'w.a')).toBe(true)
    // a caught answer is removed; the next prompt's answer falls within two spawns
    s = later.s
    const onScreen = s.drops.find((d) => d.id === s.target)
    if (onScreen) s = removeDrop(s, onScreen.key)
    s = nextPrompt(s, 'w.c', ['w.a', 'w.b', 'w.d'], rng)
    const after = run(s, 6, rng)
    expect(after.spawned.slice(0, 2).map((d) => d.id)).toContain('w.c')
  })

  it('clamps long frames so words never jump', () => {
    const rng = new Rng(2)
    let s = startRain('w.a', ['w.b'], rng)
    for (let i = 0; i < 6; i++) s = stepRain(s, 0.1, rng).state
    const y0 = s.drops[0]!.y
    const r = stepRain(s, 5, rng)
    expect(r.state.drops[0]!.y - y0).toBeLessThanOrEqual(rainSpeed(r.state.elapsed) * 0.1 + 1e-9)
  })

  it('chooses a prompt that is not falling, not just asked and has no synonym on screen', () => {
    expect(pickPrompt(ids, new Set(['w.a']), ['w.b'])).toBe('w.c')
    expect(pickPrompt(ids, new Set(['w.a']), ['w.b'], (id) => id !== 'w.c')).toBe('w.d')
    expect(pickPrompt(ids, new Set(['w.a', 'w.c', 'w.d']), ['w.b'])).toBe('w.b')
  })
})

// ---------------------------------------------------------------------------- sort it

describe('sort it', () => {
  const learner = vocabUpTo('a2')
  const all = [...vocab.values()]
  const index = new Map<string, VocabEntry[]>()
  for (const e of all) index.set(fold(e.lemma), [...(index.get(fold(e.lemma)) ?? []), e])
  const keyOf = (r: SortRound, v: VocabEntry) => (r.mode === 'topic' ? v.topic : r.mode === 'gender' ? v.gender : v.pos)

  /** Every card has a right basket, and no entry spelled the same belongs to another basket of the round. */
  const assertSound = (r: SortRound) => {
    const keys = r.baskets.map((b) => b.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(r.cards.length).toBeGreaterThanOrEqual(SORT_MIN)
    expect(new Set(r.cards.map((c) => fold(c.v.lemma))).size).toBe(r.cards.length)
    r.cards.forEach((c, i) => {
      expect(keyOf(r, c.v)).toBe(keys[c.basket])
      if (i < r.thirdFrom) expect(c.basket).toBeLessThan(2)
      for (const e of index.get(fold(c.v.lemma)) ?? []) {
        if (e.id === c.v.id) continue
        const k = keyOf(r, e)
        if (r.mode === 'gender' && e.pos === 'noun') expect(k).toBe(c.v.gender)
        else if (r.mode !== 'gender' && k !== undefined && k !== keyOf(r, c.v)) expect(keys).not.toContain(k)
      }
    })
    if (r.mode === 'topic') for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) expect(topicsClash(keys[i]!, keys[j]!)).toBe(false)
  }

  it('builds topic rounds from the course words, 15 cards, a third basket joining later', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = sortRound(new Rng(seed).shuffle(learner).slice(0, 220), all, { lang: languagePack.id, rng: new Rng(seed), fold })
      expect(r).toBeDefined()
      expect(r!.mode).toBe('topic')
      expect(r!.cards.length).toBe(15)
      for (const b of r!.baskets) expect(TOPIC_BASKETS[b.key]).toBeDefined()
      assertSound(r!)
      if (r!.baskets.length === 3) {
        expect(r!.thirdFrom).toBeGreaterThan(4)
        expect(r!.cards.slice(r!.thirdFrom).some((c) => c.basket === 2)).toBe(true)
      }
    }
  })

  it('falls back to gender (courses with articles) or part of speech when topics are thin', () => {
    const noTopics = learner.map((v) => ({ ...v, topic: undefined }))
    const r = sortRound(noTopics.slice(0, 300), all, { lang: languagePack.id, rng: new Rng(3), fold })
    expect(r).toBeDefined()
    expect(r!.mode).toBe(languagePack.id === 'yue' ? 'pos' : 'gender')
    assertSound(r!)
    const p = sortRound(learner.slice(0, 300), all, { lang: languagePack.id, rng: new Rng(4), fold, modes: ['pos'] })
    expect(p!.mode).toBe('pos')
    assertSound(p!)
  })

  it('never makes a card of a word whose spelling also sits in another basket', () => {
    const fruit = V('w.naranja', 'naranja', 'orange (fruit)', { topic: 'food' })
    const colour = V('w.naranja.adj', 'naranja', 'orange', { topic: 'colours', pos: 'adj' })
    const spec = { keyOf: (v: VocabEntry) => v.topic, anyKeyOf: (v: VocabEntry) => v.topic }
    expect(belongsToOne(fruit, new Set(['food', 'colours']), [fruit, colour], spec)).toBe(false)
    expect(belongsToOne(fruit, new Set(['food', 'clothing']), [fruit, colour], spec)).toBe(true)
    const m = V('w.capital.m', 'capital', 'capital (money)', { gender: 'm' })
    const f = V('w.capital.f', 'capital', 'capital city', { gender: 'f' })
    const g = { keyOf: (v: VocabEntry) => v.gender, anyKeyOf: (v: VocabEntry) => v.gender, strict: true }
    expect(belongsToOne(m, new Set(['m', 'f']), [m, f], g)).toBe(false)
    expect(belongsToOne(m, new Set(['m', 'f']), [m], g)).toBe(true)
  })

  it('gives up on too few words', () => {
    expect(sortRound(learner.slice(0, 5), all, { lang: languagePack.id, rng: new Rng(1), fold })).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------- word of the day

describe('word of the day', () => {
  const L = (s: string) => [...s]
  const marks = (g: string, a: string) => scoreGuess(L(g), L(a)).map((m) => (m === 'hit' ? 'G' : m === 'near' ? 'Y' : '.')).join('')

  it('marks letters with correct duplicate handling', () => {
    expect(marks('casa', 'casa')).toBe('GGGG')
    expect(marks('saco', 'casa')).toBe('YGY.')
    // two a's guessed, the answer has none; the o and r are elsewhere
    expect(marks('aamor', 'perro')).toBe('...YY')
    // two l's guessed, the answer has one (already a hit): the second is grey
    expect(marks('llama', 'lapiz')).toBe('G.Y..')
    expect(marks('aabb', 'abab')).toBe('GYYG')
    // the first e is yellow, the second grey: the answer's other e is taken by the green one
    expect(marks('eerie', 'there')).toBe('Y.Y.G')
    // exact matches claim their letter before anything is marked near
    expect(marks('sassy', 'brass')).toBe('YY.G.')
    expect(marks('robot', 'tooth')).toBe('.G.YY')
    expect(marks('ooxoo', 'xxoxx')).toBe('Y.Y..')
  })

  it('never marks more copies of a letter than the answer has', () => {
    const rng = new Rng(11)
    const abc = 'abcde'
    for (let t = 0; t < 2000; t++) {
      const n = 4 + rng.int(4)
      const g = Array.from({ length: n }, () => abc[rng.int(5)]!)
      const a = Array.from({ length: n }, () => abc[rng.int(5)]!)
      const m = scoreGuess(g, a)
      for (const ch of abc) {
        const inAnswer = a.filter((x) => x === ch).length
        const marked = g.filter((x, i) => x === ch && m[i] !== 'miss').length
        expect(marked).toBe(Math.min(inAnswer, g.filter((x) => x === ch).length))
      }
      g.forEach((x, i) => expect(m[i] === 'hit').toBe(x === a[i]))
    }
  })

  it('keeps the best state per key', () => {
    const k = keyStates([
      { guess: L('saco'), marks: scoreGuess(L('saco'), L('casa')) },
      { guess: L('cosa'), marks: scoreGuess(L('cosa'), L('casa')) },
    ])
    expect(k.get('c')).toBe('hit')
    expect(k.get('s')).toBe('hit')
    expect(k.get('o')).toBe('miss')
    expect(k.get('a')).toBe('hit')
  })

  it('picks the same word all day, a different one most days, skipping recent words', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `w.${i}`)
    expect(wordOfDay(ids, '2026-10-21', 'es')).toBe(wordOfDay([...ids].reverse(), '2026-10-21', 'es'))
    const week = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d) => wordOfDay(ids, d, 'es'))
    expect(new Set(week).size).toBeGreaterThan(2)
    const today = wordOfDay(ids, '2026-10-21', 'es')!
    expect(wordOfDay(ids, '2026-10-21', 'es', [today])).not.toBe(today)
    expect(wordOfDay(['w.1'], '2026-10-21', 'es', ['w.1'])).toBe('w.1')
    expect(wordOfDay([], '2026-10-21')).toBeUndefined()
  })

  it('folds words to plain letters, 4 to 7 of them (Jyutping without tones)', () => {
    expect(foldWord('sik6 faan6', languagePack, true)).toBe('sikfaan')
    expect(foldWord('nei hou', languagePack, true)).toBe('neihou')
    expect(foldWord('食飯', languagePack, true)).toBeUndefined()
    expect(dailyLetters(V('w.x', 'x', 'x', { jp: 'sik6 faan6' }), languagePack)).toEqual(L('sikfaan'))
    expect(dailyLetters(V('w.x', 'x', 'x', { jp: 'hai6' }), languagePack)).toBeUndefined()
    // every course has plenty of A1 words that fit, all letters
    const fit = vocabUpTo('a1').filter((v) => dailyLetters(v, languagePack))
    expect(fit.length).toBeGreaterThan(100)
    for (const v of fit) for (const ch of dailyLetters(v, languagePack)!) expect(ch).toMatch(/^\p{Ll}$/u)
  })

  it('accepts every answer as a guess', () => {
    const jp = languagePack.id === 'yue'
    const forms = [...vocab.values()].flatMap((v) => (jp ? (v.jp ? [v.jp] : []) : [v.lemma]))
    const list = guessList(forms, languagePack, jp)
    for (const v of vocabUpTo('a1')) {
      const l = dailyLetters(v, languagePack)
      if (l) expect(list.get(l.length)!.has(l.join(''))).toBe(true)
    }
  })

  it('counts streaks across days', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
    expect(nextStreak({}, '2026-10-21', true)).toBe(1)
    expect(nextStreak({ day: '2026-10-20', streak: 4 }, '2026-10-21', true)).toBe(5)
    expect(nextStreak({ day: '2026-10-19', streak: 4 }, '2026-10-21', true)).toBe(1)
    expect(nextStreak({ day: '2026-10-20', streak: 4 }, '2026-10-21', false)).toBe(0)
    expect(liveStreak({ day: '2026-10-20', streak: 4 }, '2026-10-21')).toBe(4)
    expect(liveStreak({ day: '2026-10-18', streak: 4 }, '2026-10-21')).toBe(0)
  })

  it('counts down to local midnight', () => {
    const now = new Date(2026, 9, 21, 23, 59, 30)
    expect(msToTomorrow(now)).toBe(30_000)
    expect(formatCountdown(3 * 3600_000 + 7 * 60_000 + 45_000)).toBe('3:07:45')
  })
})
