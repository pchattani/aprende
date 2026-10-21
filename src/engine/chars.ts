/**
 * Characters to write (a lesson's `write` list): their SRS item ids and what is shown with
 * them (reading and meaning, from the vocabulary entry spelt with that one character).
 */
import type { VocabEntry } from './schema'
import { languagePack } from '@lang'
import { PICTOGRAMS } from './pictograms'

const PREFIX = 'c.'

/** SRS item id of a character to write: `c.火`. */
export const charId = (char: string): string => PREFIX + char
export const isCharId = (id: string): boolean => id.startsWith(PREFIX) && /^\p{Script=Han}$/u.test(id.slice(PREFIX.length))
/** The character of a `c.` id (undefined for any other id). */
export const charOf = (id: string): string | undefined => (isCharId(id) ? id.slice(PREFIX.length) : undefined)

export interface CharInfo {
  char: string
  /** Reading (Jyutping for Cantonese), when known. */
  jp?: string
  /** English meaning(s), joined. */
  en: string
  /** The vocabulary entry that is this character on its own (火 = w.fo2), when there is one. */
  vocab?: VocabEntry
}

/** The single-character word for `char`, preferring an entry that is not a classifier or particle. */
export function charWord(char: string, vocab: Iterable<VocabEntry>): VocabEntry | undefined {
  const all = [...vocab].filter((v) => v.lemma === char)
  return all.find((v) => v.pos !== 'classifier' && v.pos !== 'particle') ?? all[0]
}

export function charInfo(char: string, vocab: ReadonlyMap<string, VocabEntry>): CharInfo {
  const v = charWord(char, vocab.values())
  const jp = v?.jp ?? languagePack.romanize?.(char)[0]?.reading
  const en = v ? v.en.slice(0, 2).join(', ') : (PICTOGRAMS[char]?.en ?? '')
  return { char, jp, en, vocab: v }
}
