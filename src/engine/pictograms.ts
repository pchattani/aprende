/**
 * Characters that grew out of a picture (pictograms) or a simple sign (ideograms), with the
 * story told beside their art (src/components/art/Pictogram.tsx draws picture → ancient form → modern).
 * Engine-side so the generator knows which characters can have a pictogram exercise.
 */
export interface PictogramInfo {
  /** English meaning, shown with the art. */
  en: string
  /** What the picture shows and how it became the character (one short sentence). */
  story: string
  /** Pictogram (a drawing of a thing) or ideogram (a sign for an idea). */
  type: 'pictogram' | 'ideogram'
}

export const PICTOGRAMS: Readonly<Record<string, PictogramInfo>> = {
  火: { en: 'fire', story: 'Flames leaping up from a fire: the tall middle flame and two sparks either side.', type: 'pictogram' },
  水: { en: 'water', story: 'A stream flowing down the middle, with ripples and drops on both sides.', type: 'pictogram' },
  山: { en: 'mountain', story: 'Three peaks on one ridge, the middle one the tallest.', type: 'pictogram' },
  門: { en: 'door, gate', story: 'A pair of swinging doors, one leaf on each side of the doorway.', type: 'pictogram' },
  口: { en: 'mouth', story: 'An open mouth, drawn as a box.', type: 'pictogram' },
  人: { en: 'person', story: 'A person walking, seen from the side: a body leaning forward on two legs.', type: 'pictogram' },
  田: { en: 'field', story: 'A rice field from above, divided into four plots by raised paths.', type: 'pictogram' },
  月: { en: 'moon, month', story: 'A crescent moon; a month is one moon from new to new.', type: 'pictogram' },
  雨: { en: 'rain', story: 'Drops of rain falling from under the sky.', type: 'pictogram' },
  木: { en: 'tree, wood', story: 'A tree: branches reaching up, roots spreading down.', type: 'pictogram' },
  上: { en: 'up, above', story: 'A mark above a line: whatever is on top.', type: 'ideogram' },
  下: { en: 'down, below', story: 'A mark below a line: whatever is underneath.', type: 'ideogram' },
  大: { en: 'big', story: 'A person standing with arms and legs stretched out wide.', type: 'ideogram' },
  小: { en: 'small', story: 'Three tiny grains of sand.', type: 'ideogram' },
  一: { en: 'one', story: 'One counting rod laid flat.', type: 'ideogram' },
  二: { en: 'two', story: 'Two counting rods.', type: 'ideogram' },
  三: { en: 'three', story: 'Three counting rods.', type: 'ideogram' },
}

export function hasPictogram(char: string): boolean {
  return Object.hasOwn(PICTOGRAMS, char)
}
