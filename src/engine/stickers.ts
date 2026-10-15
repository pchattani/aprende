import { ui } from './loader'

/** Emoji stickers that give each unit a face on the course page. Unlisted units fall back by position. */
const UNIT_STICKERS: Record<string, string> = ui.unitStickers
const FALLBACK = ['✨', '🌟', '🎈', '🍀', '🌈', '🎯', '🧡', '🎵']

export function unitSticker(unitId: string): string {
  const s = UNIT_STICKERS[unitId]
  if (s) return s
  const n = Number(unitId.split('.u')[1] ?? 0)
  return FALLBACK[n % FALLBACK.length]!
}

/** Short celebratory lines, in the target language with a translation, shown when a lesson is done. */
export const CHEERS: { es: string; en: string }[] = ui.cheers
