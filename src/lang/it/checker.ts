/**
 * Rule-based Italian writing checker. No AI: it uses the dictionary (built from
 * the course vocabulary), the conjugator and a list of learner-error patterns,
 * and returns explainable findings: unknown words and spelling, missing accents
 * (perché, città, è), article choice and agreement (lo studente, gli amici,
 * un'amica), adjective agreement, the auxiliary of compound tenses (sono andato)
 * and subject–verb agreement.
 */
import type { CheckerFinding } from '../types'
import type { ErrorRule, VocabEntry } from '../../engine/schema'
import type { ItVerb } from './schema'
import { lookup, pluralize, isInvariantAdjective, IRREGULAR_PLURALS, type Dictionary } from './inflect'
import { tokenize } from './tokenize'
import { stripAccents, editDistance, apostropheAccents } from './normalize'
import { conjugate, parseLemma, PERSONS, AUXILIARY_FORMS, type Aux, type Tense } from './conjugator'

export interface CheckerDeps {
  dict: Dictionary
  rules: ErrorRule[]
  verbs: ReadonlyMap<string, ItVerb>
}

type Gender = 'm' | 'f' | 'mf'
type Num = 'sg' | 'pl' | 'any'
/** Which article form a word needs at its start: consonant, "lo" sounds (s+consonant, z, gn, ps, x, y, pn, i+vowel) or vowel. */
type Onset = 'cons' | 'lo' | 'vowel'
interface Features {
  gender: Gender
  number: Num
  role: 'det' | 'noun' | 'adj'
}
interface Det extends Features {
  /** Article family: definite, indefinite, demonstrative quel-, bel-, buon-… */
  kind: 'def' | 'indef' | 'quel' | 'bel' | 'other'
  /** Preposition fused with a definite article (del → di). */
  prep?: string
}

// ---- determiners
const DEF: Record<string, Pick<Det, 'gender' | 'number'>> = {
  il: { gender: 'm', number: 'sg' }, lo: { gender: 'm', number: 'sg' }, "l'": { gender: 'mf', number: 'sg' }, la: { gender: 'f', number: 'sg' },
  i: { gender: 'm', number: 'pl' }, gli: { gender: 'm', number: 'pl' }, le: { gender: 'f', number: 'pl' },
}
const PREP_STEMS: Record<string, string> = { de: 'di', a: 'a', da: 'da', ne: 'in', su: 'su', co: 'con' }
/** del, dello, della, dell', dei, degli, delle, al…, dal…, nel…, sul…, col, coi. */
const ARTICULATED: Record<string, { prep: string; article: string }> = {}
for (const [stem, prep] of Object.entries(PREP_STEMS)) {
  const l = stem === 'co' ? 'l' : 'll'
  const forms: [string, string][] = [[`${stem}l`, 'il'], [`${stem}${l}o`, 'lo'], [`${stem}${l}a`, 'la'], [`${stem}${l}'`, "l'"], [`${stem}i`, 'i'], [`${stem}gli`, 'gli'], [`${stem}${l}e`, 'le']]
  for (const [f, article] of forms) if (!(stem === 'co' && !['col', 'coi'].includes(f))) ARTICULATED[f] = { prep, article }
}
const INDEF: Record<string, Pick<Det, 'gender' | 'number'>> = {
  un: { gender: 'm', number: 'sg' }, uno: { gender: 'm', number: 'sg' }, una: { gender: 'f', number: 'sg' }, "un'": { gender: 'f', number: 'sg' },
}
const QUEL: Record<string, Pick<Det, 'gender' | 'number'>> = {
  quel: { gender: 'm', number: 'sg' }, quello: { gender: 'm', number: 'sg' }, "quell'": { gender: 'mf', number: 'sg' }, quella: { gender: 'f', number: 'sg' },
  quei: { gender: 'm', number: 'pl' }, quegli: { gender: 'm', number: 'pl' }, quelle: { gender: 'f', number: 'pl' },
}
const BEL: Record<string, Pick<Det, 'gender' | 'number'>> = {
  bel: { gender: 'm', number: 'sg' }, "bell'": { gender: 'mf', number: 'sg' }, bei: { gender: 'm', number: 'pl' }, begli: { gender: 'm', number: 'pl' },
}
const OTHER_DET: Record<string, Pick<Det, 'gender' | 'number'>> = { ogni: { gender: 'mf', number: 'sg' }, qualche: { gender: 'mf', number: 'sg' }, "quest'": { gender: 'mf', number: 'sg' } }
/** Determiners with four forms: m sg, f sg, m pl, f pl (possessives, demonstratives, quantifiers). */
for (const [msg, fsg, mpl, fpl] of [
  ['mio', 'mia', 'miei', 'mie'], ['tuo', 'tua', 'tuoi', 'tue'], ['suo', 'sua', 'suoi', 'sue'], ['nostro', 'nostra', 'nostri', 'nostre'],
  ['vostro', 'vostra', 'vostri', 'vostre'], ['questo', 'questa', 'questi', 'queste'], ['molto', 'molta', 'molti', 'molte'],
  ['poco', 'poca', 'pochi', 'poche'], ['tanto', 'tanta', 'tanti', 'tante'], ['troppo', 'troppa', 'troppi', 'troppe'],
  ['tutto', 'tutta', 'tutti', 'tutte'], ['altro', 'altra', 'altri', 'altre'], ['certo', 'certa', 'certi', 'certe'],
  ['alcuno', 'alcuna', 'alcuni', 'alcune'], ['stesso', 'stessa', 'stessi', 'stesse'], ['nessuno', 'nessuna', '', ''], ['ciascuno', 'ciascuna', '', ''],
] as const) {
  OTHER_DET[msg] = { gender: 'm', number: 'sg' }
  OTHER_DET[fsg] = { gender: 'f', number: 'sg' }
  if (mpl) OTHER_DET[mpl] = { gender: 'm', number: 'pl' }
  if (fpl) OTHER_DET[fpl] = { gender: 'f', number: 'pl' }
}

function detOf(w: string): Det | undefined {
  if (DEF[w]) return { ...DEF[w], role: 'det', kind: 'def' }
  const a = ARTICULATED[w]
  if (a) return { ...DEF[a.article]!, role: 'det', kind: 'def', prep: a.prep }
  if (INDEF[w]) return { ...INDEF[w], role: 'det', kind: 'indef' }
  if (QUEL[w]) return { ...QUEL[w], role: 'det', kind: 'quel' }
  if (BEL[w]) return { ...BEL[w], role: 'det', kind: 'bel' }
  if (OTHER_DET[w]) return { ...OTHER_DET[w], role: 'det', kind: 'other' }
  return undefined
}

/** Sound at the start of a word, which decides il/lo/l', un/uno/un', quel/quello/quell'. */
export function onsetOf(word: string): Onset {
  const w = stripAccents(word.toLowerCase())
  if (/^(s[^aeiou]|z|gn|ps|pn|x|y|i[aeiou])/.test(w) || /^(sh|ch(ef|ampagne|alet))/.test(w)) return 'lo' // lo chef, lo show
  if (/^h?[aeiou]/.test(w)) return 'vowel'
  return 'cons'
}

/** The definite article a word needs: il / lo / l' / la / i / gli / le. */
export function definiteArticle(gender: 'm' | 'f', number: 'sg' | 'pl', next: string): string {
  const o = onsetOf(next)
  if (gender === 'f') return number === 'pl' ? 'le' : o === 'vowel' ? "l'" : 'la'
  if (number === 'pl') return o === 'cons' ? 'i' : 'gli'
  return o === 'vowel' ? "l'" : o === 'lo' ? 'lo' : 'il'
}

/** The indefinite article a word needs: un / uno / una / un'. */
export function indefiniteArticle(gender: 'm' | 'f', next: string): string {
  const o = onsetOf(next)
  if (gender === 'f') return o === 'vowel' ? "un'" : 'una'
  return o === 'lo' ? 'uno' : 'un'
}

/** Fuse a preposition with an article: di + il → del, a + l' → all', in + gli → negli. */
export function articulate(prep: string, article: string): string {
  if (prep === 'con') return article === 'il' ? 'col' : article === 'i' ? 'coi' : `con ${article}`
  const stem = Object.entries(PREP_STEMS).find(([, p]) => p === prep)?.[0] ?? prep
  if (article === 'il') return stem + 'l'
  if (article === 'i') return stem + 'i'
  if (article === 'gli') return stem + 'gli'
  return stem + 'l' + article // lo → dello, la → della, l' → dell', le → delle
}

/** Every gender/number reading of a noun or adjective form (cameriere: m sg, or f pl of cameriera). */
function featuresOf(form: string, e: VocabEntry): Features[] {
  const lemma = e.lemma.toLowerCase()
  if (e.pos === 'noun') {
    const out: Features[] = []
    const plurals = e.plural ? [e.plural.toLowerCase()] : pluralize(lemma, { gender: e.gender })
    // nouns with a feminine form: amico/amica, studente/studentessa, attore/attrice
    const fem = e.feminine?.toLowerCase() ?? (e.gender === 'mf' && lemma.endsWith('o') ? lemma.slice(0, -1) + 'a' : undefined)
    const base: Gender = fem ? 'm' : (e.gender ?? 'mf')
    if (form === lemma) out.push({ gender: base, number: plurals.includes(lemma) ? 'any' : 'sg', role: 'noun' })
    if (fem) {
      if (form === fem) out.push({ gender: 'f', number: 'sg', role: 'noun' })
      if (pluralize(fem, { gender: 'f' }).includes(form)) out.push({ gender: 'f', number: 'pl', role: 'noun' })
    }
    const k = plurals.indexOf(form)
    if (k >= 0 && form !== lemma) {
      let gender = base
      if (!fem && e.gender === 'mf' && plurals.length > 1) gender = k === 0 ? 'm' : 'f' // turisti / turiste
      // uovo → le uova, braccio → le braccia, orecchio → le orecchie
      if (gender === 'm' && lemma.endsWith('o') && (form.endsWith('a') || (form.endsWith('e') && (e.plural || IRREGULAR_PLURALS[lemma])))) gender = 'f'
      out.push({ gender, number: 'pl', role: 'noun' })
    }
    return out
  }
  const a = adjFeatures(form, e)
  return a ? [a] : []
}

function adjFeatures(form: string, e: VocabEntry): Features | undefined {
  const lemma = e.lemma.toLowerCase()
  if (e.pos === 'adj') {
    const role = 'adj'
    if (isInvariantAdjective(lemma) || pluralize(lemma)[0] === lemma) return { gender: 'mf', number: 'any', role } // blu, rosa, pari
    if (lemma.endsWith('a') && !e.feminine) {
      const pl = pluralize(lemma, { gender: 'mf' }) // ottimista → ottimisti, ottimiste
      if (form === lemma) return { gender: 'mf', number: 'sg', role }
      const k = pl.indexOf(form)
      return k < 0 ? undefined : { gender: k === 0 ? 'm' : 'f', number: 'pl', role }
    }
    const fem = e.feminine?.toLowerCase() ?? (lemma.endsWith('o') ? lemma.slice(0, -1) + 'a' : lemma.endsWith('tore') ? lemma.slice(0, -4) + 'trice' : undefined)
    const g: Gender = fem ? 'm' : 'mf'
    if (form === lemma) return { gender: g, number: 'sg', role }
    if (pluralize(lemma, { gender: 'm' }).includes(form)) return { gender: g, number: 'pl', role }
    if (fem && form === fem) return { gender: 'f', number: 'sg', role }
    if (fem && pluralize(fem, { gender: 'f' }).includes(form)) return { gender: 'f', number: 'pl', role }
  }
  return undefined
}

const ADVERBS_IN_NP = new Set(['molto', 'più', 'meno', 'così', 'tanto', 'troppo', 'poco', 'assai', 'davvero', 'proprio', 'veramente', 'abbastanza'])
const SUBJECT_PRONOUNS: Record<string, number[]> = { io: [0], tu: [1], lui: [2], lei: [2], egli: [2], ella: [2], noi: [3], voi: [4], loro: [5], essi: [5], esse: [5] }
const CLITICS = new Set(['mi', 'ti', 'si', 'ci', 'vi', 'lo', 'la', 'li', 'le', 'gli', 'ne', 'non', 'me', 'te', 'se', 'ce', 've', 'glielo', 'gliela', 'glieli', 'gliele', 'gliene', "l'", "m'", "t'", "s'", "c'", "v'", "n'"])
/** Words before a subject pronoun that make it something else (a lei, io e lei). */
const SUBJECT_BLOCKERS = new Set(['a', 'di', 'da', 'con', 'per', 'su', 'tra', 'fra', 'e', 'ed', 'o', 'che', 'come', 'anche', 'senza', 'verso', 'secondo'])
const ADVERBS_IN_VP = new Set(['già', 'mai', 'ancora', 'sempre', 'appena', 'anche', 'proprio', 'più', 'spesso', 'davvero', 'forse', 'subito', 'bene', 'male', 'molto', 'poco', 'tanto'])
/** Words before "e" where it means "is" (è): lui e → lui è, c'e → c'è. */
const BEFORE_E_IS = new Set(['lui', 'lei', 'chi', 'dove', 'come', 'cosa', 'che', 'questo', 'questa', 'quello', 'quella', 'ciò', 'quale', 'qual', 'quanto', 'quanta', 'non'])
const ELIDED_BEFORE_E_IS = new Set(["c'", "dov'", "cos'", "com'", "quand'", "qual'", "chi'"])
const NOT_AFTER_E_IS = new Set(['io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'questo', 'questa', 'quello', 'quella', 'quando', 'dove', 'come', 'perché', 'chi', 'cosa', 'poi', 'anche', 'non', 'e', 'o'])

/** Accented words that are not in every course dictionary but are always correct as written. */
const ACCENTED_WORDS = new Set(['né', 'sé', 'là', 'lì', 'dà', 'già', 'più', 'può', 'giù', 'ciò', 'perché', 'poiché', 'affinché', 'benché', 'finché', 'sì', 'tè', 'è', 'cioè', 'però', 'così'])
/** Parts of speech whose forms are not adjectives even when they look like one (prima di, vicino a). */
const NOT_ATTRIBUTIVE = new Set(['adv', 'prep', 'conj'])
const PREPOSITIONS = new Set(['a', 'ad', 'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra'])
/** Words after which a noun phrase starts a clause and can be its subject. */
const CLAUSE_OPENERS = new Set(['e', 'ed', 'ma', 'però', 'che', 'perché', 'quando', 'se', 'anche', 'mentre', 'poi', 'dove', 'come', 'cioè', 'quindi', 'oggi', 'ieri', 'domani', 'adesso', 'ora'])
const COLOUR_SHADES = new Set(['chiaro', 'scuro', 'pastello', 'acceso', 'elettrico'])

const ESSERE_FORMS = new Set(['è', 'sono', 'sei', 'siamo', 'siete', 'era', 'erano', 'ero', 'eri', 'eravamo', 'eravate', 'sarà', 'saranno', 'sia', 'siano', 'fosse', 'fossero', 'sembra', 'sembrano', 'diventa', 'diventano', 'resta', 'restano', 'rimane', 'rimangono'])

/** Auxiliary form → [auxiliary, tense, person]. */
const AUX_INDEX = new Map<string, { aux: Aux; tense: keyof (typeof AUXILIARY_FORMS)['avere']; person: number }[]>()
for (const aux of ['avere', 'essere'] as Aux[]) {
  for (const [tense, forms] of Object.entries(AUXILIARY_FORMS[aux]) as [keyof (typeof AUXILIARY_FORMS)['avere'], string[]][]) {
    forms.forEach((f, person) => AUX_INDEX.set(f, [...(AUX_INDEX.get(f) ?? []), { aux, tense, person }]))
  }
}

export function check(text: string, deps: CheckerDeps): CheckerFinding[] {
  const findings: CheckerFinding[] = []
  const tokens = tokenize(text)
  const words = tokens.filter((t) => t.kind === 'word')
  const lw = words.map((t) => t.text.toLowerCase().replace(/’/g, "'"))

  // ---- spelling / accents
  const plainIndex = getPlainIndex(deps.dict)
  const verbIndex = getVerbIndex(deps)
  const participles = getParticipleIndex(deps)
  /** All gender/number readings of each word, and its dictionary entries. */
  const cands: Features[][] = []
  const entriesOf: (VocabEntry[] | undefined)[] = []
  const dets: (Det | undefined)[] = []
  // a punctuation mark or number between two words ends a phrase: "il taxi! Sei pronta?"
  const wordAt = tokens.map((t, k) => (t.kind === 'word' ? k : -1)).filter((k) => k >= 0)
  const gap = words.map((_, i) => i + 1 < words.length && tokens.slice(wordAt[i]! + 1, wordAt[i + 1]!).some((t) => t.kind !== 'space'))
  const setFeats = (i: number, form: string, es: VocabEntry[] | undefined) => {
    entriesOf[i] = es
    cands[i] = es ? es.flatMap((x) => featuresOf(form, x)) : []
  }
  words.forEach((t, i) => {
    const w = lw[i]!
    dets[i] = detOf(w)
    // "qual'è" is a classic mistake: quale loses its e without an apostrophe (qual è)
    if (w === "qual'" && lw[i + 1] === 'è') {
      findings.push({ code: 'spelling', message: '“qual è” is written without an apostrophe: “qual” is a truncation, not an elision.', start: t.start, end: words[i + 1]!.end, suggestion: 'qual è' })
      return
    }
    // e (and) vs è (is)
    if (w === 'e' && i > 0 && isEIs(i)) {
      findings.push({ code: 'accent', message: '“è” (is) takes an accent; “e” without it means “and”.', start: t.start, end: t.end, suggestion: 'è', grammar: 'g.essere-present' })
      return
    }
    // accent typed as an apostrophe: perche' → perché
    if (/['’]$/.test(t.text) && !lw[i]!.match(/^(po|mo|va|fa|da|sta|di|to|be|ca|de)'$/)) {
      const fixed = apostropheAccents(w)
      if (fixed !== w) {
        findings.push({ code: 'accent', message: `Accent: write “${fixed}” with an accent, not an apostrophe. ${explainAccent(fixed)}`, start: t.start, end: t.end, suggestion: fixed })
        setFeats(i, fixed, deps.dict.get(fixed))
        return
      }
    }
    const entries = lookup(deps.dict, w)
    setFeats(i, w, entries)
    if (entries) return
    if (dets[i] || ARTICULATED[w] || w.endsWith("'") || ACCENTED_WORDS.has(w)) return // function word not in the course dictionary
    if (verbIndex.has(w) || participles.has(w) || participles.has(w.slice(0, -1) + 'o')) return // a verb form (unita, colpite)
    const capital = /^\p{Lu}/u.test(t.text)
    if (capital && i > 0) return // proper noun
    const plain = stripAccents(w)
    const candidates = plainIndex.get(plain)
    if (candidates && candidates.length) {
      const correct = candidates[0]!
      if (correct !== w) {
        const why = /[àèéìòù]/.test(correct) ? explainAccent(correct) : `“${correct}” has no written accent: only a stressed final vowel takes one.`
        findings.push({ code: 'accent', message: `Accent: “${t.text}” should be “${correct}”. ${why}`, start: t.start, end: t.end, suggestion: correct, grammar: 'g.accents' })
        setFeats(i, correct, deps.dict.get(correct))
      }
      return
    }
    const hyphenated = /[-–]/.test(text.slice(words[i - 1]?.end ?? t.start, t.start)) || /^[-–]/.test(text.slice(t.end))
    if (capital) return // a capitalised first word we don't know is probably a name (Roma, Dante)
    if (w.length >= 4 && !hyphenated && !/(at|it|ut)[oaie]$/.test(w)) {
      const near = nearest(w, deps.dict, plainIndex)
      // a different final vowel is usually another form of a word we lack (geni/genio), not a typo
      if (near && near.slice(0, -1) !== w.slice(0, -1) && near !== w.slice(0, -1) && near.slice(0, -1) !== w) {
        findings.push({ code: 'spelling', message: `Spelling: did you mean “${near}”?`, start: t.start, end: t.end, suggestion: near })
        return
      }
    }
    if (i > 0 || words.length > 1) findings.push({ code: 'unknown', message: `“${t.text}” is not a word I know. Check the spelling or the dictionary.`, start: t.start, end: t.end })
  })

  function isEIs(i: number): boolean {
    if (gap[i - 1]) return false // "…a lei! E adesso": a new sentence starting with "and"
    const prev = lw[i - 1]!
    const next = lw[i + 1]
    if (ELIDED_BEFORE_E_IS.has(prev)) return true
    if (!BEFORE_E_IS.has(prev)) return false
    if (next === undefined) return prev !== 'non'
    if (NOT_AFTER_E_IS.has(next) || /^\p{Lu}/u.test(words[i + 1]!.text)) return false
    return true
  }

  // ---- articles and agreement within noun phrases: det (adv)* adj* noun adj*
  const isAdjAt = (x: number) => !dets[x] && cands[x]!.some((f) => f.role === 'adj') && !entriesOf[x]?.some((e) => NOT_ATTRIBUTIVE.has(e.pos))
  /** A preposition at x: the word before it heads a phrase (vicino al ponte, pieno di gente). */
  const startsPhrase = (x: number) => x < words.length && !gap[x - 1] && (PREPOSITIONS.has(lw[x]!) || Boolean(ARTICULATED[lw[x]!]))
  const agrees = (a: Features, b: Features) => (a.gender === 'mf' || b.gender === 'mf' || a.gender === b.gender) && (a.number === 'any' || b.number === 'any' || a.number === b.number)
  for (let i = 0; i < words.length; i++) {
    const d = dets[i]
    if (!d || gap[i]) continue
    if (words[i]!.text === 'I' && i > 0) continue // Roman numeral: del I secolo
    // fixed phrases that start with an article: al fine di, ai fini di
    if ((entriesOf[i] ?? lookup(deps.dict, lw[i]!) ?? []).some((e) => e.pos === 'phrase' && lw.slice(i).join(' ').startsWith(e.lemma.toLowerCase() + ' '))) continue
    // lo, la, le, gli, l' are also object pronouns (lo porto, me lo ricordo); molto, tanto, altro… also adverbs and pronouns
    const pronounLike = (d.kind === 'def' && !d.prep && /^(lo|la|le|gli|l')$/.test(lw[i]!)) || d.kind === 'other'
    let j = i + 1
    const adjs: number[] = []
    while (j < words.length && j <= i + 3) {
      if (ADVERBS_IN_NP.has(lw[j]!) || (dets[j]?.kind === 'other' && d.kind !== 'other')) {
        if (gap[j]) break
        j++ // il mio amico: the article agrees with the noun, the possessive too
        continue
      }
      if (isAdjAt(j) && !gap[j]) {
        adjs.push(j)
        j++
        continue
      }
      break
    }
    if (j >= words.length || (j > i + 1 && gap[j - 1])) continue
    let noun = lw[j]!
    if (pronounLike && (verbIndex.has(noun) || AUX_INDEX.has(noun))) continue
    let nounC = cands[j]!.filter((f) => f.role === 'noun')
    // compound nouns: il fine settimana, la scuola guida
    for (const e of entriesOf[j] ?? []) {
      if (e.pos !== 'noun' || !e.lemma.includes(' ')) continue
      const parts = e.lemma.toLowerCase().split(' ')
      if (lw.slice(j, j + parts.length).join(' ') !== parts.join(' ') || gap.slice(j, j + parts.length - 1).some(Boolean)) continue
      nounC = [{ gender: e.gender ?? 'mf', number: 'sg', role: 'noun' }]
      noun = e.lemma.toLowerCase()
      j += parts.length - 1
      break
    }
    if (!nounC.length) continue
    // the article form depends on the next word, its gender and number on the noun (any reading that fits)
    const fits = (f: Features) => (d.gender === 'mf' || f.gender === 'mf' || d.gender === f.gender) && (f.number === 'any' || d.number === f.number)
    const nf = nounC.find(fits) ?? nounC[0]!
    let k = j + 1
    while (k < words.length && k <= j + 2 && !gap[k - 1]) {
      if (ADVERBS_IN_NP.has(lw[k]!)) {
        k++
        continue
      }
      // azzurro chiaro, verde scuro: colour compounds never agree
      // skip forms that are also verbs (la festa del paese dura…) and adjectives heading a phrase (vicino al ponte)
      if (isAdjAt(k) && !verbIndex.has(lw[k]!) && !COLOUR_SHADES.has(lw[k + 1] ?? '') && !COLOUR_SHADES.has(lw[k]!) && !startsPhrase(k + 1)) {
        adjs.push(k)
        k++
        continue
      }
      break
    }
    const next = lw[i + 1]!
    if (next === 'ex') continue // la ex / l'ex: both are used
    const gOk = d.gender === 'mf' || nf.gender === 'mf' || d.gender === nf.gender
    const nOk = nf.number === 'any' || d.number === nf.number
    if (!gOk || !nOk) {
      const fix = suggestDet(d, nf, next, lw[i]!)
      // un'amico / un amica: the apostrophe is the problem, not the gender
      if (fix && d.kind === 'indef' && onsetOf(next) === 'vowel' && nOk) {
        findings.push({ code: 'article', message: `Article: “${fix}”, not “${words[i]!.text}”, before “${next}”. ${articleRule(fix, next)}`, start: words[i]!.start, end: words[i + 1]!.end, suggestion: fix, grammar: 'g.articles' })
        continue
      }
      findings.push({
        code: 'agreement', message: `Agreement: “${words[i]!.text} ${noun}”: the article/determiner must match the noun (${describe(nf)}).`,
        start: words[i]!.start, end: words[j]!.end, suggestion: fix, grammar: 'g.articles',
      })
    } else {
      const want = expectedForm(d, nf, next, lw[i]!)
      if (want && want !== lw[i]) {
        findings.push({
          code: 'article', message: `Article: “${want}”, not “${words[i]!.text}”, before “${next}”. ${articleRule(want, next)}`,
          start: words[i]!.start, end: words[i + 1]!.end, suggestion: want, grammar: 'g.articles',
        })
      }
    }
    for (const a of adjs) {
      const ac = cands[a]!.filter((f) => f.role === 'adj')
      if (!ac.length || ac.some((af) => nounC.some((n) => agrees(af, n)))) continue
      {
        findings.push({
          code: 'agreement', message: `Agreement: “${words[a]!.text}” must agree with “${noun}” (${describe(nf)}).`,
          start: Math.min(words[a]!.start, words[j]!.start), end: Math.max(words[a]!.end, words[j]!.end), grammar: 'g.adjective-agreement',
        })
      }
    }
    // predicate adjective: la casa è bianco (only for a subject, not a noun after a preposition: la scuola dei bambini è vicina)
    let p = k
    const clauseStart = i === 0 || gap[i - 1] || CLAUSE_OPENERS.has(lw[i - 1]!)
    if (!d.prep && clauseStart && p < words.length && !gap[p - 1] && ESSERE_FORMS.has(lw[p]!)) {
      p++
      while (p < words.length && ADVERBS_IN_NP.has(lw[p]!) && !gap[p - 1]) p++
      const ac = p < words.length && !gap[p - 1] && isAdjAt(p) ? cands[p]!.filter((f) => f.role === 'adj') : []
      if (ac.length && !COLOUR_SHADES.has(lw[p + 1] ?? '') && !startsPhrase(p + 1)) {
        const ok = ac.some((af) => nounC.some((n) => agrees(af, n)))
        if (!ok) {
          findings.push({
            code: 'agreement', message: `Agreement: “${words[p]!.text}” describes “${noun}”, so it must be ${describe(nf)}.`,
            start: words[p]!.start, end: words[p]!.end, grammar: 'g.adjective-agreement',
          })
        }
      }
    }
  }

  // ---- auxiliary in compound tenses: "ho andato" → "sono andato"
  for (let i = 0; i < words.length; i++) {
    const auxHits = AUX_INDEX.get(lw[i]!)
    const avere = auxHits?.find((h) => h.aux === 'avere')
    if (!avere) continue
    let j = i + 1
    while (j < words.length && ADVERBS_IN_VP.has(lw[j]!) && !gap[j - 1]) j++
    if (gap[j - 1]) continue
    const part = lw[j]
    if (!part) continue
    const verb = participles.get(part)
    if (!verb || verb.auxiliaries.includes('avere')) continue
    if (lookup(deps.dict, part)?.some((e) => e.pos === 'noun')) continue // ho successo
    const plural = avere.person >= 3
    const agreed = part.slice(0, -1) + (plural ? (part.endsWith('e') ? 'e' : 'i') : part.endsWith('a') ? 'a' : 'o')
    const auxE = AUXILIARY_FORMS.essere[avere.tense][avere.person]!
    const suggestion = `${auxE} ${agreed}`
    findings.push({
      code: 'auxiliary', message: `“${verb.lemma}” forms its compound tenses with essere, not avere: “${suggestion}” (the participle agrees with the subject). Verbs of motion and change of state (andare, venire, partire, nascere, diventare…) and reflexive verbs take essere.`,
      start: words[i]!.start, end: words[j]!.end, suggestion, grammar: 'g.passato-prossimo-essere',
    })
  }

  // ---- subject pronoun + verb person
  const imperatives = getImperativeIndex(deps)
  const agreesWith = (form: string, persons: number[]) =>
    verbIndex.get(form)?.some((h) => persons.includes(h.person)) || AUX_INDEX.get(form)?.some((h) => persons.includes(h.person)) || imperatives.get(form)?.some((p) => persons.includes(p))
  for (let i = 0; i < words.length; i++) {
    const w = lw[i]!
    const persons = SUBJECT_PRONOUNS[w]
    if (!persons || gap[i]) continue
    if (i > 0 && SUBJECT_BLOCKERS.has(lw[i - 1]!)) continue // a loro, io e lei, la loro casa
    if (w === 'loro' && i > 0 && dets[i - 1]) continue
    // a subject after its verb: "paghi tu la cena", "che hai tu"
    if (i > 0 && !gap[i - 1] && agreesWith(lw[i - 1]!, persons)) continue
    let j = i + 1
    while (j < words.length && CLITICS.has(lw[j]!) && !gap[j - 1]) j++
    const v = lw[j]
    if (!v || gap[j - 1]) continue
    if (w === 'noi' && lw.slice(i + 1, j).includes('si')) continue // Tuscan "noi si va"
    if (imperatives.get(v)?.some((p) => persons.includes(p))) continue // tu prepara la caffettiera
    const hits = verbIndex.get(v)
    const auxHits = AUX_INDEX.get(v)
    let fix: string | undefined
    if (hits && hits.length) {
      if (hits.some((h) => persons.includes(h.person))) continue
      const h = hits[0]!
      fix = conjugate(h.lemma, deps.verbs).forms[h.tense][persons[0]!]?.split(' ')[0]
    } else if (auxHits && auxHits.length) {
      if (auxHits.some((h) => persons.includes(h.person))) continue
      const h = auxHits[0]!
      fix = AUXILIARY_FORMS[h.aux][h.tense][persons[0]!]
    } else continue
    findings.push({
      code: 'verb-agreement', message: `“${w} ${v}”: the verb must agree with ${PERSONS[persons[0]!]}${fix ? ` → “${w} ${fix}”` : ''}.`,
      start: words[i]!.start, end: words[j]!.end, suggestion: fix, grammar: 'g.subject-pronouns',
    })
  }

  // ---- learner-error rules
  const lower = text.toLowerCase()
  for (const r of deps.rules) {
    let re: RegExp
    try {
      re = new RegExp(r.pattern, 'giu')
    } catch {
      continue
    }
    let m: RegExpExecArray | null
    while ((m = re.exec(lower))) {
      findings.push({ code: 'learner-error', message: r.message + (r.example ? ` (✗ ${r.example.wrong} → ✓ ${r.example.right})` : ''), start: m.index, end: m.index + m[0].length, grammar: r.grammar })
      if (m[0].length === 0) re.lastIndex++
    }
  }

  findings.sort((a, b) => a.start - b.start)
  return findings
}

/** The right form of a determiner for the next word (lo studente, gli amici, un'amica, quell'uomo). */
function expectedForm(d: Det, nf: Features, next: string, given: string): string | undefined {
  const g: 'm' | 'f' = nf.gender === 'f' || (nf.gender === 'mf' && d.gender === 'f') ? 'f' : 'm'
  const n: 'sg' | 'pl' = nf.number === 'any' ? (d.number === 'any' ? 'sg' : (d.number as 'sg' | 'pl')) : nf.number
  if (nf.gender === 'mf' && d.gender === 'mf' && g === 'm' && given.endsWith("'")) return undefined // l'artista: either gender
  if (d.kind === 'def') {
    const art = definiteArticle(g, n, next)
    return d.prep ? articulate(d.prep, art) : art
  }
  if (d.kind === 'indef') return n === 'sg' ? indefiniteArticle(g, next) : undefined
  if (d.kind === 'quel' || d.kind === 'bel') {
    const stem = d.kind === 'quel' ? 'que' : 'be'
    const art = definiteArticle(g, n, next)
    // il → quel/bel, lo → quello/bello, l' → quell'/bell', i → quei/bei, gli → quegli/begli, la → quella, le → quelle
    const map: Record<string, string> = { il: 'l', lo: 'llo', "l'": "ll'", la: 'lla', i: 'i', gli: 'gli', le: 'lle' }
    return stem + map[art]!
  }
  return undefined
}

function suggestDet(d: Det, nf: Features, next: string, given: string): string | undefined {
  if (nf.gender === 'mf') return undefined
  return expectedForm({ ...d, gender: nf.gender, number: nf.number }, nf, next, given)
}

function articleRule(want: string, next: string): string {
  if (/^(lo|uno|quello|bello|dello|allo|dallo|nello|sullo)$/.test(want) || /gli$/.test(want)) {
    if (onsetOf(next) === 'lo') return `Masculine words starting with s + consonant, z, gn, ps, x or y take lo / gli / uno (lo studente, gli zaini, uno psicologo).`
    return `Masculine plural words starting with a vowel take gli (gli amici).`
  }
  if (/'$/.test(want)) {
    if (want === "un'") return `“un'” (with an apostrophe) is only for feminine words starting with a vowel (un'amica).`
    return `Before a vowel, lo and la become l' (l'amico, l'acqua).`
  }
  if (want === 'un') return `Masculine “un” never takes an apostrophe (un amico, un albero).`
  return `Use “${want}” here.`
}

/** Short explanation of the Italian written accent. */
export function explainAccent(word: string): string {
  if (/é$/.test(word)) return `Words stressed on a final closed e take an acute accent: perché, poiché, né, sé, ventitré.`
  if (/[àèìòù]$/.test(word)) return `Words stressed on the last vowel are written with an accent (città, caffè, così, può, virtù).`
  if (/[àèéìòù]/.test(word)) return `This word is written with an accent.`
  return ''
}

function describe(f: Features): string {
  const g = f.gender === 'm' ? 'masculine' : f.gender === 'f' ? 'feminine' : 'either gender'
  return `${g}, ${f.number === 'sg' ? 'singular' : f.number === 'pl' ? 'plural' : 'singular or plural'}`
}

// ---- caches keyed by dictionary identity
const plainCache = new WeakMap<Dictionary, Map<string, string[]>>()
function getPlainIndex(dict: Dictionary): Map<string, string[]> {
  let idx = plainCache.get(dict)
  if (!idx) {
    idx = new Map()
    for (const form of dict.keys()) {
      const p = stripAccents(form)
      const list = idx.get(p)
      if (list) list.push(form)
      else idx.set(p, [form])
    }
    plainCache.set(dict, idx)
  }
  return idx
}

function nearest(w: string, dict: Dictionary, plainIndex: Map<string, string[]>): string | undefined {
  const plain = stripAccents(w)
  let best: string | undefined
  for (const p of plainIndex.keys()) {
    if (Math.abs(p.length - plain.length) > 1) continue
    if (p[0] !== plain[0]) continue
    if (editDistance(p, plain) === 1) {
      const f = plainIndex.get(p)![0]!
      if (dict.has(f) && (!best || f.length > best.length)) best = f
    }
  }
  return best
}

interface VerbHit {
  lemma: string
  tense: Tense
  person: number
}
const verbIndexCache = new WeakMap<Dictionary, Map<string, VerbHit[]>>()
function getVerbIndex(deps: CheckerDeps): Map<string, VerbHit[]> {
  let idx = verbIndexCache.get(deps.dict)
  if (idx) return idx
  idx = new Map()
  const seen = new Set<string>()
  for (const entries of deps.dict.values()) {
    for (const e of entries) {
      if (e.pos !== 'verb') continue
      const base = parseLemma(e.lemma.split(' ')[0]!).inf
      if (seen.has(base)) continue
      seen.add(base)
      let c
      try {
        c = conjugate(base, deps.verbs)
      } catch {
        continue
      }
      for (const [tense, forms] of Object.entries(c.forms) as [Tense, (string | null)[]][]) {
        if (tense === 'impAff' || tense === 'impNeg') continue
        forms.forEach((f, person) => {
          if (!f) return
          const key = f.split(' ')[0]! // auxiliary for compound tenses
          if (f.includes(' ')) return // compound tenses are checked through the auxiliary itself
          const list = idx!.get(key) ?? []
          list.push({ lemma: base, tense, person })
          idx!.set(key, list)
        })
      }
    }
  }
  verbIndexCache.set(deps.dict, idx)
  return idx
}

/** Affirmative imperative form → persons (prepara: tu). */
const imperativeCache = new WeakMap<Dictionary, Map<string, number[]>>()
function getImperativeIndex(deps: CheckerDeps): Map<string, number[]> {
  let idx = imperativeCache.get(deps.dict)
  if (idx) return idx
  idx = new Map()
  const seen = new Set<string>()
  for (const entries of deps.dict.values()) {
    for (const e of entries) {
      if (e.pos !== 'verb') continue
      const base = parseLemma(e.lemma.split(' ')[0]!).inf
      if (seen.has(base)) continue
      seen.add(base)
      let c
      try {
        c = conjugate(base, deps.verbs)
      } catch {
        continue
      }
      ;(c.forms.impAff ?? []).forEach((f, person) => {
        if (f && !f.includes(' ')) idx!.set(f, [...(idx!.get(f) ?? []), person])
      })
    }
  }
  imperativeCache.set(deps.dict, idx)
  return idx
}

/** Participle form (all four) → verb and its auxiliaries, for the verbs in the dictionary and the table. */
const participleCache = new WeakMap<Dictionary, Map<string, { lemma: string; auxiliaries: Aux[] }>>()
function getParticipleIndex(deps: CheckerDeps): Map<string, { lemma: string; auxiliaries: Aux[] }> {
  let idx = participleCache.get(deps.dict)
  if (idx) return idx
  idx = new Map()
  const lemmas = new Set<string>()
  for (const entries of deps.dict.values()) for (const e of entries) if (e.pos === 'verb' && !/si$|sene$/.test(e.lemma.split(' ')[0]!)) lemmas.add(parseLemma(e.lemma.split(' ')[0]!).inf)
  for (const [l, row] of deps.verbs) if (row.aux === 'essere') lemmas.add(l)
  for (const l of lemmas) {
    let c
    try {
      c = conjugate(l, deps.verbs)
    } catch {
      continue
    }
    for (const p of c.participles) {
      const prev = idx.get(p)
      // a participle shared by two verbs (stato: essere/stare) counts as avere-compatible if either takes avere
      if (prev) prev.auxiliaries = [...new Set([...prev.auxiliaries, ...c.auxiliaries])]
      else idx.set(p, { lemma: l, auxiliaries: [...c.auxiliaries] })
    }
  }
  participleCache.set(deps.dict, idx)
  return idx
}
