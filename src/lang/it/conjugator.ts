/**
 * Italian verb conjugator.
 *
 * Regular -are / -ere / -ire paradigms (with the -isc- class), automatic spelling
 * changes (cercare → cerchi, cercherò · mangiare → mangi, mangerò · studiare → studi
 * · inviare → invii), an irregular table (content/it/verbs/irregular.yaml) with
 * compounds derived from their base verb (proporre ← porre), and compound tenses
 * with the right auxiliary and participle agreement (sono andato / siamo andati).
 *
 * Persons: 0 io · 1 tu · 2 lui/lei/Lei · 3 noi · 4 voi · 5 loro.
 * Tense keys follow the Spanish pack so the shared engine and pages work unchanged.
 */
import type { ItVerb } from './schema'

export const PERSONS = ['io', 'tu', 'lui / lei / Lei', 'noi', 'voi', 'loro'] as const

export type SimpleTense = 'pres' | 'impf' | 'pret' | 'fut' | 'cond' | 'subjPres' | 'subjImpf' | 'impAff' | 'impNeg'
export type CompoundTense = 'perf' | 'pluperf' | 'pretPerf' | 'futPerf' | 'condPerf' | 'subjPerf' | 'subjPluperf'
export type Tense = SimpleTense | CompoundTense
export type Aux = 'avere' | 'essere'

export const TENSES: Tense[] = [
  'pres', 'perf', 'impf', 'pluperf', 'fut', 'futPerf', 'cond', 'condPerf', 'pret', 'pretPerf',
  'subjPres', 'subjPerf', 'subjImpf', 'subjPluperf', 'impAff', 'impNeg',
]

export const TENSE_LABELS: Record<Tense, { es: string; en: string; level: string }> = {
  pres: { es: 'Presente', en: 'Present', level: 'a1' },
  perf: { es: 'Passato prossimo', en: 'Present perfect (passato prossimo)', level: 'a1' },
  impf: { es: 'Imperfetto', en: 'Imperfect', level: 'a2' },
  pluperf: { es: 'Trapassato prossimo', en: 'Past perfect', level: 'b1' },
  fut: { es: 'Futuro semplice', en: 'Future', level: 'a2' },
  futPerf: { es: 'Futuro anteriore', en: 'Future perfect', level: 'b1' },
  cond: { es: 'Condizionale presente', en: 'Conditional', level: 'a2' },
  condPerf: { es: 'Condizionale passato', en: 'Conditional perfect', level: 'b1' },
  pret: { es: 'Passato remoto', en: 'Simple past (passato remoto)', level: 'b1' },
  pretPerf: { es: 'Trapassato remoto', en: 'Past anterior (trapassato remoto)', level: 'c1' },
  subjPres: { es: 'Congiuntivo presente', en: 'Present subjunctive', level: 'b1' },
  subjPerf: { es: 'Congiuntivo passato', en: 'Present perfect subjunctive', level: 'b1' },
  subjImpf: { es: 'Congiuntivo imperfetto', en: 'Imperfect subjunctive', level: 'b1' },
  subjPluperf: { es: 'Congiuntivo trapassato', en: 'Past perfect subjunctive', level: 'b2' },
  impAff: { es: 'Imperativo', en: 'Imperative', level: 'a2' },
  impNeg: { es: 'Imperativo negativo', en: 'Negative imperative', level: 'a2' },
}

export interface Conjugation {
  /** The lemma as given (alzarsi). */
  lemma: string
  reflexive: boolean
  /** Pronoun of a pronominal verb: 'si' (alzarsi), 'sene' (andarsene), '' otherwise. */
  clitic: '' | 'si' | 'sene'
  /** Infinitive without pronoun (alzare). */
  infinitive: string
  /** Masculine singular participle (andato); see `participles` for all four. */
  participle: string
  /** andato, andata, andati, andate. */
  participles: string[]
  gerund: string
  /** Auxiliary used in the table's compound tenses. */
  auxiliary: Aux
  /** Every correct auxiliary (salire: essere and avere). */
  auxiliaries: Aux[]
  /**
   * Six persons per tense. Compound tenses with essere show the masculine
   * (sono andato, siamo andati); `agreementVariants` lists the feminine ones.
   */
  forms: Record<Tense, (string | null)[]>
  /** Other accepted spellings (credetti, debbo, perduto). */
  alternates: string[]
}

type Class = 'are' | 'ere' | 'ire'

const AUX_FORMS: Record<Aux, Record<'pres' | 'impf' | 'pret' | 'fut' | 'cond' | 'subjPres' | 'subjImpf', string[]>> = {
  avere: {
    pres: ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'],
    impf: ['avevo', 'avevi', 'aveva', 'avevamo', 'avevate', 'avevano'],
    pret: ['ebbi', 'avesti', 'ebbe', 'avemmo', 'aveste', 'ebbero'],
    fut: ['avrò', 'avrai', 'avrà', 'avremo', 'avrete', 'avranno'],
    cond: ['avrei', 'avresti', 'avrebbe', 'avremmo', 'avreste', 'avrebbero'],
    subjPres: ['abbia', 'abbia', 'abbia', 'abbiamo', 'abbiate', 'abbiano'],
    subjImpf: ['avessi', 'avessi', 'avesse', 'avessimo', 'aveste', 'avessero'],
  },
  essere: {
    pres: ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'],
    impf: ['ero', 'eri', 'era', 'eravamo', 'eravate', 'erano'],
    pret: ['fui', 'fosti', 'fu', 'fummo', 'foste', 'furono'],
    fut: ['sarò', 'sarai', 'sarà', 'saremo', 'sarete', 'saranno'],
    cond: ['sarei', 'saresti', 'sarebbe', 'saremmo', 'sareste', 'sarebbero'],
    subjPres: ['sia', 'sia', 'sia', 'siamo', 'siate', 'siano'],
    subjImpf: ['fossi', 'fossi', 'fosse', 'fossimo', 'foste', 'fossero'],
  },
}
/** Auxiliary forms by person, for the checker and the explain layer. */
export const AUXILIARY_FORMS = AUX_FORMS

const COMPOUND: Record<CompoundTense, keyof (typeof AUX_FORMS)['avere']> = {
  perf: 'pres', pluperf: 'impf', pretPerf: 'pret', futPerf: 'fut', condPerf: 'cond', subjPerf: 'subjPres', subjPluperf: 'subjImpf',
}

const END: Record<'pres' | 'impf' | 'pret' | 'subjImpf', Record<Class, string[]>> = {
  pres: { are: ['o', 'i', 'a', 'iamo', 'ate', 'ano'], ere: ['o', 'i', 'e', 'iamo', 'ete', 'ono'], ire: ['o', 'i', 'e', 'iamo', 'ite', 'ono'] },
  impf: { are: ['avo', 'avi', 'ava', 'avamo', 'avate', 'avano'], ere: ['evo', 'evi', 'eva', 'evamo', 'evate', 'evano'], ire: ['ivo', 'ivi', 'iva', 'ivamo', 'ivate', 'ivano'] },
  pret: { are: ['ai', 'asti', 'ò', 'ammo', 'aste', 'arono'], ere: ['ei', 'esti', 'é', 'emmo', 'este', 'erono'], ire: ['ii', 'isti', 'ì', 'immo', 'iste', 'irono'] },
  subjImpf: { are: ['assi', 'assi', 'asse', 'assimo', 'aste', 'assero'], ere: ['essi', 'essi', 'esse', 'essimo', 'este', 'essero'], ire: ['issi', 'issi', 'isse', 'issimo', 'iste', 'issero'] },
}
const ISC_PRES = ['isco', 'isci', 'isce', 'iamo', 'ite', 'iscono']
const FUT = ['ò', 'ai', 'à', 'emo', 'ete', 'anno']
const COND = ['ei', 'esti', 'ebbe', 'emmo', 'este', 'ebbero']
const SUBJ_ARE = ['i', 'i', 'i', 'iamo', 'iate', 'ino']

/**
 * -ire verbs that insert -isc- in the present (io, tu, lui, loro), the present
 * subjunctive and the imperative: finisco, capisci, preferisce, puliscono.
 * Prefixed forms (ricostruire, riunire) are recognised too.
 */
export const ISC_VERBS: ReadonlySet<string> = new Set([
  'abbellire', 'abolire', 'addolcire', 'aderire', 'agire', 'alleggerire', 'ammonire', 'ammorbidire', 'annuire',
  'appassire', 'approfondire', 'arricchire', 'arrossire', 'arrostire', 'arrugginire', 'asserire', 'attribuire',
  'capire', 'chiarire', 'colpire', 'concepire', 'condire', 'conferire', 'contribuire', 'costituire', 'costruire',
  'definire', 'demolire', 'differire', 'digerire', 'dimagrire', 'diminuire', 'distribuire', 'esaurire', 'fallire',
  'favorire', 'ferire', 'finire', 'fiorire', 'fornire', 'garantire', 'gestire', 'gioire', 'gradire', 'guarire',
  'imbruttire', 'impallidire', 'impazzire', 'impedire', 'incuriosire', 'indebolire', 'influire', 'ingelosire',
  'ingrandire', 'inserire', 'interferire', 'irrigidire', 'istituire', 'istruire', 'obbedire', 'partorire',
  'percepire', 'preferire', 'proibire', 'progredire', 'pulire', 'punire', 'rapire', 'reagire', 'restituire',
  'riferire', 'ringiovanire', 'sbalordire', 'scolpire', 'seppellire', 'sminuire', 'smarrire', 'snellire',
  'sostituire', 'sparire', 'spedire', 'stabilire', 'starnutire', 'stordire', 'stupire', 'suggerire', 'svanire',
  'tossire', 'tradire', 'tramortire', 'trasferire', 'ubbidire', 'unire', 'zittire',
])

/** -iare verbs whose i is stressed in io/tu/lui/loro (invìo → invii); others: studio → studi. */
const STRESSED_I: ReadonlySet<string> = new Set(['inviare', 'sciare', 'spiare', 'avviare', 'deviare', 'rinviare', 'obliare', 'espiare', 'fuorviare', 'traviare', 'ovviare'])

function isIsc(inf: string): boolean {
  if (ISC_VERBS.has(inf)) return true
  for (const p of ['ri', 're', 'ris', 's', 'di', 'pre']) if (inf.startsWith(p) && ISC_VERBS.has(inf.slice(p.length))) return true
  return false
}

/**
 * Join a stem and an ending with Italian spelling rules (-are verbs only need them):
 *  - c/g + e/i → ch/gh (cerchi, paghiamo, cercherò)
 *  - ci/gi (and sci) + e/i → the i drops (mangi, mangerò, lascerò) unless the i is stressed
 *  - i + i collapses (studi, studiamo), but stays for stressed i in invii / inviino
 */
export function join(stem: string, ending: string, cls: Class, stressedI = false): string {
  if (cls !== 'are' || !/^[eièéì]/.test(ending)) return stem + ending
  if (/[cg]$/.test(stem)) return stem + 'h' + ending
  if (/[cg]i$/.test(stem) && !stressedI) return stem.slice(0, -1) + ending
  if (stem.endsWith('i') && /^i/.test(ending)) {
    if (stressedI && (ending === 'i' || ending === 'ino')) return stem + ending
    return stem + ending.slice(1)
  }
  return stem + ending
}

/** Split a lemma into infinitive and pronoun: alzarsi → alzare + si, porsi → porre, andarsene → andare + sene. */
export function parseLemma(lemma: string): { inf: string; reflexive: boolean; clitic: '' | 'si' | 'sene' } {
  const l = lemma.trim().toLowerCase()
  const restore = (x: string) => (/(ur|or|trar)$/.test(x) ? x + 're' : x + 'e')
  if (/rsene$/.test(l) && l.length > 7) return { inf: restore(l.slice(0, -4)), reflexive: true, clitic: 'sene' }
  if (/rsi$/.test(l) && l.length > 4) return { inf: restore(l.slice(0, -2)), reflexive: true, clitic: 'si' }
  return { inf: l, reflexive: false, clitic: '' }
}

export function classOf(inf: string): Class {
  const c = inf.slice(-3)
  if (c === 'are' || c === 'ere' || c === 'ire') return c
  throw new Error(`Not an Italian infinitive: ${inf}`)
}

/** Default Latin-like base for -rre verbs missing from the table (produrre < producere). */
function rreBase(inf: string): string {
  if (inf.endsWith('urre')) return inf.slice(0, -3) + 'cere'
  if (inf.endsWith('orre')) return inf.slice(0, -3) + 'nere'
  if (inf.endsWith('arre')) return inf.slice(0, -3) + 'ere'
  throw new Error(`Not an Italian infinitive: ${inf}`)
}

const FORM_KEYS = ['base', 'pres', 'impf', 'pret', 'pretStem', 'futStem', 'subjPres', 'subjImpf', 'impTu', 'impVoi', 'participle', 'gerund', 'noImperative', 'like'] as const

/** True when a row changes forms (not only the auxiliary). */
function hasForms(v: ItVerb): boolean {
  return FORM_KEYS.some((k) => v[k] !== undefined)
}

/** Copy a row to a verb with another prefix: porre → proporre (pongo → propongo). */
function reprefix(v: ItVerb, from: string, to: string, lemma: string): ItVerb {
  const swap = (s: string) => (s.startsWith(from) ? to + s.slice(from.length) : s)
  const six = (a: string[] | undefined) => a?.map(swap)
  const out: ItVerb = { ...v, lemma }
  if (v.base) out.base = swap(v.base)
  if (v.pretStem) out.pretStem = swap(v.pretStem)
  if (v.futStem) out.futStem = swap(v.futStem)
  if (v.impTu) out.impTu = swap(v.impTu)
  if (v.impVoi) out.impVoi = swap(v.impVoi)
  if (v.participle) out.participle = swap(v.participle)
  if (v.gerund) out.gerund = swap(v.gerund)
  for (const k of ['pres', 'impf', 'pret', 'subjPres', 'subjImpf', 'alt'] as const) if (v[k]) out[k] = six(v[k])
  delete out.family
  delete out.like
  return out
}

function commonSuffix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

const familyCache = new WeakMap<ReadonlyMap<string, ItVerb>, { suffix: string; row: ItVerb }[]>()
function families(table: ReadonlyMap<string, ItVerb>): { suffix: string; row: ItVerb }[] {
  let f = familyCache.get(table)
  if (!f) {
    f = [...table.values()]
      .filter((v) => hasForms(v) && v.compounds !== false && !v.like)
      .map((row) => ({ suffix: row.family ?? row.lemma, row }))
      .sort((a, b) => b.suffix.length - a.suffix.length)
    familyCache.set(table, f)
  }
  return f
}

/** Irregular row for an infinitive: listed, inherited (`like`), or derived from a base verb (ottenere ← tenere). */
export function resolveVerb(inf: string, table: ReadonlyMap<string, ItVerb>, depth = 0): ItVerb | undefined {
  const direct = table.get(inf)
  if (direct?.like && depth < 4) {
    const base = resolveVerb(direct.like, table, depth + 1)
    if (base) {
      const n = commonSuffix(base.lemma, inf)
      const derived = reprefix(base, base.lemma.slice(0, base.lemma.length - n), inf.slice(0, inf.length - n), inf)
      const own: Partial<ItVerb> = { ...direct }
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
      // an auxiliary-only row overrides what the compound inherits (aggiungere: avere, unlike giungere)
      const merged: ItVerb = { ...derived, ...direct }
      if (direct.aux && direct.bothAux === undefined) delete merged.bothAux
      return merged
    }
  }
  return direct
}

/** Masculine/feminine × singular/plural of a participle: andato → andato, andata, andati, andate. */
export function participleForms(p: string): string[] {
  const s = p.slice(0, -1)
  return [p, s + 'a', s + 'i', s + 'e']
}

export function conjugate(lemmaIn: string, table: ReadonlyMap<string, ItVerb> = new Map()): Conjugation {
  const { inf, reflexive, clitic } = parseLemma(lemmaIn)
  const irr = resolveVerb(inf, table)
  const src = irr?.base ?? (inf.endsWith('rre') ? rreBase(inf) : inf)
  const cls = classOf(src)
  const stem = src.slice(0, -3)
  const stressedI = irr?.stressedI ?? STRESSED_I.has(inf)
  const isc = cls === 'ire' && (irr?.isc ?? isIsc(inf))
  const J = (s: string, e: string) => join(s, e, cls, stressedI)

  // ---- presente
  const pres = irr?.pres ? [...irr.pres] : (isc ? ISC_PRES : END.pres[cls]).map((e) => J(stem, e))

  // ---- imperfetto
  const impf = irr?.impf ? [...irr.impf] : END.impf[cls].map((e) => stem + e)

  // ---- passato remoto
  const weak = END.pret[cls].map((e) => J(stem, e))
  let pret: string[]
  if (irr?.pret) pret = [...irr.pret]
  else if (irr?.pretStem) {
    const ps = irr.pretStem
    pret = [ps + 'i', weak[1]!, ps + 'e', weak[3]!, weak[4]!, ps + 'ero']
  } else pret = weak

  // ---- futuro / condizionale
  const futStem = irr?.futStem ?? (irr?.base || inf.endsWith('rre') ? inf.slice(0, -1) : cls === 'are' ? J(stem, 'er') : src.slice(0, -1))
  const fut = FUT.map((e) => futStem + e)
  const cond = COND.map((e) => futStem + e)

  // ---- congiuntivo presente: -are from the stem, -ere/-ire from the io form (vengo → venga)
  let subjPres: string[]
  if (irr?.subjPres) subjPres = [...irr.subjPres]
  else if (cls === 'are') subjPres = SUBJ_ARE.map((e) => J(stem, e))
  else {
    const io = pres[0]!.replace(/o$/, '')
    const noi = pres[3]!
    subjPres = [io + 'a', io + 'a', io + 'a', noi, noi.replace(/mo$/, 'te'), io + 'ano']
  }

  // ---- congiuntivo imperfetto from the tu form of the passato remoto (parlasti → parlassi, fosti → fossi)
  const ssBase = pret[1]!.replace(/sti$/, '')
  const subjImpf = irr?.subjImpf ? [...irr.subjImpf] : ['ssi', 'ssi', 'sse', 'ssimo', 'ste', 'ssero'].map((e) => ssBase + e)

  // ---- imperativo
  let impAff: (string | null)[]
  if (irr?.noImperative) impAff = [null, null, null, null, null, null]
  else {
    const tu = irr?.impTu ?? (cls === 'are' && !irr?.pres ? J(stem, 'a') : pres[1]!)
    impAff = [null, tu, subjPres[2]!, subjPres[3]!, irr?.impVoi ?? pres[4]!, subjPres[5]!]
  }
  const impNeg: (string | null)[] = impAff.map((f, p) => (f === null ? null : p === 1 ? `non ${inf}` : `non ${f}`))

  // ---- forme non finite
  const participle = irr?.participle ?? (cls === 'are' ? stem + 'ato' : cls === 'ire' ? stem + 'ito' : /[cg]$/.test(stem) ? stem + 'iuto' : stem + 'uto')
  const gerund = irr?.gerund ?? stem + (cls === 'are' ? 'ando' : 'endo')

  // ---- ausiliare
  const auxiliary: Aux = reflexive ? 'essere' : (irr?.aux ?? 'avere')
  const auxiliaries: Aux[] = reflexive ? ['essere'] : irr?.bothAux ? [auxiliary, auxiliary === 'avere' ? 'essere' : 'avere'] : [auxiliary]
  const plural = participle.slice(0, -1) + 'i'
  const compound = (t: CompoundTense) =>
    AUX_FORMS[auxiliary][COMPOUND[t]].map((a, p) => `${a} ${auxiliary === 'essere' && p >= 3 ? plural : participle}`)

  const alternates = [...(irr?.alt ?? [])]
  if (cls === 'ere' && !irr?.pret && !irr?.pretStem && !stem.endsWith('t')) alternates.push(stem + 'etti', stem + 'ette', stem + 'ettero')
  // va' / vai, fa' / fai, da' / dai, sta' / stai; di' / dì
  if (irr?.impTu?.endsWith("a'")) alternates.push(irr.impTu.slice(0, -1) + 'i')
  if (irr?.impTu === "di'") alternates.push('dì')

  return {
    lemma: lemmaIn.trim().toLowerCase(),
    reflexive,
    clitic,
    infinitive: inf,
    participle,
    participles: participleForms(participle),
    gerund,
    auxiliary,
    auxiliaries,
    forms: {
      pres, impf, pret, fut, cond, subjPres, subjImpf, impAff, impNeg,
      perf: compound('perf'),
      pluperf: compound('pluperf'),
      pretPerf: compound('pretPerf'),
      futPerf: compound('futPerf'),
      condPerf: compound('condPerf'),
      subjPerf: compound('subjPerf'),
      subjPluperf: compound('subjPluperf'),
    },
    alternates: [...new Set(alternates)],
  }
}

/** Every surface form of a conjugation: single-word forms, the participle in all four forms, alternates. */
export function formsOf(c: Conjugation): Set<string> {
  const out = new Set<string>([c.infinitive, c.gerund, ...c.participles, ...c.alternates])
  for (const forms of Object.values(c.forms)) {
    for (const f of forms) {
      if (!f) continue
      out.add(f.replace(/^non /, '').split(' ').pop()!)
    }
  }
  return out
}

/**
 * All accepted spellings of a table form: compound tenses with essere agree with
 * the subject (sono andato / sono andata; siamo andati / siamo andate).
 */
export function agreementVariants(form: string | null | undefined): string[] {
  if (!form) return []
  const parts = form.split(' ')
  const last = parts[parts.length - 1]!
  const aux = parts[parts.length - 2]
  if (!aux || !/[oi]$/.test(last) || !ESSERE_AUX.has(aux)) return [form]
  const head = parts.slice(0, -1).join(' ')
  const s = last.slice(0, -1)
  return last.endsWith('o') ? [form, `${head} ${s}a`] : [form, `${head} ${s}e`]
}
const ESSERE_AUX: ReadonlySet<string> = new Set(Object.values(AUX_FORMS.essere).flat())

/** Reflexive pronouns per person (before the verb) and their enclitic forms. */
export const REFLEXIVE = ['mi', 'ti', 'si', 'ci', 'vi', 'si'] as const
const SENE = ['me ne', 'te ne', 'se ne', 'ce ne', 've ne', 'se ne'] as const

/** Attach a clitic to a verb form, doubling after a monosyllabic imperative (fa' + ti → fatti, di' + mi → dimmi). */
export function attachClitic(form: string, clitic: string): string {
  if (form.endsWith("'")) {
    const base = form.slice(0, -1)
    return clitic.startsWith('gli') ? base + clitic : base + clitic[0] + clitic
  }
  return form + clitic
}

/**
 * Add the reflexive pronoun for display: "mi alzo", "mi sono alzato", "alzati",
 * "si alzi", "alziamoci", "non alzarti". With clitic 'sene': "me ne vado", "vattene".
 */
export function withReflexive(form: string | null | undefined, person: number, tense: Tense, clitic: 'si' | 'sene' = 'si'): string | null {
  if (form === null || form === undefined) return null
  const before = clitic === 'sene' ? SENE[person]! : REFLEXIVE[person]!
  const after = before.replace(' ', '')
  if (tense === 'impAff') {
    if (person === 2 || person === 5) return `${before} ${form}`
    return attachClitic(form, after)
  }
  if (tense === 'impNeg') {
    const verb = form.replace(/^non /, '')
    if (person === 1) return `non ${verb.endsWith('rre') ? verb.slice(0, -2) : verb.slice(0, -1)}${after}`
    if (person === 2 || person === 5) return `non ${before} ${verb}`
    return `non ${verb}${after}`
  }
  return `${before} ${form}`
}
