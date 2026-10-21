import { describe, it, expect } from 'vitest'
import * as esVerbs from '@/lang/es/verbs'
import * as ptVerbs from '@/lang/pt/verbs'
import * as itVerbs from '@/lang/it/verbs'
import * as frVerbs from '@/lang/fr/verbs'
import * as esNorm from '@/lang/es/normalize'
import * as ptNorm from '@/lang/pt/normalize'
import * as itNorm from '@/lang/it/normalize'
import * as frNorm from '@/lang/fr/normalize'
import { Rng } from '@/engine/random'
import type { VocabEntry } from '@/engine/schema'
import {
  kitFrom, formOf, reachedTenses, learnerReach, deckFor, playableVerb, promptRound, randomPrompt, makePrompt, paradigm, distractors, choicesFor, gradeForm,
  stripPronoun, pronounsOf, slotPoints, blitzMultiplier, blitzPoints, isJackpot, STAR_VERBS, type VerbKit, type VerbsModuleLike, type GameVerb,
} from '@/engine/games/verbPrompts'
import { englishHint, pastOf, thirdOf, participleOf, parseGloss } from '@/engine/games/englishVerb'
import { lunaPlan, duelWinner, median, recentAccuracy, LUNA_MIN_MS, LUNA_MAX_MS, DUEL_TARGET, DUEL_MAX_TURNS, banter } from '@/engine/games/verbDuel'

type Mod = { conjugate: (l: string) => { forms: Partial<Record<string, (string | null)[]>>; reflexive: boolean; clitic?: string } }
const COURSES = {
  es: { mod: esVerbs, norm: esNorm, verbs: ['ser', 'estar', 'tener', 'ir', 'hacer', 'hablar', 'comer', 'vivir', 'levantarse', 'pensar', 'dormir', 'pedir', 'buscar', 'decir'] },
  pt: { mod: ptVerbs, norm: ptNorm, verbs: ['ser', 'estar', 'ter', 'ir', 'fazer', 'falar', 'comer', 'partir', 'levantar-se', 'pôr', 'dizer', 'vir', 'ouvir', 'trazer'] },
  it: { mod: itVerbs, norm: itNorm, verbs: ['essere', 'avere', 'andare', 'fare', 'stare', 'parlare', 'vedere', 'dormire', 'finire', 'alzarsi', 'venire', 'dire', 'bere', 'uscire'] },
  fr: { mod: frVerbs, norm: frNorm, verbs: ['être', 'avoir', 'aller', 'faire', 'parler', 'finir', 'prendre', 'venir', 'se lever', "s'appeler", 'manger', 'pouvoir', 'vouloir', 'partir'] },
} as const
type Code = keyof typeof COURSES

const kits = {} as Record<Code, VerbKit>
for (const code of Object.keys(COURSES) as Code[]) {
  const { mod, norm } = COURSES[code]
  kits[code] = kitFrom(mod as unknown as VerbsModuleLike, { id: code, match: norm.match, normalize: norm.normalize })
}
const deckOf = (code: Code): GameVerb[] => COURSES[code].verbs.map((lemma, i) => ({ id: `w.${lemma}`, lemma, en: i % 2 ? 'to have' : 'to go', mine: i < 5 }))
/** The form straight from the language's own conjugator (with the reflexive pronoun). */
function direct(code: Code, lemma: string, tense: string, person: number): string | null {
  const mod = COURSES[code].mod as unknown as Mod & { withReflexive: (f: string, p: number, t: string, c?: string) => string | null }
  const c = mod.conjugate(lemma)
  const raw = c.forms[tense]?.[person]
  if (!raw) return null
  return c.reflexive ? (c.clitic ? mod.withReflexive(raw, person, tense, c.clitic) : mod.withReflexive(raw, person, tense)) : raw
}
const vocabEntry = (lemma: string, level: VocabEntry['level'] = 'a1', en = 'to do', pos: VocabEntry['pos'] = 'verb'): VocabEntry => ({ id: `w.${lemma.replace(/[^\p{L}]/gu, '')}`, lemma, pos, en: [en], level, tags: [] })

describe.each(Object.keys(COURSES) as Code[])('verb games (%s)', (code) => {
  const kit = kits[code]
  const allUsable = kit.tenses.filter((t) => !kit.skip.has(t) && (!t.startsWith('imp') || t === 'impf'))

  it('a beginner with no grammar met only gets the present', () => {
    expect(reachedTenses(kit, 'a1', new Set())).toEqual(['pres'])
  })

  it('tenses unlock with grammar met and with the level, never the skipped ones', () => {
    const grammarId = { es: 'g.preterite-regular', pt: 'g.preterite-regular', it: 'g.passato-prossimo-avere', fr: 'g.passe-compose-avoir' }[code]
    const tense = { es: 'pret', pt: 'pret', it: 'perf', fr: 'perf' }[code]
    expect(reachedTenses(kit, 'a1', new Set([grammarId]))).toEqual(expect.arrayContaining(['pres', tense]))
    const b1 = reachedTenses(kit, 'b1', new Set())
    for (const t of b1) expect(kit.labels[t]?.level === 'a1' || kit.labels[t]?.level === 'a2' || t === 'pres').toBe(true)
    expect(b1).toContain('impf')
    const c2 = reachedTenses(kit, 'c2', new Set())
    for (const t of c2) {
      expect(kit.skip.has(t)).toBe(false)
      expect(t === 'impAff' || t === 'impNeg').toBe(false)
    }
  })

  it('every prompt’s answer is the conjugator’s form, in a reached tense', () => {
    const rng = new Rng(7)
    const deck = deckOf(code)
    for (const level of ['a1', 'a2', 'b1', 'b2', 'c2'] as const) {
      const tenses = reachedTenses(kit, level, new Set())
      const round = promptRound(kit, deck, tenses, 40, rng)
      expect(round.length).toBe(40)
      for (const p of round) {
        expect(tenses).toContain(p.tense)
        expect(p.answer).toBe(direct(code, p.verb.lemma, p.tense, p.person))
        expect(p.accepts).toContain(p.answer)
        expect(kit.skipPersons.has(p.person)).toBe(false)
      }
    }
  })

  it('every reached-tense prompt over the whole deck is checked against the conjugator', () => {
    for (const v of deckOf(code)) {
      for (const t of allUsable) {
        for (let person = 0; person < 6; person++) {
          const p = makePrompt(kit, v, t, person)
          const d = direct(code, v.lemma, t, person)
          if (!d) {
            expect(p).toBeUndefined()
            continue
          }
          expect(p!.answer).toBe(d)
          expect(gradeForm(kit, p!, p!.answer).verdict).toBe('correct')
        }
      }
    }
  })

  it('distractors are plausible, distinct and never the answer', () => {
    const rng = new Rng(11)
    const deck = deckOf(code)
    const tenses = reachedTenses(kit, 'b2', new Set())
    for (let i = 0; i < 300; i++) {
      const p = randomPrompt(kit, deck, tenses, rng)!
      const ds = distractors(kit, p, rng, tenses, deck)
      expect(ds).toHaveLength(3)
      expect(new Set(ds.map((d) => kit.normalize(d))).size).toBe(3)
      for (const d of ds) {
        expect(p.accepts.map((a) => kit.normalize(a))).not.toContain(kit.normalize(d))
        expect(gradeForm(kit, p, d).verdict).not.toBe('correct')
      }
      const { options, answer } = choicesFor(kit, p, rng, tenses, deck)
      expect(options).toHaveLength(4)
      expect(options[answer]).toBe(p.answer)
    }
  })

  it('the paradigm lists the persons with the asked form among them', () => {
    const p = makePrompt(kit, deckOf(code)[2]!, 'pres', 1)!
    const rows = paradigm(kit, p.verb.lemma, 'pres')
    expect(rows.find((r) => r.person === 1)!.form).toBe(p.answer)
    expect(rows.some((r) => r.irregular)).toBe(true) // the third verb of each deck is an irregular star
  })

  it('a regularised form is offered as a distractor for an irregular star', () => {
    const star = deckOf(code)[2]! // tener / ter / andare / aller
    const p = makePrompt(kit, star, 'pres', 0)!
    expect(p.irregular).toBe(true)
    // a regularised first person of a stem-changing star (tengo → teno, vado → ando, vais → alle; Portuguese ter → "to" is too short to offer)
    const lemma = code === 'pt' ? 'fazer' : star.lemma
    const q = makePrompt(kit, { ...star, lemma }, 'pres', 0)!
    const reg = formOf(kit, kit.regular(lemma), 'pres', 0)
    expect(reg).toBeTruthy()
    expect(reg).not.toBe(q.answer)
    expect(distractors(kit, q, new Rng(1), ['pres'], [])[0]).toBe(reg)
  })

  it('the deck puts the learner’s verbs first and tops up with the stars of their level', () => {
    const mine = [vocabEntry(COURSES[code].verbs[5]!)]
    const pool = [...STAR_VERBS[code]!.map((l) => vocabEntry(l)), vocabEntry('zzzar', 'c1'), vocabEntry(COURSES[code].verbs[6]!, 'a1')]
    const deck = deckFor(kit, mine, pool, 'a1', 6)
    expect(deck).toHaveLength(6)
    expect(deck[0]).toMatchObject({ lemma: COURSES[code].verbs[5], mine: true })
    expect(deck.slice(1).map((v) => v.lemma)).toEqual(STAR_VERBS[code]!.slice(0, 5))
    expect(deck.some((v) => v.lemma === 'zzzar')).toBe(false)
  })
})

describe('grading (Spanish)', () => {
  const kit = kits.es
  const deck = deckOf('es')
  const tener = { id: 'w.tener', lemma: 'tener', en: 'to have', mine: true }
  it('accepts the form with or without the subject pronoun', () => {
    const p = makePrompt(kit, tener, 'pres', 1, 'tú')!
    expect(p.answer).toBe('tienes')
    expect(gradeForm(kit, p, 'tienes').verdict).toBe('correct')
    expect(gradeForm(kit, p, 'Tú tienes').verdict).toBe('correct')
    expect(gradeForm(kit, p, 'tu tienes').verdict).toBe('correct')
    expect(stripPronoun(kit, p, '  tú   tienes ')).toBe('tienes')
  })
  it('a missing accent is almost, with a note showing the accented form', () => {
    const p = makePrompt(kit, deck[5]!, 'pret', 2)! // habló
    expect(p.answer).toBe('habló')
    const g = gradeForm(kit, p, 'hablo')
    // hablo is a real form (yo, present): a wrong person/tense, not just an accent
    expect(g.verdict).toBe('wrong')
    expect(g.note).toMatch(/present|yo/)
    const q = makePrompt(kit, { ...tener, lemma: 'estar' }, 'pres', 1)! // estás
    const h = gradeForm(kit, q, 'estas')
    expect(h.verdict).toBe('almost')
    expect(h.note).toContain('estás')
  })
  it('another person of the same verb is wrong, with a note naming it', () => {
    const p = makePrompt(kit, tener, 'pres', 1)!
    const g = gradeForm(kit, p, 'tengo')
    expect(g).toMatchObject({ verdict: 'wrong', correct: 'tienes' })
    expect(g.note).toBe('That is the yo form.')
  })
  it('regularised forms are wrong', () => {
    const p = makePrompt(kit, tener, 'pres', 0)!
    expect(gradeForm(kit, p, 'teno')).toMatchObject({ verdict: 'wrong', note: 'tener is irregular here: tengo' })
    expect(gradeForm(kit, p, '').verdict).toBe('wrong')
  })
  it('the English hint follows the person and tense', () => {
    expect(makePrompt(kit, tener, 'pres', 1, 'tú')!.english).toBe('you have')
    expect(makePrompt(kit, tener, 'pres', 2, 'ella')!.english).toBe('she has')
    expect(makePrompt(kit, tener, 'pres', 2, 'usted')!.english).toBe('you (formal) have')
    expect(makePrompt(kit, tener, 'pret', 0)!.english).toBe('I had')
    expect(makePrompt(kit, tener, 'fut', 3)!.english).toBe('we will have')
  })
  it('splits person labels into pronouns', () => {
    expect(pronounsOf('él / ella / usted')).toEqual(['él', 'ella', 'usted'])
    expect(pronounsOf('nosotros/as')).toEqual(['nosotros', 'nosotras'])
    expect(pronounsOf('je')).toEqual(['je'])
  })
})

describe('grading (French, Italian, Portuguese)', () => {
  it('French: agreement variants are accepted and j’ is dropped', () => {
    const kit = kits.fr
    const aller = { id: 'w.aller', lemma: 'aller', en: 'to go', mine: true }
    const p = makePrompt(kit, aller, 'perf', 0)!
    expect(p.answer).toBe('suis allé')
    expect(p.accepts).toContain('suis allée')
    expect(gradeForm(kit, p, 'suis allée').verdict).toBe('correct')
    expect(gradeForm(kit, p, 'je suis allé').verdict).toBe('correct')
    expect(gradeForm(kit, p, 'suis alle').verdict).toBe('almost')
    expect(gradeForm(kit, p, 'ai allé').verdict).toBe('wrong')
    const aimer = makePrompt(kit, { id: 'w.aimer', lemma: 'aimer', en: 'to like', mine: true }, 'pres', 0)!
    expect(gradeForm(kit, aimer, "j'aime").verdict).toBe('correct')
    expect(gradeForm(kit, aimer, 'j’aime').verdict).toBe('correct')
    const lever = makePrompt(kit, { id: 'w.selever', lemma: 'se lever', en: 'to get up', mine: true }, 'pres', 0)!
    expect(lever.answer).toBe('me lève')
    expect(gradeForm(kit, lever, 'je me lève').verdict).toBe('correct')
    expect(lever.english).toBe('I get up')
  })
  it('Italian: essere compounds agree', () => {
    const kit = kits.it
    const p = makePrompt(kit, { id: 'w.andare', lemma: 'andare', en: 'to go', mine: true }, 'perf', 0)!
    expect(p.answer).toBe('sono andato')
    expect(gradeForm(kit, p, 'sono andata').verdict).toBe('correct')
    expect(p.english).toBe('I have gone')
  })
  it('Portuguese never asks vós', () => {
    const kit = kits.pt
    const rng = new Rng(3)
    const round = promptRound(kit, deckOf('pt'), reachedTenses(kit, 'b2', new Set()), 200, rng)
    expect(round.some((p) => p.person === 4)).toBe(false)
    expect(paradigm(kit, 'ser', 'pres').map((r) => r.person)).toEqual([0, 1, 2, 3, 5])
  })
})

describe('learner reach and playable verbs', () => {
  it('reads the level and grammar from the cards', () => {
    const r = learnerReach([
      { id: 'w.ser', kind: 'word', level: 'a1', grammar: [] },
      { id: 's.a2.u01.1', kind: 'sentence', level: 'a2', grammar: ['g.preterite-regular'] },
      { id: 'g.imperfect', kind: 'grammar', level: 'a2', grammar: [] },
    ])
    expect(r.level).toBe('a2')
    expect([...r.grammar].sort()).toEqual(['g.imperfect', 'g.preterite-regular'])
    expect(reachedTenses(kits.es, r.level, r.grammar)).toEqual(['pres', 'pret', 'impf'])
  })
  it('leaves out impersonal verbs and phrases', () => {
    expect(playableVerb(vocabEntry('tener', 'a1', 'to have'))).toBe(true)
    expect(playableVerb(vocabEntry('se lever', 'a1', 'to get up'))).toBe(true)
    expect(playableVerb(vocabEntry("s'appeler", 'a1', 'to be called'))).toBe(true)
    expect(playableVerb(vocabEntry('haber', 'a1', 'there is'))).toBe(false)
    expect(playableVerb(vocabEntry('gustar', 'a1', 'to like (be pleasing)'))).toBe(false)
    expect(playableVerb(vocabEntry('llover', 'a1', 'to rain'))).toBe(false)
    expect(playableVerb(vocabEntry('fare colazione', 'a1', 'to have breakfast'))).toBe(false)
    expect(playableVerb(vocabEntry('casa', 'a1', 'house', 'noun'))).toBe(false)
  })
})

describe('English hints', () => {
  it('inflects regular and irregular verbs', () => {
    expect(pastOf('stop')).toBe('stopped')
    expect(pastOf('try')).toBe('tried')
    expect(pastOf('live')).toBe('lived')
    expect(pastOf('travel')).toBe('travelled')
    expect(pastOf('play')).toBe('played')
    expect(pastOf('go')).toBe('went')
    expect(participleOf('write')).toBe('written')
    expect(thirdOf('watch')).toBe('watches')
    expect(thirdOf('go')).toBe('goes')
    expect(thirdOf('study')).toBe('studies')
  })
  it('reads glosses', () => {
    expect(parseGloss('to be (identity)')).toEqual({ head: 'be', tail: '' })
    expect(parseGloss('to listen (to)')).toEqual({ head: 'listen', tail: '' })
    expect(parseGloss('to look for')).toEqual({ head: 'look', tail: 'for' })
    expect(parseGloss('can')?.modal).toBe('can')
    expect(parseGloss('there is')).toBeUndefined()
  })
  it('builds hints for each tense', () => {
    expect(englishHint('to be (identity)', 'I', 'pres')).toBe('I am')
    expect(englishHint('to be', 'they', 'pret')).toBe('they were')
    expect(englishHint('to be', 'he', 'pret')).toBe('he was')
    expect(englishHint('to get up', 'she', 'pres')).toBe('she gets up')
    expect(englishHint('to eat', 'we', 'impf')).toBe('we used to eat')
    expect(englishHint('to eat', 'he', 'perf')).toBe('he has eaten')
    expect(englishHint('to eat', 'you', 'pluperf')).toBe('you had eaten')
    expect(englishHint('to eat', 'you', 'cond')).toBe('you would eat')
    expect(englishHint('can', 'you', 'pres')).toBe('you can')
    expect(englishHint('can', 'I', 'fut')).toBe('I will be able to')
    expect(englishHint('must', 'she', 'pres')).toBe('she must')
    expect(englishHint('must', 'she', 'fut')).toBe('she will have to')
    expect(englishHint('to be', 'he', 'subjImpf')).toBe('(if) he were')
    expect(englishHint('to go', 'you', 'impAff')).toBeUndefined()
    expect(englishHint('there is', 'I', 'pres')).toBeUndefined()
  })
})

describe('points', () => {
  it('slots: irregular and speed are worth more, an accent slip a bit less', () => {
    expect(slotPoints('correct', false, 0)).toBe(10)
    expect(slotPoints('correct', true, 15)).toBe(20)
    expect(slotPoints('almost', false, 0)).toBe(7)
    expect(slotPoints('wrong', true, 15)).toBe(0)
    expect(isJackpot(3)).toBe(true)
    expect(isJackpot(4)).toBe(false)
    expect(isJackpot(0)).toBe(false)
  })
  it('blitz: the streak multiplies', () => {
    expect([0, 2, 3, 5, 6, 20].map(blitzMultiplier)).toEqual([1, 1, 2, 2, 3, 3])
    expect(blitzPoints(6, true)).toBe(45)
  })
})

describe('Luna', () => {
  it('stays within her bounds', () => {
    const rng = new Rng(5)
    for (let i = 0; i < 500; i++) {
      const plan = lunaPlan({ times: [rng.int(30000)], results: [rng.next() < 0.5], lead: rng.int(21) - 10, mode: rng.next() < 0.5 ? 'type' : 'pick' }, rng)
      expect(plan.delay).toBeGreaterThanOrEqual(LUNA_MIN_MS)
      expect(plan.delay).toBeLessThanOrEqual(LUNA_MAX_MS)
    }
  })
  const avg = (h: Parameters<typeof lunaPlan>[0]) => {
    const rng = new Rng(9)
    let total = 0
    let right = 0
    for (let i = 0; i < 400; i++) {
      const p = lunaPlan(h, rng)
      total += p.delay
      right += Number(p.correct)
    }
    return { delay: total / 400, right: right / 400 }
  }
  it('follows the learner’s pace and gets quicker as they get better', () => {
    const base = { times: [5000, 5200, 4800], lead: 0, mode: 'type' as const }
    const sharp = avg({ ...base, results: [true, true, true, true, true, true] })
    const weak = avg({ ...base, results: [false, true, false, false, true, false] })
    expect(sharp.delay).toBeLessThan(weak.delay)
    expect(avg({ ...base, times: [2000, 2100], results: [true] }).delay).toBeLessThan(sharp.delay)
  })
  it('rubber-bands on the score: faster and surer when the learner leads', () => {
    const base = { times: [5000], results: [true, false, true], mode: 'type' as const }
    const ahead = avg({ ...base, lead: 4 })
    const behind = avg({ ...base, lead: -4 })
    expect(ahead.delay).toBeLessThan(behind.delay)
    expect(ahead.right).toBeGreaterThan(behind.right)
    // still beatable: she is not faster than a learner who keeps their pace
    expect(avg({ ...base, lead: 0 }).delay).toBeGreaterThan(4000)
  })
  it('decides the winner', () => {
    expect(duelWinner(DUEL_TARGET, 3, 12)).toBe('me')
    expect(duelWinner(4, DUEL_TARGET, 12)).toBe('luna')
    expect(duelWinner(4, 3, 12)).toBeUndefined()
    expect(duelWinner(4, 3, DUEL_MAX_TURNS)).toBe('me')
    expect(duelWinner(3, 3, DUEL_MAX_TURNS)).toBe('draw')
  })
  it('helpers', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBeUndefined()
    expect(recentAccuracy([])).toBe(0.6)
    expect(recentAccuracy([true, false])).toBe(0.5)
    expect(banter('lunaFirst', new Rng(1), 'tienes')).not.toContain('{form}')
  })
})
