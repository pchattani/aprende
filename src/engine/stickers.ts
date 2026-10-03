/** Emoji stickers that give each unit a face on the course page. Unlisted units fall back by position. */
const UNIT_STICKERS: Record<string, string> = {
  'a1.u01': '👋', 'a1.u02': '🌍', 'a1.u03': '👨‍👩‍👧', 'a1.u04': '🏡', 'a1.u05': '🥘', 'a1.u06': '⏰', 'a1.u07': '🧑‍🎤', 'a1.u08': '🛍️', 'a1.u09': '🚀', 'a1.u10': '⛱️', 'a1.u11': '🗺️', 'a1.u12': '🎉',
  'a2.u01': '📅', 'a2.u02': '📜', 'a2.u03': '🧸', 'a2.u04': '📖', 'a2.u05': '✅', 'a2.u06': '🔁', 'a2.u07': '🔮', 'a2.u08': '⚖️', 'a2.u09': '👩‍🍳', 'a2.u10': '✈️', 'a2.u11': '🩺', 'a2.u12': '🎒',
  'b1.u01': '🌠', 'b1.u02': '💞', 'b1.u03': '🤔', 'b1.u04': '🧭', 'b1.u05': '⌛', 'b1.u06': '🕰️', 'b1.u07': '🔗', 'b1.u08': '🏗️', 'b1.u09': '🗣️', 'b1.u10': '🕵️', 'b1.u11': '✍️', 'b1.u12': '🎭',
  'b2.u01': '🌧️', 'b2.u02': '⏮️', 'b2.u03': '😮‍💨', 'b2.u04': '☔', 'b2.u05': '🏁', 'b2.u06': '📣', 'b2.u07': '🏛️', 'b2.u08': '📈', 'b2.u09': '🎩', 'b2.u10': '⚔️', 'b2.u11': '💥', 'b2.u12': '🌎',
  'c1.u01': '🎨', 'c1.u02': '⚖️', 'c1.u03': '🧵', 'c1.u04': '🦉', 'c1.u05': '🎓', 'c1.u06': '🧩', 'c1.u07': '😂', 'c1.u08': '📚', 'c1.u09': '📰', 'c1.u10': '💎',
  'c2.u01': '🗣️', 'c2.u02': '🖋️', 'c2.u03': '🕯️', 'c2.u04': '🎤', 'c2.u05': '🔄', 'c2.u06': '🔬', 'c2.u07': '🃏', 'c2.u08': '👑',
}
const FALLBACK = ['✨', '🌟', '🎈', '🍀', '🌈', '🎯', '🧡', '🎵']

export function unitSticker(unitId: string): string {
  const s = UNIT_STICKERS[unitId]
  if (s) return s
  const n = Number(unitId.split('.u')[1] ?? 0)
  return FALLBACK[n % FALLBACK.length]!
}

/** Short celebratory lines, in Spanish with a translation, shown when a lesson is done. */
export const CHEERS: { es: string; en: string }[] = [
  { es: '¡Olé!', en: 'Bravo!' },
  { es: '¡Qué bien!', en: 'Nice one!' },
  { es: '¡Genial!', en: 'Great!' },
  { es: '¡Vaya crack!', en: 'What a star!' },
  { es: '¡Así se hace!', en: "That's how it's done!" },
  { es: '¡De lujo!', en: 'Superb!' },
]
