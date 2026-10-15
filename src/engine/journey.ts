/**
 * The journey: Leo and Bonchita tour Argentina. Each CEFR level is a region and
 * each unit is a stop. Pure data + helpers; the course page renders it.
 */
import type { LevelId } from './schema'
import type { LessonRow } from './types'
import { STOP_FACTS } from './journey-facts'

export interface Stop {
  unitId: string
  name: string
  emoji: string
  /** One-line Spanish caption shown on the stop card. */
  es: string
  en: string
  /** A short fact about the place, in Spanish at the region's level and in English, shown when the stamp is earned. */
  fact?: { es: string; en: string }
}
export interface Region {
  level: LevelId
  name: string
  es: string
  gradient: string
  stops: Stop[]
}

const R = (level: LevelId, name: string, es: string, gradient: string, stops: [string, string, string, string][]): Region => ({
  level,
  name,
  es,
  gradient,
  stops: stops.map(([n, emoji, esLine, enLine], i) => ({ unitId: `${level}.u${String(i + 1).padStart(2, '0')}`, name: n, emoji, es: esLine, en: enLine })),
})

export const REGIONS: Region[] = [
  R('a1', 'Buenos Aires', 'La gran ciudad', 'level-a1', [
    ['Aeropuerto de Ezeiza', '🛬', '¡Hola, Argentina!', 'Hello, Argentina!'],
    ['San Telmo', '🎻', 'Tango en la plaza', 'Tango in the square'],
    ['Plaza de Mayo', '🏛️', 'El corazón de la ciudad', 'The heart of the city'],
    ['La Boca', '🎨', 'Casas de colores', 'Colourful houses'],
    ['Puerto Madero', '🥩', 'Una parrilla junto al río', 'A grill by the river'],
    ['Palermo', '🌳', 'Parques y cafés', 'Parks and cafés'],
    ['Recoleta', '📚', 'Librerías y jardines', 'Bookshops and gardens'],
    ['Calle Florida', '🛍️', 'De compras', 'Shopping'],
    ['Delta del Tigre', '🚤', 'Un paseo en lancha', 'A boat ride'],
    ['Barrio Chino', '🥟', 'Sabores de Belgrano', 'Flavours of Belgrano'],
    ['Teatro Colón', '🎭', 'Una noche de ópera', 'A night at the opera'],
    ['Costanera Sur', '🐦', 'Adiós a la ciudad', 'Goodbye to the city'],
  ]),
  R('a2', 'Pampa y Litoral', 'Ríos, campo y cataratas', 'level-a2', [
    ['Luján', '⛪', 'La basílica y la feria', 'The basilica and the fair'],
    ['San Antonio de Areco', '🐎', 'Un día de gauchos', 'A day with the gauchos'],
    ['Rosario', '🚩', 'A orillas del Paraná', 'On the banks of the Paraná'],
    ['Santa Fe', '🌉', 'Puentes y alfajores', 'Bridges and alfajores'],
    ['Paraná', '🛶', 'Costanera y sol', 'Riverside and sun'],
    ['Colón', '♨️', 'Termas y descanso', 'Hot springs and rest'],
    ['Gualeguaychú', '🎉', '¡Carnaval!', 'Carnival!'],
    ['Corrientes', '🎶', 'Chamamé y tereré', 'Chamamé and tereré'],
    ['Resistencia', '🗿', 'La ciudad de las esculturas', 'The city of sculptures'],
    ['Cataratas del Iguazú', '🌊', 'La Garganta del Diablo', "The Devil's Throat"],
    ['Posadas', '🌿', 'Tierra de yerba mate', 'Land of yerba mate'],
    ['San Ignacio', '🏚️', 'Ruinas jesuíticas', 'Jesuit ruins'],
  ]),
  R('b1', 'El Norte', 'Montañas de colores', 'level-b1', [
    ['Córdoba', '🎓', 'La docta', 'The learned city'],
    ['Alta Gracia', '🏡', 'Sierras y estancias', 'Hills and estancias'],
    ['Villa General Belgrano', '🍺', 'Un pueblo alpino', 'An Alpine village'],
    ['Santiago del Estero', '🥁', 'Chacareras', 'Chacareras'],
    ['Tucumán', '📜', 'La casa de la independencia', 'The house of independence'],
    ['Tafí del Valle', '🌄', 'Valles y quesos', 'Valleys and cheeses'],
    ['Cafayate', '🍇', 'Viñedos de altura', 'High-altitude vineyards'],
    ['Salta', '🥟', 'La linda', 'The beautiful one'],
    ['Purmamarca', '🌈', 'El cerro de los siete colores', 'The hill of seven colours'],
    ['Tilcara', '🪘', 'Pucará y carnaval', 'Pucará and carnival'],
    ['San Salvador de Jujuy', '🦙', 'Llamas y mercados', 'Llamas and markets'],
    ['Salinas Grandes', '🧂', 'Un desierto blanco', 'A white desert'],
  ]),
  R('b2', 'Cuyo', 'Cordillera y viñedos', 'level-b2', [
    ['San Juan', '☀️', 'Tierra del sol', 'Land of the sun'],
    ['Valle de la Luna', '🌙', 'Paisaje de otro planeta', 'A landscape from another planet'],
    ['Mendoza', '🍷', 'Capital del vino', 'Wine capital'],
    ['Maipú', '🚲', 'Bodegas en bici', 'Wineries by bike'],
    ['Aconcagua', '🏔️', 'El techo de América', 'The roof of the Americas'],
    ['Puente del Inca', '🌉', 'Un puente natural', 'A natural bridge'],
    ['Malargüe', '🔭', 'Noches de estrellas', 'Starry nights'],
    ['San Rafael', '🍑', 'Fruta y ríos', 'Fruit and rivers'],
    ['Cañón del Atuel', '🛶', 'Rafting en el cañón', 'Rafting in the canyon'],
    ['San Luis', '🌵', 'Sierras puntanas', 'Puntano hills'],
    ['Merlo', '🌬️', 'El microclima', 'The microclimate'],
    ['Talampaya', '🦖', 'Huellas de dinosaurios', 'Dinosaur footprints'],
  ]),
  R('c1', 'Patagonia', 'Lagos, bosques y ballenas', 'level-c1', [
    ['Neuquén', '🛢️', 'Puerta de la Patagonia', 'Gateway to Patagonia'],
    ['Villa La Angostura', '🌲', 'Bosque de arrayanes', 'Arrayán forest'],
    ['Bariloche', '🍫', 'Chocolate y lagos', 'Chocolate and lakes'],
    ['El Bolsón', '🍓', 'Feria y frutas finas', 'Fair and berries'],
    ['Esquel', '🚂', 'La Trochita', 'The Old Patagonian Express'],
    ['Puerto Madryn', '🐋', 'Ballenas francas', 'Southern right whales'],
    ['Península Valdés', '🦭', 'Elefantes marinos', 'Elephant seals'],
    ['Trelew', '🏴', 'Herencia galesa', 'Welsh heritage'],
    ['Los Antiguos', '🍒', 'Cerezas junto al lago', 'Cherries by the lake'],
    ['El Chaltén', '🥾', 'El Fitz Roy', 'Fitz Roy'],
  ]),
  R('c2', 'Fin del mundo', 'Hielo, viento y vuelta a casa', 'level-c2', [
    ['El Calafate', '🧊', 'El glaciar Perito Moreno', 'The Perito Moreno glacier'],
    ['Río Gallegos', '💨', 'Viento patagónico', 'Patagonian wind'],
    ['Ushuaia', '⚓', 'La ciudad más austral', 'The southernmost city'],
    ['Tren del Fin del Mundo', '🚞', 'El último tren', 'The last train'],
    ['Canal Beagle', '🛥️', 'Navegando el Beagle', 'Sailing the Beagle'],
    ['Isla Martillo', '🐧', 'Pingüinos', 'Penguins'],
    ['Antártida', '🐻‍❄️', 'Hielo hasta el horizonte', 'Ice to the horizon'],
    ['Vuelta a Buenos Aires', '🏠', '¡Lo logramos!', 'We made it!'],
  ]),
]

for (const r of REGIONS) for (const s of r.stops) if (STOP_FACTS[s.unitId]) s.fact = STOP_FACTS[s.unitId]

const BY_UNIT = new Map<string, { region: Region; stop: Stop; index: number }>()
for (const region of REGIONS) region.stops.forEach((stop, index) => BY_UNIT.set(stop.unitId, { region, stop, index }))

export function stopFor(unitId: string): { region: Region; stop: Stop; index: number } | undefined {
  return BY_UNIT.get(unitId)
}
export function regionFor(level: LevelId): Region | undefined {
  return REGIONS.find((r) => r.level === level)
}

/** Lessons of a unit that earn its passport stamp: four, or every lesson when the unit has fewer. */
export function stampTarget(lessonCount: number): number {
  return Math.min(4, Math.max(1, lessonCount || 4))
}
/** A stop is stamped once enough of its lessons have been completed at least once. */
export function isStamped(unitId: string, rows: ReadonlyMap<string, LessonRow> | LessonRow[], lessonCount = 4): boolean {
  const list = Array.isArray(rows) ? rows : [...rows.values()]
  const done = list.filter((r) => r.unitId === unitId && r.completions > 0).length
  return done >= stampTarget(lessonCount)
}

/** Souvenirs the dogs can find at each region, awarded by quests and surprise finds. */
export type WearSlot = 'hat' | 'neck' | 'mouth' | 'paw'
export interface Souvenir {
  id: string
  level: LevelId
  emoji: string
  es: string
  en: string
  blurb: string
  /** Souvenirs the dogs can wear or carry (see the Perros page). */
  wearable?: { slot: WearSlot }
  /** Region badges earned by passing the region quiz; never handed out by quests. */
  badge?: boolean
}
const WEARABLE: Record<string, WearSlot> = {
  mate: 'paw', alfajor: 'mouth', bandoneon: 'paw', camiseta: 'neck', medialuna: 'mouth', choripan: 'mouth',
  terere: 'paw', mascara: 'hat', boina: 'hat', chamame: 'paw',
  poncho: 'neck', empanada: 'mouth', charango: 'paw', coca: 'paw', sal: 'paw',
  vino: 'paw', botas: 'paw', pluma: 'hat', fosil: 'mouth',
  chocolate: 'mouth', calafate: 'paw', ballena: 'paw', cereza: 'mouth',
  hielo: 'paw', pinguino: 'paw', faro: 'hat', centolla: 'mouth', bandera: 'paw',
}
const S = (level: LevelId, rows: [string, string, string, string, string][]): Souvenir[] => rows.map(([id, emoji, es, en, blurb]) => ({ id, level, emoji, es, en, blurb, ...(WEARABLE[id] ? { wearable: { slot: WEARABLE[id] } } : {}) }))
export const SOUVENIRS: Souvenir[] = [
  ...S('a1', [
    ['mate', '🧉', 'un mate', 'a mate gourd', 'Bonchita sniffs it suspiciously; Leo wants the bombilla.'],
    ['alfajor', '🍪', 'un alfajor', 'an alfajor', 'Two cookies, dulce de leche in the middle. Gone in seconds.'],
    ['bandoneon', '🪗', 'un bandoneón', 'a bandoneón', 'The sound of tango. Leo howls along.'],
    ['camiseta', '👕', 'una camiseta de fútbol', 'a football shirt', 'Blue and yellow, from La Boca.'],
    ['medialuna', '🥐', 'una medialuna', 'a croissant', 'Breakfast in Palermo, with café con leche.'],
    ['choripan', '🌭', 'un choripán', 'a chorizo sandwich', 'Costanera classic. Bonchita approves.'],
    ['fileteado', '🖼️', 'un cartel fileteado', 'a fileteado sign', 'Swirly painted letters from San Telmo.'],
  ]),
  ...S('a2', [
    ['terere', '🥤', 'un tereré', 'a tereré', 'Cold mate for the hot Litoral.'],
    ['yerba', '🌿', 'un paquete de yerba', 'a packet of yerba', 'Straight from Posadas.'],
    ['mascara', '🎭', 'una máscara de carnaval', 'a carnival mask', 'Gualeguaychú glitter everywhere.'],
    ['postal', '📮', 'una postal de Iguazú', 'an Iguazú postcard', 'Wet from the spray.'],
    ['boina', '🧢', 'una boina gaucha', 'a gaucho beret', 'Leo wears it sideways.'],
    ['chamame', '💿', 'un disco de chamamé', 'a chamamé record', 'Accordion music for the road.'],
  ]),
  ...S('b1', [
    ['poncho', '🧣', 'un poncho salteño', 'a Salta poncho', 'Red and black, warm at night.'],
    ['empanada', '🥟', 'una empanada salteña', 'a Salta empanada', 'Cut with a knife, eaten by hand.'],
    ['charango', '🪕', 'un charango', 'a charango', 'Tiny guitar, big sound.'],
    ['cardon', '🌵', 'un cardón de madera', 'a wooden cardón', 'A cactus souvenir from Humahuaca.'],
    ['coca', '🍵', 'té de coca', 'coca tea', 'For the altitude in Purmamarca.'],
    ['sal', '🧂', 'sal de las Salinas', 'salt from the Salinas', 'A white cube from the white desert.'],
  ]),
  ...S('b2', [
    ['vino', '🍷', 'una botella de malbec', 'a bottle of Malbec', 'From Maipú, by bike.'],
    ['aceite', '🫒', 'aceite de oliva', 'olive oil', 'San Juan gold.'],
    ['botas', '🥾', 'unas botas de montaña', 'mountain boots', 'Aconcagua-ready.'],
    ['pluma', '🪶', 'una pluma de cóndor', 'a condor feather', 'Luna found it on the trail. Probably.'],
    ['fosil', '🦴', 'un fósil (de juguete)', 'a (toy) fossil', 'From Talampaya.'],
  ]),
  ...S('c1', [
    ['chocolate', '🍫', 'chocolate de Bariloche', 'Bariloche chocolate', 'Not for dogs. Leo is outraged.'],
    ['calafate', '🫐', 'dulce de calafate', 'calafate jam', 'Eat it and you return to Patagonia.'],
    ['ballena', '🐋', 'una ballena de madera', 'a wooden whale', 'From Puerto Madryn.'],
    ['trochita', '🎫', 'un boleto de La Trochita', 'a Trochita ticket', 'Steam, smoke and sheep.'],
    ['cereza', '🍒', 'cerezas de Los Antiguos', 'Los Antiguos cherries', 'The sweetest in the south.'],
  ]),
  ...S('c2', [
    ['hielo', '🧊', 'hielo del glaciar', 'glacier ice', 'It melted. The memory did not.'],
    ['pinguino', '🐧', 'un pingüino de peluche', 'a penguin plush', 'Bonchita has adopted it.'],
    ['faro', '🗼', 'un faro en miniatura', 'a miniature lighthouse', 'The Lighthouse at the End of the World.'],
    ['centolla', '🦀', 'una centolla', 'a king crab', 'Ushuaia dinner.'],
    ['bandera', '🏁', 'la bandera del viaje', 'the journey flag', 'Signed by all three dogs. Paw prints.'],
  ]),
  // Region badges: earned with 80% or more in the region quiz.
  ...REGIONS.map((r) => ({ id: `badge-${r.level}`, level: r.level, emoji: '🏅', es: `insignia de ${r.name}`, en: `${r.name} badge`, blurb: `Passed the ${r.name} region quiz.`, badge: true }) as Souvenir),
]
export function wearableSouvenirs(): Souvenir[] {
  return SOUVENIRS.filter((s) => s.wearable)
}
export function souvenirsFor(level: LevelId): Souvenir[] {
  return SOUVENIRS.filter((s) => s.level === level)
}
export function souvenirById(id: string): Souvenir | undefined {
  return SOUVENIRS.find((s) => s.id === id)
}
