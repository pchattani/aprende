/** Moods and head poses shared by the dog drawings and the things they wear. */
export type Mood = 'happy' | 'curious' | 'sleepy'

/** Head tilt (degrees) per mood and the point it turns around: worn hats, glasses and mouth items follow it. */
export const HEAD_TILT: Record<'leo' | 'bonchita' | 'luna', Record<Mood, number>> = {
  leo: { happy: 0, curious: -9, sleepy: 6 },
  bonchita: { happy: 0, curious: 9, sleepy: -6 },
  luna: { happy: 0, curious: -10, sleepy: 6 },
}
export const HEAD_PIVOT: Record<'leo' | 'bonchita' | 'luna', [number, number]> = { leo: [60, 60], bonchita: [60, 66], luna: [66, 52] }

/** A slight tilt of the whole portrait sticker for the curious and sleepy moods. */
export const LEAN: Record<Mood, number> = { happy: 0, curious: -5, sleepy: 4 }
