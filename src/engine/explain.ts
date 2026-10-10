/**
 * Personalised feedback for a wrong or nearly-right answer: a word-level diff
 * between what the learner wrote and the closest accepted answer, plus specific
 * hints for each difference (verb person/tense, agreement, articles, ser/estar,
 * prepositions, missing/extra words, word order, accents). Pure: lookups are injected.
 */
import type { Exercise } from './types'
import type { VocabEntry } from './schema'
import type { Answer } from './grade'
import { stripAccents } from '../lang/es/normalize'
import { editDistance } from '../lang/equivalence'
import { TENSE_LABELS, type Conjugation, type Tense } from '../lang/es/conjugator'

export interface ExplainDeps {
  lookup: (form: string) => VocabEntry[] | undefined
  conjugate: (lemma: string) => Conjugation
}

export type DiffTok = { text: string; kind: 'same' | 'wrong' | 'missing' | 'extra'; fix?: string }
export interface Explanation {
  /** The learner's answer as tokens, with wrong/extra words marked and missing words inserted. */
  diff?: DiffTok[]
  hints: string[]
}

const PERSON = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes']
const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'del', 'al', 'lo'])
const PREPS = new Set(['a', 'de', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'desde', 'hasta', 'hacia', 'entre'])
const SER = new Set(['soy', 'eres', 'es', 'somos', 'sois', 'son', 'era', 'eras', 'éramos', 'erais', 'eran', 'fui', 'fue', 'fueron', 'sea', 'seas', 'sean', 'ser', 'sido', 'será'])
const ESTAR = new Set(['estoy', 'estás', 'está', 'estamos', 'estáis', 'están', 'estaba', 'estabas', 'estábamos', 'estaban', 'estuve', 'estuvo', 'esté', 'estés', 'estén', 'estar', 'estado', 'estará'])

const WORD_RE = /[\p{L}\p{N}']+/gu
const words = (s: string) => [...(s.match(WORD_RE) ?? [])]
const key = (w: string) => stripAccents(w.toLowerCase())

/** Longest-common-subsequence diff of two word lists (accent-insensitive equality). */
export function diffWords(given: string[], expected: string[]): DiffTok[] {
  const m = given.length
  const n = expected.length
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i]![j] = key(given[i]!) === key(expected[j]!) ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!)
  const out: DiffTok[] = []
  let i = 0
  let j = 0
  while (i < m || j < n) {
    if (i < m && j < n && key(given[i]!) === key(expected[j]!)) {
      out.push(given[i] === expected[j] ? { text: given[i]!, kind: 'same' } : { text: given[i]!, kind: 'wrong', fix: expected[j]! })
      i++
      j++
    } else if (j < n && (i >= m || L[i]![j + 1]! >= L[i + 1]![j]!)) {
      out.push({ text: expected[j]!, kind: 'missing' })
      j++
    } else {
      out.push({ text: given[i]!, kind: 'extra' })
      i++
    }
  }
  // Pair an extra word with an adjacent missing word as a replacement.
  const merged: DiffTok[] = []
  for (let k = 0; k < out.length; k++) {
    const a = out[k]!
    const b = out[k + 1]
    if (b && ((a.kind === 'extra' && b.kind === 'missing') || (a.kind === 'missing' && b.kind === 'extra'))) {
      const extra = a.kind === 'extra' ? a : b
      const missing = a.kind === 'missing' ? a : b
      merged.push({ text: extra.text, kind: 'wrong', fix: missing.text })
      k++
    } else merged.push(a)
  }
  return merged
}

function verbSlots(form: string, lemma: string, deps: ExplainDeps): { tense: Tense; person: number }[] {
  const c = deps.conjugate(lemma)
  const out: { tense: Tense; person: number }[] = []
  for (const [t, forms] of Object.entries(c.forms) as [Tense, (string | null)[]][]) {
    forms.forEach((f, p) => {
      if (f && f.split(' ').pop()!.toLowerCase() === form.toLowerCase()) out.push({ tense: t, person: p })
    })
  }
  return out
}

function describeSlot(s: { tense: Tense; person: number }): string {
  return `${PERSON[s.person]}, ${TENSE_LABELS[s.tense].en.toLowerCase()}`
}

function gloss(form: string, deps: ExplainDeps): string | undefined {
  const e = deps.lookup(form)?.[0]
  return e ? e.en.slice(0, 2).join(', ') : undefined
}

/** One hint for a replaced word, as specific as the lookups allow. */
function replacementHint(g: string, e: string, next: string | undefined, deps: ExplainDeps): string {
  const gl = g.toLowerCase()
  const el = e.toLowerCase()
  if (stripAccents(gl) === stripAccents(el)) return `Accent: write “${e}”, not “${g}”.`
  if ((SER.has(gl) && ESTAR.has(el)) || (ESTAR.has(gl) && SER.has(el))) {
    return ESTAR.has(el) ? `Use estar (“${e}”) here: location, a temporary state or a result.` : `Use ser (“${e}”) here: identity, origin, profession, time or a lasting quality.`
  }
  if (ARTICLES.has(gl) && ARTICLES.has(el)) {
    const noun = next ? deps.lookup(next)?.find((x) => x.pos === 'noun') : undefined
    const g2 = noun?.gender === 'f' ? 'feminine' : noun?.gender === 'm' ? 'masculine' : undefined
    return g2 && next ? `Article: “${e}”, because “${next}” is ${g2}${/s$/.test(next) ? ' plural' : ''}.` : `Article: “${e}”, not “${g}”.`
  }
  if ((gl === 'por' && el === 'para') || (gl === 'para' && el === 'por')) {
    return el === 'para' ? `“para”, not “por”: purpose, destination, deadline or recipient.` : `“por”, not “para”: cause, means, exchange, duration or movement through a place.`
  }
  if (PREPS.has(gl) && PREPS.has(el)) return `Preposition: “${e}”, not “${g}”.`
  const ge = deps.lookup(gl)
  const ee = deps.lookup(el)
  const shared = ge && ee ? ee.find((x) => ge.some((y) => y.lemma === x.lemma)) : undefined
  if (shared) {
    if (shared.pos === 'verb') {
      const ee2 = verbSlots(el, shared.lemma, deps)
      const ge2 = verbSlots(gl, shared.lemma, deps)
      if (ee2.length && ge2.length) {
        const sameTense = ee2.some((a) => ge2.some((b) => b.tense === a.tense))
        const target = ee2[0]!
        const yours = ge2.find((b) => b.tense === target.tense) ?? ge2[0]!
        if (sameTense && yours.person !== target.person) return `Verb person: “${g}” is the ${PERSON[yours.person]} form of ${shared.lemma}; the subject here needs “${e}” (${PERSON[target.person]}).`
        return `Verb form: “${g}” is ${describeSlot(yours)}; this sentence needs “${e}” (${describeSlot(target)}).`
      }
      return `Verb form: “${e}” (from ${shared.lemma}), not “${g}”.`
    }
    const plural = /s$/.test(el) && !/s$/.test(gl)
    const singular = !/s$/.test(el) && /s$/.test(gl)
    const fem = /as?$/.test(el) && /os?$/.test(gl)
    const masc = /os?$/.test(el) && /as?$/.test(gl)
    const bits = [fem && 'feminine', masc && 'masculine', plural && 'plural', singular && 'singular'].filter(Boolean)
    if (bits.length) return `Agreement: “${e}” (${bits.join(', ')}), to match the word it describes.`
    return `Form: “${e}”, not “${g}”.`
  }
  const gg = gloss(gl, deps)
  const eg = gloss(el, deps)
  if (gg && eg) return `“${g}” means “${gg}”; here you need “${e}” (“${eg}”).`
  if (eg) return `The word here is “${e}” (“${eg}”).`
  if (editDistance(key(g), key(e)) <= 2) return `Spelling: “${e}”.`
  return `“${e}”, not “${g}”.`
}

function missingHint(e: string, next: string | undefined, deps: ExplainDeps): string {
  const el = e.toLowerCase()
  if (el === 'a' && next && /^[A-ZÁÉÍÓÚÑ]/.test(next)) return `Missing “a”: Spanish puts a before a person who is the direct object (personal a).`
  if (el === 'a') return `Missing “a”.`
  if (el === 'no') return `Missing “no”: the sentence is negative.`
  if (el === 'se' || el === 'me' || el === 'te' || el === 'nos' || el === 'os') return `Missing “${e}”: this verb needs its pronoun here.`
  if (ARTICLES.has(el)) return `Missing article “${e}”: Spanish uses the article here even where English does not.`
  if (PREPS.has(el)) return `Missing preposition “${e}”.`
  const g = gloss(el, deps)
  return g ? `Missing word: “${e}” (“${g}”).` : `Missing word: “${e}”.`
}

function extraHint(g: string): string {
  const gl = g.toLowerCase()
  if (['yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas'].includes(gl)) return `“${g}” is optional here; the verb ending already shows who.`
  if (ARTICLES.has(gl)) return `No article needed: drop “${g}”.`
  return `“${g}” isn't needed here.`
}

/** Explanation for a graded answer. Returns no hints for a correct answer. */
export function explainAnswer(ex: Exercise, answer: Answer | undefined, deps: ExplainDeps): Explanation {
  switch (ex.kind) {
    case 'choiceEs':
    case 'listen':
    case 'reply':
    case 'choiceEn':
    case 'fillBlank': {
      if (typeof answer !== 'number' || answer === ex.answer) return { hints: [] }
      const chosen = ex.options[answer]!
      const right = ex.options[ex.answer]!
      const hints: string[] = []
      if (ex.kind === 'choiceEs' || ex.kind === 'listen') hints.push(`You picked “${chosen}”, but it means “${right}”.`)
      else if (ex.kind === 'reply') hints.push(`“${chosen}” doesn't answer “${ex.prompt}”. A natural reply is “${right}”.`)
      else {
        const cg = gloss(chosen, deps)
        const rg = gloss(right, deps)
        if (ex.kind === 'fillBlank') hints.push(replacementHint(chosen, right, undefined, deps))
        else hints.push(cg ? `“${chosen}” means “${cg}”.${rg ? ` “${right}” means “${rg}”.` : ''}` : `The Spanish is “${right}”.`)
      }
      if (ex.translation && ex.kind !== 'choiceEs' && ex.kind !== 'listen') hints.push(`The whole sentence: ${ex.translation}`)
      return { hints }
    }
    case 'match':
      return { hints: [] }
    default: {
      const given = Array.isArray(answer) ? answer.join(' ') : typeof answer === 'string' ? answer : ''
      if (!given.trim()) return { hints: ['No answer given.'] }
      if (ex.kind === 'typeEn') {
        const best = closest(given, ex.answers)
        return { diff: diffWords(words(given), words(best)), hints: [] }
      }
      const answers = 'answers' in ex ? ex.answers : []
      if (!answers.length) return { hints: [] }
      const best = closest(given, answers)
      const g = words(given)
      const e = words(best)
      const diff = diffWords(g, e)
      const hints: string[] = []
      const sorted = (xs: string[]) => xs.map(key).sort().join(' ')
      if (g.length === e.length && sorted(g) === sorted(e) && g.join(' ') !== e.join(' ')) {
        hints.push('Right words, different order. Spanish usually puts adjectives after the noun and object pronouns before the verb.')
        return { diff, hints }
      }
      diff.forEach((t, idx) => {
        const next = diff.slice(idx + 1).find((x) => x.kind !== 'extra')?.text
        if (t.kind === 'wrong' && t.fix) hints.push(replacementHint(t.text, t.fix, next, deps))
        else if (t.kind === 'missing') hints.push(missingHint(t.text, next, deps))
        else if (t.kind === 'extra') hints.push(extraHint(t.text))
      })
      return { diff, hints: [...new Set(hints)].slice(0, 4) }
    }
  }
}

function closest(given: string, answers: string[]): string {
  const g = key(given)
  let best = answers[0]!
  let bestD = Infinity
  for (const a of answers) {
    const d = editDistance(g, key(a))
    if (d < bestD) {
      best = a
      bestD = d
    }
  }
  return best
}
