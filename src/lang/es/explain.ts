/** Spanish data for personalised feedback and answer equivalence (see lang/contract.ts). */
import type { ExplainConfig } from '../contract'

const SER = new Set(['soy', 'eres', 'es', 'somos', 'sois', 'son', 'era', 'eras', 'éramos', 'erais', 'eran', 'fui', 'fue', 'fueron', 'sea', 'seas', 'sean', 'ser', 'sido', 'será'])
const ESTAR = new Set(['estoy', 'estás', 'está', 'estamos', 'estáis', 'están', 'estaba', 'estabas', 'estábamos', 'estaban', 'estuve', 'estuvo', 'esté', 'estés', 'estén', 'estar', 'estado', 'estará'])

export const explainConfig: ExplainConfig = {
  languageName: 'Spanish',
  marks: 'accents',
  articles: new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'del', 'al', 'lo']),
  preps: new Set(['a', 'de', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'desde', 'hasta', 'hacia', 'entre']),
  subjects: new Set(['yo', 'tú', 'vos', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes']),
  notAfterSubject: new Set(['y', 'o', 'también', 'tampoco', 'mismo', 'misma', 'solo', 'sola']),
  emphatic: new Map([['a mí', 'me'], ['a ti', 'te'], ['a él', 'le'], ['a ella', 'le'], ['a usted', 'le'], ['a nosotros', 'nos'], ['a nosotras', 'nos'], ['a vosotros', 'os'], ['a vosotras', 'os'], ['a ellos', 'les'], ['a ellas', 'les'], ['a ustedes', 'les']]),
  objectPronouns: new Set(['se', 'me', 'te', 'nos', 'os']),
  negation: 'no',
  pairs: [
    {
      a: ESTAR,
      b: SER,
      useA: (e) => `Use estar (“${e}”) here: location, a temporary state or a result.`,
      useB: (e) => `Use ser (“${e}”) here: identity, origin, profession, time or a lasting quality.`,
    },
    {
      a: new Set(['para']),
      b: new Set(['por']),
      useA: () => `“para”, not “por”: purpose, destination, deadline or recipient.`,
      useB: () => `“por”, not “para”: cause, means, exchange, duration or movement through a place.`,
    },
  ],
  missingHint: (e, next) => {
    const el = e.toLowerCase()
    if (el === 'a' && next && /^[A-ZÁÉÍÓÚÑ]/.test(next)) return `Missing “a”: Spanish puts a before a person who is the direct object (personal a).`
    if (el === 'a') return `Missing “a”.`
    return undefined
  },
  accentHint: (g, e) => `Accent: write “${e}”, not “${g}”.`,
  agreement: (g, e) => {
    const plural = /s$/.test(e) && !/s$/.test(g)
    const singular = !/s$/.test(e) && /s$/.test(g)
    const fem = /as?$/.test(e) && /os?$/.test(g)
    const masc = /os?$/.test(e) && /as?$/.test(g)
    return [fem && 'feminine', masc && 'masculine', plural && 'plural', singular && 'singular'].filter((x): x is string => Boolean(x))
  },
  articleHint: (e, noun, next, g) => {
    const g2 = noun?.gender === 'f' ? 'feminine' : noun?.gender === 'm' ? 'masculine' : undefined
    return g2 ? `Article: “${e}”, because “${next}” is ${g2}${/s$/.test(next) ? ' plural' : ''}.` : `Article: “${e}”, not “${g}”.`
  },
  missingArticle: (e) => `Missing article “${e}”: Spanish uses the article here even where English does not.`,
  wordOrder: 'Right words, different order. Spanish usually puts adjectives after the noun and object pronouns before the verb.',
}
