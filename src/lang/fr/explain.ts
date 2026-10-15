/** French data for personalised feedback and answer equivalence (see lang/contract.ts). */
import type { ExplainConfig } from '../contract'
import { AUXILIARY_FORMS, conjugate, formsOf } from './conjugator'
import { elides, cleanText } from './normalize'
import { feminineOf, pluralize } from './inflect'
import { tokenize } from './tokenize'
import { IRREGULAR } from './verbs'

const ETRE = new Set([...Object.values(AUXILIARY_FORMS.être).flat(), 'être', 'été', 'étant'])
const AVOIR = new Set([...Object.values(AUXILIARY_FORMS.avoir).flat(), 'avoir', 'eu', 'eue', 'eus', 'eues', 'ayant'])
const SAVOIR = new Set([...formsOf(conjugate('savoir', IRREGULAR))])
const CONNAITRE = new Set([...formsOf(conjugate('connaître', IRREGULAR))])

const DEFINITE = ['le', 'la', "l'", 'les']
const CONTRACTED: Record<string, [string, string]> = { du: ['de', 'le'], des: ['de', 'les'], au: ['à', 'le'], aux: ['à', 'les'] }

/** Words for the feedback diff: elisions split like the tokenizer ("l'ami" → "l'", "ami"; aujourd'hui stays whole). */
function tokens(text: string): string[] {
  return tokenize(cleanText(text))
    .filter((t) => t.kind === 'word' || t.kind === 'number')
    .map((t) => t.text)
}

/** Masculine singular base of a form, trying the usual endings (petites → petit, heureuses → heureux, chevaux → cheval). */
function bases(w: string): string[] {
  const out = new Set([w])
  if (w.endsWith('aux')) out.add(w.slice(0, -3) + 'al')
  if (/[sx]$/.test(w)) out.add(w.slice(0, -1))
  return [...out]
}

export const explainConfig: ExplainConfig = {
  languageName: 'French',
  marks: 'accents',
  articles: new Set([...DEFINITE, 'un', 'une', 'des', 'du', 'au', 'aux']),
  preps: new Set(['à', 'de', "d'", 'en', 'dans', 'sur', 'sous', 'avec', 'pour', 'par', 'chez', 'sans', 'vers', 'entre', 'contre', 'depuis', 'pendant', 'avant', 'après', 'devant', 'derrière']),
  /** French subject pronouns are never optional: nothing is dropped when comparing answers. */
  subjects: new Set<string>(),
  notAfterSubject: new Set(['et', 'ou', 'aussi', 'même', 'seul', 'seule', 'seuls', 'seules', 'non', 'oui', 'que', 'qui']),
  emphatic: new Map([
    ['à moi', 'me'], ['à toi', 'te'], ['à lui', 'lui'], ['à elle', 'lui'], ['à nous', 'nous'], ['à vous', 'vous'], ['à eux', 'leur'], ['à elles', 'leur'],
  ]),
  objectPronouns: new Set(['me', "m'", 'te', "t'", 'se', "s'", 'le', 'la', "l'", 'les', 'lui', 'leur', 'y', 'en', 'nous', 'vous']),
  negation: 'ne',
  pairs: [
    {
      a: ETRE,
      b: AVOIR,
      useA: (e) => `Use être (“${e}”) here. In the passé composé and other compound tenses, the DR MRS VANDERTRAMP verbs of motion and change of state (aller, venir, arriver, partir, naître, mourir, tomber, rester…) and all pronominal verbs take être, and the participle agrees: elle est allée, nous nous sommes levés.`,
      useB: (e) => `Use avoir (“${e}”) here. Most verbs form the passé composé with avoir (j'ai mangé, nous avons vu). French also says j'ai faim, j'ai froid, j'ai vingt ans.`,
    },
    {
      a: new Set(["c'", 'ce', 'ça']),
      b: new Set(['il', 'elle', 'ils', 'elles']),
      useA: () => `“c'est”, not “il/elle est”, before a determiner or a name (c'est un médecin, c'est Marie) and to sum up an idea (c'est bon !).`,
      useB: () => `“il/elle est”, not “c'est”, before a bare adjective or a profession without an article (il est grand, elle est médecin).`,
    },
    {
      a: SAVOIR,
      b: CONNAITRE,
      useA: () => `savoir, not connaître: to know a fact or how to do something (je sais qu'il vient, je sais nager).`,
      useB: () => `connaître, not savoir: to know a person, a place or a thing, to be familiar with it (je connais Paris, je connais ce livre).`,
    },
    {
      a: new Set(['depuis']),
      b: new Set(['pendant', 'pour']),
      useA: () => `“depuis”: an action that started in the past and is still going on, with the present tense (j'habite ici depuis deux ans).`,
      useB: () => `“pendant”: how long something lasted, a finished period (j'ai habité à Lyon pendant deux ans).`,
    },
    {
      a: new Set(['pendant']),
      b: new Set(['depuis', 'il']),
      useA: () => `“pendant”: a finished period of time (pendant trois jours).`,
      useB: () => `“il y a” means “ago” (je suis arrivé il y a trois jours); “depuis” means “since / for” for something still going on.`,
    },
    {
      a: new Set(['en']),
      b: new Set(['à', 'au', 'aux']),
      useA: () => `“en” before feminine countries and regions (most end in -e) and continents: en France, en Italie, en Europe, en Bretagne.`,
      useB: (e) => e === 'à' ? `“à” before cities (à Paris, à Montréal).` : `“${e}” before masculine countries (au Japon, au Canada) and plural ones (aux États-Unis).`,
    },
    {
      a: new Set(['vous', 'votre', 'vos']),
      b: new Set(['tu', 'te', "t'", 'toi', 'ton', 'ta', 'tes']),
      useA: () => `“vous” here: polite (a stranger, a shop, someone older) or more than one person; keep vous, votre, vos and the -ez verb forms together.`,
      useB: () => `“tu” here: one friend, a family member or a child; keep tu, te, ton/ta/tes and the tu verb forms together.`,
    },
    {
      a: new Set(['de', "d'"]),
      b: new Set(['du', 'des', 'un', 'une']),
      useA: () => `“de” (d'): after a negation (je n'ai pas de pain), after quantities (beaucoup de, un peu de) and before a plural adjective (de beaux jours), du / de la / des / un / une become de.`,
      useB: (e) => `“${e}”: in a positive sentence French needs the article (je veux du pain, il y a des fleurs); it becomes de only after a negation or a quantity.`,
    },
    {
      a: new Set(['bien']),
      b: new Set(['bon', 'bonne', 'bons', 'bonnes']),
      useA: () => `“bien” is the adverb (well): il chante bien, c'est bien.`,
      useB: (e) => `“${e}” is the adjective (good) and agrees with the noun: un bon film, une bonne idée.`,
    },
  ],
  missingHint: (e, next) => {
    const el = e.toLowerCase()
    if (el === 'pas' || el === 'jamais' || el === 'rien' || el === 'plus') return `Missing “${e}”: French negation has two parts, ne … ${el} (je ne sais pas). In speech ne often disappears, but in writing both are needed.`
    if (el === 'ne' || el === "n'") return `Missing “${e}”: written French puts ne before the verb and pas after it (je ne sais pas, je n'ai pas).`
    if (el === 'y') return `Missing “y”: it replaces à + a place or a thing (j'y vais, il y a), and must not be left out.`
    if (el === 'en') return `Missing “en”: it stands for “some / of it / of them” (j'en veux deux) or de + a place (j'en viens).`
    if (el === 'se' || el === "s'" || el === 'me' || el === "m'" || el === 'te' || el === "t'") return `Missing “${e}”: this verb is pronominal (se lever, s'appeler) and needs its pronoun.`
    if ((el === 'le' || el === 'la' || el === "l'" || el === 'les') && next !== undefined && /^(ai|as|a|avons|avez|ont|est|sont)$/.test(next.toLowerCase())) return `Missing “${e}”: the object pronoun goes before the verb (je l'ai vu).`
    return undefined
  },
  accentHint: (g, e) => {
    const ge = g.toLowerCase()
    const ee = e.toLowerCase()
    if (ee === 'à' && ge === 'a') return `Accent: “à” (to, at) needs its accent; “a” means “has”.`
    if (ee === 'a' && ge === 'à') return `No accent: “a” is the verb “has” (il a); “à” means “to, at”.`
    if (ee === 'où' && ge === 'ou') return `Accent: “où” (where) needs its accent; “ou” means “or”.`
    if (ee === 'ou' && ge === 'où') return `No accent: “ou” means “or”; “où” means “where”.`
    if (ee === 'là' && ge === 'la') return `Accent: “là” (there) needs its accent; “la” means “the / her”.`
    if (ee === 'sûr' && ge === 'sur') return `Accent: “sûr” (sure) takes a circumflex; “sur” means “on”.`
    if (/ç/.test(ee) && !/ç/.test(ge)) return `Cedilla: write “${e}”: ç keeps the c soft before a, o, u.`
    if (/é/.test(ee) && /è/.test(ge)) return `Accent: “${e}” takes an acute accent (é), a closed e as in été.`
    if (/è/.test(ee) && /é/.test(ge)) return `Accent: “${e}” takes a grave accent (è), an open e as in père.`
    return `Accent: write “${e}”, not “${g}”.`
  },
  agreement: (g, e) => {
    const gs = g.toLowerCase()
    const es = e.toLowerCase()
    if (gs === es) return []
    for (const b of new Set([...bases(gs), ...bases(es)])) {
      const fem = feminineOf(b)
      const mpl = pluralize(b)[0]!
      const fpl = fem + (/[sx]$/.test(fem) ? '' : 's')
      const cell = (w: string): [string, string] | undefined =>
        w === b && w === mpl ? ['m', '?'] : w === b ? ['m', 'sg'] : w === mpl ? ['m', 'pl'] : w === fem && fem === fpl ? ['f', '?'] : w === fem ? ['f', 'sg'] : w === fpl ? ['f', 'pl'] : undefined
      const a = cell(gs)
      const c = cell(es)
      if (!a || !c) continue
      if (fem === b && a[0] !== c[0]) continue // rouge: same in both genders
      const bits: string[] = []
      if (a[0] !== c[0] && fem !== b) bits.push(c[0] === 'f' ? 'feminine' : 'masculine')
      if (a[1] !== c[1] && a[1] !== '?' && c[1] !== '?') bits.push(c[1] === 'pl' ? 'plural' : 'singular')
      return bits
    }
    return []
  },
  articleHint: (e, noun, next, g) => {
    const el = e.toLowerCase()
    const gl = g.toLowerCase()
    if (el === "l'") return `Article: “l'”: before a vowel or a silent h, le and la become l' (l'ami, l'eau, l'hôtel).`
    if ((el === 'le' || el === 'la') && gl === "l'") return `Article: “${e}”: “${next}” starts with a consonant or an aspirated h, so there is no elision (le héros).`
    if (el === 'cet') return `Article: “cet” before a masculine word starting with a vowel or a silent h (cet ami, cet hôtel).`
    if (/^[mts]on$/.test(el) && noun?.gender === 'f') return `“${e}”: mon/ton/son are also used before a feminine word starting with a vowel (mon amie, mon école), so the two vowels don't clash.`
    if (CONTRACTED[el]) {
      const [p, a] = CONTRACTED[el]
      return `“${e}” = ${p} + ${a}: the preposition fuses with the article (${el === 'du' ? 'du pain' : el === 'au' ? 'au cinéma' : el === 'aux' ? 'aux enfants' : 'des amis'}).`
    }
    if (el === 'de' || el === "d'") return `“${e}”: after a negation or a quantity, un/une/du/de la/des become de (pas de pain).`
    const gender = noun?.gender === 'f' ? 'feminine' : noun?.gender === 'm' ? 'masculine' : undefined
    const plural = noun && cleanText(noun.lemma).toLowerCase() !== next.toLowerCase() && /[sx]$/.test(next)
    if (gender) return `Article: “${e}”, because “${next}” is ${gender}${plural ? ' plural' : ''}.`
    return elides(next) && /^(le|la)$/.test(gl) ? `Article: “${e}”: before a vowel, le and la become l'.` : `Article: “${e}”, not “${g}”.`
  },
  missingArticle: (e) => {
    const parts = CONTRACTED[e.toLowerCase()]
    if (parts) return `Missing “${e}” (${parts[0]} + ${parts[1]}): the preposition fuses with the article.`
    return `Missing article “${e}”: French nouns almost always need an article: le/la/les for general statements and likes (j'aime le café), un/une/des or du/de la for some.`
  },
  wordOrder: 'Right words, different order. French puts most adjectives after the noun (une voiture rouge, but un petit chat), object pronouns before the verb (je le vois, je le lui donne) and ne … pas around the conjugated verb (je ne parle pas, je n’ai pas parlé).',
  tokens,
}
