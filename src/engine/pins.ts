import type { Exercise } from './types'
import { hashString } from './random'

/** Stable id for pinning an exercise's item: the first item, else a hash of the Spanish text. */
export function pinIdFor(ex: Exercise): string {
  return ex.items[0] ?? `x:${hashString(ex.review?.es ?? ('prompt' in ex ? ex.prompt : ex.kind))}`
}
