/** Italian data for personalised feedback and answer equivalence (see lang/contract.ts). */
import type { ExplainConfig } from '../contract'
import { AUXILIARY_FORMS } from './conjugator'
import { onsetOf } from './checker'

const ESSERE = new Set([...Object.values(AUXILIARY_FORMS.essere).flat(), 'essere', 'stato', 'stata', 'stati', 'state', 'essendo'])
const AVERE = new Set([...Object.values(AUXILIARY_FORMS.avere).flat(), 'avere', 'avuto', 'avendo'])

const DEFINITE = ['il', 'lo', 'la', "l'", 'i', 'gli', 'le']
const ARTICULATED = ['del', 'dello', 'della', "dell'", 'dei', 'degli', 'delle', 'al', 'allo', 'alla', "all'", 'ai', 'agli', 'alle', 'dal', 'dallo', 'dalla', "dall'", 'dai', 'dagli', 'dalle', 'nel', 'nello', 'nella', "nell'", 'nei', 'negli', 'nelle', 'sul', 'sullo', 'sulla', "sull'", 'sui', 'sugli', 'sulle', 'col', 'coi']

/** dall' → [da, l'], negli → [in, gli], col → [con, il]. */
function splitArticulated(w: string): [string, string] | undefined {
  if (!ARTICULATED.includes(w)) return undefined
  const m = /^(de|a|da|ne|su|co)(l|llo|lla|ll'|i|gli|lle)$/.exec(w)
  if (!m) return undefined
  const prep: Record<string, string> = { de: 'di', a: 'a', da: 'da', ne: 'in', su: 'su', co: 'con' }
  const art: Record<string, string> = { l: 'il', llo: 'lo', lla: 'la', "ll'": "l'", i: 'i', gli: 'gli', lle: 'le' }
  return [prep[m[1]!]!, art[m[2]!]!]
}

/** Words for the feedback diff: elisions split like the tokenizer ("l'amico" → "l'", "amico"). */
function tokens(text: string): string[] {
  const out: string[] = []
  for (const w of text.replace(/’/g, "'").match(/[\p{L}\p{N}']+/gu) ?? []) {
    const parts = w.split(/(?<=')(?=\p{L})/u)
    for (const p of parts) if (p.replace(/'/g, '')) out.push(p.replace(/^'+/, ''))
  }
  return out
}

export const explainConfig: ExplainConfig = {
  languageName: 'Italian',
  marks: 'accents',
  articles: new Set([...DEFINITE, 'un', 'uno', 'una', "un'", ...ARTICULATED]),
  preps: new Set(['di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra']),
  subjects: new Set(['io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'egli', 'ella', 'esso', 'essa', 'essi', 'esse']),
  notAfterSubject: new Set(['e', 'ed', 'o', 'anche', 'neanche', 'nemmeno', 'neppure', 'stesso', 'stessa', 'stessi', 'stesse', 'solo', 'sola', 'soli', 'sole', 'pure', 'invece', 'tutti', 'tutte', 'che', 'da', 'sì', 'no']),
  emphatic: new Map([
    ['a me', 'mi'], ['a te', 'ti'], ['a lui', 'gli'], ['a lei', 'le'], ['a noi', 'ci'], ['a voi', 'vi'], ['a loro', 'gli'],
  ]),
  objectPronouns: new Set(['mi', 'ti', 'si', 'ci', 'vi', 'lo', 'la', 'li', 'le', 'gli', 'ne']),
  negation: 'non',
  pairs: [
    {
      a: ESSERE,
      b: AVERE,
      useA: (e) => `Use essere (“${e}”) here. In compound tenses, verbs of motion and change of state (andare, venire, partire, nascere, diventare…) and all reflexive verbs take essere, and the participle agrees: sono andata, ci siamo alzati.`,
      useB: (e) => `Use avere (“${e}”) here. Most verbs, and every verb with a direct object, form compound tenses with avere (ho mangiato, abbiamo visto). Italian also says ho fame, ho sete, ho vent'anni.`,
    },
    {
      a: new Set(['da']),
      b: new Set(['di']),
      useA: () => `“da”, not “di”: from a place, since a time (da tre anni), at someone's place (da Marco), or purpose (occhiali da sole).`,
      useB: () => `“di”, not “da”: possession, material, topic, or where someone is from with essere (sono di Roma).`,
    },
    {
      a: new Set(['in']),
      b: new Set(['a']),
      useA: () => `“in”, not “a”: countries, regions and many places (in Italia, in banca, in centro).`,
      useB: () => `“a”, not “in”: cities and small islands (a Roma, a Capri), and a casa, a scuola, a letto.`,
    },
  ],
  missingHint: (e) => {
    const el = e.toLowerCase()
    if (el === "c'" || el === 'ci') return `Missing “${e}”: “there is / there are” is c'è / ci sono, and ci also replaces “there” or “a + place”.`
    if (el === 'ne') return `Missing “ne”: it stands for “of it / of them / some” (ne voglio due) and must not be left out.`
    if (el === 'si') return `Missing “si”: this verb is reflexive (or the sentence is impersonal: si dice…).`
    return undefined
  },
  accentHint: (g, e) => {
    const ge = g.toLowerCase()
    const ee = e.toLowerCase()
    if (ee === 'è' && ge === 'e') return `Accent: “è” (is) needs its accent; “e” means “and”.`
    if (ee === 'e' && ge === 'è') return `No accent: “e” means “and”; “è” means “is”.`
    if (/é$/.test(ee) && /è$/.test(ge)) return `Accent: “${e}” takes an acute accent (é), like perché, poiché, né.`
    return `Accent: write “${e}”, not “${g}”.`
  },
  agreement: (g, e) => {
    const gs = g.toLowerCase()
    const es = e.toLowerCase()
    const stem = (w: string) => w.slice(0, -1).replace(/h$/, '') // bianchi / bianca
    if (gs.length < 2 || stem(gs) !== stem(es)) return []
    // o = m sg, a = f sg, i = m pl, e = f pl (e/i alone is ambiguous: verde → verdi, rosse → rossi)
    const pair = gs.slice(-1) + es.slice(-1)
    const bits: Record<string, string[]> = {
      oa: ['feminine'], ao: ['masculine'], oi: ['plural'], io: ['singular'], ae: ['plural'], ea: ['singular'],
      oe: ['feminine', 'plural'], eo: ['masculine', 'singular'], ai: ['masculine', 'plural'], ia: ['feminine', 'singular'],
    }
    return bits[pair] ?? []
  },
  articleHint: (e, noun, next, g) => {
    const el = e.toLowerCase()
    const gl = g.toLowerCase()
    const onset = onsetOf(next)
    if (/^(lo|uno|gli|quello|quegli)$/.test(el) || /(llo|gli)$/.test(el)) {
      if (onset === 'lo') return `Article: “${e}”, not “${g}”: masculine words starting with s + consonant, z, gn, ps, x or y take lo / gli / uno (lo studente, gli zaini).`
      if (onset === 'vowel') return `Article: “${e}”, not “${g}”: masculine plural words starting with a vowel take gli (gli amici).`
    }
    if (el === "un'" && gl === 'un') return `Article: “un'” with an apostrophe, because “${next}” is feminine and starts with a vowel.`
    if (el === 'un' && gl === "un'") return `Article: “un” without an apostrophe, because “${next}” is masculine.`
    if (/'$/.test(el) && onset === 'vowel') return `Article: “${e}”: before a vowel lo and la become l' (l'amico, l'acqua).`
    const gender = noun?.gender === 'f' ? 'feminine' : noun?.gender === 'm' ? 'masculine' : undefined
    return gender ? `Article: “${e}”, because “${next}” is ${gender}${/[ie]$/.test(next) && noun?.lemma !== next ? ' plural' : ''}.` : `Article: “${e}”, not “${g}”.`
  },
  missingArticle: (e) => {
    const parts = splitArticulated(e.toLowerCase())
    if (parts) return `Missing “${e}” (${parts[0]} + ${parts[1]}): the preposition joins the article of the noun.`
    return `Missing article “${e}”: Italian uses the article with possessives (la mia casa), with nouns in a general sense (il caffè, gli italiani) and where English has none.`
  },
  wordOrder: 'Right words, different order. Italian usually puts adjectives after the noun, and object pronouns before the conjugated verb (lo vedo) but attached to infinitives and imperatives (vederlo, guardalo).',
  tokens,
}
