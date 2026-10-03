/**
 * Spanish inflection: noun plurals, adjective agreement forms and the full
 * surface-form dictionary used by the checker, the reader coverage meter and
 * the content checker. Pure: verb tables are passed in.
 */
import type { IrregularVerb, VocabEntry } from '../../engine/schema'
import { conjugate } from './conjugator'
import { placeAccent, stressedVowelIndex, analyzeAccent } from './accents'
import { stripAccents } from './normalize'

const INVARIANT_OR = new Set(['mejor', 'peor', 'mayor', 'menor', 'superior', 'inferior', 'exterior', 'interior', 'anterior', 'posterior', 'ulterior', 'bicolor', 'multicolor'])

/** Re-place the accent of a derived form so stress stays on the same vowel as in the base word. */
function keepStress(base: string, derived: string): string {
  const idx = stressedVowelIndex(base)
  return placeAccent(stripAccents(derived), idx)
}

/** Plural(s) of a noun or adjective form. Returns one or two accepted spellings. */
export function pluralize(word: string): string[] {
  const w = word.toLowerCase()
  if (w.includes(' ')) {
    const [first, ...rest] = w.split(' ')
    return pluralize(first!).map((p) => [p, ...rest].join(' '))
  }
  const last = w[w.length - 1]!
  if ('aeiou'.includes(last)) return [w + 's']
  if ('áéó'.includes(last)) return [w + 's']
  if ('íú'.includes(last)) return [w + 'es', w + 's']
  if (last === 'z') return [keepStress(w, w.slice(0, -1) + 'ces')]
  if (last === 's' || last === 'x') {
    const a = analyzeAccent(w)
    if (a.syllables.length === 1) return [w + 'es'] // mes -> meses, gas -> gases
    if (a.type === 'aguda') return [keepStress(w, w + 'es')] // autobús -> autobuses
    return [w] // lunes, crisis, tórax
  }
  return [keepStress(w, w + 'es')] // canción -> canciones, examen -> exámenes, rey -> reyes
}

/** Gender/number forms of an adjective (or noun with gender variation). */
export function adjectiveForms(lemma: string, opts: { feminine?: string; nationality?: boolean } = {}): string[] {
  const w = lemma.toLowerCase()
  const out = new Set<string>()
  const addWithPlural = (f: string) => {
    out.add(f)
    for (const p of pluralize(f)) out.add(p)
  }
  if (w.includes(' ')) {
    out.add(w)
    return [...out]
  }
  let fem: string | undefined = opts.feminine
  if (!fem) {
    if (w.endsWith('o')) fem = w.slice(0, -1) + 'a'
    else if (/(or|án|ín|ón|és)$/.test(w) && !INVARIANT_OR.has(w)) fem = keepStress(w, w + 'a')
    else if (opts.nationality && !/[aeiou]$/.test(w)) fem = keepStress(w, w + 'a')
  }
  addWithPlural(w)
  if (fem && fem !== w) addWithPlural(fem)
  return [...out]
}

/** Every surface form a learner may meet for a vocabulary entry (lowercase). */
export function inflections(entry: VocabEntry, verbs: ReadonlyMap<string, IrregularVerb>): string[] {
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
      break
    }
    case 'det':
    case 'pron':
    case 'num': {
      if (lemma.endsWith('o') && !entry.forms) for (const f of adjectiveForms(lemma)) out.add(f)
      else if (!entry.forms && /[aeiou]$/.test(lemma)) for (const p of pluralize(lemma)) out.add(p)
      break
    }
    case 'verb': {
      const base = lemma.replace(/se$/, '')
      try {
        const c = conjugate(base, verbs)
        out.add(c.infinitive).add(c.participle).add(c.gerund)
        for (const forms of Object.values(c.forms)) {
          for (const f of forms) {
            if (!f) continue
            out.add(f.replace(/^no /, '').split(' ').pop()!)
          }
        }
        if (c.participle.endsWith('o')) {
          const p = c.participle.slice(0, -1)
          out.add(p + 'a').add(p + 'os').add(p + 'as')
        }
      } catch {
        /* not conjugable (e.g. phrase) */
      }
      break
    }
    case 'phrase': {
      for (const w of lemma.split(/\s+/)) out.add(w.replace(/[¿?¡!.,]/g, ''))
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
export function buildDictionary(entries: Iterable<VocabEntry>, verbs: ReadonlyMap<string, IrregularVerb>): Dictionary {
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

const ENCLITICS = ['me', 'te', 'se', 'nos', 'os', 'lo', 'la', 'los', 'las', 'le', 'les']

/**
 * Dictionary lookup that also understands attached pronouns:
 * comprarlo, ayudarte, levántate, dímelo, haciéndolo.
 */
export function lookup(dict: Dictionary, form: string): VocabEntry[] | undefined {
  const w = form.toLowerCase()
  const direct = dict.get(w)
  if (direct) return direct
  const tryBase = (b: string) => dict.get(b) ?? dict.get(stripAccents(b))
  for (const a of ENCLITICS) {
    if (!w.endsWith(a) || w.length - a.length < 2) continue
    const b1 = w.slice(0, -a.length)
    const hit1 = tryBase(b1)
    if (hit1 && isHost(b1)) return hit1
    for (const b of ENCLITICS) {
      if (!b1.endsWith(b) || b1.length - b.length < 2) continue
      const b2 = b1.slice(0, -b.length)
      const hit2 = tryBase(b2)
      if (hit2 && isHost(b2)) return hit2
    }
  }
  return undefined
}

/** Pronouns attach to infinitives, gerunds and affirmative imperatives. */
function isHost(base: string): boolean {
  const p = stripAccents(base)
  return /(ar|er|ir|ndo)$/.test(p) || /[aeiou]d?$/.test(p) || /^(di|haz|pon|sal|ten|ven|ve|se)$/.test(p)
}
