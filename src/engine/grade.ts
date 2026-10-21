/** Grades a learner answer for any exercise kind. */
import type { Exercise, GradeResult } from './types'
import type { LanguagePack, CheckerFinding } from '../lang/types'
import { expandAnswers, typoMatch } from '../lang/equivalence'
import { numberWordsToDigits, hasNumberWord } from '@lang/numbers'
import { explainConfig } from '@lang/explain'
import { numberWordsToDigitsEn, hasNumberWordEn } from '../lang/en/numbers'

const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, 'i am'], [/\byou're\b/g, 'you are'], [/\bwe're\b/g, 'we are'], [/\bthey're\b/g, 'they are'],
  [/\bhe's\b/g, 'he is'], [/\bshe's\b/g, 'she is'], [/\bit's\b/g, 'it is'], [/\bthat's\b/g, 'that is'],
  [/\bwhat's\b/g, 'what is'], [/\bwhere's\b/g, 'where is'], [/\bthere's\b/g, 'there is'], [/\bwho's\b/g, 'who is'],
  [/\bhow's\b/g, 'how is'], [/\bdon't\b/g, 'do not'], [/\bdoesn't\b/g, 'does not'], [/\bdidn't\b/g, 'did not'],
  [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bwasn't\b/g, 'was not'], [/\bweren't\b/g, 'were not'],
  [/\bcan't\b/g, 'cannot'], [/\bcouldn't\b/g, 'could not'], [/\bwon't\b/g, 'will not'], [/\bwouldn't\b/g, 'would not'],
  [/\bi've\b/g, 'i have'], [/\byou've\b/g, 'you have'], [/\bwe've\b/g, 'we have'], [/\bthey've\b/g, 'they have'],
  [/\bi'll\b/g, 'i will'], [/\byou'll\b/g, 'you will'], [/\bhe'll\b/g, 'he will'], [/\bshe'll\b/g, 'she will'], [/\bwe'll\b/g, 'we will'],
  [/\bi'd\b/g, 'i would'], [/\byou'd\b/g, 'you would'], [/\blet's\b/g, 'let us'], [/\bhaven't\b/g, 'have not'], [/\bhasn't\b/g, 'has not'],
]

export function normalizeEnglish(s: string): string {
  let t = s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep)
  return t.replace(/\b(the|a|an)\b /g, (m) => m) // articles kept; alternatives list handles optional ones
}

type Equiv = (g: string, e: string) => 'exact' | 'accents' | false

/** English answer matching: literal, synonyms, optional articles, small typos. Digits and number words compare equal. */
export function matchEnglish(given: string, expectedIn: string[], equiv?: Equiv): { verdict: GradeResult['verdict']; notes: string[]; lenient?: 'typo' } {
  const g0 = normalizeEnglish(given)
  if (!g0) return { verdict: 'wrong', notes: [] }
  const expected0 = expandAnswers(expectedIn).map(normalizeEnglish)
  const numeric = /\d/.test(g0) || hasNumberWordEn(g0) || expected0.some((e) => /\d/.test(e) || hasNumberWordEn(e))
  const variants: [string, string[]][] = [[g0, expected0]]
  if (numeric) variants.push([numberWordsToDigitsEn(g0), expected0.map(numberWordsToDigitsEn)])
  for (const [g, exps] of variants) {
    if (exps.includes(g)) return { verdict: 'correct', notes: [] }
    if (equiv && exps.some((e) => equiv(g, e))) return { verdict: 'correct', notes: [] }
  }
  // optional articles
  const strip = (x: string) => x.replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim()
  for (const [g, exps] of variants) {
    if (exps.some((e) => strip(e) === strip(g) || (equiv && equiv(strip(g), strip(e))))) return { verdict: 'correct', notes: [] }
  }
  // small typos in words of 4+ letters (no dictionary for English: meaning is what counts)
  for (const [g, exps] of variants) {
    for (const e of exps) {
      const direct = typoMatch(g, e, undefined, 4)
      const t = direct.ok ? direct : typoMatch(strip(g), strip(e), undefined, 4)
      if (t.ok) return { verdict: 'correct', notes: t.fixes.map(([a, b]) => `Small typo: “${a}” → “${b}”.`), lenient: 'typo' }
    }
  }
  return { verdict: 'wrong', notes: [] }
}

export interface GradeDeps {
  /** The target-language pack; `comparable` (Cantonese → Jyutping) is used for typo tolerance. */
  pack: LanguagePack & { comparable?: (text: string) => string }
  /** Optional checker for explanations on wrong typed answers. */
  check?: (text: string) => CheckerFinding[]
  /** Equivalence comparators (synonyms, regional variants, optional pronouns); see lang/equivalence. */
  equivEs?: Equiv
  equivEn?: Equiv
  /** True when a form is a real word of the target language (so a "typo" that forms another word is not forgiven). */
  isWord?: (w: string) => boolean
}

type Match = { verdict: GradeResult['verdict']; notes: string[]; matched?: string; viaEquivalence: boolean; lenient?: 'accents' | 'typo' }

function matchSpanishOnce(text: string, expected: string[], deps: GradeDeps, exact: boolean): Match {
  const r = deps.pack.match(text, expected)
  if (r.verdict !== 'wrong') return { verdict: r.verdict, notes: r.notes, matched: r.matched, viaEquivalence: false, lenient: r.reason }
  if (!text.trim()) return { verdict: 'wrong', notes: [], viaEquivalence: false }
  if (!exact && deps.equivEs) {
    for (const e of expected) {
      const c = deps.equivEs(text, e)
      if (c === 'exact') return { verdict: 'correct', notes: [], matched: e, viaEquivalence: true }
      if (c === 'accents') return { verdict: 'almost', notes: [`Check the ${explainConfig.marks}.`], matched: e, viaEquivalence: true, lenient: 'accents' }
    }
  }
  const cmp = deps.pack.comparable ?? ((t: string) => t)
  for (const e of expected) {
    const t = typoMatch(cmp(text), cmp(e), deps.isWord, exact ? 5 : 4)
    if (t.ok) return { verdict: 'almost', notes: t.fixes.map(([a, b]) => `Small typo: “${a}” → “${b}”.`), matched: e, viaEquivalence: false, lenient: 'typo' }
  }
  return { verdict: 'wrong', notes: [], viaEquivalence: false }
}

/**
 * Target-language answer matching: literal, then equivalence, then dictionary-aware typo tolerance.
 * Digits and number words compare equal ("Tengo 15 años" = "Tengo quince años").
 * Unless `exact` (dictation, conjugation, error fixes), missing accents and a small
 * typo still count as correct, with a reminder note.
 */
export function matchSpanish(text: string, expectedIn: string[], deps: GradeDeps, opts: { exact?: boolean } = {}): Match {
  const exact = Boolean(opts.exact)
  const expected = expandAnswers(expectedIn)
  let r = matchSpanishOnce(text, expected, deps, exact)
  if (r.verdict === 'wrong') {
    const numeric = /\d/.test(text) || hasNumberWord(text) || expected.some((e) => /\d/.test(e) || hasNumberWord(e))
    if (numeric) {
      const canon = expected.map(numberWordsToDigits)
      const r2 = matchSpanishOnce(numberWordsToDigits(text), canon, deps, exact)
      if (r2.verdict !== 'wrong') {
        const idx = r2.matched ? canon.indexOf(r2.matched) : -1
        r = { ...r2, matched: idx >= 0 ? expected[idx] : r2.matched }
      }
    }
  }
  if (r.verdict === 'almost' && !exact) return { ...r, verdict: 'correct', lenient: r.lenient ?? 'typo' }
  return r
}

/**
 * Match: mismatched pairs. Writing a character: strokes that needed another try (`mistakes`), strokes
 * finished only after the hint showed (`hints`) and the character's stroke count.
 */
export type StrokeAnswer = { mistakes: number; hints?: number; strokes?: number }
export type Answer = number | string | string[] | StrokeAnswer

/**
 * Tracing is guided, so it is never wrong: few slips and no hints is correct, anything else almost.
 * Writing from memory allows a slip or so; leaning on the hint for more than a third of the strokes is wrong.
 */
export function gradeStrokes(kind: 'trace' | 'writeChar', a: StrokeAnswer): GradeResult['verdict'] {
  const n = a.strokes ?? 1
  const hints = a.hints ?? 0
  if (kind === 'trace') return hints === 0 && a.mistakes <= Math.max(2, Math.ceil(n / 3)) ? 'correct' : 'almost'
  if (hints === 0 && a.mistakes <= Math.max(1, Math.floor(n / 4))) return 'correct'
  return hints <= Math.max(1, Math.floor(n / 3)) ? 'almost' : 'wrong'
}

export function grade(ex: Exercise, answer: Answer, deps: GradeDeps): GradeResult {
  switch (ex.kind) {
    case 'choiceEs':
    case 'choiceEn':
    case 'listen':
    case 'fillBlank':
    case 'reply':
    case 'pictogram':
    case 'hearChar': {
      const correct = ex.options[ex.answer]!
      return { verdict: answer === ex.answer ? 'correct' : 'wrong', correct, notes: [] }
    }
    case 'trace':
    case 'writeChar': {
      const a: StrokeAnswer = typeof answer === 'object' && answer !== null && 'mistakes' in answer ? answer : { mistakes: 99, hints: 99 }
      const hints = a.hints ?? 0
      const notes = [
        ...(a.mistakes ? [`${a.mistakes} stroke${a.mistakes === 1 ? '' : 's'} needed another try.`] : []),
        ...(hints ? [`The hint showed ${hints === 1 ? 'one stroke' : `${hints} strokes`}: watch the stroke order again.`] : []),
      ]
      return { verdict: gradeStrokes(ex.kind, a), correct: ex.char, notes }
    }
    case 'match': {
      const m = typeof answer === 'object' && answer !== null && 'mistakes' in answer ? answer.mistakes : 99
      return { verdict: m === 0 ? 'correct' : m <= 2 ? 'almost' : 'wrong', correct: ex.pairs.map((p) => `${p.left} = ${p.right}`).join(', '), notes: m ? [`${m} mismatched pair${m === 1 ? '' : 's'}.`] : [] }
    }
    case 'wordBank':
    case 'order':
    case 'orderText': {
      const text = Array.isArray(answer) ? answer.join(' ') : String(answer ?? '')
      const r = matchSpanish(text, ex.answers, deps)
      return { verdict: r.verdict === 'almost' ? 'correct' : r.verdict, correct: ex.answers[0]!, notes: [] }
    }
    case 'typeEn': {
      const r = matchEnglish(String(answer ?? ''), ex.answers, deps.equivEn)
      return { verdict: r.verdict, correct: ex.answers[0]!, notes: r.notes, lenient: r.lenient }
    }
    case 'speak': {
      const text = String(answer ?? '')
      if (!text.trim()) return { verdict: 'wrong', correct: ex.answers[0]!, notes: ['I could not hear anything. Try again closer to the microphone.'] }
      const r = matchSpanish(text, ex.answers, deps)
      if (r.verdict !== 'wrong') return { verdict: 'correct', correct: ex.answers[0]!, notes: [] }
      // Speech recognisers often drop accents or mishear one short word: be generous.
      const target = deps.pack.words(ex.answers[0]!)
      const said = new Set(deps.pack.words(text).map((w) => deps.pack.normalize(w, { accentInsensitive: true })))
      const hit = target.filter((w) => said.has(deps.pack.normalize(w, { accentInsensitive: true }))).length
      const ratio = target.length ? hit / target.length : 0
      if (ratio >= 0.75) return { verdict: 'almost', correct: ex.answers[0]!, notes: [`I heard: “${text}”.`] }
      return { verdict: 'wrong', correct: ex.answers[0]!, notes: [`I heard: “${text}”.`] }
    }
    case 'findError':
    case 'typeEs':
    case 'dictation':
    case 'conjugate':
    case 'transform': {
      const text = String(answer ?? '')
      // Dictation, conjugation and error fixes want the exact form; translation and transformation accept equivalents.
      const exact = ex.kind === 'dictation' || ex.kind === 'conjugate' || ex.kind === 'findError'
      const r = matchSpanish(text, ex.answers, deps, { exact })
      const notes = [...r.notes]
      if (r.viaEquivalence) notes.push(`Also correct. Another way to say it: ${ex.answers[0]}`)
      if (r.verdict === 'wrong' && deps.check && text.trim()) {
        for (const f of deps.check(text).slice(0, 2)) notes.push(f.message)
      }
      if (ex.kind === 'findError' && r.verdict === 'wrong') notes.push(ex.explain)
      return { verdict: r.verdict, correct: ex.answers[0]!, notes, lenient: r.lenient }
    }
    default:
      return { verdict: 'wrong', correct: '', notes: [] }
  }
}
