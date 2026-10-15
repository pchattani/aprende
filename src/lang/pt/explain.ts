/** Portuguese data for personalised feedback and answer equivalence (see lang/contract.ts). */
import type { ExplainConfig } from '../contract'

const SER = new Set([
  'ser', 'sou', 'és', 'é', 'somos', 'sois', 'são', 'era', 'eras', 'éramos', 'eram', 'fui', 'foste', 'foi', 'fomos', 'foram',
  'seja', 'sejas', 'sejamos', 'sejam', 'fosse', 'fossem', 'for', 'forem', 'serei', 'será', 'seremos', 'serão', 'seria', 'seriam', 'sido', 'sendo',
])
const ESTAR = new Set([
  'estar', 'estou', 'estás', 'está', 'estamos', 'estão', 'estava', 'estavas', 'estávamos', 'estavam', 'estive', 'esteve', 'estivemos', 'estiveram',
  'esteja', 'estejas', 'estejamos', 'estejam', 'estivesse', 'estivessem', 'estiver', 'estiverem', 'estarei', 'estará', 'estaremos', 'estarão', 'estaria', 'estado', 'estando',
])
const FICAR = new Set(['ficar', 'fico', 'ficas', 'fica', 'ficamos', 'ficam', 'fiquei', 'ficou', 'ficaram', 'ficava', 'ficavam', 'fique', 'fiquem', 'ficará', 'ficaria', 'ficado', 'ficando'])
/** ter is the everyday "there is" in Brazil; haver is the standard / written one. */
const TER_EXIST = new Set(['tem', 'tinha', 'teve', 'terá', 'teria', 'tenha', 'tivesse'])
const HAVER_EXIST = new Set(['há', 'havia', 'houve', 'haverá', 'haveria', 'haja', 'houvesse'])

const FEMININE_END = /(a|as|ã|ãs)$/
const MASCULINE_END = /(o|os|ão|ãos|ões)$/

export const explainConfig: ExplainConfig = {
  languageName: 'Portuguese',
  marks: 'accents',
  articles: new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'ao', 'à', 'aos', 'às',
    'pelo', 'pela', 'pelos', 'pelas', 'num', 'numa', 'nuns', 'numas', 'dum', 'duma',
  ]),
  preps: new Set(['a', 'de', 'em', 'com', 'por', 'para', 'pra', 'sem', 'sobre', 'desde', 'até', 'entre', 'contra', 'após', 'sob', 'perante']),
  subjects: new Set(['eu', 'tu', 'ele', 'ela', 'você', 'nós', 'a gente', 'vós', 'eles', 'elas', 'vocês']),
  notAfterSubject: new Set(['e', 'ou', 'nem', 'também', 'mesmo', 'mesma', 'mesmos', 'mesmas', 'só', 'sozinho', 'sozinha', 'sozinhos', 'sozinhas', 'próprio', 'própria', 'todos', 'todas', 'ambos', 'ambas']),
  emphatic: new Map([
    ['a mim', 'me'], ['a ti', 'te'], ['a ele', 'lhe'], ['a ela', 'lhe'], ['a você', 'lhe'],
    ['a nós', 'nos'], ['a vós', 'vos'], ['a eles', 'lhes'], ['a elas', 'lhes'], ['a vocês', 'lhes'],
  ]),
  objectPronouns: new Set(['me', 'te', 'se', 'nos', 'vos', 'lhe', 'lhes']),
  negation: 'não',
  pairs: [
    {
      a: ESTAR,
      b: SER,
      useA: (e) => `Use estar (“${e}”) here: location of a thing or person, a temporary state or a condition.`,
      useB: (e) => `Use ser (“${e}”) here: identity, origin, profession, time, the place of an event or a lasting quality.`,
    },
    {
      a: new Set(['para', 'pra']),
      b: new Set(['por', 'pelo', 'pela', 'pelos', 'pelas']),
      useA: () => `“para”, not “por”: purpose, destination, deadline or recipient.`,
      useB: () => `“por”, not “para”: cause, means, exchange, duration or movement through a place (por + o = pelo).`,
    },
    {
      a: FICAR,
      b: new Set([...ESTAR, ...SER]),
      useA: (e) => `Use ficar (“${e}”) here: becoming or getting into a state (ficar feliz), or where something is located for good (fica no centro).`,
      useB: (e) => `Use “${e}” here, not ficar: the sentence describes a state, not a change.`,
    },
    {
      a: HAVER_EXIST,
      b: TER_EXIST,
      useA: (e) => `“${e}” (haver) is the standard “there is / there was”; Brazilians also say “tem” in speech.`,
      useB: (e) => `“${e}” (ter) is the everyday Brazilian “there is”; “há” is the formal and European form.`,
    },
  ],
  missingHint: (e) => {
    const el = e.toLowerCase()
    if (el === 'que') return `Missing “que”: Portuguese never drops “que” the way English drops “that”.`
    if (el === 'se') return `Missing “se”: this verb is reflexive here.`
    return undefined
  },
  accentHint: (g, e) =>
    e.toLowerCase().replace(/ç/g, 'c') === g.toLowerCase()
      ? `Cedilla: write “${e}”, not “${g}”.`
      : `Accent: write “${e}”, not “${g}”.`,
  agreement: (g, e) => {
    const plural = /s$/.test(e) && !/s$/.test(g)
    const singular = !/s$/.test(e) && /s$/.test(g)
    const fem = FEMININE_END.test(e) && MASCULINE_END.test(g)
    const masc = MASCULINE_END.test(e) && FEMININE_END.test(g)
    return [fem && 'feminine', masc && 'masculine', plural && 'plural', singular && 'singular'].filter((x): x is string => Boolean(x))
  },
  articleHint: (e, noun, next, g) => {
    const g2 = noun?.gender === 'f' ? 'feminine' : noun?.gender === 'm' ? 'masculine' : undefined
    return g2 ? `Article: “${e}”, because “${next}” is ${g2}${/s$/.test(next) ? ' plural' : ''}.` : `Article: “${e}”, not “${g}”.`
  },
  missingArticle: (e) => `Missing “${e}”: Portuguese uses the article here even where English does not (o Brasil, a minha casa, do/na/ao when it joins a preposition).`,
  wordOrder: 'Right words, different order. Portuguese usually puts adjectives after the noun; in Brazil object pronouns usually go before the verb (me chamo), in Portugal after it (chamo-me).',
}
