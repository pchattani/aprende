/**
 * The wardrobe: everyday accessories (berets, scarves, sunglasses…) in every colour, so that
 * errands keep paying out once a learner has found the region's souvenirs. Every
 * WARDROBE_KINDS × WARDROBE_COLOURS pair is one souvenir, id `wear-<kind>-<colour>`.
 * Target-language names come from content/<lang>/wardrobe.yaml, with the colour agreeing
 * with the noun (una boina roja, unos lentes de sol rojos, un béret rouge, 一頂紅色貝雷帽).
 */
import { WARDROBE_KINDS, WARDROBE_COLOURS, type ArtKind, type WardrobeColour, type WearSlot } from './artKinds'
import type { LevelId, WardrobeFile } from './schema'
import type { Souvenir } from './journey'
import { wardrobeData } from './loader'

interface KindInfo {
  /** English noun; `plural` ones take no article ("blue sunglasses"). */
  en: string
  plural?: boolean
  /** Fallback thumbnail until SouvenirArt draws it. */
  emoji: string
  /** Region whose passport page lists this kind; rewards favour kinds of the learner's level or earlier. */
  level: LevelId
  blurb: string
}

/** English names, levels and blurbs per kind: two kinds per region, so new kinds show up as the learner travels. */
const KIND_INFO: Record<string, KindInfo> = {
  cap: { en: 'cap', emoji: '🧢', level: 'a1', blurb: 'Peak at the front, peak at the back: Bonchita can never decide.' },
  sunglasses: { en: 'sunglasses', plural: true, emoji: '🕶️', level: 'a1', blurb: 'Very cool, very dark. Luna walks into a lamppost, still very cool.' },
  sunhat: { en: 'sun hat', emoji: '👒', level: 'a2', blurb: 'A wide brim for long sunny walks. Bonchita disappears underneath it.' },
  bandana: { en: 'bandana', emoji: '🔺', level: 'a2', blurb: 'Knotted at the back, tips flapping in the wind. Leo says it makes him run faster.' },
  'bucket-hat': { en: 'bucket hat', emoji: '🎣', level: 'b1', blurb: 'Floppy and fearless. Leo wears it to the beach and to bed.' },
  balloon: { en: 'balloon', emoji: '🎈', level: 'b1', blurb: 'Tied to a paw so it never flies away. Bonchita checks on it every five minutes.' },
  beanie: { en: 'beanie', emoji: '🧶', level: 'b2', blurb: 'Warm ears on cold mornings. Luna pulls it right down to her nose.' },
  scarf: { en: 'scarf', emoji: '🧣', level: 'b2', blurb: 'Wrapped twice round the neck. Bonchita looks like a famous author.' },
  beret: { en: 'beret', emoji: '🎨', level: 'c1', blurb: 'Leo wears it tilted over one ear and calls himself an artist.' },
  'round-glasses': { en: 'round glasses', plural: true, emoji: '👓', level: 'c1', blurb: 'Luna puts them on to read the map. Leo puts them on to look clever.' },
  bowtie: { en: 'bow tie', emoji: '🎀', level: 'c2', blurb: 'For dinners, concerts and very important naps. Luna keeps straightening it.' },
  umbrella: { en: 'umbrella', emoji: '☂️', level: 'c2', blurb: 'Rain or shine, Leo holds it over Bonchita, who never says thank you.' },
}

/** English label of a wardrobe kind ("sun hat"), for the dress-up page. */
export function wardrobeKindLabel(kind: ArtKind): string {
  return KIND_INFO[kind]?.en ?? kind
}

export function wardrobeId(kind: ArtKind, colour: WardrobeColour): string {
  return `wear-${kind}-${colour}`
}

/** The target-language name of one item, with the colour in the form that agrees with the noun. */
export function wardrobeName(file: WardrobeFile, kind: ArtKind, colour: WardrobeColour): string {
  const k = file.kinds[kind]
  const word = file.colours[colour]
  if (!k || !word) throw new Error(`wardrobe.yaml: no name for ${kind} / ${colour}`)
  const form = typeof word === 'string' ? word : word[k.form]
  return k.name.replace('{colour}', form)
}

function englishName(kind: ArtKind, colour: WardrobeColour): string {
  const info = KIND_INFO[kind]!
  const phrase = `${colour} ${info.en}`
  return info.plural ? phrase : `${/^[aeiou]/.test(colour) ? 'an' : 'a'} ${phrase}`
}

/** Every wardrobe souvenir, named from a course's wardrobe.yaml: kinds in order, then colours. */
export function buildWardrobe(file: WardrobeFile): Souvenir[] {
  return WARDROBE_KINDS.flatMap(({ kind, slot }: { kind: ArtKind; slot: WearSlot }) => {
    const info = KIND_INFO[kind]
    if (!info) throw new Error(`wardrobe: no English name for ${kind}`)
    return WARDROBE_COLOURS.map(
      (c): Souvenir => ({
        id: wardrobeId(kind, c.id),
        level: info.level,
        emoji: info.emoji,
        art: kind,
        color: c.hex,
        es: wardrobeName(file, kind, c.id),
        en: englishName(kind, c.id),
        blurb: info.blurb,
        wearable: { slot },
        wardrobe: { kind, colour: c.id },
      }),
    )
  })
}

/** This course's wardrobe: 12 kinds × 8 colours. */
export const WARDROBE: Souvenir[] = buildWardrobe(wardrobeData)
