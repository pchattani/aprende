/**
 * Rule-based Spanish writing checker. No AI: it uses the dictionary (built from
 * the course vocabulary), the conjugator, the accent rules and a list of
 * learner-error patterns, and returns explainable findings.
 */
import { contentRegExp } from '../wordBoundary'
import type { CheckerFinding } from '../types'
import type { ErrorRule, IrregularVerb, VocabEntry } from '../../engine/schema'
import { lookup, pluralize, adjectiveForms, INVARIANT_OR, type Dictionary } from './inflect'
import { tokenize } from './tokenize'
import { stripAccents, editDistance } from './normalize'
import { analyzeAccent, explainAccent } from './accents'
import { conjugate, PERSONS, type Tense } from './conjugator'

export interface CheckerDeps {
  dict: Dictionary
  rules: ErrorRule[]
  verbs: ReadonlyMap<string, IrregularVerb>
}

type Gender = 'm' | 'f' | 'mf'
type Number_ = 'sg' | 'pl'
interface Features {
  gender: Gender
  number: Number_
  role: 'det' | 'noun' | 'adj' | 'other'
}

const ARTICLES: Record<string, Features> = {
  el: { gender: 'm', number: 'sg', role: 'det' }, la: { gender: 'f', number: 'sg', role: 'det' },
  los: { gender: 'm', number: 'pl', role: 'det' }, las: { gender: 'f', number: 'pl', role: 'det' },
  un: { gender: 'm', number: 'sg', role: 'det' }, una: { gender: 'f', number: 'sg', role: 'det' },
  unos: { gender: 'm', number: 'pl', role: 'det' }, unas: { gender: 'f', number: 'pl', role: 'det' },
  este: { gender: 'm', number: 'sg', role: 'det' }, esta: { gender: 'f', number: 'sg', role: 'det' },
  estos: { gender: 'm', number: 'pl', role: 'det' }, estas: { gender: 'f', number: 'pl', role: 'det' },
  ese: { gender: 'm', number: 'sg', role: 'det' }, esa: { gender: 'f', number: 'sg', role: 'det' },
  esos: { gender: 'm', number: 'pl', role: 'det' }, esas: { gender: 'f', number: 'pl', role: 'det' },
  aquel: { gender: 'm', number: 'sg', role: 'det' }, aquella: { gender: 'f', number: 'sg', role: 'det' },
  aquellos: { gender: 'm', number: 'pl', role: 'det' }, aquellas: { gender: 'f', number: 'pl', role: 'det' },
  mucho: { gender: 'm', number: 'sg', role: 'det' }, mucha: { gender: 'f', number: 'sg', role: 'det' },
  muchos: { gender: 'm', number: 'pl', role: 'det' }, muchas: { gender: 'f', number: 'pl', role: 'det' },
  poco: { gender: 'm', number: 'sg', role: 'det' }, poca: { gender: 'f', number: 'sg', role: 'det' },
  pocos: { gender: 'm', number: 'pl', role: 'det' }, pocas: { gender: 'f', number: 'pl', role: 'det' },
  otro: { gender: 'm', number: 'sg', role: 'det' }, otra: { gender: 'f', number: 'sg', role: 'det' },
  otros: { gender: 'm', number: 'pl', role: 'det' }, otras: { gender: 'f', number: 'pl', role: 'det' },
  todo: { gender: 'm', number: 'sg', role: 'det' }, toda: { gender: 'f', number: 'sg', role: 'det' },
  todos: { gender: 'm', number: 'pl', role: 'det' }, todas: { gender: 'f', number: 'pl', role: 'det' },
  mi: { gender: 'mf', number: 'sg', role: 'det' }, mis: { gender: 'mf', number: 'pl', role: 'det' },
  tu: { gender: 'mf', number: 'sg', role: 'det' }, tus: { gender: 'mf', number: 'pl', role: 'det' },
  su: { gender: 'mf', number: 'sg', role: 'det' }, sus: { gender: 'mf', number: 'pl', role: 'det' },
  nuestro: { gender: 'm', number: 'sg', role: 'det' }, nuestra: { gender: 'f', number: 'sg', role: 'det' },
  nuestros: { gender: 'm', number: 'pl', role: 'det' }, nuestras: { gender: 'f', number: 'pl', role: 'det' },
  vuestro: { gender: 'm', number: 'sg', role: 'det' }, vuestra: { gender: 'f', number: 'sg', role: 'det' },
  vuestros: { gender: 'm', number: 'pl', role: 'det' }, vuestras: { gender: 'f', number: 'pl', role: 'det' },
}
/** Adjectives that also work as adverbs in their masculine singular form. */
const ADVERBIAL_ADJECTIVES = new Set(['justo', 'medio', 'solo', 'mismo', 'claro', 'rápido', 'alto', 'bajo', 'fuerte', 'lento', 'temprano', 'demasiado', 'puro', 'seguro', 'directo', 'barato', 'caro'])
const ADVERBS_IN_NP = new Set(['muy', 'bastante', 'tan', 'más', 'menos', 'poco', 'demasiado', 'realmente'])
const SUBJECT_PRONOUNS: Record<string, number[]> = {
  yo: [0], tú: [1], él: [2], ella: [2], usted: [2], nosotros: [3], nosotras: [3], vosotros: [4], vosotras: [4], ellos: [5], ellas: [5], ustedes: [5],
}
const CLITICS = new Set(['me', 'te', 'se', 'lo', 'la', 'le', 'nos', 'os', 'los', 'las', 'les', 'no'])
/** Words before a subject pronoun that make it part of a larger subject, a comparison or a prepositional phrase (mi novia y yo, yo que tú, a ella). */
const COORDINATORS = new Set(['y', 'e', 'o', 'u', 'ni', 'que', 'como', 'entre', 'según', 'con', 'menos', 'incluso', 'a', 'de', 'del', 'para', 'por', 'sin', 'sobre', 'hacia', 'desde', 'hasta', 'contra', 'tras', 'ante'])

/**
 * Every gender/number reading of a word form for one dictionary entry (nouns and adjectives).
 * Keeping all of them (vacaciones and lunes are singular or plural, periodista and guía either
 * gender, hermana the feminine of hermano) keeps the agreement check quiet on correct Spanish.
 */
function readingsOf(form: string, e: VocabEntry): Features[] {
  const lemma = e.lemma.toLowerCase()
  if (lemma.includes(' ')) return []
  const nationality = e.tags.includes('nationality')
  const pl = (w: string) => pluralize(w)
  if (e.pos === 'noun') {
    const gendered = e.gender === 'mf' || nationality || Boolean(e.feminine)
    // the distinct feminine of a gendered noun (hermano → hermana); none for epicene nouns (periodista, cantante)
    const fem = gendered ? (e.feminine?.toLowerCase() ?? adjectiveForms(lemma, { nationality: true }).find((f) => f !== lemma && !pl(lemma).includes(f))) : undefined
    const base: Gender = e.gender === 'f' ? 'f' : e.gender === 'm' ? 'm' : fem ? 'm' : 'mf'
    const plurals = e.plural ? [e.plural.toLowerCase()] : pl(lemma)
    const out: Features[] = []
    if (form === lemma) out.push({ gender: base, number: 'sg', role: 'noun' })
    if (plurals.includes(form)) out.push({ gender: base, number: 'pl', role: 'noun' })
    if (fem && fem !== lemma) {
      if (form === fem) out.push({ gender: 'f', number: 'sg', role: 'noun' })
      if (pl(fem).includes(form)) out.push({ gender: 'f', number: 'pl', role: 'noun' })
    }
    return out
  }
  if (e.pos === 'adj') {
    const inv = INVARIANT_OR.has(lemma) || (!lemma.endsWith('o') && !/(or|án|ín|ón|és)$/.test(lemma) && !nationality && !e.feminine)
    const out: Features[] = []
    if (inv) {
      if (form === lemma) out.push({ gender: 'mf', number: 'sg', role: 'adj' })
      if (pl(lemma).includes(form)) out.push({ gender: 'mf', number: 'pl', role: 'adj' })
      return out
    }
    const fem = e.feminine?.toLowerCase() ?? adjectiveForms(lemma, { nationality }).find((f) => f !== lemma && !pl(lemma).includes(f))
    if (form === lemma) out.push({ gender: 'm', number: 'sg', role: 'adj' })
    if (pl(lemma).includes(form)) out.push({ gender: 'm', number: 'pl', role: 'adj' })
    if (fem) {
      if (form === fem) out.push({ gender: 'f', number: 'sg', role: 'adj' })
      if (pl(fem).includes(form)) out.push({ gender: 'f', number: 'pl', role: 'adj' })
    }
    return out
  }
  return []
}

const agrees = (a: Features, b: Features) => (a.gender === 'mf' || b.gender === 'mf' || a.gender === b.gender) && a.number === b.number
/** Readings that are not a noun or an adjective and make an NP check unsafe (tarde "late", bien). */
const NON_NOMINAL = new Set(['adv', 'prep', 'conj', 'interj', 'pron'])

function startsWithStressedA(noun: string): boolean {
  if (!/^(a|ha)/.test(noun)) return false
  return analyzeAccent(noun).stress === 0
}

export function check(text: string, deps: CheckerDeps): CheckerFinding[] {
  const findings: CheckerFinding[] = []
  const tokens = tokenize(text)
  const words = tokens.filter((t) => t.kind === 'word')

  // ---- punctuation: ¿ ¡
  if (text.includes('?') && !text.includes('¿')) {
    const i = text.indexOf('?')
    findings.push({ code: 'punctuation', message: 'Spanish questions open with ¿ as well as closing with ?.', start: i, end: i + 1, suggestion: '¿ … ?', grammar: 'g.question-words' })
  }
  if (text.includes('!') && !text.includes('¡')) {
    const i = text.indexOf('!')
    findings.push({ code: 'punctuation', message: 'Spanish exclamations open with ¡ as well as closing with !.', start: i, end: i + 1, suggestion: '¡ … !' })
  }

  // ---- spelling / accents
  const plainIndex = getPlainIndex(deps.dict)
  const feats: Features[][] = words.map(() => [])
  const entriesAt: (VocabEntry[] | undefined)[] = []
  const readings = (w: string, entries: VocabEntry[] | undefined): Features[] => (ARTICLES[w] ? [ARTICLES[w]] : (entries ?? []).flatMap((e) => readingsOf(w, e)))
  words.forEach((t, i) => {
    const w = t.text.toLowerCase()
    const entries = lookup(deps.dict, w)
    entriesAt[i] = entries
    if (entries) {
      feats[i] = readings(w, entries)
      return
    }
    if (ARTICLES[w]) {
      feats[i] = [ARTICLES[w]]
      return
    }
    if (/^[A-ZÁÉÍÓÚÑ]/.test(t.text) && i > 0) return // proper noun
    const plain = stripAccents(w)
    const candidates = plainIndex.get(plain)
    if (candidates && candidates.length) {
      const correct = candidates[0]!
      if (correct !== w) {
        const why = /[áéíóú]/.test(correct) ? explainAccent(correct) : `“${correct}” does not take a written accent. ${explainAccent(correct)}`
        findings.push({ code: 'accent', message: `Accent: “${t.text}” should be “${correct}”. ${why}`, start: t.start, end: t.end, suggestion: correct, grammar: 'g.stress-and-tilde' })
        const e = deps.dict.get(correct)
        if (e) feats[i] = readings(correct, e)
      }
      return
    }
    if (w.length >= 4) {
      const near = nearest(w, deps.dict, plainIndex)
      if (near) {
        findings.push({ code: 'spelling', message: `Spelling: did you mean “${near}”?`, start: t.start, end: t.end, suggestion: near })
        return
      }
    }
    if (i > 0 || words.length > 1) findings.push({ code: 'unknown', message: `“${t.text}” is not a word I know. Check the spelling or the dictionary.`, start: t.start, end: t.end })
  })

  // ---- agreement within noun phrases: det (adv)* adj* noun adj*, never across punctuation
  const gap = words.map((t, i) => i > 0 && /[^\s]/.test(text.slice(words[i - 1]!.end, t.start)))
  const lw = words.map((t) => t.text.toLowerCase())
  const isAdj = (x: number) => feats[x]!.some((f) => f.role === 'adj') && !feats[x]!.some((f) => f.role === 'det')
  for (let i = 0; i < words.length; i++) {
    const f = feats[i]![0]
    if (!f || f.role !== 'det') continue
    // find the noun within next 3 words, skipping adjectives / adverbs
    let j = i + 1
    const adjs: number[] = []
    while (j < words.length && j <= i + 3 && !gap[j]) {
      if (ADVERBS_IN_NP.has(lw[j]!)) {
        j++
        continue
      }
      if (isAdj(j) && !feats[j]!.some((x) => x.role === 'noun')) {
        adjs.push(j)
        j++
        continue
      }
      break
    }
    if (j >= words.length || gap[j]) continue
    const nouns = feats[j]!.filter((x) => x.role === 'noun')
    if (!nouns.length) continue
    const entries = entriesAt[j] ?? []
    // tarde (late), bien…: another part of speech makes the phrase ambiguous; la/lo + a verb form is an object pronoun
    if (entries.some((e) => NON_NOMINAL.has(e.pos))) continue
    if (/^(la|lo|las|los)$/.test(lw[i]!) && entries.some((e) => e.pos === 'verb')) continue
    const noun = lw[j]!
    const before = [...adjs]
    // one trailing adjective, possibly after an adverb (una casa muy bonita); a second one may describe something else
    let k = j + 1
    while (k < words.length && k <= j + 2 && !gap[k]) {
      if (ADVERBS_IN_NP.has(lw[k]!)) {
        k++
        continue
      }
      // justo, medio, solo, claro…: often adverbs after a noun (dejar la oficina justo ahora)
      if (isAdj(k) && !(entriesAt[k] ?? []).some((e) => e.pos !== 'adj') && !ADVERBIAL_ADJECTIVES.has(lw[k]!)) adjs.push(k)
      break
    }
    const det = lw[i]!
    const detFits = (n: Features) => agrees(f, n) || (n.gender === 'f' && n.number === 'sg' && f.number === 'sg' && (det === 'el' || det === 'un') && startsWithStressedA(noun))
    let fitting = nouns.filter(detFits)
    // an adjective used as a noun (el español, el rojo) followed by another phrase: el árabe dejó en el español palabras…
    if (!fitting.length && before.some((a) => feats[a]!.some((x) => x.role === 'adj' && agrees(f, x)))) continue
    if (!fitting.length) {
      findings.push({
        code: 'agreement', message: `Agreement: “${words[i]!.text} ${noun}” — the article/determiner must match the noun (${describe(nouns[0]!)}).`,
        start: words[i]!.start, end: words[j]!.end, grammar: 'g.gender-nouns',
      })
      fitting = nouns
    }
    for (const a of adjs) {
      const ok = feats[a]!.some((af) => af.role === 'adj' && fitting.some((n) => agrees(af, n)))
      if (!ok) {
        findings.push({
          code: 'agreement', message: `Agreement: “${words[a]!.text}” must agree with “${noun}” (${describe(fitting[0]!)}).`,
          start: Math.min(words[a]!.start, words[j]!.start), end: Math.max(words[a]!.end, words[j]!.end), grammar: 'g.adjective-agreement',
        })
      }
    }
  }

  // ---- subject pronoun + verb person
  const verbIndex = getVerbIndex(deps)
  for (let i = 0; i < words.length; i++) {
    const w = lw[i]!
    const persons = SUBJECT_PRONOUNS[w]
    if (!persons) continue
    // "mi novia y yo tenemos", "yo que tú…", "¿pagas tú…?": coordinated, comparative or inverted subjects
    if (i > 0 && !gap[i] && (COORDINATORS.has(lw[i - 1]!) || verbIndex.has(lw[i - 1]!))) continue
    let j = i + 1
    while (j < words.length && !gap[j] && CLITICS.has(lw[j]!)) j++
    if (j >= words.length || gap[j]) continue
    // la/lo/los/las before a noun is an article, not a clitic (tú la cena…)
    if (j > i + 1 && /^(la|lo|las|los)$/.test(lw[j - 1]!) && (entriesAt[j] ?? []).some((e) => e.pos === 'noun')) continue
    const v = lw[j]!
    const hits = verbIndex.get(v)
    if (!hits || hits.length === 0) continue
    // a form that is also another word (para: parar / the preposition) is not clearly a verb
    if ((entriesAt[j] ?? []).some((e) => e.pos !== 'verb')) continue
    if (hits.some((h) => persons.includes(h.person))) continue
    // tú + the imperative (tú prepara la cena, mientras yo…)
    if (persons.includes(1) && hits.some((h) => conjugate(h.lemma, deps.verbs).forms.impAff?.[1] === v)) continue
    // compound: "ha comido": only check the auxiliary (first word) - fine.
    const h = hits[0]!
    const correct = conjugate(h.lemma, deps.verbs).forms[h.tense][persons[0]!]?.split(' ')[0] // compound tenses: the auxiliary the learner wrote
    findings.push({
      code: 'verb-agreement', message: `“${w} ${v}”: the verb must agree with ${PERSONS[persons[0]!]}${correct ? ` → “${w} ${correct}”` : ''}.`,
      start: words[i]!.start, end: words[j]!.end, suggestion: correct ?? undefined, grammar: 'g.subject-pronouns',
    })
  }

  // ---- learner-error rules
  const lower = text.toLowerCase()
  for (const r of deps.rules) {
    let re: RegExp
    try {
      re = contentRegExp(r.pattern, 'giu')
    } catch {
      continue
    }
    let m: RegExpExecArray | null
    while ((m = re.exec(lower))) {
      findings.push({ code: 'learner-error', message: r.message + (r.example ? ` (✗ ${r.example.wrong} → ✓ ${r.example.right})` : ''), start: m.index, end: m.index + m[0].length, grammar: r.grammar })
      if (m[0].length === 0) re.lastIndex++
    }
  }

  findings.sort((a, b) => a.start - b.start)
  return findings
}

function describe(f: Features): string {
  const g = f.gender === 'm' ? 'masculine' : f.gender === 'f' ? 'feminine' : 'either gender'
  return `${g}, ${f.number === 'sg' ? 'singular' : 'plural'}`
}

// ---- caches keyed by dictionary identity
const plainCache = new WeakMap<Dictionary, Map<string, string[]>>()
function getPlainIndex(dict: Dictionary): Map<string, string[]> {
  let idx = plainCache.get(dict)
  if (!idx) {
    idx = new Map()
    for (const form of dict.keys()) {
      const p = stripAccents(form)
      const list = idx.get(p)
      if (list) list.push(form)
      else idx.set(p, [form])
    }
    plainCache.set(dict, idx)
  }
  return idx
}

function nearest(w: string, dict: Dictionary, plainIndex: Map<string, string[]>): string | undefined {
  const plain = stripAccents(w)
  let best: string | undefined
  for (const p of plainIndex.keys()) {
    if (Math.abs(p.length - plain.length) > 1) continue
    if (p[0] !== plain[0]) continue
    if (editDistance(p, plain) === 1) {
      const forms = plainIndex.get(p)!
      const f = forms[0]!
      if (dict.has(f) && (!best || f.length > best.length)) best = f
    }
  }
  return best
}

interface VerbHit {
  lemma: string
  tense: Tense
  person: number
}
const verbIndexCache = new WeakMap<Dictionary, Map<string, VerbHit[]>>()
function getVerbIndex(deps: CheckerDeps): Map<string, VerbHit[]> {
  let idx = verbIndexCache.get(deps.dict)
  if (idx) return idx
  idx = new Map()
  const seen = new Set<string>()
  for (const entries of deps.dict.values()) {
    for (const e of entries) {
      if (e.pos !== 'verb') continue
      const base = e.lemma.toLowerCase().replace(/se$/, '')
      if (seen.has(base)) continue
      seen.add(base)
      let c
      try {
        c = conjugate(base, deps.verbs)
      } catch {
        continue
      }
      for (const [tense, forms] of Object.entries(c.forms) as [Tense, (string | null)[]][]) {
        if (tense === 'impAff' || tense === 'impNeg') continue
        forms.forEach((f, person) => {
          if (!f) return
          const key = f.split(' ')[0]! // auxiliary for compound tenses
          const list = idx!.get(key) ?? []
          list.push({ lemma: base, tense, person })
          idx!.set(key, list)
        })
      }
    }
  }
  verbIndexCache.set(deps.dict, idx)
  return idx
}
