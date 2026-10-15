/**
 * Italian inflection: noun plurals, adjective forms and the full surface-form
 * dictionary used by the checker, the reader coverage meter and the content
 * checker. Pure: verb tables are passed in.
 */
import type { VocabEntry } from '../../engine/schema'
import type { ItVerb } from './schema'
import { conjugate, parseLemma, formsOf } from './conjugator'
import { apostropheAccents } from './normalize'

type Gender = 'm' | 'f' | 'mf'

/** Plurals that no rule gives (first spelling is the main one). */
export const IRREGULAR_PLURALS: Readonly<Record<string, string[]>> = {
  uomo: ['uomini'], dio: ['dei'], bue: ['buoi'], mano: ['mani'], ala: ['ali'], arma: ['armi'], moglie: ['mogli'],
  tempio: ['templi', 'tempi'], uovo: ['uova'], paio: ['paia'], centinaio: ['centinaia'], migliaio: ['migliaia'],
  braccio: ['braccia'], dito: ['dita'], labbro: ['labbra'], lenzuolo: ['lenzuola'], osso: ['ossa'],
  ginocchio: ['ginocchia', 'ginocchi'], orecchio: ['orecchie', 'orecchi'], ciglio: ['ciglia'], sopracciglio: ['sopracciglia'],
  miglio: ['miglia'], eco: ['echi'], superficie: ['superfici'], effigie: ['effigi'],
}

/** Nouns and adjectives that never change in the plural (besides accented, consonant-final and -i words). */
const INVARIANT: ReadonlySet<string> = new Set([
  'cinema', 'foto', 'moto', 'radio', 'auto', 'metro', 'euro', 'video', 'zoo', 'stereo', 'frigo', 'gorilla', 'boia',
  'sosia', 'vaglia', 'serie', 'specie', 'bici', 'vaglia', 'dinamo', 'tivù',
  // invariable adjectives (colours from nouns, pari/dispari…)
  'rosa', 'blu', 'viola', 'beige', 'lilla', 'ocra', 'fucsia', 'pari', 'dispari', 'perbene', 'avana', 'nocciola',
])

/** Masculine nouns in -a (problema → problemi). */
const MASC_A: ReadonlySet<string> = new Set([
  'problema', 'tema', 'sistema', 'programma', 'dramma', 'clima', 'schema', 'dilemma', 'diploma', 'enigma', 'panorama',
  'poema', 'teorema', 'trauma', 'telegramma', 'diagramma', 'emblema', 'lemma', 'stemma', 'dogma', 'carisma', 'prisma',
  'aroma', 'idioma', 'sisma', 'magma', 'paradigma', 'pianeta', 'poeta', 'profeta', 'papa', 'monarca', 'duca', 'pilota',
])

/** -co words with -chi although stressed on the third-last syllable, and -co words with -ci although not. */
const CO_CHI: ReadonlySet<string> = new Set(['ombelico', 'antico', 'fico', 'carico', 'incarico', 'scarico', 'valico', 'strascico', 'abbaco', 'dimentico'])
const CO_CI: ReadonlySet<string> = new Set(['greco', 'porco', 'sindaco', 'monaco', 'stomaco', 'equivoco', 'parroco'])
/** -logo things keep -ghi (dialoghi); -logo people take -gi (psicologi). */
const LOGO_GHI: ReadonlySet<string> = new Set(['dialogo', 'catalogo', 'monologo', 'prologo', 'epilogo', 'decalogo', 'analogo', 'omologo'])
/** -io with a stressed i: zio → zii. */
const STRESSED_IO: ReadonlySet<string> = new Set([
  'zio', 'invio', 'rinvio', 'addio', 'pendio', 'brusio', 'leggio', 'fruscio', 'mormorio', 'ronzio', 'pigolio', 'lavorio',
  'scintillio', 'calpestio', 'luccichio', 'cigolio', 'gorgoglio', 'rio', 'oblio', 'natio', 'restio', 'pio', 'gocciolio', 'brulichio',
])

const VOWELS = 'aeiou'
const ACCENTED_END = /[àèéìòùíóú]$/

/** Plural(s) of a noun or adjective. `gender` decides -a words (problema → problemi, casa → case). */
export function pluralize(word: string, opts: { gender?: Gender } = {}): string[] {
  const w = word.toLowerCase().trim()
  if (w.includes(' ')) {
    const [first, ...rest] = w.split(' ')
    return pluralize(first!, opts).map((p) => [p, ...rest].join(' '))
  }
  const irr = IRREGULAR_PLURALS[w]
  if (irr) return [...irr]
  if (INVARIANT.has(w) || ACCENTED_END.test(w) || !VOWELS.includes(w.slice(-1)) || w.length <= 2) return [w]
  if (w.endsWith('i') || w.endsWith('ie')) return [w] // crisi, analisi, specie
  const g = opts.gender
  const stem = w.slice(0, -1)
  const last = w.slice(-1)
  if (last === 'a') {
    const masc = g === 'm' || (g === undefined && MASC_A.has(w))
    const both = g === 'mf' || (g === undefined && /(ista|cida)$/.test(w))
    const fem = (s: string) => {
      if (/[cg]a$/.test(s)) return s.slice(0, -1) + 'he' // amica → amiche, collega → colleghe
      if (/[cg]ia$/.test(s)) {
        const before = s[s.length - 4] ?? ''
        // camicia → camicie, valigia → valigie; arancia → arance, spiaggia → spiagge; energia → energie (stressed i)
        if (VOWELS.includes(before) || /(ergia|algia|urgia|argia)$/.test(s)) return s.slice(0, -1) + 'e'
        return s.slice(0, -2) + 'e'
      }
      return s.slice(0, -1) + 'e'
    }
    const mascPl = (s: string) => (/[cg]a$/.test(s) ? s.slice(0, -1) + 'hi' : s.slice(0, -1) + 'i') // duca → duchi, collega → colleghi
    if (w === 'belga') return ['belgi', 'belghe']
    if (both) return [mascPl(w), fem(w)]
    return masc ? [mascPl(w)] : [fem(w)]
  }
  if (last === 'o') {
    if (g === 'f') return [w] // la radio, la foto (la mano is irregular)
    if (w.endsWith('io')) return STRESSED_IO.has(w) ? [stem + 'i'] : [stem]
    if (w.endsWith('co')) {
      if (CO_CHI.has(w)) return [stem + 'hi']
      if (CO_CI.has(w) || /iaco$/.test(w)) return [stem + 'i']
      if (w.endsWith('ico')) return [stem + 'i'] // amico → amici, medico → medici, simpatico → simpatici
      return [stem + 'hi'] // bianco → bianchi, gioco → giochi, parco → parchi
    }
    if (w.endsWith('go')) {
      if (w.endsWith('logo') && !LOGO_GHI.has(w) && w.length > 6) return [stem + 'i', stem + 'hi'] // psicologi
      if (w === 'asparago' || w.endsWith('fago')) return [stem + 'i']
      return [stem + 'hi'] // lago → laghi, albergo → alberghi
    }
    return [stem + 'i']
  }
  if (last === 'e') return [stem + 'i'] // studente → studenti, chiave → chiavi
  return [w]
}

/** Adjectives with shortened / elided forms before nouns. */
const IRREGULAR_ADJ: Readonly<Record<string, string[]>> = {
  bello: ['bello', 'bel', "bell'", 'bella', 'belli', 'bei', 'begli', 'belle'],
  buono: ['buono', 'buon', "buon'", 'buona', 'buoni', 'buone'],
  quello: ['quello', 'quel', "quell'", 'quella', 'quelli', 'quei', 'quegli', 'quelle'],
  questo: ['questo', "quest'", 'questa', 'questi', 'queste'],
  grande: ['grande', 'gran', "grand'", 'grandi'],
  santo: ['santo', 'san', "sant'", 'santa', 'santi', 'sante'],
  nessuno: ['nessuno', 'nessun', "nessun'", 'nessuna'],
  alcuno: ['alcuno', 'alcun', "alcun'", 'alcuna', 'alcuni', 'alcune'],
  ciascuno: ['ciascuno', 'ciascun', "ciascun'", 'ciascuna'],
  uno: ['uno', 'un', "un'", 'una'],
}

/** Gender/number forms of an adjective (or a noun with a feminine: amico → amica, amici, amiche). */
export function adjectiveForms(lemma: string, opts: { feminine?: string } = {}): string[] {
  const w = lemma.toLowerCase().trim()
  const special = IRREGULAR_ADJ[w]
  if (special) return [...special]
  const out = new Set<string>([w])
  if (w.includes(' ')) return [...out]
  const add = (f: string, g: Gender) => {
    out.add(f)
    for (const p of pluralize(f, { gender: g })) out.add(p)
  }
  if (INVARIANT.has(w) || ACCENTED_END.test(w) || !VOWELS.includes(w.slice(-1))) return [...out]
  let fem = opts.feminine?.toLowerCase()
  if (!fem && w.endsWith('o')) fem = w.slice(0, -1) + 'a'
  if (!fem && w.endsWith('tore')) fem = w.slice(0, -4) + 'trice'
  if (w.endsWith('a') && !fem) {
    for (const p of pluralize(w, { gender: 'mf' })) out.add(p) // ottimista → ottimisti, ottimiste
    return [...out]
  }
  add(w, 'm')
  if (fem && fem !== w) add(fem, 'f')
  return [...out]
}

/** Elided forms of function words (lo → l', una → un', ci → c', dove → dov'). */
export const ELISIONS: Readonly<Record<string, string>> = {
  lo: "l'", la: "l'", una: "un'", questo: "quest'", questa: "quest'", quello: "quell'", quella: "quell'",
  bello: "bell'", bella: "bell'", dello: "dell'", della: "dell'", allo: "all'", alla: "all'", dallo: "dall'", dalla: "dall'",
  nello: "nell'", nella: "nell'", sullo: "sull'", sulla: "sull'", buona: "buon'", nessuna: "nessun'", alcuna: "alcun'",
  santo: "sant'", santa: "sant'", ci: "c'", mi: "m'", ti: "t'", si: "s'", vi: "v'", ne: "n'", di: "d'",
  dove: "dov'", come: "com'", cosa: "cos'", anche: "anch'", quando: "quand'", senza: "senz'", mezzo: "mezz'", mezza: "mezz'",
  tutto: "tutt'", tutta: "tutt'", grande: "grand'",
}
const ELIDED_BASES: Map<string, string[]> = new Map()
for (const [full, el] of Object.entries(ELISIONS)) ELIDED_BASES.set(el, [...(ELIDED_BASES.get(el) ?? []), full])
ELIDED_BASES.set("l'", ['lo', 'la', 'il'])
ELIDED_BASES.set("un'", ['una', 'uno', 'un'])
ELIDED_BASES.set("qual'", ['quale'])
ELIDED_BASES.set("po'", ['poco'])
for (const p of ['dell', 'all', 'dall', 'nell', 'sull']) {
  const prep = { dell: 'di', all: 'a', dall: 'da', nell: 'in', sull: 'su' }[p]!
  ELIDED_BASES.get(`${p}'`)!.push(prep)
}

/** Words of a phrase as the tokenizer and the tile builder see them (c'è → c'è, c', è). */
function phraseWords(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toLowerCase().replace(/’/g, "'").split(/\s+/)) {
    const w = raw.replace(/[¿?¡!.,;:"“”«»()]/g, '')
    if (!w) continue
    out.push(w)
    const k = w.lastIndexOf("'")
    if (k > 0 && k < w.length - 1) out.push(w.slice(0, k + 1), w.slice(k + 1))
  }
  return out
}

/** Every surface form a learner may meet for a vocabulary entry (lowercase). */
export function inflections(entry: VocabEntry, verbs: ReadonlyMap<string, ItVerb>): string[] {
  const lemma = entry.lemma.toLowerCase().replace(/’/g, "'")
  const out = new Set<string>([lemma])
  if (entry.forms) for (const f of entry.forms) out.add(f.toLowerCase().replace(/’/g, "'"))
  switch (entry.pos) {
    case 'noun': {
      if (entry.plural) out.add(entry.plural.toLowerCase())
      else for (const p of pluralize(lemma, { gender: entry.gender })) out.add(p)
      if (entry.gender === 'mf' || entry.feminine || entry.tags.includes('nationality')) {
        for (const f of adjectiveForms(lemma, { feminine: entry.feminine })) out.add(f)
      }
      break
    }
    case 'adj': {
      if (entry.plural) out.add(entry.plural.toLowerCase())
      for (const f of adjectiveForms(lemma, { feminine: entry.feminine })) out.add(f)
      break
    }
    case 'det':
    case 'pron':
    case 'num': {
      if (!entry.forms && (lemma.endsWith('o') || IRREGULAR_ADJ[lemma])) for (const f of adjectiveForms(lemma)) out.add(f)
      break
    }
    case 'verb': {
      const [head, ...rest] = lemma.split(' ')
      try {
        const c = conjugate(parseLemma(head!).inf, verbs)
        for (const f of formsOf(c)) out.add(f)
        out.add(head!)
        for (const r of rest) out.add(r)
      } catch {
        /* not conjugable (e.g. a phrase tagged as a verb) */
      }
      break
    }
    case 'phrase': {
      for (const w of phraseWords(lemma)) out.add(w)
      break
    }
    default:
      break
  }
  for (const f of [...out]) {
    const el = ELISIONS[f]
    if (el && entry.pos !== 'verb') out.add(el)
  }
  out.delete('')
  return [...out]
}

export type Dictionary = Map<string, VocabEntry[]>

/** Build form -> entries index. Phrases also register their words. */
export function buildDictionary(entries: Iterable<VocabEntry>, verbs: ReadonlyMap<string, ItVerb>): Dictionary {
  const dict: Dictionary = new Map()
  for (const e of entries) {
    for (const f of inflections(e, verbs)) {
      const list = dict.get(f)
      if (list) {
        if (!list.includes(e)) list.push(e)
      } else dict.set(f, [e])
    }
  }
  return dict
}

/** Pronouns that attach to the end of a verb, longest first. */
const FINAL_CLITICS = ['gli', 'mi', 'ti', 'si', 'ci', 'vi', 'lo', 'la', 'li', 'le', 'ne']
/** First pronoun of a cluster (me lo → -melo, glielo, -sene). */
const FIRST_CLITICS = ['glie', 'me', 'te', 'se', 'ce', 've']

const isVerb = (es: VocabEntry[] | undefined) => (es && es.some((e) => e.pos === 'verb') ? es : undefined)

/** Verb form before attached pronouns: parlar(e), facendo, alza, di' (dimmi), fa' (fallo). */
function hostLookup(dict: Dictionary, host: string, clitic: string): VocabEntry[] | undefined {
  if (host === 'ecco') return dict.get('ecco')
  if (host.endsWith('r')) return isVerb(dict.get(host + 'e')) ?? isVerb(dict.get(host + 're'))
  const direct = isVerb(dict.get(host)) ?? isVerb(dict.get(host + "'")) // alza-ti, da'-gli
  if (direct) return direct
  // dimmi, fallo, dammelo, vattene: monosyllabic imperative + doubled consonant
  if (!clitic.startsWith('gli') && host.length >= 3 && host.endsWith(clitic[0]!) && host[host.length - 2] !== clitic[0]) {
    const short = host.slice(0, -1)
    return isVerb(dict.get(short + "'")) ?? isVerb(dict.get(short))
  }
  return undefined
}

/**
 * Dictionary lookup that also understands Italian spelling: attached pronouns
 * (dimmi, parlarle, dammelo, alzati, comprarlo, facendolo, vederci, andarsene),
 * elisions ("l'", "dell'", "c'", or "l'amico" as one string) and accents typed
 * as apostrophes ("perche'").
 */
export function lookup(dict: Dictionary, form: string): VocabEntry[] | undefined {
  const w = form.toLowerCase().replace(/’/g, "'")
  const direct = dict.get(w)
  if (direct) return direct
  const accented = apostropheAccents(w)
  if (accented !== w) return dict.get(accented)
  if (w.endsWith("'")) {
    const bases = ELIDED_BASES.get(w) ?? ['o', 'a', 'e', 'i', ''].map((v) => w.slice(0, -1) + v)
    for (const b of bases) {
      const hit = dict.get(b)
      if (hit) return hit
    }
    return undefined
  }
  const k = w.lastIndexOf("'")
  if (k > 0 && k < w.length - 1) return lookup(dict, w.slice(k + 1))
  for (const c1 of FINAL_CLITICS) {
    if (!w.endsWith(c1) || w.length - c1.length < 2) continue
    const host = w.slice(0, -c1.length)
    const hit = hostLookup(dict, host, c1)
    if (hit) return hit
    if (!['lo', 'la', 'li', 'le', 'ne'].includes(c1)) continue
    for (const c0 of FIRST_CLITICS) {
      if (!host.endsWith(c0) || host.length - c0.length < 2) continue
      const hit2 = hostLookup(dict, host.slice(0, -c0.length), c0)
      if (hit2) return hit2
    }
  }
  return undefined
}
