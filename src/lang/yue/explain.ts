/**
 * Cantonese data for personalised feedback. Answers are compared as Jyutping
 * syllables, so a wrong tone shows up as one syllable with the right letters.
 */
import type { ExplainConfig } from '../contract'
import { toSyllables } from './lexicon'
import { stripTones } from './jyutping'

/** Particles and function words worth a specific hint when they are missing. */
const MISSING: Record<string, string> = {
  zo2: 'Missing 咗 (zo2): it marks a completed action.',
  gan2: 'Missing 緊 (gan2): it marks an action in progress.',
  gwo3: 'Missing 過 (gwo3): it marks something experienced before.',
  ge3: 'Missing 嘅 (ge3): it links a description to a noun, or marks possession.',
  dei6: 'Missing 哋 (dei6): it makes the pronoun plural (我哋, 你哋, 佢哋).',
  m4: 'Missing 唔 (m4): the sentence is negative.',
  mou5: 'Missing 冇 (mou5): “not have / did not”.',
  maa3: 'Missing 嗎 (maa3): it turns a statement into a yes/no question.',
  aa3: 'Missing 呀 (aa3): the sentence-final particle softens the sentence.',
  laa1: 'Missing 啦 (laa1): it makes a suggestion or request.',
  lo1: 'Missing 囉 (lo1): it marks something obvious.',
  hai6: 'Missing 係 (hai6): “to be”.',
  hai2: 'Missing 喺 (hai2): “to be at / in”.',
}

export const explainConfig: ExplainConfig = {
  languageName: 'Cantonese',
  marks: 'tones',
  articles: new Set(),
  preps: new Set(['hai2', 'heoi3', 'hai2dou6', 'tung4', 'bei2', 'cung4', 'deoi3']),
  subjects: new Set(['ngo5', 'nei5', 'keoi5']),
  notAfterSubject: new Set(['dei6']),
  emphatic: new Map(),
  objectPronouns: new Set(),
  negation: 'm4',
  pairs: [
    {
      a: new Set(['zo2']),
      b: new Set(['gwo3']),
      useA: () => '咗 (zo2), not 過 (gwo3): the action is completed now; 過 means “have done it before”.',
      useB: () => '過 (gwo3), not 咗 (zo2): it is about having had the experience before.',
    },
    {
      a: new Set(['m4']),
      b: new Set(['mou5']),
      useA: () => '唔 (m4) negates verbs and adjectives: 唔係, 唔去, 唔好.',
      useB: () => '冇 (mou5) means “not have”, or “did not” for past actions: 冇錢, 冇去.',
    },
    {
      a: new Set(['go3']),
      b: new Set(['zek3', 'bun2', 'zoeng1', 'tiu4', 'gaan1', 'ga3', 'bui1', 'zi1', 'gin6', 'deoi3']),
      useA: () => '個 (go3) is the general measure word for this noun.',
      useB: (e) => `This noun takes its own measure word: ${e}.`,
    },
  ],
  missingHint: (e) => MISSING[e.toLowerCase()],
  accentHint: (g, e) => {
    const base = stripTones(e)
    if (base === 'hai') return `Tone: “${e}”. 係 hai6 = “to be”; 喺 hai2 = “to be at / in”.`
    return `Tone: say and write “${e}”, not “${g}”. The tone changes the word.`
  },
  agreement: () => [],
  articleHint: (e, _noun, _next, g) => `“${e}”, not “${g}”.`,
  missingArticle: (e) => `Missing “${e}”.`,
  wordOrder: 'Right words, different order. Cantonese puts time and place before the verb (我聽日喺屋企食飯), and question words stay where the answer would be.',
  tokens: (text) => toSyllables(text),
  key: (w) => stripTones(w.toLowerCase()),
}
