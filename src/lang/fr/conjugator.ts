/**
 * French verb conjugator.
 *
 * Regular -er / -ir (finir: -iss-) / -re (vendre) paradigms, automatic spelling
 * changes (commencer → commençons · manger → mangeons · acheter → achète ·
 * appeler → appelle · jeter → jette · préférer → préfère · employer → emploie ·
 * essuyer → essuie · payer → paie / paye), an irregular table
 * (content/fr/verbs/irregular.yaml) whose rows are inherited by derived verbs
 * (revenir ← venir, comprendre ← prendre, décrire ← écrire), and compound tenses
 * with the right auxiliary and participle agreement (je suis allé, nous sommes
 * allés). Pronominal verbs (se lever, s'asseoir, s'en aller) take être.
 *
 * Persons: 0 je · 1 tu · 2 il/elle/on · 3 nous · 4 vous · 5 ils/elles.
 * Tense keys follow the Spanish pack so the shared engine and pages work unchanged.
 */
import type { FrVerb } from './schema'
import { elides } from './normalize'

export const PERSONS = ['je', 'tu', 'il / elle / on', 'nous', 'vous', 'ils / elles'] as const

export type SimpleTense = 'pres' | 'impf' | 'pret' | 'fut' | 'cond' | 'subjPres' | 'subjImpf' | 'impAff' | 'impNeg'
export type CompoundTense = 'perf' | 'pluperf' | 'pretPerf' | 'futPerf' | 'condPerf' | 'subjPerf' | 'subjPluperf'
export type Tense = SimpleTense | CompoundTense
export type Aux = 'avoir' | 'être'

export const TENSES: Tense[] = [
  'pres', 'perf', 'impf', 'pluperf', 'fut', 'futPerf', 'cond', 'condPerf', 'pret', 'pretPerf',
  'subjPres', 'subjPerf', 'subjImpf', 'subjPluperf', 'impAff', 'impNeg',
]

export const TENSE_LABELS: Record<Tense, { es: string; en: string; level: string }> = {
  pres: { es: 'Présent', en: 'Present', level: 'a1' },
  perf: { es: 'Passé composé', en: 'Perfect (passé composé)', level: 'a1' },
  impf: { es: 'Imparfait', en: 'Imperfect', level: 'a2' },
  pluperf: { es: 'Plus-que-parfait', en: 'Past perfect', level: 'b1' },
  fut: { es: 'Futur simple', en: 'Future', level: 'a2' },
  futPerf: { es: 'Futur antérieur', en: 'Future perfect', level: 'b1' },
  cond: { es: 'Conditionnel présent', en: 'Conditional', level: 'a2' },
  condPerf: { es: 'Conditionnel passé', en: 'Conditional perfect', level: 'b1' },
  pret: { es: 'Passé simple', en: 'Simple past (passé simple)', level: 'b2' },
  pretPerf: { es: 'Passé antérieur', en: 'Past anterior (passé antérieur)', level: 'c1' },
  subjPres: { es: 'Subjonctif présent', en: 'Present subjunctive', level: 'b1' },
  subjPerf: { es: 'Subjonctif passé', en: 'Perfect subjunctive', level: 'b1' },
  subjImpf: { es: 'Subjonctif imparfait', en: 'Imperfect subjunctive (literary)', level: 'c1' },
  subjPluperf: { es: 'Subjonctif plus-que-parfait', en: 'Pluperfect subjunctive (literary)', level: 'c2' },
  impAff: { es: 'Impératif', en: 'Imperative', level: 'a2' },
  impNeg: { es: 'Impératif négatif', en: 'Negative imperative', level: 'a2' },
}

export interface Conjugation {
  /** The lemma as given (se lever). */
  lemma: string
  reflexive: boolean
  /** Pronoun of a pronominal verb: 'se' (se lever, s'asseoir), 'sen' (s'en aller), '' otherwise. */
  clitic: '' | 'se' | 'sen'
  /** Infinitive without pronoun (lever). */
  infinitive: string
  /** Masculine singular participle (allé); see `participles` for all four. */
  participle: string
  /** allé, allée, allés, allées. */
  participles: string[]
  /** Present participle, used in the gerund (en parlant). */
  gerund: string
  /** Auxiliary used in the table's compound tenses. */
  auxiliary: Aux
  /** Every correct auxiliary (sortir: être and avoir). */
  auxiliaries: Aux[]
  /**
   * Six persons per tense (null where a person has no form: imperatives,
   * impersonal verbs). Compound tenses with être show the masculine
   * (suis allé, sommes allés); `agreementVariants` lists the feminine ones.
   */
  forms: Record<Tense, (string | null)[]>
  /** Other accepted spellings (je paye, je puis, connait, assois). */
  alternates: string[]
}

type Class = 'er' | 'ir' | 're' | 'oir'
type AuxTense = 'pres' | 'impf' | 'pret' | 'fut' | 'cond' | 'subjPres' | 'subjImpf'

const AUX_FORMS: Record<Aux, Record<AuxTense, string[]>> = {
  avoir: {
    pres: ['ai', 'as', 'a', 'avons', 'avez', 'ont'],
    impf: ['avais', 'avais', 'avait', 'avions', 'aviez', 'avaient'],
    pret: ['eus', 'eus', 'eut', 'eûmes', 'eûtes', 'eurent'],
    fut: ['aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront'],
    cond: ['aurais', 'aurais', 'aurait', 'aurions', 'auriez', 'auraient'],
    subjPres: ['aie', 'aies', 'ait', 'ayons', 'ayez', 'aient'],
    subjImpf: ['eusse', 'eusses', 'eût', 'eussions', 'eussiez', 'eussent'],
  },
  être: {
    pres: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'],
    impf: ['étais', 'étais', 'était', 'étions', 'étiez', 'étaient'],
    pret: ['fus', 'fus', 'fut', 'fûmes', 'fûtes', 'furent'],
    fut: ['serai', 'seras', 'sera', 'serons', 'serez', 'seront'],
    cond: ['serais', 'serais', 'serait', 'serions', 'seriez', 'seraient'],
    subjPres: ['sois', 'sois', 'soit', 'soyons', 'soyez', 'soient'],
    subjImpf: ['fusse', 'fusses', 'fût', 'fussions', 'fussiez', 'fussent'],
  },
}
/** Auxiliary forms by person, for the checker and the explain layer. */
export const AUXILIARY_FORMS = AUX_FORMS

const COMPOUND: Record<CompoundTense, AuxTense> = {
  perf: 'pres', pluperf: 'impf', pretPerf: 'pret', futPerf: 'fut', condPerf: 'cond', subjPerf: 'subjPres', subjPluperf: 'subjImpf',
}

const IMPF = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']
const FUT = ['ai', 'as', 'a', 'ons', 'ez', 'ont']
const COND = IMPF
const PRET_ER = ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent']

/** -eler / -eter verbs that take è instead of doubling the consonant (acheter → achète, but appeler → appelle). */
const E_GRAVE_ELET: ReadonlySet<string> = new Set([
  'acheter', 'racheter', 'geler', 'dégeler', 'congeler', 'surgeler', 'peler', 'modeler', 'remodeler', 'haleter', 'ciseler', 'démanteler',
  'écarteler', 'marteler', 'crocheter', 'fureter', 'harceler', 'déceler', 'receler', 'celer', 'corseter', 'bégueter', 'encasteler',
])

const CIRC: Record<string, string> = { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' }
/** Circumflex on the last vowel of a passé simple stem (fu → fû: fûmes; vin → vîn: vînmes). */
export function circ(stem: string): string {
  for (let k = stem.length - 1; k >= 0; k--) {
    const ch = stem[k]!
    if ('âêîôûïü'.includes(ch)) return stem // already marked, or haï (haïmes)
    if (CIRC[ch]) return stem.slice(0, k) + CIRC[ch] + stem.slice(k + 1)
  }
  return stem
}

/** Join an -er stem and an ending: c → ç and g → ge before a and o (commençons, mangeais, plaça). */
export function join(stem: string, ending: string, cls: Class): string {
  if (cls !== 'er' || !/^[aoâ]/.test(ending)) return stem + ending
  if (stem.endsWith('c')) return stem.slice(0, -1) + 'ç' + ending
  if (stem.endsWith('g')) return stem + 'e' + ending
  return stem + ending
}

/**
 * Stem of an -er verb before a silent e (je …e, tu …es, il …e, ils …ent, the
 * subjunctive, and the whole future and conditional): achet → achèt, appel →
 * appell, jet → jett, préfér → préfèr, employ → emploi, essuy → essui, pay → pai
 * (alt pay). `future` keeps é in préférer (préférerai; préfèrerai is the alternate).
 */
export function muteStem(stem: string, inf: string, future = false): { main: string; alt?: string } {
  if (/[ou]y$/.test(stem)) return { main: stem.slice(0, -1) + 'i' }
  if (/ay$/.test(stem)) return { main: stem.slice(0, -1) + 'i', alt: stem }
  const acute = /é([^aeiouyéèêëàâîïôûùœ]+)$/.exec(stem)
  if (acute) {
    const changed = stem.slice(0, acute.index) + 'è' + acute[1]
    return future ? { main: stem, alt: changed } : { main: changed }
  }
  const mute = /e([bcdfgjklmnpqstvz]|[bcdfgptv][rl])$/.exec(stem)
  if (mute && mute.index > 0) {
    if (/e[lt]$/.test(stem) && !E_GRAVE_ELET.has(inf)) return { main: stem + stem.slice(-1) }
    return { main: stem.slice(0, mute.index) + 'è' + mute[1] }
  }
  return { main: stem }
}

/**
 * Split a lemma into infinitive and pronoun: se lever → lever + se, s'asseoir →
 * asseoir, s'en aller → aller + 'sen'. Words after the verb (avoir faim, se rendre
 * compte) are returned in `rest`.
 */
export function parseLemma(lemma: string): { inf: string; reflexive: boolean; clitic: '' | 'se' | 'sen'; rest: string } {
  const l = lemma.trim().toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ')
  let m = /^s'en (.+)$/.exec(l)
  let clitic: '' | 'se' | 'sen' = ''
  let body = l
  if (m) {
    clitic = 'sen'
    body = m[1]!
  } else if ((m = /^se (.+)$/.exec(l)) || (m = /^s'(.+)$/.exec(l))) {
    clitic = 'se'
    body = m[1]!
  }
  const [inf, ...rest] = body.split(' ')
  return { inf: inf!, reflexive: clitic !== '', clitic, rest: rest.join(' ') }
}

export function classOf(inf: string): Class {
  if (inf.endsWith('oir')) return 'oir'
  if (inf.endsWith('er')) return 'er'
  if (inf.endsWith('ir') || inf.endsWith('ïr')) return 'ir'
  if (inf.endsWith('re')) return 're'
  throw new Error(`Not a French infinitive: ${inf}`)
}

const FORM_KEYS = [
  'pres', 'impfStem', 'pret', 'pretStem', 'futStem', 'subjPres', 'impTu', 'impNous', 'impVous', 'noImperative', 'participle', 'participles',
  'invariable', 'gerund', 'like', 'regular', 'impersonal',
] as const

/** True when a row changes forms (not only the auxiliary). */
function hasForms(v: FrVerb): boolean {
  return FORM_KEYS.some((k) => v[k] !== undefined)
}

/** Copy a row to a verb with another prefix: venir → revenir (viens → reviens), écrire → décrire (écris → décris). */
function reprefix(v: FrVerb, from: string, to: string, lemma: string): FrVerb {
  const swap = (s: string) => (s !== '-' && s.startsWith(from) ? to + s.slice(from.length) : s)
  const six = (a: string[] | undefined) => a?.map(swap)
  const out: FrVerb = { ...v, lemma }
  for (const k of ['impfStem', 'pretStem', 'futStem', 'impTu', 'impNous', 'impVous', 'participle', 'gerund'] as const) if (v[k]) out[k] = swap(v[k])
  for (const k of ['pres', 'pret', 'subjPres', 'participles', 'alt'] as const) if (v[k]) out[k] = six(v[k])
  delete out.family
  delete out.like
  delete out.compounds
  return out
}

function commonSuffix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

const familyCache = new WeakMap<ReadonlyMap<string, FrVerb>, { suffix: string; row: FrVerb }[]>()
function families(table: ReadonlyMap<string, FrVerb>): { suffix: string; row: FrVerb }[] {
  let f = familyCache.get(table)
  if (!f) {
    f = [...table.values()]
      .filter((v) => hasForms(v) && v.compounds !== false && !v.like && !v.regular)
      .map((row) => ({ suffix: row.family ?? row.lemma, row }))
      .sort((a, b) => b.suffix.length - a.suffix.length)
    familyCache.set(table, f)
  }
  return f
}

/** Irregular row for an infinitive: listed, inherited (`like`), or derived from a base verb (revenir ← venir). */
export function resolveVerb(inf: string, table: ReadonlyMap<string, FrVerb>, depth = 0): FrVerb | undefined {
  const direct = table.get(inf)
  if (direct?.like && depth < 4) {
    const base = resolveVerb(direct.like, table, depth + 1)
    if (base) {
      const n = commonSuffix(base.lemma, inf)
      const derived = reprefix(base, base.lemma.slice(0, base.lemma.length - n), inf.slice(0, inf.length - n), inf)
      const own: Partial<FrVerb> = { ...direct }
      delete own.like
      return { ...derived, ...own, lemma: inf }
    }
  }
  if (direct && hasForms(direct)) return direct
  for (const { suffix, row } of families(table)) {
    if (inf.length > suffix.length && inf.endsWith(suffix)) {
      const from = row.lemma.slice(0, row.lemma.length - suffix.length)
      const derived = reprefix(row, from, inf.slice(0, inf.length - suffix.length), inf)
      if (!direct) return derived
      // an auxiliary-only row overrides what the compound inherits (prévenir: avoir, unlike venir)
      const merged: FrVerb = { ...derived, ...direct }
      if (direct.aux && direct.bothAux === undefined) delete merged.bothAux
      return merged
    }
  }
  return direct
}

/** Masculine/feminine × singular/plural of a participle: allé → allé, allée, allés, allées; pris → pris, prise, pris, prises. */
export function participleForms(p: string): string[] {
  return [p, p + 'e', /[sx]$/.test(p) ? p : p + 's', p + 'es']
}

/** Participle (any of its four forms) → its four forms, for the participles met so far (agreementVariants). */
const KNOWN_PARTICIPLES = new Map<string, string[]>()

const dash = (a: readonly string[]): (string | null)[] => a.map((f) => (f === '-' ? null : f))
const simpleStem = (s: string): string[] => [s + 's', s + 's', s + 't', circ(s) + 'mes', circ(s) + 'tes', s + 'rent']

/** ne … pas around an imperative: ne parle pas, n'aie pas peur. */
export function negate(form: string): string {
  return `${elides(form) ? "n'" : 'ne '}${form} pas`
}

export function conjugate(lemmaIn: string, table: ReadonlyMap<string, FrVerb> = new Map()): Conjugation {
  const { inf, reflexive, clitic } = parseLemma(lemmaIn)
  const cls = classOf(inf)
  const irr = resolveVerb(inf, table)
  const stem = inf.slice(0, cls === 'oir' ? -3 : -2)
  const mute = cls === 'er' ? muteStem(stem, inf) : { main: stem }
  const alternates: string[] = [...(irr?.alt ?? [])]
  const J = (s: string, e: string) => join(s, e, cls)

  // ---- présent
  let pres: (string | null)[]
  if (irr?.pres) pres = dash(irr.pres)
  else if (cls === 'er') {
    const m = mute.main
    pres = [m + 'e', m + 'es', m + 'e', J(stem, 'ons'), stem + 'ez', m + 'ent']
    if (mute.alt) alternates.push(mute.alt + 'e', mute.alt + 'es', mute.alt + 'ent')
  } else if (cls === 'ir') pres = ['is', 'is', 'it', 'issons', 'issez', 'issent'].map((e) => stem + e)
  else pres = [stem + 's', stem + 's', stem + (/[dt]$/.test(stem) ? '' : 't'), stem + 'ons', stem + 'ez', stem + 'ent'] // vendre, rompre → il rompt

  // ---- imparfait (from the nous form: faisons → faisais; -er verbs from the stem: commencions / commençais)
  const impfStem = irr?.impfStem ?? (cls === 'er' || !pres[3] ? stem : pres[3].replace(/ons$/, ''))
  const impf: (string | null)[] = IMPF.map((e) => J(impfStem, e))

  // ---- passé simple
  let pret: (string | null)[]
  if (irr?.pret) pret = dash(irr.pret)
  else if (irr?.pretStem) pret = simpleStem(irr.pretStem)
  else if (cls === 'er') pret = PRET_ER.map((e) => J(stem, e))
  else pret = simpleStem(stem + (cls === 'oir' ? 'u' : 'i'))

  // ---- futur / conditionnel
  let futStem: string
  if (irr?.futStem) futStem = irr.futStem
  else if (cls === 'er') {
    const f = muteStem(stem, inf, true)
    futStem = f.main + 'er'
    if (f.alt) for (const e of FUT) alternates.push(f.alt + 'er' + e)
    if (f.alt) for (const e of COND) alternates.push(f.alt + 'er' + e)
  } else if (cls === 'ir') futStem = inf
  else if (cls === 're') futStem = inf.slice(0, -1)
  else futStem = stem + 'r' // recevoir → recevr, devoir → devr
  const fut: (string | null)[] = FUT.map((e) => futStem + e)
  const cond: (string | null)[] = COND.map((e) => futStem + e)

  // ---- subjonctif présent: ils-stem (viennent → vienne), nous/vous from the imperfect (venions)
  let subjPres: (string | null)[]
  if (irr?.subjPres) subjPres = dash(irr.subjPres)
  else {
    const ils = (pres[5] ?? pres[2] ?? stem).replace(/ent$/, '')
    subjPres = [ils + 'e', ils + 'es', ils + 'e', J(impfStem, 'ions'), J(impfStem, 'iez'), ils + 'ent']
    if (cls === 'er' && mute.alt) alternates.push(mute.alt + 'e', mute.alt + 'es', mute.alt + 'ent')
  }

  // ---- subjonctif imparfait from the tu form of the passé simple (parlas → parlasse, fus → fusse, vins → vinsse)
  const ss = pret[1]?.replace(/s$/, '')
  const subjImpf: (string | null)[] = ss ? [ss + 'sse', ss + 'sses', circ(ss) + 't', ss + 'ssions', ss + 'ssiez', ss + 'ssent'] : [null, null, null, null, null, null]

  // ---- impératif: tu (parle, finis, va), nous, vous
  let impAff: (string | null)[]
  if (irr?.noImperative || irr?.impersonal) impAff = [null, null, null, null, null, null]
  else {
    const tuPres = pres[1] ?? ''
    const tu = irr?.impTu ?? (tuPres.endsWith('es') || tuPres === 'vas' ? tuPres.slice(0, -1) : tuPres)
    impAff = [null, tu, null, irr?.impNous ?? pres[3] ?? null, irr?.impVous ?? pres[4] ?? null, null]
  }
  const impNeg: (string | null)[] = impAff.map((f) => (f === null ? null : negate(f)))

  // ---- participes
  const participle = irr?.participle ?? stem + (cls === 'er' ? 'é' : cls === 'ir' ? 'i' : 'u')
  const participles = irr?.invariable ? [participle, participle, participle, participle] : (irr?.participles ? [...irr.participles] : participleForms(participle))
  const gerund = irr?.gerund ?? J(impfStem, 'ant')

  // ---- auxiliaire
  const auxiliary: Aux = reflexive ? 'être' : (irr?.aux ?? 'avoir')
  const auxiliaries: Aux[] = reflexive ? ['être'] : irr?.bothAux ? [auxiliary, auxiliary === 'avoir' ? 'être' : 'avoir'] : [auxiliary]
  const compound = (t: CompoundTense) =>
    AUX_FORMS[auxiliary][COMPOUND[t]].map((a, p) => `${a} ${auxiliary === 'être' && p >= 3 ? participles[2] : participle}`)

  const forms: Record<Tense, (string | null)[]> = {
    pres, impf, pret, fut, cond, subjPres, subjImpf, impAff, impNeg,
    perf: compound('perf'),
    pluperf: compound('pluperf'),
    pretPerf: compound('pretPerf'),
    futPerf: compound('futPerf'),
    condPerf: compound('condPerf'),
    subjPerf: compound('subjPerf'),
    subjPluperf: compound('subjPluperf'),
  }
  if (irr?.impersonal) for (const t of TENSES) forms[t] = forms[t].map((f, p) => (p === 2 ? f : null))

  // 1990 spelling: connait, parait, plait (no circumflex on i before t)
  for (const f of [...pres, inf]) if (f && /[aoû]ît/.test(f)) alternates.push(f.replace(/([ao])ît/, '$1it'))
  for (const p of participles) KNOWN_PARTICIPLES.set(p, participles)

  return {
    lemma: lemmaIn.trim().toLowerCase(),
    reflexive,
    clitic,
    infinitive: inf,
    participle,
    participles,
    gerund,
    auxiliary,
    auxiliaries,
    forms,
    alternates: [...new Set(alternates)].filter((a) => a && a !== '-'),
  }
}

/** The verb of a table form: "ai parlé" → parlé, "ne parle pas" → parle, "n'aie pas" → aie. */
export function verbWord(form: string): string {
  return form.replace(/^ne |^n'/, '').replace(/ pas$/, '').split(' ').pop()!
}

/** Every surface form of a conjugation: single-word forms, the participle in all four forms, alternates. */
export function formsOf(c: Conjugation): Set<string> {
  const out = new Set<string>([c.infinitive, ...c.participles, ...c.alternates])
  if (c.gerund) out.add(c.gerund)
  for (const forms of Object.values(c.forms)) {
    for (const f of forms) if (f) out.add(verbWord(f))
  }
  return out
}

const ETRE_SG: ReadonlySet<string> = new Set(['suis', 'es', 'est', 'étais', 'était', 'fus', 'fut', 'serai', 'seras', 'sera', 'serais', 'serait', 'sois', 'soit', 'fusse', 'fusses', 'fût'])
const ETRE_PL: ReadonlySet<string> = new Set(['sommes', 'sont', 'étions', 'étaient', 'fûmes', 'furent', 'serons', 'seront', 'serions', 'seraient', 'soyons', 'soient', 'fussions', 'fussent'])
const ETRE_VOUS: ReadonlySet<string> = new Set(['êtes', 'étiez', 'fûtes', 'serez', 'seriez', 'soyez', 'fussiez'])

/** Four forms of a participle seen in a table form (from the conjugations met so far, else by rule). */
function fourForms(p: string): string[] {
  const known = KNOWN_PARTICIPLES.get(p)
  if (known) return known
  if (/és$|[iu]s$/.test(p)) return participleForms(p.slice(0, -1))
  return participleForms(p)
}

/**
 * All accepted spellings of a table form: compound tenses with être agree with
 * the subject (suis allé / suis allée; sommes allés / sommes allées; vous êtes
 * allé, allée, allés or allées). Works on pronominal forms too (me suis levé).
 */
export function agreementVariants(form: string | null | undefined): string[] {
  if (!form) return []
  const parts = form.split(' ')
  if (parts.length < 2) return [form]
  const last = parts[parts.length - 1]!
  const aux = parts[parts.length - 2]!.replace(/^[mts]'/, '')
  const head = parts.slice(0, -1).join(' ')
  const [msg, fsg, mpl, fpl] = fourForms(last)
  if (msg === fsg) return [form] // invariable (été)
  let want: string[]
  if (ETRE_SG.has(aux)) want = [msg!, fsg!]
  else if (ETRE_PL.has(aux)) want = [mpl!, fpl!]
  else if (ETRE_VOUS.has(aux)) want = [mpl!, fpl!, msg!, fsg!]
  else return [form]
  return [...new Set([form, ...want.map((p) => `${head} ${p}`)])]
}

/** Reflexive pronouns per person (before the verb) and their stressed forms after an imperative. */
export const REFLEXIVE = ['me', 'te', 'se', 'nous', 'vous', 'se'] as const
const ELIDED_REFLEXIVE = ["m'", "t'", "s'", 'nous ', 'vous ', "s'"] as const
const STRESSED = [null, 'toi', null, 'nous', 'vous', null] as const
const EN_CLUSTER = ["m'en ", "t'en ", "s'en ", 'nous en ', 'vous en ', "s'en "] as const

/** Pronoun of a pronominal verb before a form: "me " / "m'" (m'habille, m'appelle) / "nous ". */
function pronounBefore(person: number, next: string, clitic: 'se' | 'sen'): string {
  if (clitic === 'sen') return EN_CLUSTER[person]!
  return elides(next) ? ELIDED_REFLEXIVE[person]! : `${REFLEXIVE[person]} `
}

/**
 * Add the pronoun of a pronominal verb for display: "me lève", "m'habille",
 * "me suis levé", "lève-toi", "ne te lève pas", "ne t'habille pas". With clitic
 * 'sen' (s'en aller): "m'en vais", "va-t'en", "allez-vous-en", "ne t'en va pas".
 */
export function withReflexive(form: string | null | undefined, person: number, tense: Tense, clitic: 'se' | 'sen' = 'se'): string | null {
  if (form === null || form === undefined) return null
  if (tense === 'impAff') {
    const stressed = STRESSED[person]
    if (!stressed) return null
    if (clitic === 'sen') return person === 1 ? `${form}-t'en` : `${form}-${stressed}-en`
    return `${form}-${stressed}`
  }
  if (tense === 'impNeg') {
    const verb = form.replace(/^ne |^n'/, '').replace(/ pas$/, '')
    return `ne ${pronounBefore(person, verb, clitic)}${verb} pas`
  }
  return `${pronounBefore(person, form, clitic)}${form}`
}
