/**
 * Rule-based Portuguese writing checker. No AI: it uses the dictionary (built
 * from the course vocabulary), the conjugator and a list of learner-error
 * patterns, and returns explainable findings: unknown words with spelling
 * suggestions, missing accents or cedillas, article/determiner–noun agreement,
 * adjective agreement, subject–verb agreement and the course's error rules.
 *
 * Grammar note ids used: g.accents, g.gender-nouns, g.adjective-agreement, g.subject-pronouns.
 */
import type { CheckerFinding } from '../types'
import type { ErrorRule, VocabEntry } from '../../engine/schema'
import type { PtIrregularVerb } from './schema'
import { lookup, pluralize, feminineOf, type Dictionary } from './inflect'
import { tokenize } from './tokenize'
import { stripAccents, editDistance } from './normalize'
import { conjugate, PERSONS, type Tense } from './conjugator'

export interface CheckerDeps {
  dict: Dictionary
  rules: ErrorRule[]
  verbs: ReadonlyMap<string, PtIrregularVerb>
}

type Gender = 'm' | 'f' | 'mf'
type Number_ = 'sg' | 'pl' | 'any'
interface Features {
  gender: Gender
  number: Number_
  role: 'det' | 'noun' | 'adj' | 'other'
}

/** Articles, contractions and determiners that agree with the noun. */
const DETERMINERS: Record<string, Features> = {}
function det(m: string, f: string, mp: string, fp: string) {
  DETERMINERS[m] = { gender: 'm', number: 'sg', role: 'det' }
  DETERMINERS[f] = { gender: 'f', number: 'sg', role: 'det' }
  DETERMINERS[mp] = { gender: 'm', number: 'pl', role: 'det' }
  DETERMINERS[fp] = { gender: 'f', number: 'pl', role: 'det' }
}
det('o', 'a', 'os', 'as')
det('um', 'uma', 'uns', 'umas')
det('do', 'da', 'dos', 'das')
det('no', 'na', 'nos', 'nas')
det('ao', 'à', 'aos', 'às')
det('pelo', 'pela', 'pelos', 'pelas')
det('num', 'numa', 'nuns', 'numas')
det('dum', 'duma', 'duns', 'dumas')
det('este', 'esta', 'estes', 'estas')
det('esse', 'essa', 'esses', 'essas')
det('aquele', 'aquela', 'aqueles', 'aquelas')
det('deste', 'desta', 'destes', 'destas')
det('neste', 'nesta', 'nestes', 'nestas')
det('desse', 'dessa', 'desses', 'dessas')
det('nesse', 'nessa', 'nesses', 'nessas')
det('daquele', 'daquela', 'daqueles', 'daquelas')
det('naquele', 'naquela', 'naqueles', 'naquelas')
det('àquele', 'àquela', 'àqueles', 'àquelas')
det('meu', 'minha', 'meus', 'minhas')
det('teu', 'tua', 'teus', 'tuas')
det('seu', 'sua', 'seus', 'suas')
det('nosso', 'nossa', 'nossos', 'nossas')
det('vosso', 'vossa', 'vossos', 'vossas')
det('muito', 'muita', 'muitos', 'muitas')
det('pouco', 'pouca', 'poucos', 'poucas')
det('outro', 'outra', 'outros', 'outras')
det('todo', 'toda', 'todos', 'todas')
det('algum', 'alguma', 'alguns', 'algumas')
det('nenhum', 'nenhuma', 'nenhuns', 'nenhumas')
det('quanto', 'quanta', 'quantos', 'quantas')

/** Words that can be adverbs inside a noun phrase (uma casa muito bonita). */
const ADVERBS_IN_NP = new Set(['muito', 'bem', 'bastante', 'tão', 'mais', 'menos', 'pouco', 'demasiado', 'super', 'meio', 'realmente'])
/** "a" is also a preposition (vou a pé): only check it after another preposition or at the start of a sentence. */
const PREPS_BEFORE_ARTICLE = new Set(['de', 'em', 'para', 'pra', 'com', 'por', 'sem', 'sobre', 'entre', 'até', 'desde', 'contra', 'após', 'sob', 'perante'])
/** Linking verbs for predicate adjective agreement (a casa é bonita). */
const COPULAS = new Set(['é', 'são', 'era', 'eram', 'foi', 'foram', 'será', 'serão', 'seria', 'seriam', 'está', 'estão', 'estava', 'estavam', 'esteve', 'estiveram', 'estará', 'estarão', 'fica', 'ficam', 'ficou', 'ficaram', 'parece', 'parecem', 'continua', 'continuam', 'anda', 'andam'])
const SUBJECT_PRONOUNS: Record<string, number[]> = {
  eu: [0], tu: [1], ele: [2], ela: [2], você: [2], nós: [3], vós: [4], eles: [5], elas: [5], vocês: [5],
}
/** Words that may stand between a subject pronoun and its verb. */
const BETWEEN_SUBJECT_AND_VERB = new Set(['me', 'te', 'se', 'nos', 'vos', 'lhe', 'lhes', 'o', 'a', 'os', 'as', 'não', 'nunca', 'já', 'também', 'ainda', 'só', 'sempre', 'jamais'])
/** A pronoun joined to another subject (ela e eu fomos) is not checked. */
const COORDINATORS = new Set(['e', 'ou', 'nem', 'com'])

/** Determine gender/number of a word form from a dictionary entry. */
function featuresOf(form: string, e: VocabEntry): Features | undefined {
  const lemma = e.lemma.toLowerCase()
  if (e.pos !== 'noun' && e.pos !== 'adj') return undefined
  const nationality = e.tags.includes('nationality')
  const fem = e.feminine?.toLowerCase() ?? (e.pos === 'adj' || e.gender === 'mf' || nationality ? feminineOf(lemma, { nationality: e.pos === 'noun' || nationality }) : undefined)
  const mPl = e.plural && e.pos === 'noun' ? [e.plural.toLowerCase()] : pluralize(lemma)
  const fPl = fem ? pluralize(fem) : []
  let number: Number_ = mPl.includes(form) || fPl.includes(form) ? 'pl' : 'sg'
  if (number === 'pl' && (form === lemma || form === fem)) number = 'any' // lápis, simples
  let gender: Gender = e.pos === 'noun' ? (e.gender ?? 'mf') : 'mf'
  if (fem && fem !== lemma) gender = form === fem || fPl.includes(form) ? 'f' : 'm'
  return { gender, number, role: e.pos }
}

function agrees(a: Features, b: Features): boolean {
  const g = a.gender === 'mf' || b.gender === 'mf' || a.gender === b.gender
  const n = a.number === 'any' || b.number === 'any' || a.number === b.number
  return g && n
}

/** Explanation for a missing or wrong mark. */
function markWhy(given: string, correct: string): string {
  const g = given.toLowerCase()
  if (correct.includes('ç') && correct.replace(/ç/g, 'c') === g) {
    return 'The cedilla (ç) makes c sound like s before a, o and u.'
  }
  if (/[ãõ]/.test(correct) && !/[ãõ]/.test(g)) return 'The tilde (~) marks a nasal vowel.'
  if (/[âêô]/.test(correct) && !/[âêô]/.test(g)) return 'The circumflex (^) marks a stressed closed vowel.'
  if (/[áéíóú]/.test(correct)) return 'The acute accent (´) marks the stressed, open vowel.'
  if (/[à]/.test(correct)) return 'The grave accent (`) marks the contraction of a + a.'
  return `“${correct}” is written without an accent.`
}

export function check(text: string, deps: CheckerDeps): CheckerFinding[] {
  const findings: CheckerFinding[] = []
  const words = tokenize(text).filter((t) => t.kind === 'word')
  const lower = words.map((t) => t.text.toLowerCase())

  // ---- spelling / accents
  const plainIndex = getPlainIndex(deps.dict)
  const feats: (Features | undefined)[] = []
  words.forEach((t, i) => {
    const w = lower[i]!
    const entries = lookup(deps.dict, w)
    if (entries) {
      feats[i] = DETERMINERS[w] ?? entries.map((e) => featuresOf(w, e)).find(Boolean)
      return
    }
    if (DETERMINERS[w]) {
      feats[i] = DETERMINERS[w]
      return
    }
    if (/^\p{Lu}/u.test(t.text) && i > 0) return // proper noun
    const candidates = plainIndex.get(stripAccents(w))
    if (candidates && candidates.length) {
      // the closest spelling wins (comecamos → começamos, not the European começámos)
      const correct = [...candidates].sort((a, b) => editDistance(w, a) - editDistance(w, b))[0]!
      if (correct !== w) {
        const cedilla = correct.includes('ç') && correct.replace(/ç/g, 'c') === w
        findings.push({
          code: 'accent', message: `${cedilla ? 'Cedilla' : 'Accent'}: “${t.text}” should be “${correct}”. ${markWhy(w, correct)}`,
          start: t.start, end: t.end, suggestion: correct, grammar: 'g.accents',
        })
        const e = deps.dict.get(correct)
        if (e) feats[i] = DETERMINERS[correct] ?? e.map((x) => featuresOf(correct, x)).find(Boolean)
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

  // ---- agreement within noun phrases: det (adv)* adj* noun (adv)* adj*
  for (let i = 0; i < words.length; i++) {
    const f = feats[i]
    if (!f || f.role !== 'det') continue
    const d = lower[i]!
    if (ADVERBS_IN_NP.has(d) && feats[i + 1]?.role === 'adj') continue // muito bonita: adverb
    let j = i + 1
    const adjs: number[] = []
    while (j < words.length && j <= i + 3) {
      if (ADVERBS_IN_NP.has(lower[j]!) && feats[j]?.role !== 'noun') {
        j++
        continue
      }
      if (feats[j]?.role === 'adj') {
        adjs.push(j)
        j++
        continue
      }
      break
    }
    const nf = feats[j]
    if (!nf || nf.role !== 'noun' || j >= words.length) continue
    let k = j + 1
    while (k < words.length && k <= j + 2) {
      if (ADVERBS_IN_NP.has(lower[k]!)) {
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
    const ambiguousA = d === 'a' && i > 0 && !PREPS_BEFORE_ARTICLE.has(lower[i - 1]!)
    if (!agrees(f, nf) && !ambiguousA) {
      findings.push({
        code: 'agreement', message: `Agreement: “${words[i]!.text} ${words[j]!.text}”: the article/determiner must match the noun (${describe(nf)}).`,
        start: words[i]!.start, end: words[j]!.end, grammar: 'g.gender-nouns',
      })
    }
    for (const a of adjs) {
      if (!agrees(feats[a]!, nf)) {
        findings.push({
          code: 'agreement', message: `Agreement: “${words[a]!.text}” must agree with “${words[j]!.text}” (${describe(nf)}).`,
          start: Math.min(words[a]!.start, words[j]!.start), end: Math.max(words[a]!.end, words[j]!.end), grammar: 'g.adjective-agreement',
        })
      }
    }
    // predicate adjective: a casa é bonita
    let c = k
    if (COPULAS.has(lower[c] ?? '')) {
      c++
      while (c < words.length && ADVERBS_IN_NP.has(lower[c]!)) c++
      const af = feats[c]
      if (af?.role === 'adj' && !agrees(af, nf)) {
        findings.push({
          code: 'agreement', message: `Agreement: “${words[c]!.text}” describes “${words[j]!.text}” and must agree with it (${describe(nf)}).`,
          start: words[c]!.start, end: words[c]!.end, grammar: 'g.adjective-agreement',
        })
      }
    }
  }

  // ---- subject pronoun + verb person
  const verbIndex = getVerbIndex(deps)
  for (let i = 0; i < words.length; i++) {
    const aGente = lower[i] === 'gente' && lower[i - 1] === 'a'
    const w = aGente ? 'a gente' : lower[i]!
    const persons = aGente ? [2] : SUBJECT_PRONOUNS[w]
    if (!persons) continue
    if (COORDINATORS.has(lower[aGente ? i - 2 : i - 1] ?? '') || COORDINATORS.has(lower[i + 1] ?? '')) continue
    let j = i + 1
    while (j < words.length && BETWEEN_SUBJECT_AND_VERB.has(lower[j]!)) j++
    const raw = lower[j]
    if (!raw) continue
    const v = raw.split('-')[0]! // levantei-me → levantei
    const hits = verbIndex.get(v)
    if (!hits || hits.length === 0) continue
    if (hits.some((h) => persons.includes(h.person))) continue
    const h = hits[0]!
    const correct = conjugate(h.lemma, deps.verbs).forms[h.tense][persons[0]!]
    findings.push({
      code: 'verb-agreement', message: `“${w} ${v}”: the verb must agree with ${PERSONS[persons[0]!]}${correct ? ` → “${w} ${correct}”` : ''}.`,
      start: words[aGente ? i - 1 : i]!.start, end: words[j]!.end, suggestion: correct ?? undefined, grammar: 'g.subject-pronouns',
    })
  }

  // ---- learner-error rules
  const lowerText = text.toLowerCase()
  for (const r of deps.rules) {
    let re: RegExp
    try {
      re = new RegExp(r.pattern, 'giu')
    } catch {
      continue
    }
    let m: RegExpExecArray | null
    while ((m = re.exec(lowerText))) {
      findings.push({ code: 'learner-error', message: r.message + (r.example ? ` (✗ ${r.example.wrong} → ✓ ${r.example.right})` : ''), start: m.index, end: m.index + m[0].length, grammar: r.grammar })
      if (m[0].length === 0) re.lastIndex++
    }
  }

  findings.sort((a, b) => a.start - b.start)
  return findings
}

function describe(f: Features): string {
  const g = f.gender === 'm' ? 'masculine' : f.gender === 'f' ? 'feminine' : 'either gender'
  return f.number === 'any' ? g : `${g}, ${f.number === 'sg' ? 'singular' : 'plural'}`
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
      const f = plainIndex.get(p)![0]!
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
const SKIP_IN_INDEX = new Set<Tense>(['impAff', 'impNeg'])
const verbIndexCache = new WeakMap<Dictionary, Map<string, VerbHit[]>>()
function getVerbIndex(deps: CheckerDeps): Map<string, VerbHit[]> {
  let idx = verbIndexCache.get(deps.dict)
  if (idx) return idx
  idx = new Map()
  const seen = new Set<string>()
  for (const entries of deps.dict.values()) {
    for (const e of entries) {
      if (e.pos !== 'verb') continue
      const base = e.lemma.toLowerCase().replace(/-se$/, '')
      if (seen.has(base)) continue
      seen.add(base)
      let c
      try {
        c = conjugate(base, deps.verbs)
      } catch {
        continue
      }
      for (const [tense, forms] of Object.entries(c.forms) as [Tense, (string | null)[]][]) {
        if (SKIP_IN_INDEX.has(tense)) continue
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
