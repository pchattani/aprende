/**
 * Spanish verb conjugator (Castilian: includes vosotros).
 *
 * Regular paradigms + orthographic adjustments + stem changes + an irregular
 * table (content/es/verbs/irregular.yaml). All six persons:
 *   0 yo · 1 tú · 2 él/ella/usted · 3 nosotros/as · 4 vosotros/as · 5 ellos/ellas/ustedes
 */
import type { IrregularVerb } from '../../engine/schema'
import { syllabify } from './syllabify'
import { placeAccent, stressedVowelIndex, DIACRITIC_TILDE } from './accents'
import { stripAccents } from './normalize'

export const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros/as', 'vosotros/as', 'ellos / ellas / ustedes'] as const

export type SimpleTense = 'pres' | 'pret' | 'impf' | 'fut' | 'cond' | 'subjPres' | 'subjImpf' | 'subjImpfSe' | 'impAff' | 'impNeg'
export type CompoundTense = 'perf' | 'pluperf' | 'futPerf' | 'condPerf' | 'subjPerf' | 'subjPluperf'
export type Tense = SimpleTense | CompoundTense

export const TENSES: Tense[] = [
  'pres', 'pret', 'impf', 'fut', 'cond', 'perf', 'pluperf', 'futPerf', 'condPerf',
  'subjPres', 'subjImpf', 'subjImpfSe', 'subjPerf', 'subjPluperf', 'impAff', 'impNeg',
]

export const TENSE_LABELS: Record<Tense, { es: string; en: string; level: string }> = {
  pres: { es: 'Presente', en: 'Present', level: 'a1' },
  pret: { es: 'Pretérito indefinido', en: 'Preterite (simple past)', level: 'a2' },
  impf: { es: 'Pretérito imperfecto', en: 'Imperfect', level: 'a2' },
  fut: { es: 'Futuro simple', en: 'Future', level: 'a2' },
  cond: { es: 'Condicional simple', en: 'Conditional', level: 'a2' },
  perf: { es: 'Pretérito perfecto', en: 'Present perfect', level: 'a2' },
  pluperf: { es: 'Pretérito pluscuamperfecto', en: 'Past perfect', level: 'b1' },
  futPerf: { es: 'Futuro compuesto', en: 'Future perfect', level: 'b2' },
  condPerf: { es: 'Condicional compuesto', en: 'Conditional perfect', level: 'b2' },
  subjPres: { es: 'Presente de subjuntivo', en: 'Present subjunctive', level: 'b1' },
  subjImpf: { es: 'Imperfecto de subjuntivo (-ra)', en: 'Imperfect subjunctive (-ra)', level: 'b2' },
  subjImpfSe: { es: 'Imperfecto de subjuntivo (-se)', en: 'Imperfect subjunctive (-se)', level: 'b2' },
  subjPerf: { es: 'Perfecto de subjuntivo', en: 'Present perfect subjunctive', level: 'b2' },
  subjPluperf: { es: 'Pluscuamperfecto de subjuntivo', en: 'Past perfect subjunctive', level: 'b2' },
  impAff: { es: 'Imperativo afirmativo', en: 'Affirmative imperative', level: 'a2' },
  impNeg: { es: 'Imperativo negativo', en: 'Negative imperative', level: 'b1' },
}

export interface Conjugation {
  lemma: string
  reflexive: boolean
  infinitive: string
  participle: string
  gerund: string
  forms: Record<Tense, (string | null)[]>
}

type Class = 'ar' | 'er' | 'ir'

const END = {
  pres: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
  pret: { ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'] },
  impf: { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] },
  subjPres: { ar: ['e', 'es', 'e', 'emos', 'éis', 'en'], er: ['a', 'as', 'a', 'amos', 'áis', 'an'], ir: ['a', 'as', 'a', 'amos', 'áis', 'an'] },
} as const
const FUT = ['é', 'ás', 'á', 'emos', 'éis', 'án']
const COND = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían']
const STRONG_PRET = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron']
const HABER = {
  pres: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
  impf: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'],
  fut: ['habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán'],
  cond: ['habría', 'habrías', 'habría', 'habríamos', 'habríais', 'habrían'],
  subjPres: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
  subjImpf: ['hubiera', 'hubieras', 'hubiera', 'hubiéramos', 'hubierais', 'hubieran'],
}

const STRONG_PERSONS = [0, 1, 2, 5]
const VOWELS = 'aeiouáéíóú'

function lastIndexOfVowel(stem: string, v: string): number {
  return stem.lastIndexOf(v)
}

/** Apply a diphthong / vowel change to the last matching vowel of the stem. */
function changeStem(stem: string, change: string): string {
  const [from, to] = change.split('>') as [string, string]
  const i = lastIndexOfVowel(stem, from)
  if (i < 0) return stem
  return stem.slice(0, i) + to + stem.slice(i + from.length)
}

/** Put a tilde on the last i/u of the stem (envío, continúo, prohíbo, reúno). */
function stressLastWeak(stem: string): string {
  for (let i = stem.length - 1; i >= 0; i--) {
    const c = stem[i]!
    if (c === 'i') return stem.slice(0, i) + 'í' + stem.slice(i + 1)
    if (c === 'u') return stem.slice(0, i) + 'ú' + stem.slice(i + 1)
  }
  return stem
}

function startsWithFront(ending: string): boolean {
  return /^[eéií]/.test(ending)
}
function startsWithBack(ending: string): boolean {
  return /^[aáoó]/.test(ending)
}

/**
 * Join stem + ending with spelling adjustments. `inf` is the full infinitive
 * (decides the orthographic class).
 */
export function join(stem: string, ending: string, inf: string): string {
  const cls = inf.slice(-2)
  const last = stem[stem.length - 1] ?? ''
  const stemEndsVowel = last !== '' && VOWELS.includes(last) && !/[gq]u$/.test(stem)
  // -car, -gar, -zar, -guar before front vowels
  if (cls === 'ar') {
    if (inf.endsWith('car') && stem.endsWith('c') && startsWithFront(ending)) return stem.slice(0, -1) + 'qu' + ending
    if (inf.endsWith('guar') && stem.endsWith('gu') && startsWithFront(ending)) return stem.slice(0, -2) + 'gü' + ending
    if (inf.endsWith('gar') && stem.endsWith('g') && startsWithFront(ending)) return stem + 'u' + ending
    if (inf.endsWith('zar') && stem.endsWith('z') && startsWithFront(ending)) return stem.slice(0, -1) + 'c' + ending
  } else {
    // -cer/-cir, -ger/-gir, -guir, -quir before back vowels
    if (startsWithBack(ending)) {
      if ((inf.endsWith('cer') || inf.endsWith('cir')) && stem.endsWith('c')) {
        const before = stem[stem.length - 2] ?? ''
        return VOWELS.includes(before) ? stem.slice(0, -1) + 'zc' + ending : stem.slice(0, -1) + 'z' + ending
      }
      if ((inf.endsWith('ger') || inf.endsWith('gir')) && stem.endsWith('g')) return stem.slice(0, -1) + 'j' + ending
      if (inf.endsWith('guir') && stem.endsWith('gu')) return stem.slice(0, -2) + 'g' + ending
      if (inf.endsWith('quir') && stem.endsWith('qu')) return stem.slice(0, -2) + 'c' + ending
    }
    // -uir (construir): insert y before a/e/o endings
    if (inf.endsWith('uir') && !inf.endsWith('guir') && !inf.endsWith('quir') && /^[aeoáéó]/.test(ending)) {
      return stem + 'y' + ending
    }
    // stems ending in a vowel: unstressed i between vowels -> y (leyó, cayeron, construyendo)
    if (stemEndsVowel && /^i[eéoó]/.test(ending)) return stem + 'y' + ending.slice(1)
    // -aer/-eer/-oír: í in hiatus (leíste, caímos, oído) — not after u (construiste)
    if (stemEndsVowel && !stem.endsWith('u') && /^i(ste|mos|steis|do)$/.test(ending)) return stem + 'í' + ending.slice(1)
    // -ñir/-llir: drop the i of -ió/-ie (gruñó, tañendo)
    if ((stem.endsWith('ñ') || stem.endsWith('ll')) && /^i[eéoó]/.test(ending)) return stem + ending.slice(1)
  }
  return stem + ending
}

function stripReflexive(lemma: string): { inf: string; reflexive: boolean } {
  const l = lemma.trim().toLowerCase()
  if (l.endsWith('se') && l.length > 4 && /[aei]r$/.test(l.slice(0, -2))) return { inf: l.slice(0, -2), reflexive: true }
  return { inf: l, reflexive: false }
}

export function classOf(inf: string): Class {
  const c = inf.slice(-2)
  if (c === 'ar' || c === 'er' || c === 'ir') return c
  if (inf.endsWith('ír')) return 'ir' // oír, reír
  throw new Error(`Not an infinitive: ${inf}`)
}

/** Accent the last vowel of a string (for subjImpf nosotros: hablá-ramos). */
function accentLastVowel(s: string): string {
  const map: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i]!
    if (map[c]) return s.slice(0, i) + map[c] + s.slice(i + 1)
    if ('áéíóú'.includes(c)) return s
  }
  return s
}

export function conjugate(lemmaIn: string, table: ReadonlyMap<string, IrregularVerb> = new Map()): Conjugation {
  const { inf, reflexive } = stripReflexive(lemmaIn)
  const cls = classOf(inf)
  const irr = table.get(inf) ?? derivedIrregular(inf, table)
  const stem = inf.endsWith('ír') ? inf.slice(0, -2) : inf.slice(0, -2)
  const isIr = cls === 'ir'

  const stemChange = irr?.stemChange
  const raise = irr?.irVowelRaise ?? (isIr && stemChange ? (stemChange.startsWith('o') ? 'o>u' : stemChange === 'e>ie' || stemChange === 'e>i' ? 'e>i' : undefined) : undefined)
  const strongStem = (base: string) => {
    let s = base
    if (stemChange) s = changeStem(s, stemChange)
    if (irr?.stressHiatus) s = stressLastWeak(s)
    return s
  }
  const raisedStem = raise ? changeStem(stem, raise) : stem

  // ---- present
  let pres: string[]
  if (irr?.pres) pres = [...irr.pres]
  else {
    pres = END.pres[cls].map((e, p) => join(STRONG_PERSONS.includes(p) ? strongStem(stem) : stem, e, inf))
    if (irr?.yo) pres[0] = irr.yo
  }

  // ---- preterite
  let pret: string[]
  if (irr?.pret) pret = [...irr.pret]
  else if (irr?.pretStem) {
    const ps = irr.pretStem
    pret = STRONG_PRET.map((e, p) => {
      if (p === 2 && ps.endsWith('c')) return ps.slice(0, -1) + 'z' + e // hizo
      if (p === 5 && ps.endsWith('j')) return ps + 'eron' // dijeron
      return ps + e
    })
  } else {
    pret = END.pret[cls].map((e, p) => join(isIr && raise && (p === 2 || p === 5) ? raisedStem : stem, e, inf))
  }

  // ---- imperfect
  const impf = irr?.impf ? [...irr.impf] : END.impf[cls].map((e) => stem + e)

  // ---- future / conditional
  const futStem = irr?.futStem ?? inf
  const fut = FUT.map((e) => futStem + e)
  const cond = COND.map((e) => futStem + e)

  // ---- present subjunctive
  let subjPres: string[]
  if (irr?.subjPres) subjPres = [...irr.subjPres]
  else {
    const yoForm = pres[0]!
    const yoStem = yoForm.endsWith('o') ? yoForm.slice(0, -1) : yoForm
    const explicitYo = Boolean(irr?.yo) || isAutoYo(inf)
    subjPres = END.subjPres[cls].map((e, p) => {
      if (STRONG_PERSONS.includes(p)) return joinSubj(yoStem, e, inf)
      // nosotros / vosotros
      if (explicitYo) return joinSubj(yoStem, e, inf)
      return join(isIr && raise ? raisedStem : stem, e, inf)
    })
  }

  // ---- imperfect subjunctive from 3pl preterite
  const base3 = pret[5]!.replace(/ron$/, '')
  const subjImpf = ['ra', 'ras', 'ra', 'ramos', 'rais', 'ran'].map((e, p) => (p === 3 ? accentLastVowel(base3) : base3) + e)
  const subjImpfSe = ['se', 'ses', 'se', 'semos', 'seis', 'sen'].map((e, p) => (p === 3 ? accentLastVowel(base3) : base3) + e)

  // ---- imperatives
  let impAff: (string | null)[]
  if (irr?.impAff) impAff = irr.impAff.map((x, i) => (i === 0 ? null : x))
  else {
    impAff = [null, irr?.impTu ?? pres[2]!, subjPres[2]!, subjPres[3]!, inf.replace(/r$/, 'd').replace(/ír$/, 'íd'), subjPres[5]!]
    if (inf.endsWith('ír')) impAff[4] = inf.slice(0, -2) + 'íd'
  }
  const impNeg: (string | null)[] = [null, `no ${subjPres[1]}`, `no ${subjPres[2]}`, `no ${subjPres[3]}`, `no ${subjPres[4]}`, `no ${subjPres[5]}`]

  // ---- non-finite
  const participle = irr?.participle ?? join(stem, cls === 'ar' ? 'ado' : 'ido', inf)
  const gerund = irr?.gerund ?? (cls === 'ar' ? stem + 'ando' : join(isIr && raise ? raisedStem : stem, 'iendo', inf))

  const compound = (aux: string[]) => aux.map((a) => `${a} ${participle}`)
  const fix = (arr: (string | null)[]) => arr.map((f) => (f === null ? null : fixMonosyllable(f)))
  pres = fix(pres) as string[]
  pret = fix(pret) as string[]

  return {
    lemma: lemmaIn.trim().toLowerCase(),
    reflexive,
    infinitive: inf,
    participle,
    gerund,
    forms: {
      pres, pret, impf, fut, cond, subjPres, subjImpf, subjImpfSe, impAff, impNeg,
      perf: compound(HABER.pres),
      pluperf: compound(HABER.impf),
      futPerf: compound(HABER.fut),
      condPerf: compound(HABER.cond),
      subjPerf: compound(HABER.subjPres),
      subjPluperf: compound(HABER.subjImpf),
    },
  }
}

/** RAE 2010: orthographic monosyllables take no tilde (huis, rio, guie, fie) unless diacritic. */
function fixMonosyllable(form: string): string {
  if (!/[áéíóú]/.test(form) || form.includes(' ')) return form
  if (DIACRITIC_TILDE[form]) return form
  const plain = stripAccents(form)
  if (syllabify(plain).length === 1 && syllabify(form).length === 1) return plain
  return form
}

/** Verbs whose yo form is irregular only by orthography (-cer/-cir -> zc/z, -ger/-gir -> j, -guir -> g). */
function isAutoYo(inf: string): boolean {
  return /(cer|cir|ger|gir|guir|quir)$/.test(inf)
}

/** Join for subjunctive from a yo-stem that already carries orthographic changes (conozc-, coj-, sig-). */
function joinSubj(yoStem: string, ending: string, inf: string): string {
  // yo-stem already adjusted for back vowels; subjunctive endings of -er/-ir are back vowels, -ar are front.
  if (inf.endsWith('ar')) return join(yoStem, ending, inf)
  // -uir: yo stem 'construy' already has y
  return yoStem + ending
}

/** Build irregularity from the reflexive-less lemma when the table lists the reflexive form or vice versa. */
function derivedIrregular(inf: string, table: ReadonlyMap<string, IrregularVerb>): IrregularVerb | undefined {
  return table.get(inf + 'se')
}

/** Reflexive pronouns per person. */
export const REFLEXIVE = ['me', 'te', 'se', 'nos', 'os', 'se'] as const

/** Attach reflexive pronoun for display: "me levanto", "levántate" (imperative enclitic). */
export function withReflexive(form: string | null | undefined, person: number, tense: Tense): string | null {
  if (form === null || form === undefined) return null
  const pr = REFLEXIVE[person]!
  if (tense === 'impAff') {
    let base = form
    if (person === 3) base = base.replace(/s$/, '') // levantémonos
    if (person === 4) base = base.replace(/d$/, '') // levantaos
    const joined = base + pr
    return addEncliticAccent(joined, form)
  }
  if (tense === 'impNeg') return form.replace(/^no /, `no ${pr} `)
  return `${pr} ${form}`
}

/** Keep stress where it was in the base form after adding an enclitic (levanta -> levántate, levantad+os -> levantaos). */
function addEncliticAccent(joined: string, base: string): string {
  const idx = stressedVowelIndex(base)
  return placeAccent(stripAccents(joined), idx)
}
