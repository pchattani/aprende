/**
 * French inflection: noun plurals, adjective genders and plurals, and the full
 * surface-form dictionary used by the checker, the reader coverage meter and the
 * content checker. Pure: verb tables are passed in.
 */
import type { VocabEntry } from '../../engine/schema'
import type { FrVerb } from './schema'
import { conjugate, parseLemma, formsOf } from './conjugator'
import { cleanText } from './normalize'

type Gender = 'm' | 'f' | 'mf'

/** Plurals that no rule gives (first spelling is the main one). */
export const IRREGULAR_PLURALS: Readonly<Record<string, string[]>> = {
  œil: ['yeux'], oeil: ['yeux'], ciel: ['cieux', 'ciels'], aïeul: ['aïeux', 'aïeuls'], monsieur: ['messieurs'], madame: ['mesdames'],
  mademoiselle: ['mesdemoiselles'], bonhomme: ['bonshommes'], gentilhomme: ['gentilshommes'], travail: ['travaux'], vitrail: ['vitraux'],
  corail: ['coraux'], émail: ['émaux'], bail: ['baux'], soupirail: ['soupiraux'], vantail: ['vantaux'], ail: ['aulx', 'ails'],
  'week-end': ['week-ends'], 'après-midi': ['après-midi', 'après-midis'], 'grand-mère': ['grands-mères', 'grand-mères'],
  'grand-père': ['grands-pères'], 'petit-enfant': ['petits-enfants'], 'petit-fils': ['petits-fils'], 'petite-fille': ['petites-filles'],
  'chou-fleur': ['choux-fleurs'], 'porte-monnaie': ['porte-monnaie', 'porte-monnaies'], 'gratte-ciel': ['gratte-ciel', 'gratte-ciels'],
  'arc-en-ciel': ['arcs-en-ciel'], 'hors-d’œuvre': ['hors-d’œuvre'], "hors-d'œuvre": ["hors-d'œuvre"], 'timbre-poste': ['timbres-poste'],
}

/** -al nouns and adjectives with -als (bals, festivals, banals, finals). */
const AL_S: ReadonlySet<string> = new Set([
  'bal', 'carnaval', 'chacal', 'festival', 'récital', 'régal', 'cal', 'narval', 'cérémonial', 'pal', 'val', 'étal', 'aval', 'choral', 'gavial',
  'rorqual', 'serval', 'sisal', 'banal', 'bancal', 'fatal', 'final', 'natal', 'naval', 'causal', 'tonal', 'chorals',
])
/** -al adjectives with both plurals (idéaux / idéals). */
const AL_BOTH: ReadonlySet<string> = new Set(['idéal', 'glacial', 'austral', 'boréal', 'estival', 'jovial', 'pascal', 'banal'])
/** -au / -eu words with -s (pneus, bleus, landaus). */
const EU_S: ReadonlySet<string> = new Set(['pneu', 'bleu', 'émeu', 'landau', 'sarrau', 'enfeu', 'lieu-dit'])
/** -ou words with -x. */
const OU_X: ReadonlySet<string> = new Set(['bijou', 'caillou', 'chou', 'genou', 'hibou', 'joujou', 'pou', 'ripou'])
/** Words that never change in the plural (besides those in -s, -x, -z). */
const INVARIANT: ReadonlySet<string> = new Set(['rendez-vous', 'gratte-ciel', 'porte-monnaie', 'sans-abri', 'compte-rendu', 'appui-tête'])

/** Colour words and other adjectives that never change (une veste marron, des chaussures orange). */
const INVARIANT_ADJ: ReadonlySet<string> = new Set([
  'marron', 'orange', 'chic', 'kaki', 'cerise', 'crème', 'olive', 'turquoise', 'émeraude', 'ocre', 'saumon', 'moutarde', 'citron', 'bordeaux',
  'sable', 'abricot', 'champagne', 'prune', 'framboise', 'pêche', 'lavande', 'noisette', 'caramel', 'chocolat', 'corail', 'ivoire', 'indigo',
  'safran', 'paille', 'super', 'cool', 'standard', 'snob', 'sexy', 'bon marché', 'marine', 'pastel', 'fuchsia', 'nature', 'bio', 'extra',
])
export const isInvariantAdjective = (w: string): boolean => INVARIANT_ADJ.has(w) || w.includes(' ')

const PREPOSITIONS: ReadonlySet<string> = new Set(['de', "d'", 'à', 'au', 'aux', 'en', 'du', 'des', 'pour', 'sans', 'sur', 'sous', 'après', 'avant', 'contre', 'entre', 'par', 'hors'])
/** First parts of hyphenated compounds that are verbs or invariable: only the last part takes -s (porte-clés, tire-bouchons). */
const COMPOUND_HEAD_FIXED = /^(porte|garde|tire|ouvre|lave|sèche|casse|coupe|essuie|presse|gratte|chauffe|abat|pare|brise|couvre|cure|lance|passe|pique|presse|sous|sur|après|avant|contre|entre|hors|non|demi|semi|mi|vice|ex|néo|anti|pseudo|mini|maxi|super|arrière|haut-parleur)$/

/** Plural of one simple word. */
function pluralWord(w: string): string[] {
  const irr = IRREGULAR_PLURALS[w]
  if (irr) return [...irr]
  if (INVARIANT.has(w) || /[sxz]$/.test(w)) return [w]
  if (w.endsWith('al')) {
    if (AL_BOTH.has(w)) return [w.slice(0, -2) + 'aux', w + 's']
    return AL_S.has(w) ? [w + 's'] : [w.slice(0, -2) + 'aux']
  }
  if (/(au|eau|eu|œu)$/.test(w)) return EU_S.has(w) ? [w + 's'] : [w + 'x']
  if (w.endsWith('ou')) return OU_X.has(w) ? [w + 'x'] : [w + 's']
  return [w + 's']
}

/**
 * Plural(s) of a noun or adjective: livre → livres, cheval → chevaux, bal → bals,
 * bateau → bateaux, pneu → pneus, bijou → bijoux, prix → prix, œil → yeux.
 * In compounds every word before a preposition is pluralised (pommes de terre,
 * cartes postales, arcs-en-ciel, grands-mères); after a verb or an invariable
 * first part only the last word is (porte-clés, sous-sols).
 */
export function pluralize(word: string, _opts: { gender?: Gender } = {}): string[] {
  const w = cleanText(word).toLowerCase().trim()
  const irr = IRREGULAR_PLURALS[w]
  if (irr) return [...irr]
  if (INVARIANT.has(w)) return [w]
  const parts = w.split(/([ -])/)
  if (parts.length === 1) return pluralWord(w)
  const words = parts.filter((_, k) => k % 2 === 0)
  const seps = parts.filter((_, k) => k % 2 === 1)
  let plural: string[]
  if (seps[0] === '-' && COMPOUND_HEAD_FIXED.test(words[0]!)) plural = words.map((x, k) => (k === words.length - 1 ? pluralWord(x)[0]! : x))
  else {
    let stop = false
    plural = words.map((x) => {
      if (stop || PREPOSITIONS.has(x) || x.includes("'")) {
        stop = true
        return x
      }
      return pluralWord(x)[0]!
    })
  }
  return [plural.map((x, k) => x + (seps[k] ?? '')).join('')]
}

/** Masculine forms used before a vowel (un bel homme, un nouvel ami, un vieil ami, un fol espoir, un mol oreiller). */
export const PRENOMINAL_M: Readonly<Record<string, string>> = { beau: 'bel', nouveau: 'nouvel', vieux: 'vieil', fou: 'fol', mou: 'mol' }
/** Feminines that no rule gives. */
const IRREGULAR_FEM: Readonly<Record<string, string>> = {
  beau: 'belle', nouveau: 'nouvelle', vieux: 'vieille', fou: 'folle', mou: 'molle', blanc: 'blanche', franc: 'franche', sec: 'sèche',
  frais: 'fraîche', long: 'longue', oblong: 'oblongue', doux: 'douce', faux: 'fausse', roux: 'rousse', gentil: 'gentille', nul: 'nulle',
  bas: 'basse', gras: 'grasse', las: 'lasse', épais: 'épaisse', gros: 'grosse', exprès: 'expresse', public: 'publique', turc: 'turque',
  grec: 'grecque', malin: 'maligne', bénin: 'bénigne', favori: 'favorite', coi: 'coite', tiers: 'tierce', andalou: 'andalouse',
  aigu: 'aiguë', ambigu: 'ambiguë', exigu: 'exiguë', contigu: 'contiguë', paysan: 'paysanne', jaloux: 'jalouse', vieillot: 'vieillotte',
  sot: 'sotte', pâlot: 'pâlotte', bref: 'brève', complet: 'complète', incomplet: 'incomplète', concret: 'concrète', discret: 'discrète',
  indiscret: 'indiscrète', inquiet: 'inquiète', secret: 'secrète', désuet: 'désuète', replet: 'replète', meilleur: 'meilleure',
  supérieur: 'supérieure', inférieur: 'inférieure', extérieur: 'extérieure', intérieur: 'intérieure', majeur: 'majeure', mineur: 'mineure',
  antérieur: 'antérieure', postérieur: 'postérieure', ultérieur: 'ultérieure', enchanteur: 'enchanteresse', vengeur: 'vengeresse',
  pécheur: 'pécheresse', chanteur: 'chanteuse', menteur: 'menteuse', porteur: 'porteuse', acheteur: 'acheteuse', serveur: 'serveuse',
  vendeur: 'vendeuse', danseur: 'danseuse', chasseur: 'chasseuse', docteur: 'docteure', auteur: 'autrice', professeur: 'professeure',
  copain: 'copine', roi: 'reine', héros: 'héroïne', prince: 'princesse', comte: 'comtesse', maître: 'maîtresse', hôte: 'hôtesse',
  dieu: 'déesse', neveu: 'nièce', oncle: 'tante', frère: 'sœur', père: 'mère', fils: 'fille', homme: 'femme', mari: 'femme', garçon: 'fille',
  compagnon: 'compagne', loup: 'louve', chat: 'chatte', chien: 'chienne', lion: 'lionne', canard: 'cane', coq: 'poule', cheval: 'jument',
}

/** Feminine of an adjective or of a noun that has one (heureux → heureuse, actif → active, cher → chère, ancien → ancienne). */
export function feminineOf(word: string): string {
  const w = word.toLowerCase().trim()
  const irr = IRREGULAR_FEM[w]
  if (irr) return irr
  if (/[^éè]e$/.test(w) || w.endsWith('ë')) return w // rouge, jeune, facile
  if (w.endsWith('eux')) return w.slice(0, -1) + 'se'
  if (/(at|ct)eur$/.test(w)) return w.slice(0, -3) + 'rice' // créateur → créatrice, directeur → directrice
  if (w.endsWith('eur')) return w.slice(0, -1) + 'se' // travailleur → travailleuse
  if (w.endsWith('if')) return w.slice(0, -1) + 've'
  if (w.endsWith('f')) return w.slice(0, -1) + 've' // neuf → neuve
  if (w.endsWith('er')) return w.slice(0, -2) + 'ère' // cher → chère, premier → première
  if (/(el|eil)$/.test(w)) return w + 'le' // naturel → naturelle, pareil → pareille
  if (/(en|on)$/.test(w)) return w + 'ne' // ancien → ancienne, bon → bonne
  if (w.endsWith('et')) return w + 'te' // muet → muette
  if (w.endsWith('x')) return w.slice(0, -1) + 'se'
  return w + 'e' // petit → petite, grand → grande, gris → grise, fini → finie, aimé → aimée
}

/** Gender/number forms of an adjective (or a noun with a feminine: ami → amie, amis, amies). */
export function adjectiveForms(lemma: string, opts: { feminine?: string } = {}): string[] {
  const w = cleanText(lemma).toLowerCase().trim()
  if (isInvariantAdjective(w)) return [w]
  const out = new Set<string>([w, ...pluralize(w)])
  const fem = opts.feminine?.toLowerCase() ?? feminineOf(w)
  out.add(fem)
  out.add(fem + (/[sx]$/.test(fem) ? '' : 's'))
  const pre = PRENOMINAL_M[w]
  if (pre) out.add(pre)
  if (AL_BOTH.has(w)) out.add(w + 's')
  return [...out]
}

/** The four forms m sg, f sg, m pl, f pl of an adjective ('' when a form is the same as another reading). */
export function adjectiveTable(lemma: string, feminine?: string): { msg: string; fsg: string; mpl: string[]; fpl: string } {
  const w = lemma.toLowerCase().trim()
  const fsg = feminine?.toLowerCase() ?? feminineOf(w)
  const mpl = pluralize(w)
  if (AL_BOTH.has(w) && !mpl.includes(w + 's')) mpl.push(w + 's')
  return { msg: w, fsg, mpl, fpl: fsg + (/[sx]$/.test(fsg) ? '' : 's') }
}

/** Forms of common determiners and pronouns that vary (when the vocabulary entry gives none). */
const DET_FORMS: Readonly<Record<string, string[]>> = {
  le: ['le', 'la', "l'", 'les'], la: ['le', 'la', "l'", 'les'], les: ['le', 'la', "l'", 'les'], un: ['un', 'une'], une: ['un', 'une'],
  ce: ['ce', 'cet', 'cette', 'ces'], cet: ['ce', 'cet', 'cette', 'ces'], cette: ['ce', 'cet', 'cette', 'ces'],
  mon: ['mon', 'ma', 'mes'], ton: ['ton', 'ta', 'tes'], son: ['son', 'sa', 'ses'], notre: ['notre', 'nos'], votre: ['votre', 'vos'], leur: ['leur', 'leurs'],
  quel: ['quel', 'quelle', 'quels', 'quelles'], tout: ['tout', 'toute', 'tous', 'toutes'], aucun: ['aucun', 'aucune'], nul: ['nul', 'nulle'],
  certain: ['certain', 'certaine', 'certains', 'certaines'], autre: ['autre', 'autres'], même: ['même', 'mêmes'], quelque: ['quelque', 'quelques'],
  du: ['du', 'de la', "de l'", 'des', 'de'], lequel: ['lequel', 'laquelle', 'lesquels', 'lesquelles'], celui: ['celui', 'celle', 'ceux', 'celles'],
  mien: ['mien', 'mienne', 'miens', 'miennes'], tien: ['tien', 'tienne', 'tiens', 'tiennes'], sien: ['sien', 'sienne', 'siens', 'siennes'],
  tel: ['tel', 'telle', 'tels', 'telles'], "quelqu'un": ["quelqu'un", "quelqu'une", "quelques-uns", "quelques-unes"],
}

/** Elided forms of function words (le → l', je → j', que → qu', si → s' before il). */
export const ELISIONS: Readonly<Record<string, string>> = {
  le: "l'", la: "l'", je: "j'", me: "m'", te: "t'", se: "s'", ne: "n'", de: "d'", que: "qu'", ce: "c'", ça: "ç'", si: "s'",
  jusque: "jusqu'", lorsque: "lorsqu'", puisque: "puisqu'", quoique: "quoiqu'", presque: "presqu'", quelque: "quelqu'",
}
const ELIDED_BASES: Map<string, string[]> = new Map()
for (const [full, el] of Object.entries(ELISIONS)) ELIDED_BASES.set(el, [...(ELIDED_BASES.get(el) ?? []), full])
ELIDED_BASES.set("t'", ['te', 'toi', 'tu'])
ELIDED_BASES.set("m'", ['me', 'moi'])
ELIDED_BASES.set("c'", ['ce', 'ça', 'cela'])
/** Prefixes that are elided function words (l'ami → ami). */
const ELISION_HEAD = /^(jusqu|lorsqu|puisqu|quoiqu|qu|l|j|c|ç|d|n|s|m|t)'(.+)$/

/** Words of a phrase as the tokenizer and the tile builder see them (s'il vous plaît → s'il, s', il, vous, plaît). */
function phraseWords(text: string): string[] {
  const out: string[] = []
  for (const raw of cleanText(text).toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[¿?¡!.,;:"“”«»()]/g, '')
    if (!w) continue
    out.push(w)
    for (const part of w.split('-')) {
      if (!part) continue
      out.push(part)
      const m = ELISION_HEAD.exec(part)
      if (m) out.push(part.slice(0, part.indexOf("'") + 1), m[2]!)
    }
  }
  return out
}

/** Every surface form a learner may meet for a vocabulary entry (lowercase). */
export function inflections(entry: VocabEntry, verbs: ReadonlyMap<string, FrVerb>): string[] {
  const lemma = cleanText(entry.lemma).toLowerCase()
  const out = new Set<string>([lemma])
  if (entry.forms) for (const f of entry.forms) out.add(cleanText(f).toLowerCase())
  switch (entry.pos) {
    case 'noun': {
      if (entry.plural) out.add(cleanText(entry.plural).toLowerCase())
      else for (const p of pluralize(lemma, { gender: entry.gender })) out.add(p)
      const hasFem = entry.feminine || entry.tags.includes('nationality') || (entry.gender === 'mf' && !/e$/.test(lemma))
      if (hasFem) for (const f of adjectiveForms(lemma, { feminine: entry.feminine })) out.add(f)
      // pomme de terre: its words too (pommes, de, terre), so the tokens of the compound are known
      if (lemma.includes(' ')) for (const f of [...out]) for (const w of phraseWords(f)) out.add(w)
      break
    }
    case 'adj': {
      if (entry.plural) out.add(cleanText(entry.plural).toLowerCase())
      for (const f of adjectiveForms(lemma, { feminine: entry.feminine })) out.add(f)
      break
    }
    case 'det':
    case 'pron':
    case 'num': {
      if (!entry.forms && DET_FORMS[lemma]) for (const f of DET_FORMS[lemma]) out.add(f)
      break
    }
    case 'verb': {
      const { inf, clitic, rest } = parseLemma(lemma)
      try {
        const c = conjugate(inf, verbs)
        for (const f of formsOf(c)) out.add(f)
        out.add(inf)
        if (clitic) out.add('se')
        for (const r of rest.split(' ')) if (r) for (const w of phraseWords(r)) out.add(w)
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
export function buildDictionary(entries: Iterable<VocabEntry>, verbs: ReadonlyMap<string, FrVerb>): Dictionary {
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

/** Pronouns written after an imperative or in an inversion (donne-moi, allez-y, parlez-en, vient-il, a-t-elle). */
const HYPHEN_PRONOUNS: ReadonlySet<string> = new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'moi', 'toi', 'lui', 'leur', 'eux', 'le', 'la', 'les', 'y', 'en', 'ce', 't', "m'en", "t'en", "m'y", "t'y", 'ci', 'là'])

const isVerb = (es: VocabEntry[] | undefined) => (es && es.some((e) => e.pos === 'verb') ? es : undefined)

/**
 * Dictionary lookup that also understands French spelling: elisions ("l'",
 * "qu'", "jusqu'", or "l'ami" as one string), pronouns attached with hyphens
 * (donne-moi, lève-toi, allez-y, vas-y, a-t-il, est-ce), hyphenated compounds
 * made of known words (grand-mère, celui-ci, ce livre-là), ligatures typed out
 * (coeur = cœur) and regular -ment adverbs (heureusement ← heureux).
 */
export function lookup(dict: Dictionary, form: string): VocabEntry[] | undefined {
  const w = cleanText(form).toLowerCase()
  const direct = dict.get(w)
  if (direct) return direct
  if (/oe|ae/.test(w)) {
    const lig = dict.get(w.replace(/oe/g, 'œ').replace(/ae/g, 'æ'))
    if (lig) return lig
  }
  if (w.endsWith("'")) {
    const bases = ELIDED_BASES.get(w) ?? [w.slice(0, -1) + 'e', w.slice(0, -1) + 'a', w.slice(0, -1)]
    for (const b of bases) {
      const hit = dict.get(b)
      if (hit) return hit
    }
    return undefined
  }
  const el = ELISION_HEAD.exec(w)
  if (el && !w.includes('-')) return lookup(dict, el[2]!)
  if (w.includes('-')) {
    const parts = w.split('-').filter(Boolean)
    // verb + pronouns: donne-moi, dis-le-lui, va-t'en, a-t-il
    const tail = parts.slice(1)
    if (tail.length && tail.every((p) => HYPHEN_PRONOUNS.has(p) || ELISION_HEAD.test(p))) {
      const host = isVerb(dict.get(parts[0]!)) ?? (parts[0] === 'est' ? dict.get('est') : undefined)
      if (host) return host
    }
    // a compound of known words: the first noun, else the first word
    const hits = parts.map((p) => (HYPHEN_PRONOUNS.has(p) || p === 't' ? [] : (dict.get(p) ?? lookup(dict, p))))
    if (hits.every(Boolean) && hits.some((h) => h!.length)) return hits.find((h) => h!.some((e) => e.pos === 'noun')) ?? hits.find((h) => h!.length)
    return undefined
  }
  return derivedLookup(dict, w)
}

const isAdj = (es: VocabEntry[] | undefined) => (es && es.some((e) => e.pos === 'adj') ? es.filter((e) => e.pos === 'adj') : undefined)

/** Regular -ment adverbs not listed in the dictionary: rapidement, heureusement, vraiment, constamment, évidemment, énormément. */
function derivedLookup(dict: Dictionary, w: string): VocabEntry[] | undefined {
  if (!w.endsWith('ment') || w.length < 7) return undefined
  const stem = w.slice(0, -4)
  const cands = [stem]
  if (stem.endsWith('am')) cands.push(stem.slice(0, -2) + 'ant') // constamment ← constant
  if (stem.endsWith('em')) cands.push(stem.slice(0, -2) + 'ent') // évidemment ← évident
  if (stem.endsWith('é')) cands.push(stem.slice(0, -1) + 'e', stem.slice(0, -1)) // énormément ← énorme, précisément ← précise
  if (stem.endsWith('i')) cands.push(stem.slice(0, -1) + 'il') // gentiment ← gentil
  for (const c of cands) {
    const hit = isAdj(dict.get(c))
    if (hit) return hit
  }
  return undefined
}
