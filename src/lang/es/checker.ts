/**
 * Rule-based Spanish writing checker. No AI: it uses the dictionary (built from
 * the course vocabulary), the conjugator, the accent rules and a list of
 * learner-error patterns, and returns explainable findings.
 */
import type { CheckerFinding } from '../types'
import type { ErrorRule, IrregularVerb, VocabEntry } from '../../engine/schema'
import { lookup, type Dictionary } from './inflect'
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
const ADVERBS_IN_NP = new Set(['muy', 'bastante', 'tan', 'más', 'menos', 'poco', 'demasiado', 'realmente'])
const SUBJECT_PRONOUNS: Record<string, number[]> = {
  yo: [0], tú: [1], él: [2], ella: [2], usted: [2], nosotros: [3], nosotras: [3], vosotros: [4], vosotras: [4], ellos: [5], ellas: [5], ustedes: [5],
}
const CLITICS = new Set(['me', 'te', 'se', 'lo', 'la', 'le', 'nos', 'os', 'los', 'las', 'les', 'no'])

/** Determine gender/number of a word form from a dictionary entry. */
function featuresOf(form: string, e: VocabEntry): Features | undefined {
  const lemma = e.lemma.toLowerCase()
  if (e.pos === 'noun') {
    const number: Number_ = form === lemma || form === e.feminine ? 'sg' : 'pl'
    let gender: Gender = e.gender ?? 'mf'
    if (e.gender === 'mf' || e.tags.includes('nationality') || e.feminine) {
      // gendered noun (profesor/profesora): derive from ending
      if (form.endsWith('a') || form.endsWith('as')) gender = 'f'
      else if (form === lemma || form === lemma + 's' || form === lemma + 'es') gender = e.gender === 'f' ? 'f' : 'm'
    }
    return { gender, number, role: 'noun' }
  }
  if (e.pos === 'adj') {
    const inv = !lemma.endsWith('o') && !/(or|án|ín|ón|és)$/.test(lemma) && !e.tags.includes('nationality') && !e.feminine
    const number: Number_ = form === lemma || form === e.feminine || (lemma.endsWith('o') && form === lemma.slice(0, -1) + 'a') ? 'sg' : 'pl'
    let gender: Gender = 'mf'
    if (!inv) {
      if (lemma.endsWith('o')) gender = form.startsWith(lemma.slice(0, -1) + 'a') ? 'f' : 'm'
      else gender = form === lemma || form === lemma + 'es' ? 'm' : 'f'
    }
    return { gender, number, role: 'adj' }
  }
  return undefined
}

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
  const feats: (Features | undefined)[] = []
  const entriesAt: (VocabEntry[] | undefined)[] = []
  words.forEach((t, i) => {
    const w = t.text.toLowerCase()
    const entries = lookup(deps.dict, w)
    entriesAt[i] = entries
    if (entries) {
      feats[i] = ARTICLES[w] ?? entries.map((e) => featuresOf(w, e)).find(Boolean)
      return
    }
    if (ARTICLES[w]) {
      feats[i] = ARTICLES[w]
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
        if (e) feats[i] = ARTICLES[correct] ?? e.map((x) => featuresOf(correct, x)).find(Boolean)
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

  // ---- agreement within noun phrases: det (adv)* adj* noun adj*
  for (let i = 0; i < words.length; i++) {
    const f = feats[i]
    if (!f || f.role !== 'det') continue
    // find the noun within next 3 words, skipping adjectives / adverbs
    let j = i + 1
    const adjs: number[] = []
    while (j < words.length && j <= i + 3) {
      const fj = feats[j]
      const wj = words[j]!.text.toLowerCase()
      if (ADVERBS_IN_NP.has(wj)) {
        j++
        continue
      }
      if (fj?.role === 'adj') {
        adjs.push(j)
        j++
        continue
      }
      break
    }
    const nf = feats[j]
    if (!nf || nf.role !== 'noun' || j >= words.length) continue
    const noun = words[j]!.text.toLowerCase()
    // trailing adjectives
    let k = j + 1
    while (k < words.length && k <= j + 2) {
      const wk = words[k]!.text.toLowerCase()
      if (ADVERBS_IN_NP.has(wk)) {
        k++
        continue
      }
      if (feats[k]?.role === 'adj') {
        adjs.push(k)
        k++
        continue
      }
      break
    }
    const detOk =
      (f.gender === 'mf' || nf.gender === 'mf' || f.gender === nf.gender || (nf.gender === 'f' && nf.number === 'sg' && (words[i]!.text.toLowerCase() === 'el' || words[i]!.text.toLowerCase() === 'un') && startsWithStressedA(noun))) &&
      f.number === nf.number
    if (!detOk) {
      findings.push({
        code: 'agreement', message: `Agreement: “${words[i]!.text} ${noun}” — the article/determiner must match the noun (${describe(nf)}).`,
        start: words[i]!.start, end: words[j]!.end, grammar: 'g.gender-nouns',
      })
    }
    for (const a of adjs) {
      const af = feats[a]!
      const ok = (af.gender === 'mf' || nf.gender === 'mf' || af.gender === nf.gender) && af.number === nf.number
      if (!ok) {
        findings.push({
          code: 'agreement', message: `Agreement: “${words[a]!.text}” must agree with “${noun}” (${describe(nf)}).`,
          start: Math.min(words[a]!.start, words[j]!.start), end: Math.max(words[a]!.end, words[j]!.end), grammar: 'g.adjective-agreement',
        })
      }
    }
  }

  // ---- subject pronoun + verb person
  const verbIndex = getVerbIndex(deps)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!.text.toLowerCase()
    const persons = SUBJECT_PRONOUNS[w]
    if (!persons) continue
    let j = i + 1
    while (j < words.length && CLITICS.has(words[j]!.text.toLowerCase())) j++
    const v = words[j]?.text.toLowerCase()
    if (!v) continue
    const hits = verbIndex.get(v)
    if (!hits || hits.length === 0) continue
    if (hits.some((h) => persons.includes(h.person))) continue
    // compound: "ha comido": only check the auxiliary (first word) - fine.
    const h = hits[0]!
    const correct = conjugate(h.lemma, deps.verbs).forms[h.tense][persons[0]!]
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
      re = new RegExp(r.pattern, 'giu')
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
