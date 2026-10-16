/**
 * Which painting goes on each stop's postcard. A stop maps to a motif (harbour,
 * old town, snowy mountains…), an optional variant and accent (penguins, a tram,
 * fireworks), a time of day, a palette for its region (level) and a seed for the
 * small variations. Heuristics read the stop's emoji and its name/caption; an
 * explicit table fixes the places where they would get it wrong.
 */
import type { LevelId } from './schema'
import { COURSE_ID } from './course'

export const MOTIFS = [
  'skyline', 'oldtown', 'harbour', 'beach', 'cliffs', 'lighthouse', 'mountains', 'glacier', 'lake', 'forest',
  'vineyard', 'desert', 'waterfall', 'bridge', 'plaza', 'ruins', 'castle', 'market', 'temple', 'towercity',
  'farm', 'airport', 'railway', 'island', 'stadium', 'tower', 'canal', 'garden', 'volcano', 'rainforest',
] as const
export type Motif = (typeof MOTIFS)[number]

export const ACCENTS = [
  'boats', 'sailboats', 'ferry', 'whale', 'penguins', 'flamingos', 'birds', 'horses', 'llamas', 'cows',
  'fireworks', 'lanterns', 'tram', 'cablecar', 'gondola', 'dolphins', 'seals', 'stars', 'balloons', 'bikes',
] as const
export type Accent = (typeof ACCENTS)[number]

export type TimeOfDay = 'dawn' | 'day' | 'golden' | 'dusk' | 'night'

export interface Palette {
  /** Sky top and horizon (daylight; the renderer shifts them for the time of day). */
  sky: [string, string]
  far: string
  mid: string
  near: string
  ground: string
  water: string
  foliage: string
  /** Walls and roofs. */
  buildings: string[]
  /** Region ink, used for small accents (flags, awnings, boats). */
  ink: string
  sun: string
}

export interface SceneSpec {
  motif: Motif
  /** A motif's sub-form, e.g. tower: lattice | needle | leaning | pagoda. */
  variant?: string
  accent?: Accent
  time: TimeOfDay
  palette: Palette
  seed: number
  level: LevelId
}

export interface StopLike {
  unitId: string
  name: string
  emoji: string
  en: string
  es: string
}

/** One palette per region, so each region of the journey feels distinct. */
export const PALETTES: Record<LevelId, Palette> = {
  // A1: warm terracotta city light
  a1: { sky: ['#8fb8de', '#f8dcc0'], far: '#b9a3b6', mid: '#c7876a', near: '#8a5644', ground: '#dcb68e', water: '#6b9cc2', foliage: '#6e8f4c', buildings: ['#e27d60', '#f3cd8e', '#ebb5a0', '#c95b4a', '#f5e3c4', '#8fb4c9'], ink: '#d4583f', sun: '#fbe3a6' },
  // A2: golden ochre plains and rivers
  a2: { sky: ['#9cc4de', '#fbe4b2'], far: '#a9b39f', mid: '#c9a24f', near: '#7d8a3e', ground: '#e3c47c', water: '#5d97a9', foliage: '#7b9a46', buildings: ['#f2d49c', '#e7a65a', '#f6e9cd', '#c97f3a', '#e9c6a0', '#9fb9a2'], ink: '#d99227', sun: '#fde7a2' },
  // B1: sage and earth, hills and stone towns
  b1: { sky: ['#9ec3d4', '#eee5c4'], far: '#9fb1a9', mid: '#6f9a6a', near: '#3e6d4a', ground: '#bea97b', water: '#568f97', foliage: '#4f8a55', buildings: ['#eadcc0', '#c98f6a', '#d9b07a', '#a9c4a0', '#f1e6cf', '#b77a5c'], ink: '#3f8f5f', sun: '#f6e7b0' },
  // B2: ultramarine sea and whitewashed light
  b2: { sky: ['#78aae4', '#e6f0f6'], far: '#9db4d8', mid: '#5a86c4', near: '#2f5f9e', ground: '#e9d7b1', water: '#2f7fc0', foliage: '#5f9a6a', buildings: ['#f4ebd9', '#f2c879', '#e88b6a', '#9cc6e8', '#fbf3e3', '#d9a07a'], ink: '#2f6fc0', sun: '#fff1c4' },
  // C1: violet slate, misty and grand
  c1: { sky: ['#9696d4', '#f3d8df'], far: '#aaa5c9', mid: '#7d74b0', near: '#4e4979', ground: '#c9b9a9', water: '#5c6fae', foliage: '#5f7f6a', buildings: ['#e7dcef', '#c9a8d0', '#f0d0b8', '#8f84c0', '#f5ead9', '#b98fa0'], ink: '#6d55c2', sun: '#fbe2c0' },
  // C2: rose and cold blush, the far south and the way home
  c2: { sky: ['#c597b6', '#fbe1d2'], far: '#c9b5c9', mid: '#a97899', near: '#6a4a6a', ground: '#e9d9d1', water: '#7d8eb8', foliage: '#6f8a7a', buildings: ['#f2dde4', '#d98fa8', '#f5e6d2', '#b8406f', '#e8c7b0', '#a9b8d8'], ink: '#b8406f', sun: '#fde4cf' },
}

type Pick = { motif: Motif; variant?: string; accent?: Accent; time?: TimeOfDay }
const P = (motif: Motif, variant?: string, accent?: Accent, time?: TimeOfDay): Pick => ({ motif, variant, accent, time })

/** Emoji → a first guess. */
const BY_EMOJI: Record<string, Pick> = {
  '🛬': P('airport'), '✈️': P('airport'), '🛩️': P('airport'),
  '🏙️': P('skyline'), '🌆': P('skyline', undefined, undefined, 'dusk'), '🌃': P('skyline', 'harbour', undefined, 'night'), '🎰': P('skyline', undefined, 'fireworks', 'night'), '🏢': P('towercity'),
  '🎨': P('oldtown', 'colourful'), '🏘️': P('oldtown', 'colourful'), '📚': P('oldtown'), '📜': P('oldtown'), '🍪': P('oldtown'), '🎻': P('oldtown', 'balconies', undefined, 'golden'), '🎸': P('oldtown', 'hill', 'tram', 'dusk'),
  '⚓': P('harbour'), '⛴️': P('harbour', undefined, 'ferry'), '🚣': P('harbour', undefined, 'boats'), '🦞': P('harbour', 'village', 'boats', 'dusk'), '🛥️': P('harbour', undefined, 'sailboats'), '⛵': P('harbour', undefined, 'sailboats'),
  '🏖️': P('beach'), '🏄': P('beach', 'waves'), '🐚': P('beach', 'tropical'), '🌅': P('beach', undefined, undefined, 'golden'),
  '🪨': P('cliffs'), '🦭': P('beach', 'rocky', 'seals'), '🐋': P('cliffs', undefined, 'whale'),
  '💡': P('lighthouse'),
  '🏔️': P('mountains'), '🥾': P('mountains'), '⛰️': P('mountains', 'green'), '🦁': P('mountains', 'green'), '🌄': P('mountains', 'valley', undefined, 'dawn'), '🦙': P('mountains', 'andes', 'llamas'), '🔭': P('mountains', undefined, 'stars', 'night'), '🚠': P('mountains', 'green', 'cablecar'), '🚡': P('mountains', undefined, 'cablecar'),
  '🧊': P('glacier'), '🐻‍❄️': P('glacier', 'antarctic'), '🐧': P('glacier', 'shore', 'penguins'),
  '🦢': P('lake', undefined, 'birds'), '♨️': P('lake', 'springs'), '🍒': P('lake'), '🏞️': P('lake'),
  '🌲': P('forest'), '🌳': P('garden', 'park'),
  '🍇': P('vineyard'), '🍷': P('vineyard'), '🚲': P('vineyard', undefined, 'bikes'),
  '🌵': P('desert'), '🌙': P('desert', 'moon', undefined, 'dusk'), '🦖': P('desert', 'canyon'), '🌈': P('desert', 'rainbow'), '🧂': P('desert', 'salt'), '🏜️': P('desert', 'dunes'), '☀️': P('desert'),
  '🌊': P('waterfall'), '💦': P('waterfall'), '✨': P('waterfall', 'canyon'), '💧': P('desert', 'lagoons'),
  '🌉': P('bridge'),
  '⛪': P('plaza', 'cathedral'), '⛲': P('plaza', 'fountain'), '🎭': P('plaza', 'theatre', undefined, 'dusk'), '🎼': P('plaza', 'theatre', undefined, 'dusk'), '🎓': P('plaza', 'college'), '🥁': P('plaza', 'colonial'), '🗿': P('plaza', 'statues'),
  '🏛️': P('ruins', 'columns'), '🏟️': P('ruins', 'amphitheatre'), '🏚️': P('ruins', 'mission'), '🏺': P('ruins', 'columns'),
  '🏰': P('castle'), '💣': P('castle', 'fortress'), '👑': P('castle', 'chateau'),
  '🛍️': P('market', 'street'), '🥟': P('market'), '🍜': P('market', undefined, 'lanterns'), '🐠': P('market', 'neon', undefined, 'dusk'), '🍉': P('market'), '🔌': P('market', 'neon'), '🍛': P('market'), '🥚': P('market', 'night', undefined, 'night'), '🥮': P('market'), '🍅': P('market'), '🥪': P('market', 'hall'),
  '🏮': P('temple', undefined, 'lanterns'), '🐟': P('temple', 'incense'), '🛕': P('temple', 'monastery'), '🪵': P('temple', 'hall'), '🥋': P('temple'), '🧘': P('temple', 'buddha'),
  '🚋': P('towercity', undefined, 'tram'),
  '🐎': P('farm', 'pampa', 'horses'), '🐃': P('farm', 'pasture', 'cows'), '🐄': P('farm', 'pasture', 'cows'), '🧀': P('farm', 'pasture', 'cows'), '🍓': P('farm', 'orchard'), '🍑': P('farm', 'orchard'), '🏡': P('farm'), '🌻': P('farm', 'sunflowers'), '🪻': P('farm', 'lavender'), '🌾': P('farm', 'cypress'), '🌿': P('farm', 'tea'),
  '🚂': P('railway', 'steam'), '🚞': P('railway', 'mountain'), '🛤️': P('railway'),
  '🏝️': P('island'), '🐬': P('island', undefined, 'dolphins'),
  '⚽': P('stadium'), '🏇': P('stadium', 'racecourse', undefined, 'night'), '🎤': P('stadium', 'arena', undefined, 'night'),
  '🗼': P('tower', 'needle'), '🪂': P('tower', 'needle'),
  '🛶': P('canal', 'river'), '🚤': P('canal', 'delta'), '🍮': P('canal'),
  '🌸': P('garden'), '🪷': P('garden', 'pond'), '🐦': P('lake', 'wetland', 'birds'),
  '🌋': P('volcano'),
  '🐊': P('rainforest', 'wetland'),
  '🎆': P('skyline', 'harbour', 'fireworks', 'night'), '🎉': P('oldtown', 'carnival', 'fireworks', 'dusk'),
}

/** Keywords in the stop's name or English caption → a guess (checked before the emoji). */
const KEYWORDS: [RegExp, Pick][] = [
  [/\bairport\b|aeroporto|aeropuerto|fiumicino|roissy/i, P('airport')],
  [/glacier|perito moreno|antártida|antarctic/i, P('glacier')],
  [/lighthouse|faro|farol|phare/i, P('lighthouse')],
  [/waterfall|cataratas|falls|cascade/i, P('waterfall')],
  [/vineyard|wine|vino|vinho/i, P('vineyard')],
  [/\bbridge|ponte|puente|pont\b/i, P('bridge')],
  [/\bdunes?\b/i, P('desert', 'dunes')],
  [/temple|templo|tin hau|monastery/i, P('temple')],
  [/cathedral|duomo|basilica|catedral/i, P('plaza', 'cathedral')],
  [/canals?\b|gondola|venice|venezia/i, P('canal')],
  [/\btrain\b|railway|express/i, P('railway', 'steam')],
  [/garden|jardim|jardin|giardino/i, P('garden')],
  [/castle|château|chateau|palace|fort\b/i, P('castle')],
  [/market|mercado|mercato|marché/i, P('market')],
  [/\blakes?\b|lago|lac\b/i, P('lake')],
  [/harbour|port\b|porto\b|puerto/i, P('harbour')],
  [/beach|plage|praia|playa/i, P('beach')],
]

/**
 * Explicit choices, keyed `${courseId}:${unitId}`. These win over the heuristics and
 * make sure every real place gets a painting that looks like it.
 */
export const SCENE_OVERRIDES: Record<string, Pick> = {
  // ---------------------------------------------------------------- Spanish: Argentina
  'es:a1.u03': P('plaza', 'cathedral'),
  'es:a1.u04': P('oldtown', 'colourful'),
  'es:a1.u05': P('skyline', 'docks', undefined, 'golden'),
  'es:a1.u06': P('garden', 'park'),
  'es:a1.u07': P('plaza', 'dome'),
  'es:a1.u08': P('market', 'street'),
  'es:a1.u09': P('canal', 'delta', 'boats'),
  'es:a1.u10': P('market', undefined, 'lanterns', 'dusk'),
  'es:a1.u12': P('lake', 'wetland', 'birds', 'golden'),
  'es:a2.u01': P('plaza', 'cathedral'),
  'es:a2.u03': P('bridge', 'cable', undefined, 'golden'),
  'es:a2.u04': P('bridge', 'suspension'),
  'es:a2.u05': P('canal', 'river', 'boats'),
  'es:a2.u06': P('lake', 'springs'),
  'es:a2.u07': P('oldtown', 'carnival', 'fireworks', 'dusk'),
  'es:a2.u08': P('canal', 'river', undefined, 'golden'),
  'es:a2.u09': P('plaza', 'statues'),
  'es:a2.u11': P('farm', 'tea'),
  'es:b1.u01': P('plaza', 'college'),
  'es:b1.u02': P('farm', 'estancia'),
  'es:b1.u03': P('oldtown', 'alpine'),
  'es:b1.u04': P('plaza', 'colonial', undefined, 'dusk'),
  'es:b1.u05': P('oldtown', 'colonial'),
  'es:b1.u06': P('mountains', 'valley', undefined, 'dawn'),
  'es:b1.u08': P('plaza', 'colonial'),
  'es:b1.u10': P('desert', 'rainbow'),
  'es:b1.u11': P('mountains', 'andes', 'llamas'),
  'es:b2.u01': P('desert', 'mesa'),
  'es:b2.u06': P('mountains', 'arch'),
  'es:b2.u08': P('farm', 'orchard'),
  'es:b2.u09': P('desert', 'canyon', undefined, 'day'),
  'es:b2.u10': P('mountains', 'green'),
  'es:b2.u11': P('mountains', 'green', 'birds'),
  'es:c1.u01': P('skyline', 'river'),
  'es:c1.u03': P('lake', 'alpine'),
  'es:c1.u04': P('farm', 'orchard'),
  'es:c1.u06': P('cliffs', 'bay', 'whale'),
  'es:c1.u07': P('beach', 'rocky', 'seals'),
  'es:c1.u08': P('farm', 'chapel'),
  'es:c1.u09': P('lake', 'orchard'),
  'es:c2.u02': P('farm', 'steppe'),
  'es:c2.u03': P('harbour', 'mountains'),
  'es:c2.u05': P('lighthouse', 'islet', 'sailboats'),
  'es:c2.u06': P('glacier', 'shore', 'penguins'),
  'es:c2.u08': P('skyline', 'obelisk', 'fireworks', 'night'),
  // ---------------------------------------------------------------- Cantonese: Hong Kong, Macau, Guangdong
  'yue:a1.u02': P('skyline', 'harbour'),
  'yue:a1.u03': P('mountains', 'peak', 'tram'),
  'yue:a1.u04': P('harbour', 'skyline', 'ferry'),
  'yue:a1.u05': P('temple', 'incense'),
  'yue:a1.u06': P('market', 'neon', 'tram', 'dusk'),
  'yue:a1.u07': P('towercity', undefined, 'tram'),
  'yue:a1.u08': P('stadium', 'racecourse', undefined, 'night'),
  'yue:a1.u09': P('beach', 'village'),
  'yue:a1.u10': P('harbour', 'village', 'boats'),
  'yue:a1.u11': P('towercity', 'terminus', 'tram', 'golden'),
  'yue:a1.u12': P('towercity', 'monster'),
  'yue:a2.u01': P('skyline', 'harbour', undefined, 'night'),
  'yue:a2.u02': P('market', 'neon', undefined, 'dusk'),
  'yue:a2.u03': P('temple', 'incense'),
  'yue:a2.u06': P('market', 'neon', undefined, 'dusk'),
  'yue:a2.u07': P('garden', 'pavilion'),
  'yue:a2.u11': P('airport', 'runway-park'),
  'yue:a2.u12': P('garden', 'pavilion'),
  'yue:b1.u01': P('temple', 'windmill'),
  'yue:b1.u02': P('railway', 'station'),
  'yue:b1.u03': P('cliffs', 'columns'),
  'yue:b1.u04': P('oldtown', 'walled'),
  'yue:b1.u05': P('market'),
  'yue:b1.u06': P('garden', 'wishing'),
  'yue:b1.u07': P('lake', 'wetland', 'birds', 'golden'),
  'yue:b1.u08': P('lake', 'reservoir', 'bikes'),
  'yue:b1.u09': P('temple', 'monastery', 'tram'),
  'yue:b1.u10': P('farm', 'village'),
  'yue:b1.u11': P('mountains', 'lionrock'),
  'yue:b1.u12': P('tower', 'pagoda'),
  'yue:b2.u01': P('mountains', 'green', 'cablecar'),
  'yue:b2.u02': P('temple', 'buddha'),
  'yue:b2.u03': P('harbour', 'stilts', 'dolphins'),
  'yue:b2.u04': P('farm', 'pasture', 'cows'),
  'yue:b2.u05': P('mountains', 'green', undefined, 'dawn'),
  'yue:b2.u06': P('island', 'village', 'boats'),
  'yue:b2.u07': P('island', 'green'),
  'yue:b2.u08': P('island', 'village', undefined, 'golden'),
  'yue:b2.u09': P('cliffs', 'rocks'),
  'yue:b2.u10': P('beach', 'bay', 'sailboats'),
  'yue:b2.u11': P('farm', 'pasture', 'cows'),
  'yue:b2.u12': P('island', 'rocks'),
  'yue:c1.u01': P('plaza', 'senado'),
  'yue:c1.u02': P('ruins', 'facade'),
  'yue:c1.u03': P('castle', 'fortress'),
  'yue:c1.u04': P('temple', undefined, 'lanterns'),
  'yue:c1.u05': P('tower', 'needle'),
  'yue:c1.u06': P('oldtown', 'colourful'),
  'yue:c1.u07': P('oldtown', 'chapel', undefined, 'golden'),
  'yue:c1.u08': P('lighthouse', 'hill'),
  'yue:c1.u09': P('garden', 'pavilion'),
  'yue:c1.u10': P('skyline', 'casino', 'fireworks', 'night'),
  'yue:c2.u01': P('oldtown', 'colonial'),
  'yue:c2.u02': P('temple', 'hall'),
  'yue:c2.u03': P('tower', 'canton', undefined, 'night'),
  'yue:c2.u04': P('market', 'street', 'lanterns'),
  'yue:c2.u05': P('garden', 'park'),
  'yue:c2.u06': P('temple', undefined, 'lanterns'),
  'yue:c2.u07': P('canal', 'water-town'),
  'yue:c2.u08': P('skyline', 'harbour', 'fireworks', 'night'),
  // ---------------------------------------------------------------- Portuguese: Brazil and Portugal
  'pt:a1.u02': P('beach', 'promenade'),
  'pt:a1.u03': P('beach', 'twin-peaks', undefined, 'golden'),
  'pt:a1.u04': P('mountains', 'corcovado'),
  'pt:a1.u05': P('island', 'sugarloaf', 'cablecar'),
  'pt:a1.u06': P('oldtown', 'hill', 'tram'),
  'pt:a1.u07': P('bridge', 'aqueduct', undefined, 'night'),
  'pt:a1.u08': P('stadium'),
  'pt:a1.u09': P('garden', 'palms'),
  'pt:a1.u10': P('plaza', 'theatre', undefined, 'dusk'),
  'pt:a1.u11': P('tower', 'saucer'),
  'pt:a1.u12': P('rainforest', 'hills'),
  'pt:a2.u01': P('skyline'),
  'pt:a2.u02': P('market', 'hall'),
  'pt:a2.u03': P('market', 'lanterns', 'lanterns', 'dusk'),
  'pt:a2.u04': P('garden', 'park'),
  'pt:a2.u05': P('harbour'),
  'pt:a2.u06': P('oldtown', 'colonial'),
  'pt:a2.u07': P('skyline', 'tube'),
  'pt:a2.u08': P('island', 'bridge'),
  'pt:a2.u10': P('oldtown', 'alpine'),
  'pt:a2.u11': P('canal', 'river', undefined, 'golden'),
  'pt:a2.u12': P('oldtown', 'alpine'),
  'pt:b1.u01': P('skyline', 'hills'),
  'pt:b1.u02': P('oldtown', 'colonial'),
  'pt:b1.u03': P('railway', 'steam'),
  'pt:b1.u04': P('garden', 'sculpture'),
  'pt:b1.u05': P('plaza', 'statues'),
  'pt:b1.u06': P('oldtown', 'balconies', undefined, 'dusk'),
  'pt:b1.u07': P('waterfall', 'highland'),
  'pt:b1.u08': P('skyline', 'brasilia'),
  'pt:b1.u09': P('oldtown', 'colonial', 'horses'),
  'pt:b1.u10': P('waterfall', 'canyon'),
  'pt:b1.u11': P('rainforest', 'wetland', 'birds'),
  'pt:b1.u12': P('lake', 'clear'),
  'pt:b2.u01': P('oldtown', 'colourful'),
  'pt:b2.u02': P('mountains', 'mesa'),
  'pt:b2.u03': P('bridge', 'river'),
  'pt:b2.u04': P('oldtown', 'hill', 'balloons'),
  'pt:b2.u05': P('beach', 'tropical', undefined, 'dawn'),
  'pt:b2.u06': P('desert', 'dunes'),
  'pt:b2.u07': P('beach', 'jangada', 'sailboats'),
  'pt:b2.u08': P('desert', 'dunes', undefined, 'golden'),
  'pt:b2.u10': P('oldtown', 'colonial'),
  'pt:b2.u11': P('beach', 'tropical'),
  'pt:c1.u01': P('rainforest', 'city'),
  'pt:c1.u02': P('plaza', 'theatre', undefined, 'dusk'),
  'pt:c1.u03': P('rainforest', 'meeting'),
  'pt:c1.u04': P('rainforest', 'islands', 'boats'),
  'pt:c1.u05': P('stadium', 'arena', 'fireworks', 'night'),
  'pt:c1.u06': P('rainforest', 'river', 'boats'),
  'pt:c1.u07': P('beach', 'river-beach'),
  'pt:c1.u08': P('harbour', 'market', 'boats'),
  'pt:c1.u09': P('farm', 'pasture', 'cows'),
  'pt:c1.u10': P('rainforest', 'river', undefined, 'golden'),
  'pt:c2.u01': P('oldtown', 'hill', 'tram', 'dusk'),
  'pt:c2.u02': P('tower', 'belem'),
  'pt:c2.u03': P('castle', 'palace'),
  'pt:c2.u04': P('plaza', 'college'),
  'pt:c2.u05': P('bridge', 'iron'),
  'pt:c2.u06': P('vineyard', 'terraces'),
  'pt:c2.u07': P('ruins', 'temple'),
  'pt:c2.u08': P('lighthouse', 'cape', undefined, 'golden'),
  // ---------------------------------------------------------------- Italian: Italy
  'it:a1.u02': P('ruins', 'amphitheatre'),
  'it:a1.u04': P('oldtown', 'balconies', undefined, 'dusk'),
  'it:a1.u05': P('plaza', 'fountain'),
  'it:a1.u06': P('plaza', 'fountain', undefined, 'golden'),
  'it:a1.u07': P('plaza', 'dome'),
  'it:a1.u09': P('plaza', 'dome'),
  'it:a1.u10': P('garden', 'park'),
  'it:a1.u11': P('market', 'trattoria'),
  'it:a1.u12': P('plaza', 'steps'),
  'it:a2.u01': P('plaza', 'dome'),
  'it:a2.u02': P('bridge', 'shops', undefined, 'golden'),
  'it:a2.u03': P('bridge', 'river'),
  'it:a2.u04': P('plaza', 'campo'),
  'it:a2.u05': P('castle', 'towers'),
  'it:a2.u06': P('tower', 'leaning'),
  'it:a2.u07': P('castle', 'walls', 'bikes'),
  'it:a2.u09': P('vineyard', 'hilltown'),
  'it:a2.u10': P('farm', 'cypress', undefined, 'golden'),
  'it:a2.u11': P('castle', 'hilltown'),
  'it:a2.u12': P('island', 'mediterranean', 'sailboats'),
  'it:b1.u01': P('plaza', 'gothic'),
  'it:b1.u02': P('canal', 'river', undefined, 'dusk'),
  'it:b1.u03': P('lake', 'villa'),
  'it:b1.u04': P('oldtown', 'balconies'),
  'it:b1.u05': P('canal', 'venice', 'gondola'),
  'it:b1.u06': P('canal', 'colourful', 'boats'),
  'it:b1.u07': P('mountains', 'dolomites', undefined, 'golden'),
  'it:b1.u08': P('oldtown', 'porticoes'),
  'it:b1.u09': P('farm', 'pasture', 'cows'),
  'it:b1.u10': P('tower', 'mole'),
  'it:b1.u11': P('harbour'),
  'it:b1.u12': P('cliffs', 'village'),
  'it:b2.u01': P('harbour', 'vesuvius'),
  'it:b2.u02': P('ruins', 'columns'),
  'it:b2.u03': P('volcano'),
  'it:b2.u04': P('cliffs', 'village'),
  'it:b2.u05': P('cliffs', 'faraglioni', 'boats'),
  'it:b2.u06': P('harbour', 'colourful', 'boats'),
  'it:b2.u07': P('oldtown', 'sassi', undefined, 'dusk'),
  'it:b2.u08': P('oldtown', 'trulli'),
  'it:b2.u09': P('plaza', 'baroque', undefined, 'golden'),
  'it:b2.u10': P('oldtown', 'colonial'),
  'it:b2.u11': P('cliffs', 'village', undefined, 'golden'),
  'it:b2.u12': P('ruins', 'temple'),
  'it:c1.u01': P('market', undefined, 'lanterns'),
  'it:c1.u02': P('plaza', 'cathedral'),
  'it:c1.u03': P('beach', 'rock'),
  'it:c1.u04': P('volcano', 'snow'),
  'it:c1.u05': P('plaza', 'fountain'),
  'it:c1.u06': P('harbour', 'island-town'),
  'it:c1.u07': P('ruins', 'temple', undefined, 'golden'),
  'it:c1.u08': P('lake', 'lagoon', 'flamingos'),
  'it:c1.u09': P('beach', 'emerald', 'sailboats'),
  'it:c1.u10': P('castle', 'seawall', undefined, 'golden'),
  'it:c2.u01': P('castle', 'hilltown'),
  'it:c2.u02': P('oldtown', 'hilltown', undefined, 'dusk'),
  'it:c2.u03': P('castle', 'palace'),
  'it:c2.u04': P('plaza', 'basilica'),
  'it:c2.u05': P('oldtown', 'hilltown', undefined, 'dusk'),
  'it:c2.u06': P('castle', 'hilltown'),
  'it:c2.u07': P('bridge', 'hilltown'),
  'it:c2.u08': P('ruins', 'amphitheatre', 'fireworks', 'night'),
  // ---------------------------------------------------------------- French: France and the francophone world
  'fr:a1.u02': P('tower', 'lattice'),
  'fr:a1.u03': P('oldtown', 'butte'),
  'fr:a1.u04': P('oldtown', 'balconies'),
  'fr:a1.u05': P('market', 'cafe'),
  'fr:a1.u06': P('plaza', 'gothic'),
  'fr:a1.u07': P('plaza', 'pyramid'),
  'fr:a1.u08': P('plaza', 'dome'),
  'fr:a1.u09': P('railway', 'metro'),
  'fr:a1.u10': P('garden', 'pond', 'sailboats'),
  'fr:a1.u11': P('bridge', 'river'),
  'fr:a1.u12': P('plaza', 'arch', 'fireworks', 'night'),
  'fr:a2.u01': P('plaza', 'gothic'),
  'fr:a2.u02': P('garden', 'pond'),
  'fr:a2.u03': P('cliffs', 'arch'),
  'fr:a2.u04': P('beach', 'memorial'),
  'fr:a2.u05': P('farm', 'orchard', 'cows'),
  'fr:a2.u06': P('castle', 'abbey-island'),
  'fr:a2.u07': P('castle', 'seawall', 'sailboats'),
  'fr:a2.u08': P('oldtown', 'timbered'),
  'fr:a2.u09': P('ruins', 'stones'),
  'fr:a2.u10': P('canal', 'river'),
  'fr:a2.u11': P('castle', 'chateau'),
  'fr:b1.u01': P('harbour'),
  'fr:b1.u02': P('plaza', 'hill-basilica'),
  'fr:b1.u03': P('cliffs', 'cove', 'sailboats'),
  'fr:b1.u04': P('plaza', 'fountain'),
  'fr:b1.u05': P('farm', 'lavender'),
  'fr:b1.u06': P('bridge', 'broken'),
  'fr:b1.u07': P('farm', 'sunflowers'),
  'fr:b1.u08': P('lake', 'lagoon', 'flamingos'),
  'fr:b1.u09': P('farm', 'flowers'),
  'fr:b1.u10': P('beach', 'promenade'),
  'fr:b1.u11': P('beach', 'promenade'),
  'fr:b1.u12': P('harbour', 'riviera', 'sailboats'),
  'fr:b2.u01': P('oldtown', 'balconies'),
  'fr:b2.u02': P('market', 'cafe', undefined, 'dusk'),
  'fr:b2.u03': P('plaza', 'cathedral', 'lanterns', 'night'),
  'fr:b2.u04': P('lake', 'alpine'),
  'fr:b2.u06': P('mountains', 'green', 'cablecar'),
  'fr:b2.u07': P('oldtown', 'timbered'),
  'fr:b2.u08': P('oldtown', 'tiled-roofs'),
  'fr:b2.u09': P('ruins', 'abbey'),
  'fr:b2.u10': P('plaza', 'gothic', 'lanterns', 'dusk'),
  'fr:b2.u11': P('canal', 'timbered', 'boats'),
  'fr:b2.u12': P('vineyard', 'village'),
  'fr:c1.u01': P('bridge', 'river', undefined, 'dusk'),
  'fr:c1.u03': P('desert', 'dunes'),
  'fr:c1.u04': P('beach', 'waves'),
  'fr:c1.u05': P('oldtown', 'timbered'),
  'fr:c1.u06': P('mountains', 'observatory', 'stars', 'night'),
  'fr:c1.u07': P('bridge', 'river', undefined, 'golden'),
  'fr:c1.u08': P('castle', 'walls'),
  'fr:c1.u09': P('cliffs', 'village'),
  'fr:c1.u10': P('harbour', 'citadel', 'sailboats'),
  'fr:c2.u01': P('plaza', 'grand'),
  'fr:c2.u02': P('lake', 'jet'),
  'fr:c2.u03': P('harbour', 'african', 'boats'),
  'fr:c2.u04': P('canal', 'river', 'boats', 'golden'),
  'fr:c2.u05': P('volcano', 'tropical'),
  'fr:c2.u06': P('rainforest', 'bayou', 'birds'),
  'fr:c2.u07': P('skyline', 'snow'),
  'fr:c2.u08': P('castle', 'chateau-frontenac', undefined, 'dusk'),
}

const TIMES: TimeOfDay[] = ['day', 'day', 'day', 'golden', 'dawn', 'dusk']

/** Guess a scene for any stop from its emoji and words (no overrides). */
export function guessScene(stop: StopLike): Pick | undefined {
  const text = `${stop.name} ${stop.en}`
  const byEmoji = BY_EMOJI[stop.emoji]
  for (const [re, pick] of KEYWORDS) if (re.test(text)) return byEmoji?.motif === pick.motif ? byEmoji : pick
  return byEmoji
}

function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const FALLBACK: Motif[] = ['oldtown', 'plaza', 'garden', 'bridge']

/** The painting for a stop. */
export function sceneFor(stop: StopLike, level: LevelId, courseId: string = COURSE_ID): SceneSpec {
  const seed = hash(`${courseId}:${stop.unitId}:${stop.name}`)
  const pick = SCENE_OVERRIDES[`${courseId}:${stop.unitId}`] ?? guessScene(stop) ?? { motif: FALLBACK[seed % FALLBACK.length]! }
  const time = pick.time ?? (/night|stars|opera|concert|lights|fireworks/i.test(stop.en) ? 'night' : /sunset/i.test(stop.en) ? 'golden' : /sunrise|dawn/i.test(stop.en) ? 'dawn' : TIMES[(seed >>> 8) % TIMES.length]!)
  return { motif: pick.motif, variant: pick.variant, accent: pick.accent, time, palette: PALETTES[level], seed, level }
}

/** A sample scene for each motif (used by the gallery). */
export function motifSample(motif: Motif, level: LevelId = 'b2', time: TimeOfDay = 'day', variant?: string, accent?: Accent): SceneSpec {
  return { motif, variant, accent, time, palette: PALETTES[level], seed: hash(motif), level }
}
