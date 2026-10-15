import { useKvValue } from './useProgress'
import { setKv } from '../db/progress'
import type { WearSlot } from '../engine/journey'

export type DogName = 'leo' | 'bonchita' | 'luna'
/** Souvenir id per slot. */
export type Outfit = Partial<Record<WearSlot, string>>
export type Outfits = Record<DogName, Outfit>

export const EMPTY_OUTFITS: Outfits = { leo: {}, bonchita: {}, luna: {} }

/** Live outfits of the three dogs (empty until the kv row loads). */
export function useOutfits(): Outfits {
  return useKvValue<Outfits>('outfits', EMPTY_OUTFITS) ?? EMPTY_OUTFITS
}

export async function setOutfit(all: Outfits, dog: DogName, slot: WearSlot, souvenirId: string | undefined): Promise<Outfits> {
  const next: Outfits = { ...all, [dog]: { ...all[dog] } }
  if (souvenirId) next[dog][slot] = souvenirId
  else delete next[dog][slot]
  await setKv('outfits', next)
  return next
}
