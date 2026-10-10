/**
 * The journey: Leo and Bonchita tour Argentina. Each CEFR level is a region and
 * each unit is a stop. Pure data + helpers; the course page renders it.
 */
import type { LevelId } from './schema'

export interface Stop {
  unitId: string
  name: string
  emoji: string
  /** One-line Spanish caption shown on the stop card. */
  es: string
  en: string
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

const BY_UNIT = new Map<string, { region: Region; stop: Stop; index: number }>()
for (const region of REGIONS) region.stops.forEach((stop, index) => BY_UNIT.set(stop.unitId, { region, stop, index }))

export function stopFor(unitId: string): { region: Region; stop: Stop; index: number } | undefined {
  return BY_UNIT.get(unitId)
}
export function regionFor(level: LevelId): Region | undefined {
  return REGIONS.find((r) => r.level === level)
}

/** Souvenirs the dogs can find at each region, awarded by quests and surprise finds. */
export interface Souvenir {
  id: string
  level: LevelId
  emoji: string
  es: string
  en: string
  blurb: string
}
const S = (level: LevelId, rows: [string, string, string, string, string][]): Souvenir[] => rows.map(([id, emoji, es, en, blurb]) => ({ id, level, emoji, es, en, blurb }))
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
]
export function souvenirsFor(level: LevelId): Souvenir[] {
  return SOUVENIRS.filter((s) => s.level === level)
}
export function souvenirById(id: string): Souvenir | undefined {
  return SOUVENIRS.find((s) => s.id === id)
}
