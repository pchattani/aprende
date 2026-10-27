/**
 * Rule-based French writing checker. No AI: it uses the dictionary (built from
 * the course vocabulary), the conjugator and a list of learner-error patterns,
 * and returns explainable findings: unknown words and spelling, missing accents
 * (à, où, là, très, français), elision (j'aime, l'ami, qu'il), article and
 * determiner agreement (le/la/l'/les, un/une, du/de la/des, ce/cet/cette/ces,
 * mon/ma/mes with mon amie), adjective agreement, être vs avoir in compound
 * tenses (je suis allé) with participle agreement, and subject–verb agreement.
 *
 * Built to stay quiet on correct French: phrases stop at punctuation, every
 * gender/number reading of a word is kept, le/la/les/l' before a verb are object
 * pronouns, predicates after a preposition are not checked, capitalised words are
 * names, and subjects after their verb (inversion: parlez-vous, a-t-il) are allowed.
 */
import { contentRegExp } from '../wordBoundary'
import type { CheckerFinding } from '../types'
import type { ErrorRule, VocabEntry } from '../../engine/schema'
import type { FrVerb } from './schema'
import { lookup, pluralize, adjectiveTable, isInvariantAdjective, feminineOf, PRENOMINAL_M, type Dictionary } from './inflect'
import { tokenize } from './tokenize'
import { stripAccents, editDistance, elides, cleanText } from './normalize'
import { conjugate, parseLemma, PERSONS, AUXILIARY_FORMS, participleForms, type Aux, type Tense } from './conjugator'

export interface CheckerDeps {
  dict: Dictionary
  rules: ErrorRule[]
  verbs: ReadonlyMap<string, FrVerb>
}

type Gender = 'm' | 'f' | 'mf'
type Num = 'sg' | 'pl' | 'any'
interface Features {
  gender: Gender
  number: Num
  role: 'det' | 'noun' | 'adj'
}
interface Det extends Features {
  /** Determiner family: definite, indefinite, demonstrative, possessive (mon/ma/mes…), other (quel, tout, notre…). */
  kind: 'def' | 'indef' | 'dem' | 'poss' | 'other'
  /** Preposition fused with a definite article (du → de, au → à). */
  prep?: 'de' | 'à'
  /** m / t / s for mon, ton, son. */
  stem?: string
}

// ---- determiners
const DETS: Record<string, Omit<Det, 'role'>> = {
  le: { kind: 'def', gender: 'm', number: 'sg' }, la: { kind: 'def', gender: 'f', number: 'sg' }, "l'": { kind: 'def', gender: 'mf', number: 'sg' },
  les: { kind: 'def', gender: 'mf', number: 'pl' },
  du: { kind: 'def', gender: 'm', number: 'sg', prep: 'de' }, au: { kind: 'def', gender: 'm', number: 'sg', prep: 'à' }, aux: { kind: 'def', gender: 'mf', number: 'pl', prep: 'à' },
  un: { kind: 'indef', gender: 'm', number: 'sg' }, une: { kind: 'indef', gender: 'f', number: 'sg' }, des: { kind: 'indef', gender: 'mf', number: 'pl' },
  ce: { kind: 'dem', gender: 'm', number: 'sg' }, cet: { kind: 'dem', gender: 'm', number: 'sg' }, cette: { kind: 'dem', gender: 'f', number: 'sg' }, ces: { kind: 'dem', gender: 'mf', number: 'pl' },
  notre: { kind: 'other', gender: 'mf', number: 'sg' }, votre: { kind: 'other', gender: 'mf', number: 'sg' }, leur: { kind: 'other', gender: 'mf', number: 'sg' },
  nos: { kind: 'other', gender: 'mf', number: 'pl' }, vos: { kind: 'other', gender: 'mf', number: 'pl' }, leurs: { kind: 'other', gender: 'mf', number: 'pl' },
  quel: { kind: 'other', gender: 'm', number: 'sg' }, quelle: { kind: 'other', gender: 'f', number: 'sg' }, quels: { kind: 'other', gender: 'm', number: 'pl' },
  quelles: { kind: 'other', gender: 'f', number: 'pl' }, chaque: { kind: 'other', gender: 'mf', number: 'sg' }, plusieurs: { kind: 'other', gender: 'mf', number: 'pl' },
  quelques: { kind: 'other', gender: 'mf', number: 'pl' }, aucun: { kind: 'other', gender: 'm', number: 'sg' }, aucune: { kind: 'other', gender: 'f', number: 'sg' },
  certains: { kind: 'other', gender: 'm', number: 'pl' }, certaines: { kind: 'other', gender: 'f', number: 'pl' }, tout: { kind: 'other', gender: 'm', number: 'sg' },
  toute: { kind: 'other', gender: 'f', number: 'sg' }, tous: { kind: 'other', gender: 'm', number: 'pl' }, toutes: { kind: 'other', gender: 'f', number: 'pl' },
}
for (const s of ['m', 't', 's']) {
  DETS[s + 'on'] = { kind: 'poss', gender: 'm', number: 'sg', stem: s }
  DETS[s + 'a'] = { kind: 'poss', gender: 'f', number: 'sg', stem: s }
  DETS[s + 'es'] = { kind: 'poss', gender: 'mf', number: 'pl', stem: s }
}

function detOf(w: string): Det | undefined {
  const d = DETS[w]
  return d ? { ...d, role: 'det' } : undefined
}

/** The definite article a word needs: le / la / l' / les. */
export function definiteArticle(gender: 'm' | 'f', number: 'sg' | 'pl', next: string): string {
  if (number === 'pl') return 'les'
  return elides(next) ? "l'" : gender === 'f' ? 'la' : 'le'
}

/** The indefinite article: un / une / des. */
export function indefiniteArticle(gender: 'm' | 'f', number: 'sg' | 'pl' = 'sg'): string {
  return number === 'pl' ? 'des' : gender === 'f' ? 'une' : 'un'
}

/** The demonstrative: ce / cet / cette / ces. */
export function demonstrative(gender: 'm' | 'f', number: 'sg' | 'pl', next: string): string {
  if (number === 'pl') return 'ces'
  return gender === 'f' ? 'cette' : elides(next) ? 'cet' : 'ce'
}

/** The possessive (stem m, t or s): mon / ma / mes; mon also before a feminine word starting with a vowel (mon amie). */
export function possessive(stem: string, gender: 'm' | 'f', number: 'sg' | 'pl', next: string): string {
  if (number === 'pl') return stem + 'es'
  return gender === 'm' || elides(next) ? stem + 'on' : stem + 'a'
}

/** Fuse a preposition with an article: de + le → du, de + les → des, à + le → au, à + les → aux; de la, de l', à la, à l' stay apart. */
export function articulate(prep: 'de' | 'à', article: string): string {
  if (article === 'le') return prep === 'de' ? 'du' : 'au'
  if (article === 'les') return prep === 'de' ? 'des' : 'aux'
  return `${prep} ${article}`
}

/** Every gender/number reading of a noun or adjective form (élève: m or f; gris: singular or plural). */
function featuresOf(form: string, e: VocabEntry): Features[] {
  const lemma = cleanText(e.lemma).toLowerCase()
  if (e.pos === 'noun') {
    const out: Features[] = []
    const plurals = e.plural ? [cleanText(e.plural).toLowerCase()] : pluralize(lemma)
    const fem = e.feminine?.toLowerCase() ?? (e.gender === 'mf' && !/e$/.test(lemma) ? feminineOf(lemma) : undefined)
    const base: Gender = fem && fem !== lemma ? 'm' : (e.gender ?? 'mf')
    if (form === lemma) out.push({ gender: base, number: plurals.includes(lemma) ? 'any' : 'sg', role: 'noun' })
    if (fem && fem !== lemma) {
      if (form === fem) out.push({ gender: 'f', number: pluralize(fem).includes(fem) ? 'any' : 'sg', role: 'noun' })
      if (form !== fem && pluralize(fem).includes(form)) out.push({ gender: 'f', number: 'pl', role: 'noun' })
    }
    if (plurals.includes(form) && form !== lemma) out.push({ gender: base, number: 'pl', role: 'noun' })
    return out
  }
  if (e.pos === 'adj') return adjFeatures(form, lemma, e.feminine)
  return []
}

function adjFeatures(form: string, lemma: string, feminine?: string): Features[] {
  const role = 'adj'
  if (isInvariantAdjective(lemma)) return form === lemma ? [{ gender: 'mf', number: 'any', role }] : []
  const t = adjectiveTable(lemma, feminine)
  const out: Features[] = []
  const g: Gender = t.fsg === t.msg ? 'mf' : 'm'
  if (form === t.msg || form === PRENOMINAL_M[lemma]) out.push({ gender: g, number: t.mpl.includes(t.msg) ? 'any' : 'sg', role })
  if (form !== t.msg && t.mpl.includes(form)) out.push({ gender: g, number: 'pl', role })
  if (t.fsg !== t.msg) {
    if (form === t.fsg) out.push({ gender: 'f', number: t.fpl === t.fsg ? 'any' : 'sg', role })
    if (form === t.fpl && t.fpl !== t.fsg) out.push({ gender: 'f', number: 'pl', role })
  } else if (form === t.fpl && !t.mpl.includes(form)) out.push({ gender: 'mf', number: 'pl', role })
  return out
}

/** Readings of a participle form (allée: f sg; pris: m sg or pl). */
function participleFeatures(form: string, four: string[]): Features[] {
  const [msg, fsg, mpl, fpl] = four
  const out: Features[] = []
  if (form === msg) out.push({ gender: 'm', number: msg === mpl ? 'any' : 'sg', role: 'adj' })
  if (form === mpl && mpl !== msg) out.push({ gender: 'm', number: 'pl', role: 'adj' })
  if (form === fsg) out.push({ gender: 'f', number: 'sg', role: 'adj' })
  if (form === fpl) out.push({ gender: 'f', number: 'pl', role: 'adj' })
  return out
}

const ADVERBS_IN_NP = new Set(['très', 'si', 'plus', 'moins', 'assez', 'trop', 'aussi', 'vraiment', 'tellement', 'bien', 'fort', 'peu', 'extrêmement', 'super', 'vachement', 'tout'])
const SUBJECT_PRONOUNS: Record<string, number[]> = { je: [0], "j'": [0], tu: [1], il: [2], elle: [2], on: [2], nous: [3], vous: [4], ils: [5], elles: [5] }
/** Gender/number of a subject pronoun, for predicate agreement. */
const SUBJECT_FEATURES: Record<string, Features> = {
  je: { gender: 'mf', number: 'sg', role: 'noun' }, "j'": { gender: 'mf', number: 'sg', role: 'noun' }, tu: { gender: 'mf', number: 'sg', role: 'noun' },
  il: { gender: 'm', number: 'sg', role: 'noun' }, elle: { gender: 'f', number: 'sg', role: 'noun' }, on: { gender: 'mf', number: 'any', role: 'noun' },
  nous: { gender: 'mf', number: 'pl', role: 'noun' }, vous: { gender: 'mf', number: 'any', role: 'noun' }, ils: { gender: 'm', number: 'pl', role: 'noun' },
  elles: { gender: 'f', number: 'pl', role: 'noun' },
}
const CLITICS = new Set(['ne', "n'", 'me', "m'", 'te', "t'", 'se', "s'", 'le', 'la', 'les', "l'", 'lui', 'leur', 'y', 'en', 'nous', 'vous'])
const REFLEXIVE_CLITICS = new Set(['me', "m'", 'te', "t'", 'se', "s'"])
const PREPOSITIONS = new Set(['à', 'de', "d'", 'en', 'dans', 'sur', 'sous', 'avec', 'pour', 'par', 'chez', 'sans', 'vers', 'entre', 'contre', 'depuis', 'pendant', 'après', 'avant', 'devant', 'derrière', 'près', 'malgré', 'selon', 'parmi', 'envers', 'durant', 'au', 'aux', 'du', 'des', 'jusqu\'', 'comme'])
/** Words before a subject pronoun that make it something else (avec elle, Paul et elle, il nous parle). */
const SUBJECT_BLOCKERS = new Set([...PREPOSITIONS, 'et', 'ou', 'ni', ...Object.keys(SUBJECT_PRONOUNS), ...CLITICS, 'moi', 'toi', 'lui', 'eux', 'c\'', 'ce'])
/** Words after which a phrase starts a clause and can be its subject. */
const CLAUSE_OPENERS = new Set([
  'et', 'mais', 'ou', 'donc', 'car', 'que', "qu'", 'quand', 'lorsque', "lorsqu'", 'si', "s'", 'puisque', "puisqu'", 'parce', 'comme', 'puis', 'alors', 'ensuite',
  'enfin', 'où', 'pourquoi', 'comment', 'aujourd\'hui', 'hier', 'demain', 'maintenant', 'parfois', 'souvent', 'toujours', 'ici', 'là', 'oui', 'non', 'bon', 'bref',
])
const ADVERBS_IN_VP = new Set(['pas', 'plus', 'jamais', 'rien', 'bien', 'mal', 'déjà', 'encore', 'toujours', 'souvent', 'beaucoup', 'trop', 'vraiment', 'enfin', 'aussi', 'même', 'tout', 'peu', 'assez', 'presque', 'longtemps', 'point', 'guère', 'très', 'si', 'tellement', 'parfois', 'vite', 'tous', 'toutes', 'toute'])
const COLOUR_SHADES = new Set(['clair', 'foncé', 'vif', 'pâle', 'marine', 'ciel', 'pastel', 'électrique', 'turquoise'])
/** Parts of speech whose forms are not adjectives even when they look like one. */
const NOT_ATTRIBUTIVE = new Set(['adv', 'prep', 'conj'])
const ETRE_FORMS = new Set([
  'est', 'sont', 'suis', 'es', 'sommes', 'êtes', 'était', 'étaient', 'étais', 'étions', 'étiez', 'sera', 'seront', 'serai', 'seras', 'serons', 'serez',
  'serait', 'seraient', 'soit', 'soient', 'sois', 'soyons', 'soyez', 'fut', 'furent', 'semble', 'semblent', 'devient', 'deviennent', 'reste', 'restent',
  'paraît', 'paraissent', 'demeure', 'demeurent', 'été',
])
/** Accented words that are always correct as written even when the course dictionary lacks them. */
const ACCENTED_WORDS = new Set(['à', 'où', 'là', 'çà', 'ça', 'déjà', 'voilà', 'très', 'après', 'près', 'dès', 'même', 'peut-être', 'être', 'été', 'août', 'sûr', 'dû', 'là-bas', 'deçà', 'holà'])
/** Function words the course dictionary may lack. */
const FUNCTION_WORDS = new Set(['ci', 'là', 'y', 'en', 'ne', 'pas', 'de', 'que', 'qui', 'et', 'ou', 'ni', 'si', 'se', 'me', 'te', 'lui', 'eux', 'moi', 'toi', 'soi', 'est-ce'])
/** Common words written without their accent, for a suggestion when the dictionary lacks them. */
const ACCENT_FALLBACK: Record<string, string> = {
  tres: 'très', deja: 'déjà', apres: 'après', voila: 'voilà', ca: 'ça', etre: 'être', meme: 'même', francais: 'français', francaise: 'française',
  garcon: 'garçon', ecole: 'école', eleve: 'élève', ete: 'été', fenetre: 'fenêtre', foret: 'forêt', hopital: 'hôpital', noel: 'Noël', naif: 'naïf',
  bientot: 'bientôt', plutot: 'plutôt', aout: 'août', theatre: 'théâtre', cafe: 'café', telephone: 'téléphone', fete: 'fête', tete: 'tête',
  pere: 'père', mere: 'mère', frere: 'frère', lecon: 'leçon', recu: 'reçu', etudiant: 'étudiant', etudiante: 'étudiante', annee: 'année',
}

/** Auxiliary form → [auxiliary, tense, person]. */
type AuxTense = keyof (typeof AUXILIARY_FORMS)['avoir']
const AUX_INDEX = new Map<string, { aux: Aux; tense: AuxTense; person: number }[]>()
for (const aux of ['avoir', 'être'] as Aux[]) {
  for (const [tense, forms] of Object.entries(AUXILIARY_FORMS[aux]) as [AuxTense, string[]][]) {
    forms.forEach((f, person) => AUX_INDEX.set(f, [...(AUX_INDEX.get(f) ?? []), { aux, tense, person }]))
  }
}

export function check(text: string, deps: CheckerDeps): CheckerFinding[] {
  const findings: CheckerFinding[] = []
  const tokens = tokenize(text)
  const words = tokens.filter((t) => t.kind === 'word')
  const lw = words.map((t) => cleanText(t.text).toLowerCase())

  const plainIndex = getPlainIndex(deps.dict)
  const verbIndex = getVerbIndex(deps)
  const participles = getParticipleIndex(deps)
  /** All gender/number readings of each word, and its dictionary entries. */
  const cands: Features[][] = []
  const entriesOf: (VocabEntry[] | undefined)[] = []
  const dets: (Det | undefined)[] = []
  // a punctuation mark, hyphen or number between two words ends a phrase: "le taxi ! Tu es prête ?", "donne-le"
  const wordAt = tokens.map((t, k) => (t.kind === 'word' ? k : -1)).filter((k) => k >= 0)
  const between = (i: number) => (i + 1 < words.length ? tokens.slice(wordAt[i]! + 1, wordAt[i + 1]!) : [])
  const gap = words.map((_, i) => between(i).some((t) => t.kind !== 'space'))
  /** A hyphen (or the -t- of inversion) right before word i: parlez-vous, a-t-il, donne-le. */
  const hyphenBefore = (i: number) => i > 0 && between(i - 1).some((t) => /^[-‑]|^-t-$/.test(t.text))
  const setFeats = (i: number, form: string, es: VocabEntry[] | undefined) => {
    entriesOf[i] = es
    // a capitalised word is the name when there is one (la Corse); a lowercase one never is (le corse, les suisses)
    const cap = /^\p{Lu}/u.test(words[i]?.text ?? '')
    const names = (es ?? []).filter((x) => x.tags.includes('name'))
    const use = cap && names.length ? names : (es ?? []).filter((x) => !x.tags.includes('name'))
    const fs = use.flatMap((x) => featuresOf(form, x))
    const part = participles.get(form)
    if (part && !part.invariable && !fs.some((f) => f.role === 'adj')) fs.push(...participleFeatures(form, part.forms))
    cands[i] = fs
  }
  words.forEach((t, i) => {
    const w = lw[i]!
    dets[i] = detOf(w)
    const entries = lookup(deps.dict, w)
    setFeats(i, w, entries)
    // a / à, ou / où, la / là, sur / sûr: real words, but the context needs the accent
    const homo = accentHomophone(i)
    if (homo) {
      findings.push({ code: 'accent', message: homo.message, start: t.start, end: t.end, suggestion: homo.fix, grammar: 'g.accents' })
      return
    }
    if (entries) return
    if (dets[i] || w.endsWith("'") || ACCENTED_WORDS.has(w) || FUNCTION_WORDS.has(w)) return // function word not in the course dictionary
    if (verbIndex.has(w) || participles.has(w)) return // a verb form
    const capital = /^\p{Lu}/u.test(t.text)
    if (capital && i > 0) return // proper noun
    const plain = stripAccents(w)
    const candidates = plainIndex.get(plain)
    const fallback = ACCENT_FALLBACK[plain]
    if ((candidates && candidates.length) || (fallback && fallback !== w)) {
      const correct = candidates?.[0] ?? fallback!
      // a word ending in -é(e)(s) is usually a participle or adjective we lack (taillé, orangé), not a wrong accent
      const participleLike = /é(e?s?)$/.test(w) && !/é(e?s?)$/.test(correct)
      if (correct !== w && !participleLike) {
        findings.push({ code: 'accent', message: `Accent: “${t.text}” should be “${correct}”. ${explainAccent(correct)}`, start: t.start, end: t.end, suggestion: correct, grammar: 'g.accents' })
        setFeats(i, correct, deps.dict.get(correct))
      }
      return
    }
    if (capital) return // a capitalised first word we don't know is probably a name (Paris, Marie)
    const hyphenated = w.includes('-')
    if (w.length >= 4 && !hyphenated && !/(é|ée|és|ées|ie|is|ies|ue|us|ues)$/.test(w)) {
      const near = nearest(w, deps.dict, plainIndex)
      // a different ending is usually another form of a word we lack (amis/ami, petite/petit), not a typo
      if (near && !sameStem(near, w)) {
        findings.push({ code: 'spelling', message: `Spelling: did you mean “${near}”?`, start: t.start, end: t.end, suggestion: near })
        return
      }
    }
    if (i > 0 || words.length > 1) findings.push({ code: 'unknown', message: `“${t.text}” is not a word I know. Check the spelling or the dictionary.`, start: t.start, end: t.end })
  })

  /** a → à, ou → où, la → là, sur → sûr where only the accented word fits. */
  function accentHomophone(i: number): { fix: string; message: string } | undefined {
    const w = words[i]!.text
    const prev = i > 0 && !gap[i - 1] ? lw[i - 1] : undefined
    const next = !gap[i] ? lw[i + 1] : undefined
    const end = i + 1 >= words.length || gap[i]
    if (w === 'a' && !(next !== undefined && participles.has(next))) { // a eu, a fini: the verb avoir
      const prevIsVerb = prev !== undefined && verbIndex.has(prev) && !SUBJECT_PRONOUNS[prev] && !lookup(deps.dict, prev)?.some((e) => e.pos !== 'verb')
      const fixedBefore = prev !== undefined && A_AFTER.has(prev)
      const startPhrase = (prev === undefined || CLAUSE_OPENERS.has(prev)) && next !== undefined && A_BEFORE.has(next)
      if (prevIsVerb || fixedBefore || startPhrase || (prev !== undefined && AUX_INDEX.get(prev)?.some((h) => h.aux === 'avoir') && next !== undefined && verbIndex.has(next) && /(er|ir|re)$/.test(next))) {
        return { fix: 'à', message: '“à” (to, at, in) takes an accent; “a” without it is the verb “has” (il a).' }
      }
    }
    const l = lw[i]!
    if (l === 'ou') {
      if ((prev === "d'" || prev === "jusqu'" || prev === 'par') || ((prev === undefined || CLAUSE_OPENERS.has(prev)) && next !== undefined && OU_BEFORE.has(next))) {
        return { fix: 'où', message: '“où” (where) takes an accent; “ou” without it means “or”.' }
      }
    }
    if (l === 'la' && end && prev !== undefined && (ETRE_FORMS.has(prev) || prev === "c'" || prev === 'par' || prev === 'ici')) {
      return { fix: 'là', message: '“là” (there) takes an accent; “la” without it is “the” or “her”.' }
    }
    if (l === 'sur' && end && prev === 'bien') return { fix: 'sûr', message: '“bien sûr”: “sûr” (sure) takes a circumflex; “sur” means “on”.' }
    return undefined
  }

  // ---- elision: je aime → j'aime, ne ai → n'ai, que il → qu'il, si il → s'il, ce est → c'est, de eau → d'eau
  for (let i = 0; i + 1 < words.length; i++) {
    const w = lw[i]!
    const next = lw[i + 1]!
    if (gap[i] || hyphenBefore(i) || !ELIDABLE.has(w) || !elides(next)) continue
    if (w === 'si' && next !== 'il' && next !== 'ils') continue
    if (w === 'ce' && !/^(est|était|étaient|eût|en)$/.test(next)) continue // ce ami is an article problem (cet ami)
    // le/la before a noun or adjective is checked as an article (l'ami); here only the pronoun (je l'aime)
    if ((w === 'le' || w === 'la') && !(verbIndex.has(next) || AUX_INDEX.has(next) || next === 'y' || next === 'en')) continue
    if ((w === 'le' || w === 'la') && /^(un|une)$/.test(next)) continue
    const el = w === 'si' ? "s'" : w.slice(0, -1) + "'"
    findings.push({
      code: 'elision', message: `Elision: “${w}” becomes “${el}” before a vowel or a silent h (${ELISION_EXAMPLE[w] ?? `${el}${next}`}).`,
      start: words[i]!.start, end: words[i + 1]!.end, suggestion: `${el}${words[i + 1]!.text}`, grammar: 'g.elision',
    })
  }

  // ---- articles and agreement within noun phrases: det (adv)* adj* noun adj*
  const isAdjAt = (x: number) => x < words.length && !dets[x] && !SUBJECT_PRONOUNS[lw[x]!] && cands[x]!.some((f) => f.role === 'adj') && !entriesOf[x]?.some((e) => NOT_ATTRIBUTIVE.has(e.pos))
  const isNounAt = (x: number) => x < words.length && cands[x]!.some((f) => f.role === 'noun')
  /** A preposition at x: the word before it heads a phrase (plein de, prêt à, proche de). */
  const startsPhrase = (x: number) => x < words.length && !gap[x - 1] && PREPOSITIONS.has(lw[x]!)
  const agrees = (a: Features, b: Features) => (a.gender === 'mf' || b.gender === 'mf' || a.gender === b.gender) && (a.number === 'any' || b.number === 'any' || a.number === b.number)
  for (let i = 0; i < words.length; i++) {
    const d = dets[i]
    if (!d || gap[i] || hyphenBefore(i)) continue
    // fixed phrases that start with a determiner: tout à fait, tout le monde, du coup
    if ((entriesOf[i] ?? []).some((e) => e.pos === 'phrase' && lw.slice(i).join(' ').startsWith(cleanText(e.lemma).toLowerCase() + ' '))) continue
    // le, la, les, l', leur are also object pronouns (je la vois, je leur parle); tout, quel… also adverbs and pronouns
    if (d.kind === 'def' && /^(plus|moins)$/.test(lw[i + 1] ?? '')) continue // superlative: la plus calme
    if (/^une?$/.test(lw[i]!) && lw[i - 1] === 'et') continue // trente et un élèves
    const pronounLike = (d.kind === 'def' && !d.prep && /^(le|la|les|l')$/.test(lw[i]!)) || d.kind === 'other' || lw[i] === 'des'
    let j = i + 1
    const adjs: number[] = []
    while (j < words.length && j <= i + 3) {
      if (gap[j - 1]) break
      if (ADVERBS_IN_NP.has(lw[j]!) && !isNounAt(j)) {
        j++
        continue
      }
      // an adjective before the noun (un petit chat); a word that can be a noun is the noun unless a noun follows (le passé / le petit chat)
      // (participles come after the noun in French: "cette vue est" is not an adjective before "est")
      if (isAdjAt(j) && entriesOf[j]?.some((e) => e.pos === 'adj') && !(isNounAt(j) && !(isNounAt(j + 1) && !gap[j]))) {
        adjs.push(j)
        j++
        continue
      }
      break
    }
    if (j >= words.length || (j > i + 1 && gap[j - 1])) continue
    let noun = lw[j]!
    if (pronounLike && (verbIndex.has(noun) || AUX_INDEX.has(noun))) continue
    if (/^\p{Lu}/u.test(words[j]!.text) && !entriesOf[j]) continue // a name
    let nounC = cands[j]!.filter((f) => f.role === 'noun')
    // compound nouns: la salle de bains, le petit déjeuner, la pomme de terre
    for (const e of entriesOf[j] ?? []) {
      if (e.pos !== 'noun' || !e.lemma.includes(' ')) continue
      const sg = cleanText(e.lemma).toLowerCase()
      const pl = e.plural ? cleanText(e.plural).toLowerCase() : pluralize(sg)[0]!
      const parts = sg.split(' ')
      const here = lw.slice(j, j + parts.length).join(' ')
      if ((here !== sg && here !== pl) || gap.slice(j, j + parts.length - 1).some(Boolean)) continue
      nounC = [{ gender: e.gender ?? 'mf', number: here === sg && here === pl ? 'any' : here === sg ? 'sg' : 'pl', role: 'noun' }]
      noun = parts.join(' ')
      j += parts.length - 1
      break
    }
    if (!nounC.length) continue
    const next = lw[i + 1]!
    const nextText = words[i + 1]!.text
    // the determiner form depends on the next word, its gender and number on the noun (any reading that fits)
    const monAmie = (f: Features) => d.kind === 'poss' && d.gender === 'm' && f.gender === 'f' && f.number !== 'pl' && elides(next)
    const fits = (f: Features) => ((d.gender === 'mf' || f.gender === 'mf' || d.gender === f.gender) || monAmie(f)) && (f.number === 'any' || d.number === f.number)
    const nf = nounC.find(fits) ?? nounC[0]!
    let k = j + 1
    while (k < words.length && k <= j + 2 && !gap[k - 1]) {
      if (ADVERBS_IN_NP.has(lw[k]!) && isAdjAt(k + 1)) {
        k++
        continue
      }
      // bleu clair, vert foncé: colour compounds never agree; forms that are also verbs are skipped (la porte ferme)
      if (isAdjAt(k) && !verbIndex.has(lw[k]!) && !AUX_INDEX.has(lw[k]!) && !COLOUR_SHADES.has(lw[k + 1] ?? '') && !COLOUR_SHADES.has(lw[k]!) && !startsPhrase(k + 1)) {
        adjs.push(k)
        k++
        continue
      }
      break
    }
    // de + le → du, à + les → aux: a definite article after de / à
    const prepBefore = d.kind === 'def' && !d.prep && i > 0 && !gap[i - 1] && (lw[i - 1] === 'de' || lw[i - 1] === 'à') ? (lw[i - 1] as 'de' | 'à') : undefined
    const gOk = d.gender === 'mf' || nf.gender === 'mf' || d.gender === nf.gender || monAmie(nf)
    const nOk = nf.number === 'any' || d.number === nf.number
    const span = (from: number) => ({ start: words[from]!.start })
    if (!gOk || !nOk) {
      let fix = suggestDet(d, nf, next, lw[i]!)
      let from = i
      if (fix && prepBefore) {
        fix = articulate(prepBefore, fix)
        from = i - 1
      }
      findings.push({
        code: 'agreement', message: `Agreement: “${words[i]!.text} ${noun}”: the article/determiner must match the noun (${describe(nf)}).`,
        ...span(from), end: words[j]!.end, suggestion: fix, grammar: 'g.articles',
      })
    } else {
      const want = expectedForm(d, nf, next)
      // letter names (le e muet) and la une (the front page) keep le/la
      const keepsArticle = next.length === 1 || (next === 'une' && lw[i] === 'la')
      if (want && want !== lw[i] && !keepsArticle) {
        findings.push({
          code: 'article', message: `Article: “${want}”, not “${words[i]!.text}”, before “${nextText}”. ${articleRule(want, next)}`,
          start: words[i]!.start, end: words[i + 1]!.end, suggestion: want, grammar: 'g.articles',
        })
      } else if (prepBefore && (lw[i] === 'le' || lw[i] === 'les')) {
        const fused = articulate(prepBefore, lw[i]!)
        findings.push({
          code: 'article', message: `Contraction: “${prepBefore} ${lw[i]}” becomes “${fused}” (de + le = du, de + les = des, à + le = au, à + les = aux).`,
          start: words[i - 1]!.start, end: words[i]!.end, suggestion: fused, grammar: 'g.contractions',
        })
      }
    }
    for (const a of adjs) {
      if (noun === 'air' || noun === 'numéro') continue // avoir l'air fatiguée (agrees with the subject), le bus numéro 69
      const ac = cands[a]!.filter((f) => f.role === 'adj')
      if (!ac.length || ac.some((af) => nounC.some((n) => agrees(af, n)))) continue
      findings.push({
        code: 'agreement', message: `Agreement: “${words[a]!.text}” must agree with “${noun}” (${describe(nf)}).`,
        start: Math.min(words[a]!.start, words[j]!.start), end: Math.max(words[a]!.end, words[j]!.end), grammar: 'g.adjective-agreement',
      })
    }
    // predicate: la maison est blanc (only for a subject, not a noun after a preposition: la porte de la maison est ouverte)
    const clauseStart = (i === 0 || gap[i - 1] || CLAUSE_OPENERS.has(lw[i - 1]!)) && !prepBefore
    if (!d.prep && clauseStart) {
      let p = k
      if (p < words.length && !gap[p - 1] && (lw[p] === 'ne' || lw[p] === "n'")) p++
      // la fille et le garçon sont… / … et cette fille sont français: a coordinated subject is plural
      const coordinated = i > 0 && /^(et|ou|ni)$/.test(lw[i - 1]!) && AUX_INDEX.get(lw[p] ?? '')?.some((h) => h.person >= 3)
      if (p < words.length && !gap[p - 1] && ETRE_FORMS.has(lw[p]!) && !coordinated) {
        p++
        while (p < words.length && ADVERBS_IN_VP.has(lw[p]!) && !gap[p - 1]) p++
        const ac = p < words.length && !gap[p - 1] && isAdjAt(p) ? cands[p]!.filter((f) => f.role === 'adj') : []
        if (ac.length && !COLOUR_SHADES.has(lw[p + 1] ?? '') && !startsPhrase(p + 1)) {
          if (!ac.some((af) => nounC.some((n) => agrees(af, n)))) {
            findings.push({
              code: 'agreement', message: `Agreement: “${words[p]!.text}” describes “${noun}”, so it must be ${describe(nf)}.`,
              start: words[p]!.start, end: words[p]!.end, grammar: 'g.adjective-agreement',
            })
          }
        }
      }
    }
  }

  // ---- auxiliary in compound tenses: "j'ai allé" → "je suis allé", "il s'a lavé" → "il s'est lavé"
  for (let i = 0; i < words.length; i++) {
    const avoir = AUX_INDEX.get(lw[i]!)?.find((h) => h.aux === 'avoir')
    if (!avoir || gap[i]) continue
    let j = i + 1
    while (j < words.length && ADVERBS_IN_VP.has(lw[j]!) && !gap[j - 1]) j++
    if (j >= words.length || gap[j - 1]) continue
    const part = lw[j]!
    const verb = participles.get(part)
    if (!verb) continue
    const prev = i > 0 && !gap[i - 1] ? lw[i - 1] : undefined
    const prev2 = i > 1 && !gap[i - 2] ? lw[i - 2] : undefined
    const reflexive = prev === "s'" || prev === 'se' || ((prev === "m'" || prev === 'me') && (prev2 === 'je' || prev2 === "j'")) || ((prev === "t'" || prev === 'te') && prev2 === 'tu')
    if (!reflexive && verb.auxiliaries.includes('avoir')) continue
    if (!reflexive && lookup(deps.dict, part)?.some((e) => e.pos === 'noun' || e.pos === 'adj')) continue // il a tort, elle a mal
    const auxE = AUXILIARY_FORMS.être[avoir.tense][avoir.person]!
    const plural = avoir.person >= 3
    const agreed = plural && !/[sx]$/.test(part) ? part + 's' : part
    const middle = lw.slice(i + 1, j).join(' ')
    let start = i
    let prefix = ''
    if (reflexive) {
      start = i - 1
      prefix = elides(auxE) ? prev!.replace(/e$/, '').replace(/'?$/, "'") : prev!.replace(/'$/, 'e') + ' '
    } else if (prev === "n'") {
      start = i - 1
      prefix = elides(auxE) ? "n'" : 'ne '
      if (prev2 === "j'") {
        start = i - 2
        prefix = 'je ' + prefix
      }
    } else if (prev === "j'") {
      start = i - 1
      prefix = 'je '
    }
    const suggestion = `${prefix}${auxE}${middle ? ' ' + middle : ''} ${agreed}`
    findings.push({
      code: 'auxiliary',
      message: reflexive
        ? `Pronominal verbs form their compound tenses with être, not avoir: “${suggestion}”.`
        : `“${verb.lemma}” forms its compound tenses with être, not avoir: “${suggestion}” (the participle agrees with the subject). The DR MRS VANDERTRAMP verbs of motion and change of state (aller, venir, arriver, partir, naître, mourir, tomber, rester…) and all pronominal verbs take être.`,
      start: words[start]!.start, end: words[j]!.end, suggestion, grammar: 'g.passe-compose-etre',
    })
  }

  // ---- subject pronoun + être + adjective / participle: elle est allée, ils sont contents
  for (let i = 0; i < words.length; i++) {
    const sf = SUBJECT_FEATURES[lw[i]!]
    if (!sf || gap[i] || hyphenBefore(i)) continue
    if (i > 0 && !gap[i - 1] && SUBJECT_BLOCKERS.has(lw[i - 1]!)) continue
    if ((lw[i] === 'nous' || lw[i] === 'vous') && !(i === 0 || gap[i - 1] || CLAUSE_OPENERS.has(lw[i - 1]!))) continue
    let p = i + 1
    let reflexive = false
    while (p < words.length && !gap[p - 1] && CLITICS.has(lw[p]!)) {
      if (REFLEXIVE_CLITICS.has(lw[p]!) || ((lw[i] === 'nous' || lw[i] === 'vous') && lw[p] === lw[i])) reflexive = true
      p++
    }
    if (reflexive || p >= words.length || gap[p - 1]) continue
    const be = AUX_INDEX.get(lw[p]!)?.find((h) => h.aux === 'être')
    if (!be || !SUBJECT_PRONOUNS[lw[i]!]!.includes(be.person)) continue
    p++
    while (p < words.length && ADVERBS_IN_VP.has(lw[p]!) && !gap[p - 1]) p++
    if (p >= words.length || gap[p - 1] || dets[p]) continue
    const ac = isAdjAt(p) ? cands[p]!.filter((f) => f.role === 'adj') : []
    if (!ac.length || COLOUR_SHADES.has(lw[p + 1] ?? '') || ac.some((af) => agrees(af, sf))) continue
    findings.push({
      code: 'agreement', message: `Agreement: “${words[p]!.text}” describes “${words[i]!.text}”, so it must be ${describe(sf)}${participles.has(lw[p]!) ? ' (with être, the past participle agrees with the subject)' : ''}.`,
      start: words[p]!.start, end: words[p]!.end, suggestion: agreeTo(lw[p]!, sf, participles.get(lw[p]!)?.forms, entriesOf[p]), grammar: 'g.adjective-agreement',
    })
  }

  // ---- subject pronoun + verb person
  const agreesWith = (form: string, persons: number[]) => verbIndex.get(form)?.some((h) => persons.includes(h.person)) || AUX_INDEX.get(form)?.some((h) => persons.includes(h.person))
  for (let i = 0; i < words.length; i++) {
    const w = lw[i]!
    const persons = SUBJECT_PRONOUNS[w]
    if (!persons || gap[i]) continue
    if (hyphenBefore(i)) continue // inversion: parlez-vous, a-t-il, que fais-tu
    if (i > 0 && !gap[i - 1] && SUBJECT_BLOCKERS.has(lw[i - 1]!)) continue // avec elle, Paul et elle, il nous parle
    // nous / vous are subjects only at the start of a clause (Paul nous a vus: an object)
    if ((w === 'nous' || w === 'vous') && !(i === 0 || gap[i - 1] || CLAUSE_OPENERS.has(lw[i - 1]!))) continue
    // a subject after its verb: "dit-elle" is hyphenated; "Ainsi parlait-il"
    if (i > 0 && !gap[i - 1] && agreesWith(lw[i - 1]!, persons)) continue
    let j = i + 1
    while (j < words.length && CLITICS.has(lw[j]!) && !gap[j - 1]) j++
    const v = lw[j]
    if (!v || gap[j - 1]) continue
    const hits = verbIndex.get(v)
    const auxHits = AUX_INDEX.get(v)
    // nous / vous before a third-person verb are objects with the subject after: « Venez ! » nous dit la cavalière
    const invertedSubject = j + 1 < words.length && !gap[j] && (/^(le|la|les|l')$/.test(lw[j + 1]!) || /^\p{Lu}/u.test(words[j + 1]!.text))
    if (w === 'je' && v === 'vas') continue // Québec and familiar French: je vas
    const afterComma = i > 0 && between(i - 1).some((t) => t.text === ',')
    if ((w === 'nous' || w === 'vous') && (invertedSubject || afterComma) && (hits ?? auxHits ?? []).some((h) => h.person === 2 || h.person === 5)) continue
    let fix: string | undefined
    if (auxHits && auxHits.length) {
      if (auxHits.some((h) => persons.includes(h.person)) || hits?.some((h) => persons.includes(h.person))) continue
      const h = auxHits[0]!
      fix = AUXILIARY_FORMS[h.aux][h.tense][persons[0]!]
    } else if (hits && hits.length) {
      if (hits.some((h) => persons.includes(h.person))) continue
      const h = hits[0]!
      fix = conjugate(h.lemma, deps.verbs).forms[h.tense][persons[0]!] ?? undefined
    } else continue
    if (fix && v === fix) continue
    findings.push({
      code: 'verb-agreement', message: `“${words[i]!.text} ${words[j]!.text}”: the verb must agree with ${PERSONS[persons[0]!]}${fix ? ` → “${w === "j'" ? 'je' : w} ${fix}”` : ''}.`,
      start: words[i]!.start, end: words[j]!.end, suggestion: fix, grammar: 'g.subject-pronouns',
    })
  }

  // ---- learner-error rules
  const lower = cleanText(text).toLowerCase()
  for (const r of deps.rules) {
    let re: RegExp
    try {
      re = contentRegExp(r.pattern, 'giu')
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

/** Words before which a lowercase "a" must be the preposition à. */
const A_AFTER = new Set(["jusqu'", 'grâce', 'quant', 'face', 'rapport', 'merci', 'bienvenue', 'peu', 'suite', 'conformément', 'contrairement', 'jusque', 'mal'])
/** Words after which a sentence-initial "a" must be à (à demain, à bientôt, à côté). */
const A_BEFORE = new Set(['demain', 'bientôt', 'côté', 'cause', 'partir', 'droite', 'gauche', 'pied', 'travers', 'condition', 'cheval', 'vélo', 'plus', 'tout', 'la', "l'", 'quelle'])
/** Words after which a clause-initial "ou" must be où (où est, où vas-tu). */
const OU_BEFORE = new Set(['est', 'sont', 'était', 'étaient', 'es', 'êtes', 'sera', 'seront', 'vas', 'va', 'allez', 'vont', 'habites', 'habitez', 'habite', 'habitent', 'se', 'sommes', 'suis', 'travailles', 'travaillez', 'étais', 'étiez'])
const ELIDABLE = new Set(['je', 'me', 'te', 'se', 'le', 'la', 'ne', 'de', 'que', 'ce', 'si', 'jusque', 'lorsque', 'puisque'])
const ELISION_EXAMPLE: Record<string, string> = {
  je: "j'aime, j'habite", me: "je m'appelle", te: "tu t'appelles", se: "il s'appelle", le: "je l'aime", la: "je l'ai vue", ne: "je n'ai pas",
  de: "un verre d'eau", que: "qu'il, qu'elle", ce: "c'est", si: "s'il, s'ils (but si elle)",
}

/** The right form of a determiner for the noun and the next word (l'ami, cet homme, mon amie, du pain, de l'eau). */
function expectedForm(d: Det, nf: Features, next: string): string | undefined {
  const g: 'm' | 'f' = nf.gender === 'f' || (nf.gender === 'mf' && d.gender === 'f') ? 'f' : 'm'
  const n: 'sg' | 'pl' = nf.number === 'any' ? (d.number === 'pl' ? 'pl' : 'sg') : (nf.number as 'sg' | 'pl')
  if (d.kind === 'def') {
    const art = definiteArticle(g, n, next)
    return d.prep ? articulate(d.prep, art) : art
  }
  if (d.kind === 'indef') return indefiniteArticle(g, n)
  if (d.kind === 'dem') return demonstrative(g, n, next)
  if (d.kind === 'poss') return possessive(d.stem!, g, n, next)
  return undefined
}

function suggestDet(d: Det, nf: Features, next: string, given: string): string | undefined {
  if (nf.gender === 'mf' && nf.number === 'any') return undefined
  const gender = nf.gender === 'mf' ? d.gender : nf.gender
  const number = nf.number === 'any' ? d.number : nf.number
  if (d.kind === 'other') {
    const row = OTHER_FORMS.find((r) => r.includes(given))
    return row?.[(number === 'pl' ? 2 : 0) + (gender === 'f' ? 1 : 0)] || undefined
  }
  const forms: Det = { ...d, gender, number }
  return expectedForm(forms, { ...nf, gender, number }, next)
}

/** quel/quelle/quels/quelles, tout/toute/tous/toutes, aucun/aucune, certains/certaines. */
const OTHER_FORMS: string[][] = [['quel', 'quelle', 'quels', 'quelles'], ['tout', 'toute', 'tous', 'toutes'], ['aucun', 'aucune', '', ''], ['', '', 'certains', 'certaines']]

function articleRule(want: string, next: string): string {
  if (want === "l'" || want === "de l'" || want === "à l'") return `Before a vowel or a silent h, le and la become l' (l'ami, l'eau, l'hôtel).`
  if (want === 'le' || want === 'la') return `“${next}” starts with a consonant or an aspirated h, so there is no elision (le héros, la honte).`
  if (want === 'cet') return `Masculine words starting with a vowel or a silent h take cet (cet ami, cet hôtel).`
  if (want === 'ce') return `“cet” is only for masculine words starting with a vowel sound; before a consonant use ce (ce livre).`
  if (/^[mts]on$/.test(want)) return `Before a feminine word starting with a vowel, ma/ta/sa become ${want} (mon amie, ton école).`
  if (/^[mts]a$/.test(want)) return `“${want}”: feminine words starting with a consonant take ma/ta/sa.`
  return `Use “${want}” here.`
}

/** The form of an adjective or participle that agrees with a subject (contente, allés). */
function agreeTo(form: string, f: Features, four: string[] | undefined, entries: VocabEntry[] | undefined): string | undefined {
  let table = four
  if (!table) {
    const adj = entries?.find((e) => e.pos === 'adj')
    if (!adj) return undefined
    const t = adjectiveTable(cleanText(adj.lemma).toLowerCase(), adj.feminine)
    table = [t.msg, t.fsg, t.mpl[0]!, t.fpl]
  }
  if (f.gender === 'mf' || f.number === 'any' || !table.includes(form)) return undefined
  return table[(f.number === 'pl' ? 2 : 0) + (f.gender === 'f' ? 1 : 0)]
}

/** Short explanation of a French accent. */
export function explainAccent(word: string): string {
  if (word === 'à' || word === 'où' || word === 'là') return `The grave accent tells homophones apart: à (to) / a (has), où (where) / ou (or), là (there) / la (the).`
  if (/ç/.test(word)) return `The cedilla keeps c soft (like s) before a, o and u: ça, garçon, français, leçon, reçu.`
  if (/[ëïüÿ]/.test(word)) return `The diaeresis (tréma) means the vowel is pronounced on its own: Noël, naïf, maïs.`
  if (/[âêîôû]/.test(word)) return `The circumflex often marks an s that has disappeared (forêt ~ forest, hôpital ~ hospital, fête ~ feast).`
  if (/è/.test(word)) return `è (grave) is an open e, usually before a syllable with a silent e or a final s: père, très, élève, après.`
  if (/é/.test(word)) return `é (acute) is a closed e: été, café, école; the past participle of -er verbs ends in -é.`
  if (/[àù]/.test(word)) return `This word is written with a grave accent.`
  return ''
}

function describe(f: Features): string {
  const g = f.gender === 'm' ? 'masculine' : f.gender === 'f' ? 'feminine' : 'either gender'
  return `${g}, ${f.number === 'sg' ? 'singular' : f.number === 'pl' ? 'plural' : 'singular or plural'}`
}

/** Two forms of one word that differ only in a grammatical ending (ami/amie/amis, petit/petite, parle/parles/parlent). */
function sameStem(a: string, b: string): boolean {
  const strip = (w: string) => stripAccents(w).replace(/(es|e|s|x|nt|ent)$/, '')
  return strip(a) === strip(b) || a.startsWith(b) || b.startsWith(a)
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
/** Infinitives of the verbs in the dictionary (se lever → lever). */
function dictVerbs(dict: Dictionary): Set<string> {
  const out = new Set<string>()
  for (const entries of dict.values()) for (const e of entries) if (e.pos === 'verb') out.add(parseLemma(e.lemma).inf)
  return out
}

const verbIndexCache = new WeakMap<Dictionary, Map<string, VerbHit[]>>()
function getVerbIndex(deps: CheckerDeps): Map<string, VerbHit[]> {
  let idx = verbIndexCache.get(deps.dict)
  if (idx) return idx
  idx = new Map()
  for (const base of dictVerbs(deps.dict)) {
    let c
    try {
      c = conjugate(base, deps.verbs)
    } catch {
      continue
    }
    for (const [tense, forms] of Object.entries(c.forms) as [Tense, (string | null)[]][]) {
      if (tense === 'impAff' || tense === 'impNeg') continue
      forms.forEach((f, person) => {
        if (!f || f.includes(' ')) return // compound tenses are checked through the auxiliary itself
        const list = idx!.get(f) ?? []
        list.push({ lemma: base, tense, person })
        idx!.set(f, list)
      })
    }
  }
  verbIndexCache.set(deps.dict, idx)
  return idx
}

/** Participle form (all four) → verb, its auxiliaries and its four forms, for the verbs in the dictionary and the être verbs of the table. */
interface PartInfo {
  lemma: string
  auxiliaries: Aux[]
  forms: string[]
  invariable: boolean
}
const participleCache = new WeakMap<Dictionary, Map<string, PartInfo>>()
function getParticipleIndex(deps: CheckerDeps): Map<string, PartInfo> {
  let idx = participleCache.get(deps.dict)
  if (idx) return idx
  idx = new Map()
  const lemmas = dictVerbs(deps.dict)
  for (const [l, row] of deps.verbs) if (row.aux === 'être') lemmas.add(l)
  for (const l of lemmas) {
    let c
    try {
      c = conjugate(l, deps.verbs)
    } catch {
      continue
    }
    const forms = c.participles.length === 4 ? c.participles : participleForms(c.participle)
    const invariable = forms[0] === forms[1]
    for (const p of new Set(forms)) {
      const prev = idx.get(p)
      // a participle shared by two verbs (plu: plaire/pleuvoir) counts as avoir-compatible if either takes avoir
      if (prev) prev.auxiliaries = [...new Set([...prev.auxiliaries, ...c.auxiliaries])]
      else idx.set(p, { lemma: l, auxiliaries: [...c.auxiliaries], forms, invariable })
    }
  }
  participleCache.set(deps.dict, idx)
  return idx
}
