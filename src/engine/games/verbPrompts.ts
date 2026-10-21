/**
 * Pure logic for the verb mini games (Verb slots, Verb blitz, Verb duel): which tenses the learner
 * has reached, which verbs to play, prompts ("tú · tener · present" → tienes), plausible wrong
 * forms, grading with the conjugate exercise's accent rules, and points.
 *
 * Language-agnostic: everything goes through a VerbKit built from a language's verbs module
 * (kitFrom), so the same code is tested against the es, pt, it and fr conjugators.
 */
import type { AnswerMatch } from '../../lang/types'
import type { CardRow } from '../types'
import { LEVEL_ORDER, type LevelId, type VocabEntry } from '../schema'
import { Rng } from '../random'
import { englishHint, pronounEnglish } from './englishVerb'

// ---------------------------------------------------------------------------- the kit

export interface KitConjugation {
  lemma: string
  reflexive: boolean
  clitic?: string
  forms: Partial<Record<string, (string | null)[]>>
}
type Labels = Readonly<Record<string, { es: string; en: string; level: string } | undefined>>

/** What a language's verbs module looks like to the games (see src/lang/<code>/verbs.ts). */
export interface VerbsModuleLike {
  PERSONS: readonly string[]
  TENSES: readonly string[]
  TENSE_LABELS: Labels
  VERB_TRAINER: { skipInExercises: readonly string[] }
  conjugate(lemma: string): KitConjugation
  conjugateWith(lemma: string, table?: ReadonlyMap<string, unknown>): KitConjugation
  withReflexive(form: string | null | undefined, person: number, tense: string, clitic?: string): string | null
  agreementVariants?(form: string | null | undefined): string[]
}
export interface PackLike {
  id: string
  match(given: string, expected: string[]): AnswerMatch
  normalize(text: string, opts?: { accentInsensitive?: boolean }): string
}

export interface VerbKit {
  lang: string
  persons: readonly string[]
  tenses: readonly string[]
  labels: Labels
  /** Tenses the exercises leave to the verb trainer (imperatives, literary tenses). */
  skip: ReadonlySet<string>
  /** Persons the games never ask (Portuguese vós). */
  skipPersons: ReadonlySet<number>
  conjugate(lemma: string): KitConjugation | undefined
  /** The verb conjugated as if it were regular (no irregular table): "teno" for tener. */
  regular(lemma: string): KitConjugation | undefined
  withReflexive(form: string | null | undefined, person: number, tense: string, clitic?: string): string | null
  variants(form: string): string[]
  match(given: string, expected: string[]): AnswerMatch
  normalize(text: string, opts?: { accentInsensitive?: boolean }): string
}

/** Persons the games skip per course: Portuguese vós only survives in the Bible and poetry. */
const SKIP_PERSONS: Record<string, number[]> = { pt: [4] }

export function kitFrom(mod: VerbsModuleLike, pack: PackLike): VerbKit {
  const safe = (f: () => KitConjugation): KitConjugation | undefined => {
    try {
      return f()
    } catch {
      return undefined
    }
  }
  const regularCache = new Map<string, KitConjugation | undefined>()
  return {
    lang: pack.id,
    persons: mod.PERSONS,
    tenses: mod.TENSES,
    labels: mod.TENSE_LABELS,
    skip: new Set(mod.VERB_TRAINER.skipInExercises),
    skipPersons: new Set(SKIP_PERSONS[pack.id] ?? []),
    conjugate: (lemma) => safe(() => mod.conjugate(lemma)),
    regular: (lemma) => {
      if (!regularCache.has(lemma)) regularCache.set(lemma, safe(() => mod.conjugateWith(lemma.trim().toLowerCase(), new Map())))
      return regularCache.get(lemma)
    },
    withReflexive: (form, person, tense, clitic) => (clitic ? mod.withReflexive(form, person, tense, clitic) : mod.withReflexive(form, person, tense)),
    variants: (form) => (mod.agreementVariants ? mod.agreementVariants(form) : [form]),
    match: (g, e) => pack.match(g, e),
    normalize: (t, o) => pack.normalize(t, o),
  }
}

/** One person's form of a verb in a tense, with the reflexive pronoun when it has one (me levanto). */
export function formOf(kit: VerbKit, c: KitConjugation | undefined, tense: string, person: number): string | null {
  const raw = c?.forms[tense]?.[person]
  if (!raw || !c) return null
  return c.reflexive ? kit.withReflexive(raw, person, tense, c.clitic || undefined) : raw
}

// ---------------------------------------------------------------------------- tenses reached

/** Grammar notes that teach each tense's forms, across the courses (ids without the g.). */
const TENSE_GRAMMAR: Record<string, RegExp> = {
  pret: /^(preterite-(?!anterior|vs)|passato-remoto-(forms|irregular)|passe-simple-(forms|usage))/,
  impf: /^(imperfect|imperfetto|imparfait)(-|$)/,
  fut: /^(future-(simple|irregular)|futuro-(semplice|irregular)|futur-(simple|irregular))/,
  cond: /^(conditional-(simple|courtesy|politeness)|condizionale-(presente|courtesy)|conditionnel-present)/,
  perf: /^(present-perfect|perfeito-composto|passato-prossimo|reflexive-passato-prossimo|passe-compose|pronominal-passe-compose)/,
  pluperf: /^(pluperfect|plus-que-parfait|trapassato-prossimo)/,
  futPerf: /^(future-perfect|futuro-anteriore|futur-anterieur)/,
  condPerf: /^(conditional-perfect|condizionale-passato|conditionnel-passe)/,
  pretPerf: /^(trapassato-remoto|passe-anterieur|preterite-anterior)/,
  subjPres: /^(subjunctive-(present|irregular)|congiuntivo-(presente|irregular)|subjonctif-(forms|irregular))/,
  subjImpf: /^(subjunctive-imperfect|congiuntivo-imperfetto|subjonctif-imparfait)/,
  subjImpfSe: /^subjunctive-imperfect/,
  subjPerf: /^(subjunctive-perfect|congiuntivo-passato|subjonctif-passe)/,
  subjPluperf: /^(subjunctive-pluperfect|congiuntivo-trapassato|subjonctif-plus-que-parfait)/,
  subjFut: /^future-subjunctive(-forms)?$/,
  subjFutPerf: /^future-subjunctive-compound/,
}

/** The learner's level (highest level of any card) and every grammar point they have met. */
export function learnerReach(cards: readonly Pick<CardRow, 'id' | 'kind' | 'level' | 'grammar'>[]): { level: LevelId; grammar: Set<string> } {
  let level: LevelId = 'a1'
  const grammar = new Set<string>()
  for (const c of cards) {
    if (LEVEL_ORDER.indexOf(c.level) > LEVEL_ORDER.indexOf(level)) level = c.level
    if (c.kind === 'grammar') grammar.add(c.id)
    for (const g of c.grammar) grammar.add(g)
  }
  return { level, grammar }
}

/**
 * Tenses the learner has reached, in the course's order: the present always; a tense from an
 * earlier level than theirs; or one whose grammar note they have met (passé composé at A2…).
 * Never the tenses the exercises leave to the verb trainer.
 */
export function reachedTenses(kit: Pick<VerbKit, 'tenses' | 'labels' | 'skip'>, level: LevelId, grammar: ReadonlySet<string>): string[] {
  const rank = LEVEL_ORDER.indexOf(level)
  const met = [...grammar].map((g) => g.replace(/^g\./, ''))
  return kit.tenses.filter((t) => {
    if (kit.skip.has(t) || (t.startsWith('imp') && t !== 'impf')) return false
    if (t === 'pres') return true
    const lvl = kit.labels[t]?.level as LevelId | undefined
    if (lvl && LEVEL_ORDER.indexOf(lvl) >= 0 && LEVEL_ORDER.indexOf(lvl) < rank) return true
    const re = TENSE_GRAMMAR[t]
    return Boolean(re && met.some((g) => re.test(g)))
  })
}

// ---------------------------------------------------------------------------- verbs

/** The irregular stars of each course, offered first when topping up a beginner's verbs. */
export const STAR_VERBS: Record<string, string[]> = {
  es: ['ser', 'estar', 'tener', 'ir', 'hacer', 'poder', 'querer', 'decir', 'venir', 'saber', 'dar', 'ver', 'poner', 'salir'],
  pt: ['ser', 'estar', 'ter', 'ir', 'fazer', 'poder', 'querer', 'dizer', 'vir', 'saber', 'dar', 'ver', 'pôr', 'trazer'],
  it: ['essere', 'avere', 'andare', 'fare', 'stare', 'potere', 'volere', 'dovere', 'dire', 'venire', 'sapere', 'dare', 'uscire', 'bere'],
  fr: ['être', 'avoir', 'aller', 'faire', 'pouvoir', 'vouloir', 'devoir', 'dire', 'venir', 'savoir', 'prendre', 'voir', 'mettre', 'partir'],
}
/** Impersonal verbs and "it pleases me" verbs: odd in a person-by-person drill. */
const IMPERSONAL = new Set(['haber', 'haver', 'gustar', 'encantar', 'doler', 'llover', 'nevar', 'chover', 'ventar', 'falloir', 'pleuvoir', 'neiger', 'piacere', 'piovere', 'nevicare', 'bisognare'])
const IMPERSONAL_GLOSS = /^(there |to rain|to snow|to be windy|to be necessary)|pleasing|^to please/

/** A one-word verb (or a French pronominal one: se lever, s'appeler) that the games can drill. */
export function playableVerb(v: Pick<VocabEntry, 'pos' | 'lemma' | 'en'>): boolean {
  if (v.pos !== 'verb' || !v.en[0]) return false
  const bare = v.lemma.trim().toLowerCase().replace(/^(s['’]en |se |s['’])/, '')
  if (/\s/.test(bare) || IMPERSONAL.has(bare)) return false
  return !IMPERSONAL_GLOSS.test(v.en[0].toLowerCase())
}

export interface GameVerb {
  /** Vocab id (w.tener): answers are recorded on its card. */
  id: string
  lemma: string
  en: string
  /** The learner has a card for it (due or weak verbs come first). */
  mine: boolean
}

/**
 * The verbs for a round: the learner's (already ranked due/weak first) and then, up to `want`,
 * frequent verbs from their level: the irregular stars first, then the course's own order.
 */
export function deckFor(kit: VerbKit, mine: readonly VocabEntry[], pool: readonly VocabEntry[], level: LevelId, want: number): GameVerb[] {
  const out: GameVerb[] = []
  const seen = new Set<string>()
  const add = (v: VocabEntry, isMine: boolean) => {
    if (out.length >= want || seen.has(v.lemma) || !playableVerb(v)) return
    const c = kit.conjugate(v.lemma)
    if (!c || !formOf(kit, c, 'pres', 0)) return
    seen.add(v.lemma)
    out.push({ id: v.id, lemma: v.lemma, en: v.en[0]!, mine: isMine })
  }
  for (const v of mine) add(v, true)
  const rank = LEVEL_ORDER.indexOf(level)
  const near = pool.filter((v) => LEVEL_ORDER.indexOf(v.level) <= rank)
  const stars = STAR_VERBS[kit.lang] ?? []
  const byLemma = new Map(near.map((v) => [v.lemma, v]))
  for (const s of stars) {
    const v = byLemma.get(s)
    if (v) add(v, false)
  }
  for (const v of near) add(v, false)
  return out
}

// ---------------------------------------------------------------------------- prompts

export interface ParadigmRow {
  person: number
  /** The full person label (él / ella / usted). */
  label: string
  form: string | null
  irregular: boolean
}

export interface VerbPrompt {
  key: string
  verb: GameVerb
  tense: string
  /** English tense name (Present, Imperfect…). */
  tenseLabel: string
  /** The tense's name in the course language (Presente, Passé composé…). */
  tenseName: string
  person: number
  /** One pronoun of the person, as shown (ella). */
  pronoun: string
  /** "you have", when the gloss reads cleanly. */
  english?: string
  answer: string
  /** Every accepted spelling (French and Italian participle agreement: suis allé / allée). */
  accepts: string[]
  /** The form differs from the regular pattern (tengo, fui, suis allé). */
  irregular: boolean
}

/** The alternatives of a person label: "él / ella / usted" → [él, ella, usted]; "nosotros/as" → [nosotros, nosotras]. */
export function pronounsOf(label: string): string[] {
  return label.split(' / ').flatMap((p) => {
    const m = /^(.+)os\/as$/.exec(p.trim())
    return m ? [`${m[1]}os`, `${m[1]}as`] : [p.trim()]
  })
}

function isIrregular(kit: VerbKit, lemma: string, tense: string, person: number, form: string): boolean {
  const reg = formOf(kit, kit.regular(lemma), tense, person)
  return reg !== null && kit.normalize(reg) !== kit.normalize(form)
}

/** All six persons of a verb in a tense (the mini table shown after each answer). */
export function paradigm(kit: VerbKit, lemma: string, tense: string): ParadigmRow[] {
  const c = kit.conjugate(lemma)
  return kit.persons
    .map((label, person) => {
      const form = formOf(kit, c, tense, person)
      return { person, label, form, irregular: form ? isIrregular(kit, lemma, tense, person, form) : false }
    })
    .filter((r) => !kit.skipPersons.has(r.person))
}

/** Build the prompt for a verb, tense and person (undefined when that person has no form). */
export function makePrompt(kit: VerbKit, verb: GameVerb, tense: string, person: number, pronoun?: string): VerbPrompt | undefined {
  const c = kit.conjugate(verb.lemma)
  const answer = formOf(kit, c, tense, person)
  if (!answer) return undefined
  const label = kit.persons[person] ?? ''
  const shown = pronoun ?? pronounsOf(label)[0]!
  return {
    key: `${verb.lemma}|${tense}|${person}`,
    verb,
    tense,
    tenseLabel: kit.labels[tense]?.en ?? tense,
    tenseName: kit.labels[tense]?.es ?? tense,
    person,
    pronoun: shown,
    english: englishHint(verb.en, pronounEnglish(shown, person), tense),
    answer,
    accepts: [...new Set([answer, ...kit.variants(answer)])],
    irregular: isIrregular(kit, verb.lemma, tense, person, answer),
  }
}

/** Persons a prompt may ask for this course. */
export function personsFor(kit: VerbKit): number[] {
  return kit.persons.map((_, i) => i).filter((i) => !kit.skipPersons.has(i))
}

/**
 * One random prompt: a verb (the learner's own a little more often), a reached tense and a person,
 * avoiding the keys in `avoid` (recent prompts).
 */
export function randomPrompt(kit: VerbKit, verbs: readonly GameVerb[], tenses: readonly string[], rng: Rng, avoid: ReadonlySet<string> = new Set()): VerbPrompt | undefined {
  if (!verbs.length || !tenses.length) return undefined
  const mine = verbs.filter((v) => v.mine)
  const persons = personsFor(kit)
  let fallback: VerbPrompt | undefined
  for (let tries = 0; tries < 40; tries++) {
    const verb = mine.length && rng.next() < 0.6 ? rng.pick(mine) : rng.pick(verbs)
    // the present stays a little more frequent: it is the tense learners use most
    const tense = tenses.length > 1 && rng.next() < 0.3 ? (tenses.includes('pres') ? 'pres' : rng.pick(tenses)) : rng.pick(tenses)
    const person = rng.pick(persons)
    const pronoun = rng.pick(pronounsOf(kit.persons[person] ?? ''))
    const p = makePrompt(kit, verb, tense, person, pronoun)
    if (!p) continue
    if (!avoid.has(p.key) && !avoid.has(verb.lemma)) return p
    fallback ??= p
  }
  return fallback
}

/** A round of prompts that does not repeat a verb within the last few. */
export function promptRound(kit: VerbKit, verbs: readonly GameVerb[], tenses: readonly string[], n: number, rng: Rng): VerbPrompt[] {
  const out: VerbPrompt[] = []
  const window = Math.min(4, Math.max(0, verbs.length - 1))
  for (let i = 0; i < n; i++) {
    const avoid = new Set<string>([...out.map((p) => p.key), ...out.slice(-window).map((p) => p.verb.lemma)])
    const p = randomPrompt(kit, verbs, tenses, rng, avoid)
    if (!p) break
    out.push(p)
  }
  return out
}

// ---------------------------------------------------------------------------- distractors

/**
 * Plausible wrong forms for a pick-one prompt: the verb made regular ("teno"), other persons of the
 * same tense, the same person in other tenses, then other verbs. Never an accepted answer, no repeats.
 */
export function distractors(kit: VerbKit, p: VerbPrompt, rng: Rng, reached: readonly string[], others: readonly GameVerb[] = [], n = 3): string[] {
  const key = (s: string) => kit.normalize(s)
  const taken = new Set(p.accepts.map(key))
  const out: string[] = []
  const push = (f: string | null | undefined) => {
    if (!f || out.length >= n || taken.has(key(f))) return
    taken.add(key(f))
    out.push(f)
  }
  const c = kit.conjugate(p.verb.lemma)
  const persons = personsFor(kit).filter((q) => q !== p.person)
  const regular = formOf(kit, kit.regular(p.verb.lemma), p.tense, p.person)
  if (regular && regular.replace(/\s/g, '').length >= 3) push(regular)
  const sameTense = rng.shuffle(persons).map((q) => formOf(kit, c, p.tense, q))
  const usable = (t: string) => !kit.skip.has(t) && (!t.startsWith('imp') || t === 'impf')
  const otherReached = rng.shuffle(reached.filter((t) => t !== p.tense)).map((t) => formOf(kit, c, t, p.person))
  const otherTenses = rng.shuffle(kit.tenses.filter((t) => t !== p.tense && usable(t) && !reached.includes(t))).map((t) => formOf(kit, c, t, p.person))
  // alternate: another person, another tense, another person…
  const a = [...sameTense]
  const b = [...otherReached, ...otherTenses]
  while (out.length < n && (a.length || b.length)) {
    push(a.shift())
    push(b.shift())
  }
  for (const v of rng.shuffle(others.filter((o) => o.lemma !== p.verb.lemma))) {
    if (out.length >= n) break
    push(formOf(kit, kit.conjugate(v.lemma), p.tense, p.person))
  }
  return out
}

/** The four options of a pick-one prompt, shuffled, with the index of the right one. */
export function choicesFor(kit: VerbKit, p: VerbPrompt, rng: Rng, reached: readonly string[], others: readonly GameVerb[] = []): { options: string[]; answer: number } {
  const options = rng.shuffle([p.answer, ...distractors(kit, p, rng, reached, others, 3)])
  return { options, answer: options.indexOf(p.answer) }
}

// ---------------------------------------------------------------------------- grading

export interface FormGrade {
  verdict: 'correct' | 'almost' | 'wrong'
  /** The form as it should be written (accents!). */
  correct: string
  /** "Watch the accent: …", "That is the yo form." */
  note?: string
}

/** The person and tense a typed form belongs to, when it is another form of the same verb. */
function otherSlot(kit: VerbKit, p: VerbPrompt, typed: string): { person: number; tense: string } | undefined {
  const c = kit.conjugate(p.verb.lemma)
  const t = kit.normalize(typed)
  const order = [p.tense, ...kit.tenses.filter((x) => x !== p.tense)]
  for (const tense of order) {
    for (const person of personsFor(kit)) {
      if (tense === p.tense && person === p.person) continue
      const f = formOf(kit, c, tense, person)
      if (f && kit.variants(f).some((v) => kit.normalize(v) === t)) return { person, tense }
    }
  }
  return undefined
}

/** Drop a subject pronoun typed in front of the form ("tú tienes", "je m'appelle", "j'aime"). */
export function stripPronoun(kit: VerbKit, p: VerbPrompt, typed: string): string {
  const t = typed.trim().replace(/\s+/g, ' ')
  if (kit.lang === 'fr' && p.person === 0 && /^j['’]\p{L}/u.test(t)) return t.slice(2)
  const space = t.indexOf(' ')
  if (space < 0) return t
  const alts = new Set(pronounsOf(kit.persons[p.person] ?? '').map((x) => kit.normalize(x, { accentInsensitive: true })))
  return alts.has(kit.normalize(t.slice(0, space), { accentInsensitive: true })) ? t.slice(space + 1) : t
}

/**
 * Grade a typed form like the conjugate exercise: exact form right; the right letters with a missing
 * or wrong accent is "almost" (counted, with the accented form shown); a small typo is "almost" too.
 * Unless what was typed is another real form of the verb (comemos for comimos, hablo for habló: a
 * wrong tense or person, not a slip) or the verb made regular (teno for tengo).
 */
export function gradeForm(kit: VerbKit, p: VerbPrompt, typed: string): FormGrade {
  // as typed first (nous nous levons: the first "nous" is the reflexive), then without a subject pronoun
  const raw = typed.trim().replace(/\s+/g, ' ')
  if (!raw) return { verdict: 'wrong', correct: p.answer }
  const tries = [...new Set([raw, stripPronoun(kit, p, raw)])].map((text) => ({ text, r: kit.match(text, p.accepts) }))
  const hit = tries.find((x) => x.r.verdict === 'correct') ?? tries.find((x) => x.r.verdict === 'almost') ?? tries.at(-1)!
  const { text, r } = hit
  const correct = r.matched ?? p.answer
  if (r.verdict === 'correct') return { verdict: 'correct', correct }
  const same = (a: string, b: string) => kit.normalize(a) === kit.normalize(b)
  if (same(text, correct)) return { verdict: 'almost', correct, note: `Almost: ${correct}` }
  const slot = otherSlot(kit, p, text)
  if (slot) {
    const sameTense = slot.tense === p.tense
    const who = pronounsOf(kit.persons[slot.person] ?? '')[0]
    return { verdict: 'wrong', correct, note: sameTense ? `That is the ${who} form.` : `That is the ${(kit.labels[slot.tense]?.en ?? slot.tense).toLowerCase()} (${who}).` }
  }
  if (r.verdict === 'almost' && r.reason === 'accents') return { verdict: 'almost', correct, note: `Watch the accent: ${correct}` }
  const regular = formOf(kit, kit.regular(p.verb.lemma), p.tense, p.person)
  if (regular && same(text, regular)) return { verdict: 'wrong', correct, note: `${p.verb.lemma} is irregular here: ${correct}` }
  if (r.verdict === 'almost') return { verdict: 'almost', correct, note: r.notes[0] ?? `Almost: ${correct}` }
  return { verdict: 'wrong', correct }
}

// ---------------------------------------------------------------------------- points

/** Verb slots: 10 a form, 15 when irregular, up to 5 for speed; an accent slip keeps 70 %. */
export function slotPoints(verdict: FormGrade['verdict'], irregular: boolean, secondsLeft: number): number {
  if (verdict === 'wrong') return 0
  const base = (irregular ? 15 : 10) + Math.min(5, Math.ceil(Math.max(0, secondsLeft) / 3))
  return verdict === 'almost' ? Math.round(base * 0.7) : base
}
/** Every third right answer in a row hits the jackpot. */
export const JACKPOT_EVERY = 3
export const JACKPOT_BONUS = 25
export function isJackpot(streak: number): boolean {
  return streak > 0 && streak % JACKPOT_EVERY === 0
}

/** Verb blitz: ×2 from a streak of 3, ×3 from 6. */
export function blitzMultiplier(streak: number): number {
  return streak >= 6 ? 3 : streak >= 3 ? 2 : 1
}
export function blitzPoints(streak: number, irregular: boolean): number {
  return (irregular ? 15 : 10) * blitzMultiplier(streak)
}
