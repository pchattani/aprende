/**
 * Portuguese inflection: noun plurals, adjective agreement forms and the full
 * surface-form dictionary used by the checker, the reader coverage meter and
 * the content checker. Pure: verb tables are passed in.
 */
import type { VocabEntry } from '../../engine/schema'
import type { PtIrregularVerb } from './schema'
import { conjugate, formsOf } from './conjugator'
import { stripAccents } from './normalize'

/** Written accents that mark stress (not the nasal tilde). */
const STRESS_MARK = /[áéíóúâêô]/

/** Nouns in -ão with plural -ãos. */
const AO_AOS = new Set(['mão', 'irmão', 'cidadão', 'cristão', 'órgão', 'órfão', 'bênção', 'sótão', 'grão', 'chão', 'vão', 'são', 'pagão', 'cortesão', 'acórdão', 'desvão', 'artesão'])
/** Nouns in -ão with plural -ães. */
const AO_AES = new Set(['pão', 'cão', 'alemão', 'capitão', 'charlatão', 'escrivão', 'tabelião', 'sacristão', 'catalão', 'capelão', 'maçapão'])
/** Words with more than one accepted plural, or an irregular one (first = preferred). */
const IRREGULAR_PLURAL: Record<string, string[]> = {
  verão: ['verões', 'verãos'], vilão: ['vilões', 'vilãos'], ancião: ['anciãos', 'anciões', 'anciães'],
  guardião: ['guardiões', 'guardiães'], aldeão: ['aldeões', 'aldeãos', 'aldeães'], vulcão: ['vulcões', 'vulcãos'],
  corrimão: ['corrimãos', 'corrimões'], refrão: ['refrões', 'refrães'], cirurgião: ['cirurgiões', 'cirurgiães'],
  sultão: ['sultões', 'sultãos', 'sultães'], ermitão: ['ermitões', 'ermitãos', 'ermitães'], zangão: ['zangões', 'zangãos'],
  mal: ['males'], cônsul: ['cônsules'], júnior: ['juniores'], sênior: ['seniores'], caráter: ['caracteres'],
  gol: ['gols', 'golos'], cais: ['cais'], deus: ['deuses'], mel: ['méis', 'meles'], qualquer: ['quaisquer'],
  cós: ['cós'], xis: ['xis'],
}

/** Plural(s) of a noun or adjective form; the first is the standard one. */
export function pluralize(word: string): string[] {
  const w = word.toLowerCase()
  if (IRREGULAR_PLURAL[w]) return IRREGULAR_PLURAL[w]
  if (w.includes(' ')) {
    const [first, ...rest] = w.split(' ')
    return pluralize(first!).map((p) => [p, ...rest].join(' '))
  }
  if (w.includes('-')) {
    // guarda-chuva → guarda-chuvas (verb + noun); couve-flor → couves-flores (noun + noun)
    const parts = w.split('-')
    const last = parts.pop()!
    const lastOnly = pluralize(last).map((p) => [...parts, p].join('-'))
    const all = [...parts.map((p) => pluralize(p)[0]!), pluralize(last)[0]!].join('-')
    return [...new Set([...lastOnly, all])]
  }
  if (w.endsWith('ão')) {
    if (AO_AOS.has(w)) return [w + 's']
    if (AO_AES.has(w)) return [w.slice(0, -2) + 'ães']
    return [w.slice(0, -2) + 'ões']
  }
  if (/[aeiouáéíóúâêôã]$/.test(w)) return [w + 's'] // casa, café, avó, irmã, chapéu, pai
  const last = w[w.length - 1]!
  if (last === 'm') return [w.slice(0, -1) + 'ns'] // homem → homens, armazém → armazéns
  if (last === 'r' || last === 'z') return [w + 'es'] // mulher, açúcar, luz, rapaz
  if (last === 'n') return w.endsWith('en') ? [unstress(w) + 's'] : [w + 's'] // hífen → hifens, próton → prótons
  if (last === 'x') return [w] // tórax, xérox
  if (last === 's') {
    if (/[íú]s$/.test(w)) return [w + 'es'] // país → países
    if (/[áéóâêô]s$/.test(w)) return [w.slice(0, -2) + unstress(w.slice(-2)) + 'es'] // gás → gases, mês → meses, português → portugueses
    if (STRESS_MARK.test(w)) return [w] // lápis, ônibus, vírus, tênis, óculos
    if (vowelGroups(w) <= 1) return [w + 'es'] // monosyllables
    if (/[iu]s$/.test(w)) return [w + 'es'] // unaccented -is/-us are oxytone (anis → anises)
    return [w] // pires, atlas, ourives
  }
  if (last === 'l') {
    const marked = STRESS_MARK.test(w) // paroxytone: nível, fácil, fóssil, álcool
    const head = w.slice(0, -2)
    if (w.endsWith('al')) return [head + 'ais'] // animal → animais
    if (w.endsWith('el')) return [head + (marked ? 'eis' : 'éis')] // papel → papéis, nível → níveis
    if (w.endsWith('ol')) return [head + (marked ? 'ois' : 'óis')] // espanhol → espanhóis, álcool → álcoois
    if (w.endsWith('ul')) return [head + 'uis'] // azul → azuis
    if (w.endsWith('il')) return [head + (marked ? 'eis' : 'is')] // funil → funis, fóssil → fósseis
  }
  return [w + 's'] // loanwords: shows, clubes
}

/** Remove acute and circumflex accents only (keeps ç and the nasal tilde). */
function unstress(s: string): string {
  return s.replace(/[áéíóúâêô]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', â: 'a', ê: 'e', ô: 'o' })[c] ?? c)
}

function vowelGroups(w: string): number {
  return (stripAccents(w).match(/[aeiou]+/g) ?? []).length
}

const INVARIANT_OR = new Set(['melhor', 'pior', 'maior', 'menor', 'superior', 'inferior', 'exterior', 'interior', 'anterior', 'posterior', 'ulterior', 'incolor', 'multicolor', 'bicolor', 'tricolor'])
const INVARIANT_ES = new Set(['cortês', 'descortês'])
const SPECIAL_FEMININE: Record<string, string> = { bom: 'boa', mau: 'má', judeu: 'judia', são: 'sã', vão: 'vã', ateu: 'ateia', plebeu: 'plebeia' }

/** Masculine form → feminine form of an adjective, or undefined for invariable adjectives (feliz, grande, azul). */
export function feminineOf(lemma: string, opts: { nationality?: boolean } = {}): string | undefined {
  const w = lemma.toLowerCase()
  if (SPECIAL_FEMININE[w]) return SPECIAL_FEMININE[w]
  if (w.endsWith('ão')) return w.slice(0, -2) + 'ã' // alemão → alemã
  if (w.endsWith('o')) return w.slice(0, -1) + 'a' // bonito → bonita
  if (w.endsWith('ês') && !INVARIANT_ES.has(w)) return w.slice(0, -2) + 'esa' // português → portuguesa
  if (w.endsWith('or') && !INVARIANT_OR.has(w)) return w + 'a' // trabalhador → trabalhadora
  if (w.endsWith('eu')) return w.slice(0, -2) + 'eia' // europeu → europeia
  if (w.endsWith('ol')) return w + 'a' // espanhol → espanhola
  if (opts.nationality && /[lz]$/.test(w)) return w + 'a' // andaluz → andaluza
  return undefined
}

/** Gender/number forms of an adjective (or noun with gender variation). */
export function adjectiveForms(lemma: string, opts: { feminine?: string; nationality?: boolean } = {}): string[] {
  const w = lemma.toLowerCase()
  const out = new Set<string>()
  if (w.includes(' ')) return [w]
  const addWithPlural = (f: string) => {
    out.add(f)
    for (const p of pluralize(f)) out.add(p)
  }
  const fem = opts.feminine?.toLowerCase() ?? feminineOf(w, opts)
  addWithPlural(w)
  if (fem && fem !== w) addWithPlural(fem)
  return [...out]
}

/** Every surface form a learner may meet for a vocabulary entry (lowercase). */
export function inflections(entry: VocabEntry, verbs: ReadonlyMap<string, PtIrregularVerb>): string[] {
  const lemma = entry.lemma.toLowerCase()
  const out = new Set<string>([lemma])
  if (entry.forms) for (const f of entry.forms) out.add(f.toLowerCase())
  const nationality = entry.tags.includes('nationality')
  switch (entry.pos) {
    case 'noun': {
      if (entry.plural) out.add(entry.plural.toLowerCase())
      else for (const p of pluralize(lemma)) out.add(p)
      if (entry.gender === 'mf' || nationality || entry.feminine) {
        for (const f of adjectiveForms(lemma, { feminine: entry.feminine, nationality: true })) out.add(f)
      }
      break
    }
    case 'adj': {
      for (const f of adjectiveForms(lemma, { feminine: entry.feminine, nationality })) out.add(f)
      if (entry.plural) out.add(entry.plural.toLowerCase())
      break
    }
    case 'det':
    case 'pron':
    case 'num': {
      if (entry.forms) break
      if (lemma.endsWith('o')) for (const f of adjectiveForms(lemma)) out.add(f)
      else if (/[aeiou]$/.test(lemma)) for (const p of pluralize(lemma)) out.add(p)
      break
    }
    case 'verb': {
      const base = lemma.replace(/-se$/, '')
      try {
        for (const f of formsOf(conjugate(base, verbs))) out.add(f)
      } catch {
        /* not conjugable (e.g. phrase) */
      }
      break
    }
    case 'phrase': {
      for (const w of lemma.split(/\s+/)) out.add(w.replace(/[¿?¡!.,;:"“”]/g, ''))
      break
    }
    default:
      break
  }
  out.delete('')
  return [...out]
}

export type Dictionary = Map<string, VocabEntry[]>

/** Build form -> entries index. Phrases also register their words. */
export function buildDictionary(entries: Iterable<VocabEntry>, verbs: ReadonlyMap<string, PtIrregularVerb>): Dictionary {
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

/** Clitic pronouns that attach to a verb with a hyphen (and their contractions: mo, lho). */
const CLITICS = new Set([
  'me', 'te', 'se', 'nos', 'vos', 'lhe', 'lhes',
  'o', 'a', 'os', 'as', 'lo', 'la', 'los', 'las', 'no', 'na', 'nas',
  'mo', 'ma', 'mos', 'mas', 'to', 'ta', 'tos', 'tas', 'lho', 'lha', 'lhos', 'lhas',
])
/** Future and conditional endings split off by mesoclisis (dir-lhe-ei, fá-lo-ia). */
const MESOCLITIC_ENDINGS = new Set(['ei', 'ás', 'á', 'emos', 'eis', 'ão', 'ia', 'ias', 'íamos', 'íeis', 'iam'])

/** Possible dictionary forms of a verb before an enclitic (comprá-lo → comprar, fi-lo → fiz, levantemo-nos → levantemos). */
function hostCandidates(host: string, clitic: string): string[] {
  const plain = stripAccents(host)
  const out = [host]
  if (/^l(o|a|os|as)$/.test(clitic)) out.push(host + 'r', plain + 'r', host + 's', plain + 's', host + 'z', plain + 'z')
  if (clitic === 'nos' && host.endsWith('mo')) out.push(host + 's')
  return out
}

/**
 * Dictionary lookup that also understands pronouns joined with a hyphen:
 * enclisis (dá-me, levantei-me, comprá-lo, fazê-lo, levantemo-nos) and
 * mesoclisis (dir-lhe-ei, fá-lo-ia, levantar-me-ei).
 */
export function lookup(dict: Dictionary, form: string): VocabEntry[] | undefined {
  const w = form.toLowerCase()
  const direct = dict.get(w)
  if (direct) return direct
  if (!w.includes('-')) return undefined
  const parts = w.split('-')
  const ending = parts[parts.length - 1]!
  if (parts.length >= 3 && MESOCLITIC_ENDINGS.has(ending) && parts.slice(1, -1).every((p) => CLITICS.has(p))) {
    const stem = parts[0]!
    for (const s of [stem, stripAccents(stem) + 'r']) {
      const hit = dict.get(s + ending)
      if (hit) return hit
    }
  }
  let k = parts.length
  while (k > 1 && CLITICS.has(parts[k - 1]!)) k--
  if (k === parts.length) return undefined
  const host = parts.slice(0, k).join('-')
  for (const b of hostCandidates(host, parts[k]!)) {
    const hit = dict.get(b)
    if (hit) return hit
  }
  return undefined
}
