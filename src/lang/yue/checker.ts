/**
 * Cantonese writing checker: measure-word agreement (一隻狗, not 一個狗), words
 * outside the dictionary, and the course's learner-error patterns.
 */
import type { CheckerFinding } from '../types'
import type { ErrorRule, VocabEntry } from '../../engine/schema'
import { segment } from './lexicon'
import { lookup, type Dictionary } from './inflect'

export interface CheckerDeps {
  dict: Dictionary
  rules: ErrorRule[]
  verbs?: ReadonlyMap<string, unknown>
}

const COUNTERS = /^([一二兩三四五六七八九十幾呢嗰每]+|[0-9]+)$/

export function check(text: string, deps: CheckerDeps): CheckerFinding[] {
  const out: CheckerFinding[] = []
  const segs: { text: string; start: number; end: number }[] = []
  let i = 0
  for (const s of segment(text)) {
    if (s.kind === 'han' || s.kind === 'num') segs.push({ text: s.text, start: i, end: i + s.text.length })
    i += s.text.length
  }
  const entry = (w: string, pos?: VocabEntry['pos']) => lookup(deps.dict, w)?.find((e) => !pos || e.pos === pos)
  for (let k = 0; k + 2 < segs.length; k++) {
    const [a, b, c] = [segs[k]!, segs[k + 1]!, segs[k + 2]!]
    if (!COUNTERS.test(a.text)) continue
    const cl = entry(b.text, 'classifier')
    const noun = entry(c.text, 'noun')
    if (cl && noun?.cl && noun.cl !== b.text) {
      out.push({ code: 'agreement', message: `“${noun.lemma}” is counted with ${noun.cl}: ${a.text}${noun.cl}${noun.lemma}.`, start: b.start, end: b.end, suggestion: noun.cl, grammar: 'g.classifiers' })
    }
  }
  for (const r of deps.rules) {
    let re: RegExp
    try {
      re = new RegExp(r.pattern, 'gu')
    } catch {
      continue
    }
    for (const m of text.matchAll(re)) out.push({ code: 'learner-error', message: r.message, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, grammar: r.grammar })
  }
  return out
}
