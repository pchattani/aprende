/**
 * Cantonese has no inflection: a word's only "forms" are its characters and its
 * Jyutping (with and without tones), all registered in the dictionary so that the
 * reader, checker and feedback can look up either spelling.
 */
import type { VocabEntry } from '../../engine/schema'
import { stripTones } from './jyutping'
import { toSyllables } from './lexicon'

export function inflections(entry: VocabEntry, _verbs?: ReadonlyMap<string, unknown>): string[] {
  const out = new Set<string>([entry.lemma.replace(/\s+/g, ''), ...(entry.forms ?? [])])
  if (entry.jp) out.add(entry.jp).add(stripTones(entry.jp))
  out.delete('')
  return [...out]
}

export type Dictionary = Map<string, VocabEntry[]>

export function buildDictionary(entries: Iterable<VocabEntry>, _verbs?: ReadonlyMap<string, unknown>): Dictionary {
  const dict: Dictionary = new Map()
  for (const e of entries) {
    for (const f of inflections(e)) {
      const list = dict.get(f)
      if (list) {
        if (!list.includes(e)) list.push(e)
      } else dict.set(f, [e])
    }
  }
  return dict
}

/** Look up characters, or Jyutping with or without tones. */
export function lookup(dict: Dictionary, form: string): VocabEntry[] | undefined {
  const w = form.trim().toLowerCase()
  const direct = dict.get(w) ?? dict.get(form.trim())
  if (direct) return direct
  const syl = toSyllables(form).join(' ')
  return dict.get(syl) ?? dict.get(stripTones(syl))
}
