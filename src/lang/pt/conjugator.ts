/**
 * Portuguese verb conjugator (Brazilian orthography; tu and vós kept in the tables).
 *
 * Regular paradigms + orthographic adjustments + automatic stem changes + an
 * irregular table (content/pt/verbs/irregular.yaml). Six persons:
 *   0 eu · 1 tu · 2 ele/ela/você · 3 nós · 4 vós · 5 eles/elas/vocês
 *
 * Automatic rules (no table entry needed):
 *  - spelling: ficar → fiquei/fique, chegar → cheguei, começar → comecei,
 *    conhecer → conheço, proteger → protejo, dirigir → dirijo, seguir → sigo, erguer → ergo
 *  - -ir verbs with e in the last stem syllable: sentir → sinto/sinta, preferir → prefiro, servir → sirvo
 *  - -ear verbs: passear → passeio, passeie (passeamos)
 *  - vowel stems: sair → saio, saímos, saí, saísse, sair/saíres; incluir → incluis, incluímos, incluído;
 *    roer → róis, rói, roí
 *  - -uzir verbs: traduzir → traduz (3sg)
 */
import type { PtIrregularVerb } from './schema'
import { stripAccents } from './normalize'

export const PERSONS = ['eu', 'tu', 'ele / ela / você', 'nós', 'vós', 'eles / elas / vocês'] as const

export type SimpleTense = 'pres' | 'pret' | 'impf' | 'mqp' | 'fut' | 'cond' | 'subjPres' | 'subjImpf' | 'subjFut' | 'persInf' | 'impAff' | 'impNeg'
export type CompoundTense = 'perf' | 'pluperf' | 'futPerf' | 'condPerf' | 'subjPerf' | 'subjPluperf' | 'subjFutPerf'
export type Tense = SimpleTense | CompoundTense

export const TENSES: Tense[] = [
  'pres', 'pret', 'impf', 'fut', 'cond', 'perf', 'pluperf', 'mqp', 'futPerf', 'condPerf',
  'subjPres', 'subjImpf', 'subjFut', 'subjPerf', 'subjPluperf', 'subjFutPerf', 'persInf', 'impAff', 'impNeg',
]

/** `es` is the name of the tense in the target language (Portuguese), as in every pack. */
export const TENSE_LABELS: Record<Tense, { es: string; en: string; level: string }> = {
  pres: { es: 'Presente', en: 'Present', level: 'a1' },
  pret: { es: 'Pretérito perfeito', en: 'Preterite (simple past)', level: 'a2' },
  impf: { es: 'Pretérito imperfeito', en: 'Imperfect', level: 'a2' },
  fut: { es: 'Futuro do presente', en: 'Future', level: 'a2' },
  cond: { es: 'Futuro do pretérito (condicional)', en: 'Conditional', level: 'b1' },
  perf: { es: 'Pretérito perfeito composto', en: 'Present perfect (“have been doing”)', level: 'b1' },
  pluperf: { es: 'Mais-que-perfeito composto', en: 'Past perfect', level: 'b1' },
  mqp: { es: 'Mais-que-perfeito simples', en: 'Past perfect (simple, literary)', level: 'c1' },
  futPerf: { es: 'Futuro do presente composto', en: 'Future perfect', level: 'b2' },
  condPerf: { es: 'Futuro do pretérito composto', en: 'Conditional perfect', level: 'b2' },
  subjPres: { es: 'Presente do subjuntivo', en: 'Present subjunctive', level: 'b1' },
  subjImpf: { es: 'Pretérito imperfeito do subjuntivo', en: 'Imperfect subjunctive', level: 'b1' },
  subjFut: { es: 'Futuro do subjuntivo', en: 'Future subjunctive', level: 'b1' },
  subjPerf: { es: 'Pretérito perfeito do subjuntivo', en: 'Perfect subjunctive', level: 'b2' },
  subjPluperf: { es: 'Mais-que-perfeito do subjuntivo', en: 'Past perfect subjunctive', level: 'b2' },
  subjFutPerf: { es: 'Futuro composto do subjuntivo', en: 'Future perfect subjunctive', level: 'c1' },
  persInf: { es: 'Infinitivo pessoal', en: 'Personal infinitive', level: 'b2' },
  impAff: { es: 'Imperativo afirmativo', en: 'Affirmative imperative', level: 'a2' },
  impNeg: { es: 'Imperativo negativo', en: 'Negative imperative', level: 'b1' },
}

export interface Conjugation {
  lemma: string
  reflexive: boolean
  infinitive: string
  /** Participle used with ter in the compound tenses (feito, pago, aceitado). */
  participle: string
  /** Every accepted participle, main one first (aceitado, aceito, aceite). */
  participles: string[]
  gerund: string
  forms: Record<Tense, (string | null)[]>
  /** Extra accepted forms that are not in the table (European variants: falámos, oiço). */
  alt: string[]
}

type Class = 'ar' | 'er' | 'ir'

const IA = ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam']
const A = ['a', 'as', 'a', 'amos', 'ais', 'am']
const END = {
  pres: { ar: ['o', 'as', 'a', 'amos', 'ais', 'am'], er: ['o', 'es', 'e', 'emos', 'eis', 'em'], ir: ['o', 'es', 'e', 'imos', 'is', 'em'] },
  pret: { ar: ['ei', 'aste', 'ou', 'amos', 'astes', 'aram'], er: ['i', 'este', 'eu', 'emos', 'estes', 'eram'], ir: ['i', 'iste', 'iu', 'imos', 'istes', 'iram'] },
  impf: { ar: ['ava', 'avas', 'ava', 'ávamos', 'áveis', 'avam'], er: IA, ir: IA },
  subjPres: { ar: ['e', 'es', 'e', 'emos', 'eis', 'em'], er: A, ir: A },
} as const
/** -ir verbs whose stem ends in a vowel (sair, incluir): stressed i in hiatus takes an accent. */
const PRES_IR_V = ['o', 'is', 'i', 'ímos', 'ís', 'em']
const PRET_IR_V = ['í', 'íste', 'iu', 'ímos', 'ístes', 'íram']
const PRET_ER_V = ['í', 'este', 'eu', 'emos', 'estes', 'eram']
const IMPF_V = ['ía', 'ías', 'ía', 'íamos', 'íeis', 'íam']
const FUT = ['ei', 'ás', 'á', 'emos', 'eis', 'ão']
const COND = ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam']
const SUBJ_IMPF = ['sse', 'sses', 'sse', 'ssemos', 'sseis', 'ssem']
const MQP = ['ra', 'ras', 'ra', 'ramos', 'reis', 'ram']
const SUBJ_FUT = ['r', 'res', 'r', 'rmos', 'rdes', 'rem']
const PERS_INF = ['', 'es', '', 'mos', 'des', 'em']

/** Auxiliary ter for the compound tenses. */
const TER = {
  perf: ['tenho', 'tens', 'tem', 'temos', 'tendes', 'têm'],
  pluperf: ['tinha', 'tinhas', 'tinha', 'tínhamos', 'tínheis', 'tinham'],
  futPerf: ['terei', 'terás', 'terá', 'teremos', 'tereis', 'terão'],
  condPerf: ['teria', 'terias', 'teria', 'teríamos', 'teríeis', 'teriam'],
  subjPerf: ['tenha', 'tenhas', 'tenha', 'tenhamos', 'tenhais', 'tenham'],
  subjPluperf: ['tivesse', 'tivesses', 'tivesse', 'tivéssemos', 'tivésseis', 'tivessem'],
  subjFutPerf: ['tiver', 'tiveres', 'tiver', 'tivermos', 'tiverdes', 'tiverem'],
} as const

/** Persons whose present-tense stem is stressed (eu, tu, ele, eles). */
const STRONG = [0, 1, 2, 5]
const VOWELS = 'aeiouáéíóúâêôãõ'

/** Index of the last vowel of a stem, ignoring the silent u of a final gu/qu (segu → e). */
function lastVowelIndex(stem: string): number {
  for (let i = stem.length - 1; i >= 0; i--) {
    const c = stem[i]!
    if (!VOWELS.includes(c)) continue
    if (c === 'u' && i === stem.length - 1 && i > 0 && 'gq'.includes(stem[i - 1]!)) continue
    return i
  }
  return -1
}

function replaceAt(s: string, i: number, to: string): string {
  return s.slice(0, i) + to + s.slice(i + 1)
}

/** Replace the last vowel of the stem when it is `from`. */
function changeLastVowel(stem: string, from: string, to: string): string {
  const i = lastVowelIndex(stem)
  return i >= 0 && stem[i] === from ? replaceAt(stem, i, to) : stem
}

/**
 * Join stem + ending with the spelling adjustments that keep the consonant sound:
 * c/qu, g/gu, ç/c before e (-ar verbs); c/ç, g/j, gu/g before a/o (-er/-ir verbs).
 */
export function join(stem: string, ending: string, inf: string): string {
  if (inf.endsWith('ar')) {
    if (/^[eé]/.test(ending)) {
      if (stem.endsWith('c')) return stem.slice(0, -1) + 'qu' + ending
      if (stem.endsWith('ç')) return stem.slice(0, -1) + 'c' + ending
      if (stem.endsWith('g')) return stem + 'u' + ending
    }
    return stem + ending
  }
  if (/^[aoáó]/.test(ending)) {
    if (stem.endsWith('c') && /c[ei]r$/.test(inf)) return stem.slice(0, -1) + 'ç' + ending
    if (stem.endsWith('gu') && /gu[ei]r$/.test(inf)) return stem.slice(0, -2) + 'g' + ending
    if (stem.endsWith('g') && /g[ei]r$/.test(inf)) return stem.slice(0, -1) + 'j' + ending
  }
  return stem + ending
}

export function classOf(inf: string): Class {
  if (inf === 'pôr') return 'er'
  const c = inf.slice(-2)
  if (c === 'ar' || c === 'er' || c === 'ir') return c
  throw new Error(`Not an infinitive: ${inf}`)
}

/** Accent the last vowel of the preterite base for nós/vós (falá-ssemos, comê-ssemos, tivé-ssemos, fô-ssemos). */
function accentBase(base: string, strongPret: boolean): string {
  const last = base[base.length - 1] ?? ''
  const map: Record<string, string> = { a: 'á', e: strongPret ? 'é' : 'ê', i: 'í', o: 'ô', u: 'ú' }
  return map[last] ? base.slice(0, -1) + map[last] : base
}

function stripReflexive(lemma: string): { inf: string; reflexive: boolean } {
  const l = lemma.trim().toLowerCase()
  if (/^\p{L}*[aeioô]r-se$/u.test(l)) return { inf: l.slice(0, -3), reflexive: true } // levantar-se, ir-se, pôr-se
  return { inf: l, reflexive: false }
}

type Core = Omit<Conjugation, 'lemma' | 'reflexive'>

/** Conjugate a verb that is either regular or listed in the table itself. */
function conjugateBase(inf: string, irr: PtIrregularVerb | undefined): Core {
  const cls = classOf(inf)
  const stem = inf.slice(0, -2)
  const vowelStem = cls !== 'ar' && /[aeiou]$/.test(stem) && !/[gq]u$/.test(stem)
  const air = cls === 'ir' && vowelStem && stem.endsWith('a')
  const oer = cls === 'er' && vowelStem && stem.endsWith('o')
  const ear = inf.endsWith('ear')
  const diphthong = Boolean(irr?.diphthong) || ear
  const strongStem = (s: string) => (irr?.diphthong ? changeLastVowel(s, 'i', 'ei') : ear ? s + 'i' : s)

  // ---- present
  let pres: string[]
  if (irr?.pres) pres = [...irr.pres]
  else {
    const ends = vowelStem && cls === 'ir' ? PRES_IR_V : END.pres[cls]
    pres = ends.map((e, p) => {
      let s = stem
      if (diphthong && STRONG.includes(p)) s = strongStem(s)
      if (irr?.strongVowel === 'u>o' && (p === 1 || p === 2 || p === 5)) s = changeLastVowel(s, 'u', 'o')
      return join(s, e, inf)
    })
    if (oer) {
      const s = stem.slice(0, -1)
      pres[1] = s + 'óis'
      pres[2] = s + 'ói'
    }
    if (air) pres[0] = stem + 'io'
    if (inf.endsWith('uzir')) pres[2] = stem
    if (cls === 'ir' && !vowelStem && !irr?.regularStem) {
      const i = lastVowelIndex(stem)
      const before = stem[i - 1] ?? ''
      const after = stem[i + 1] ?? ''
      if (i >= 0 && stem[i] === 'e' && !VOWELS.includes(before) && !'iu'.includes(after)) pres[0] = join(replaceAt(stem, i, 'i'), 'o', inf)
    }
    if (irr?.eu) pres[0] = irr.eu
  }

  // ---- preterite
  const strongPret = Boolean(irr?.pret)
  const pret = irr?.pret ? [...irr.pret] : (vowelStem ? (cls === 'ir' ? PRET_IR_V : PRET_ER_V) : END.pret[cls]).map((e) => join(stem, e, inf))

  // ---- imperfect, future, conditional
  const impf = irr?.impf ? [...irr.impf] : (vowelStem ? IMPF_V : END.impf[cls]).map((e) => stem + e)
  const futStem = irr?.futStem ?? inf
  const fut = FUT.map((e) => futStem + e)
  const cond = COND.map((e) => futStem + e)

  // ---- present subjunctive: from the eu form (tenho → tenha, faço → faça, sinto → sintamos)
  let subjPres: string[]
  if (irr?.subjPres) subjPres = [...irr.subjPres]
  else {
    const eu = pres[0]!
    const euStem = eu.endsWith('o') ? eu.slice(0, -1) : eu
    subjPres = END.subjPres[cls].map((e, p) => join(diphthong && !STRONG.includes(p) ? stem : euStem, e, inf))
  }

  // ---- tenses built on the preterite base (3pl minus -ram): tivesse, tiver, tivera
  const base = pret[5]!.replace(/ram$/, '')
  const accented = accentBase(base, strongPret)
  const subjImpf = SUBJ_IMPF.map((e, p) => (p === 3 || p === 4 ? accented : base) + e)
  const mqp = MQP.map((e, p) => (p === 3 || p === 4 ? accented : base) + e)
  // saí-r → sair, sairmos, sairdes (i before r in the same syllable takes no accent) but saíres, saírem
  const unaccentedR = (b: string) => (b.endsWith('í') ? b.slice(0, -1) + 'i' : b)
  const subjFut = SUBJ_FUT.map((e) => (/^r(mos|des)?$/.test(e) ? unaccentedR(base) : base) + e)

  // ---- personal infinitive
  let persInf: string[]
  if (irr?.persInf) persInf = [...irr.persInf]
  else if (vowelStem && cls === 'ir') persInf = ['ir', 'íres', 'ir', 'irmos', 'irdes', 'írem'].map((e) => stem + e)
  else persInf = PERS_INF.map((e) => inf + e)

  // ---- imperatives: tu and vós from the indicative, the rest from the subjunctive
  const none: (string | null)[] = [null, null, null, null, null, null]
  let impAff: (string | null)[]
  if (irr?.noImperative) impAff = none
  else if (irr?.impAff) impAff = irr.impAff.map((x, i) => (i === 0 || !x ? null : x))
  else impAff = [null, pres[2]!, subjPres[2]!, subjPres[3]!, pres[4]!.replace(/s$/, ''), subjPres[5]!]
  const impNeg: (string | null)[] = irr?.noImperative ? none : [null, ...subjPres.slice(1).map((f) => `não ${f}`)]

  // ---- non-finite forms
  const participle = irr?.participle ?? (cls === 'ar' ? stem + 'ado' : stem + (vowelStem ? 'ído' : 'ido'))
  const participles = [participle, ...(irr?.altParticiples ?? [])]
  const gerund = irr?.gerund ?? inf.slice(0, -1) + 'ndo'
  const compound = (aux: readonly string[]) => aux.map((a) => `${a} ${participle}`)

  const alt = [...(irr?.alt ?? [])]
  // European Portuguese writes the -ar preterite nós with an accent (falámos ≠ falamos).
  if (cls === 'ar' && !irr?.pret && pret[3]!.endsWith('amos')) alt.push(pret[3]!.slice(0, -4) + 'ámos')

  return {
    infinitive: inf,
    participle,
    participles,
    gerund,
    alt,
    forms: {
      pres, pret, impf, fut, cond,
      perf: compound(TER.perf),
      pluperf: compound(TER.pluperf),
      mqp,
      futPerf: compound(TER.futPerf),
      condPerf: compound(TER.condPerf),
      subjPres, subjImpf, subjFut,
      subjPerf: compound(TER.subjPerf),
      subjPluperf: compound(TER.subjPluperf),
      subjFutPerf: compound(TER.subjFutPerf),
      persInf, impAff, impNeg,
    },
  }
}

// ---------------------------------------------------------------------------
// Derived verbs: manter (ter), compor (pôr), satisfazer (fazer), inscrever (escrever)

/** Monosyllables that take an accent once a prefix makes them oxytone (tem → mantém); pôr loses its differential accent. */
const PREFIXED_ACCENT: Record<string, string> = { tem: 'tém', tens: 'téns', vem: 'vém', vens: 'véns', pôr: 'por' }

interface Derivation {
  irr: PtIrregularVerb
  /** Beginning of the base verb replaced by `newHead` (escrever: "e" → inscrever: "in"). */
  head: string
  newHead: string
}

const derivedCache = new WeakMap<ReadonlyMap<string, PtIrregularVerb>, { derived: Map<string, PtIrregularVerb>; prefixable: PtIrregularVerb[] }>()
function derivedIndex(table: ReadonlyMap<string, PtIrregularVerb>) {
  let idx = derivedCache.get(table)
  if (!idx) {
    idx = { derived: new Map(), prefixable: [] }
    for (const v of table.values()) {
      for (const d of v.derived ?? []) idx.derived.set(d, v)
      if (v.prefixable) idx.prefixable.push(v)
    }
    derivedCache.set(table, idx)
  }
  return idx
}

function splitHeads(base: string, derived: string): { head: string; newHead: string } {
  const a = stripAccents(base)
  const b = stripAccents(derived)
  let k = 0
  while (k < a.length && k < b.length && a[a.length - 1 - k] === b[b.length - 1 - k]) k++
  return { head: base.slice(0, base.length - k), newHead: derived.slice(0, derived.length - k) }
}

function findDerivation(inf: string, table: ReadonlyMap<string, PtIrregularVerb>): Derivation | undefined {
  const idx = derivedIndex(table)
  let irr = idx.derived.get(inf)
  if (!irr) {
    irr = idx.prefixable.find((v) => {
      const plain = stripAccents(v.lemma)
      return inf.length > plain.length && inf.endsWith(plain)
    })
  }
  if (!irr) return undefined
  return { irr, ...splitHeads(irr.lemma, inf) }
}

function applyDerivation(core: Core, d: Derivation, inf: string): Core {
  const word = (w: string) => {
    if (!w.startsWith(d.head)) return w
    const rest = w.slice(d.head.length)
    return d.newHead + (d.head === '' && PREFIXED_ACCENT[rest] ? PREFIXED_ACCENT[rest] : rest)
  }
  const form = (f: string | null) => {
    if (f === null) return null
    const i = f.lastIndexOf(' ')
    return i < 0 ? word(f) : f.slice(0, i + 1) + word(f.slice(i + 1))
  }
  const forms = Object.fromEntries(Object.entries(core.forms).map(([t, fs]) => [t, fs.map(form)])) as Record<Tense, (string | null)[]>
  return {
    infinitive: inf,
    participle: word(core.participle),
    participles: core.participles.map(word),
    gerund: word(core.gerund),
    alt: core.alt.map(word),
    forms,
  }
}

/** Conjugate a Portuguese verb (reflexive lemmas end in -se: levantar-se). Throws for non-infinitives. */
export function conjugate(lemmaIn: string, table: ReadonlyMap<string, PtIrregularVerb> = new Map()): Conjugation {
  const { inf, reflexive } = stripReflexive(lemmaIn)
  if (!/^\p{L}+$/u.test(inf)) throw new Error(`Not an infinitive: ${inf}`)
  const listed = table.get(inf)
  let core: Core
  if (listed) core = conjugateBase(inf, listed)
  else {
    const d = findDerivation(inf, table)
    core = d ? applyDerivation(conjugateBase(d.irr.lemma, d.irr), d, inf) : conjugateBase(inf, undefined)
  }
  return { lemma: lemmaIn.trim().toLowerCase(), reflexive, ...core }
}

/** Participles that agree in gender and number (feito → feita, feitos, feitas; entregue → entregues). */
export function participleForms(participle: string): string[] {
  if (participle.endsWith('o')) {
    const p = participle.slice(0, -1)
    return [participle, p + 'a', p + 'os', p + 'as']
  }
  if (participle.endsWith('e')) return [participle, participle + 's']
  return [participle]
}

/** Every single-word form of a conjugation: finite forms (last word), infinitive, gerund, participles and their agreement. */
export function formsOf(c: Conjugation): Set<string> {
  const out = new Set<string>([c.infinitive, c.gerund])
  for (const p of c.participles) for (const f of participleForms(p)) out.add(f)
  for (const forms of Object.values(c.forms)) {
    for (const f of forms) {
      if (!f) continue
      out.add(f.replace(/^não /, '').split(' ').pop()!)
    }
  }
  for (const a of c.alt) out.add(a)
  return out
}

/** Reflexive pronouns per person. */
export const REFLEXIVE = ['me', 'te', 'se', 'nos', 'vos', 'se'] as const

/**
 * Attach the reflexive pronoun for display. Brazilian proclisis in the
 * indicative and subjunctive ("me levanto"), enclisis with a hyphen in the
 * affirmative imperative and personal infinitive ("levanta-te", "levantemo-nos"),
 * and "não te levantes" in the negative imperative.
 */
export function withReflexive(form: string | null | undefined, person: number, tense: Tense): string | null {
  if (form === null || form === undefined) return null
  const pr = REFLEXIVE[person]!
  if (tense === 'impAff' || tense === 'persInf') {
    const base = person === 3 ? form.replace(/s$/, '') : form
    return `${base}-${pr}`
  }
  if (tense === 'impNeg') return form.replace(/^não /, `não ${pr} `)
  return `${pr} ${form}`
}
