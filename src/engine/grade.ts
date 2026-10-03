/** Grades a learner answer for any exercise kind. */
import type { Exercise, GradeResult } from './types'
import type { LanguagePack, CheckerFinding } from '../lang/types'
import { editDistance } from '../lang/es/normalize'

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

function matchEnglish(given: string, expected: string[]): GradeResult['verdict'] {
  const g = normalizeEnglish(given)
  if (!g) return 'wrong'
  const exps = expected.map(normalizeEnglish)
  if (exps.includes(g)) return 'correct'
  // optional leading subject "I" / articles tolerance
  const strip = (x: string) => x.replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim()
  if (exps.some((e) => strip(e) === strip(g))) return 'almost'
  for (const e of exps) {
    const gw = g.split(' ')
    const ew = e.split(' ')
    if (gw.length !== ew.length) continue
    let typos = 0
    let ok = true
    for (let i = 0; i < gw.length; i++) {
      if (gw[i] === ew[i]) continue
      if (ew[i]!.length >= 4 && editDistance(gw[i]!, ew[i]!) === 1) typos++
      else {
        ok = false
        break
      }
    }
    if (ok && typos <= 1) return 'almost'
  }
  return 'wrong'
}

export interface GradeDeps {
  pack: LanguagePack
  /** Optional checker for explanations on wrong typed answers. */
  check?: (text: string) => CheckerFinding[]
}

export type Answer = number | string | string[] | { mistakes: number }

export function grade(ex: Exercise, answer: Answer, deps: GradeDeps): GradeResult {
  switch (ex.kind) {
    case 'choiceEs':
    case 'choiceEn':
    case 'listen':
    case 'fillBlank': {
      const correct = ex.options[ex.answer]!
      return { verdict: answer === ex.answer ? 'correct' : 'wrong', correct, notes: [] }
    }
    case 'match': {
      const m = typeof answer === 'object' && answer !== null && 'mistakes' in answer ? answer.mistakes : 99
      return { verdict: m === 0 ? 'correct' : m <= 2 ? 'almost' : 'wrong', correct: ex.pairs.map((p) => `${p.left} = ${p.right}`).join(', '), notes: m ? [`${m} mismatched pair${m === 1 ? '' : 's'}.`] : [] }
    }
    case 'wordBank':
    case 'order': {
      const text = Array.isArray(answer) ? answer.join(' ') : String(answer ?? '')
      const r = deps.pack.match(text, ex.answers)
      return { verdict: r.verdict === 'almost' ? 'correct' : r.verdict, correct: ex.answers[0]!, notes: [] }
    }
    case 'typeEn': {
      const v = matchEnglish(String(answer ?? ''), ex.answers)
      return { verdict: v, correct: ex.answers[0]!, notes: v === 'almost' ? ['Close enough — check the exact wording.'] : [] }
    }
    case 'speak': {
      const text = String(answer ?? '')
      if (!text.trim()) return { verdict: 'wrong', correct: ex.answers[0]!, notes: ['I could not hear anything. Try again closer to the microphone.'] }
      const r = deps.pack.match(text, ex.answers)
      if (r.verdict !== 'wrong') return { verdict: 'correct', correct: ex.answers[0]!, notes: [] }
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
      const r = deps.pack.match(text, ex.answers)
      const notes = [...r.notes]
      if (r.verdict === 'wrong' && deps.check && text.trim()) {
        for (const f of deps.check(text).slice(0, 2)) notes.push(f.message)
      }
      if (ex.kind === 'findError' && r.verdict === 'wrong') notes.push(ex.explain)
      return { verdict: r.verdict, correct: ex.answers[0]!, notes }
    }
    default:
      return { verdict: 'wrong', correct: '', notes: [] }
  }
}
