/**
 * The shared vocabulary between souvenir data and souvenir illustrations.
 * Every souvenir (content/<lang>/journey.yaml) names one `art` kind from ART_KINDS and
 * optionally a colour; src/components/art/SouvenirArt.tsx draws each kind. Wardrobe items
 * (accessories in colours, earned once regional souvenirs run out) use WARDROBE_KINDS.
 */

/** Where an item sits on a dog in the dress-up. */
export const WEAR_SLOTS = ['hat', 'eyes', 'neck', 'mouth', 'paw'] as const
export type WearSlot = (typeof WEAR_SLOTS)[number]

/** Objects the illustrator can draw. Keep in sync with SouvenirArt. */
export const ART_KINDS = [
  // food and drink
  'mate', 'cookie', 'empanada', 'croissant', 'baguette', 'pizza', 'gelato', 'coffee', 'teacup', 'wine', 'cheese',
  'dumpling', 'bun', 'noodles', 'mooncake', 'eggtart', 'chocolate', 'candy', 'sandwich', 'grill', 'fish', 'fruit', 'coconut', 'pastry', 'jam',
  // music
  'guitar', 'accordion', 'drum', 'maracas', 'violin', 'flute', 'tambourine',
  // clothing worn as souvenirs
  'poncho', 'football-shirt', 'sombrero', 'fan', 'flower', 'lei', 'necklace', 'bracelet', 'carnival-mask', 'gloves',
  // objects
  'football', 'flag', 'map', 'postcard', 'book', 'camera', 'ticket', 'key', 'lantern', 'kite', 'toy-boat', 'shell', 'stone',
  'feather', 'compass', 'keychain', 'snowglobe', 'figurine', 'painting', 'vase', 'candle', 'perfume', 'soap', 'cactus',
  'leaf', 'star', 'medal', 'tile', 'chopsticks', 'abacus', 'bell', 'scroll', 'mirror', 'puppet', 'origami', 'pinwheel',
  // wardrobe (accessories that come in colours)
  'beret', 'cap', 'beanie', 'sunhat', 'bucket-hat', 'scarf', 'bandana', 'bowtie', 'sunglasses', 'round-glasses', 'umbrella', 'balloon',
] as const
export type ArtKind = (typeof ART_KINDS)[number]

/** Accessories that come in every WARDROBE_COLOURS colour, with the slot they are worn in. */
export const WARDROBE_KINDS: { kind: ArtKind; slot: WearSlot }[] = [
  { kind: 'beret', slot: 'hat' },
  { kind: 'cap', slot: 'hat' },
  { kind: 'beanie', slot: 'hat' },
  { kind: 'sunhat', slot: 'hat' },
  { kind: 'bucket-hat', slot: 'hat' },
  { kind: 'sunglasses', slot: 'eyes' },
  { kind: 'round-glasses', slot: 'eyes' },
  { kind: 'scarf', slot: 'neck' },
  { kind: 'bandana', slot: 'neck' },
  { kind: 'bowtie', slot: 'neck' },
  { kind: 'umbrella', slot: 'paw' },
  { kind: 'balloon', slot: 'paw' },
]

/** Colours the wardrobe comes in (hex is the illustration's main colour). */
export const WARDROBE_COLOURS = [
  { id: 'red', hex: '#d4483c' },
  { id: 'blue', hex: '#2f5bd3' },
  { id: 'green', hex: '#3f8f5f' },
  { id: 'yellow', hex: '#e9b92e' },
  { id: 'purple', hex: '#7a55c2' },
  { id: 'pink', hex: '#e07aa6' },
  { id: 'orange', hex: '#e0782e' },
  { id: 'black', hex: '#2a2d3a' },
] as const
export type WardrobeColour = (typeof WARDROBE_COLOURS)[number]['id']
