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
/** Measure words that go with any noun: the plural 啲, containers and quantities (一碟帶子, 一杯茶, 一份工, 二百級). */
const ANY_NOUN = new Set([...'啲些碟杯碗盒樽包袋箱煲籠盤份種款次級斤磅罐瓶壺盅串堆排群班對雙打半'])

export function check(text: string, deps: CheckerDeps): CheckerFinding[] {
  const out: CheckerFinding[] = []
  const segs: { text: string; start: number; end: number }[] = []
  let i = 0
  const entry = (w: string, pos?: VocabEntry['pos']) => lookup(deps.dict, w)?.find((e) => !pos || e.pos === pos)
  for (const s of segment(text)) {
    if (s.kind === 'han' || s.kind === 'num') {
      // The segmenter may keep "number + measure word" together (一個, 兩隻): split it for the agreement check.
      const m = s.text.match(/^([一二兩三四五六七八九十幾呢嗰每]+)(.+)$/u)
      if (m && entry(m[2]!, 'classifier')) {
        segs.push({ text: m[1]!, start: i, end: i + m[1]!.length })
        segs.push({ text: m[2]!, start: i + m[1]!.length, end: i + s.text.length })
      } else segs.push({ text: s.text, start: i, end: i + s.text.length })
    }
    i += s.text.length
  }
  for (let k = 0; k + 2 < segs.length; k++) {
    const [a, b, c] = [segs[k]!, segs[k + 1]!, segs[k + 2]!]
    if (!COUNTERS.test(a.text)) continue
    const cl = entry(b.text, 'classifier')
    const noun = entry(c.text, 'noun')
    if (cl && noun?.cl && noun.cl !== b.text && !ANY_NOUN.has(b.text)) {
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
