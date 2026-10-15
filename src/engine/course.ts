/**
 * Facts about the course this build is for (from content/<lang>/pack.yaml):
 * the HTML language tag for target-language text, the English name of the
 * language, and storage names that keep each sister course's progress apart
 * (they share one origin on GitHub Pages).
 */
import packRaw from '@content/pack.yaml'
import { PackSchema } from './schema'

const PACK = PackSchema.parse(packRaw)

/** BCP 47 tag for target-language text (es-ES, yue-Hant-HK, pt-BR, it-IT). */
export const TL = PACK.locale
/** `lang` attribute for text marked 'es' (target language) or 'en'. */
export const tlOf = (l: 'es' | 'en' | string): string => (l === 'en' ? 'en' : TL)
/** English name of the language ("Spanish"). */
export const LANGUAGE = PACK.name
export const COURSE_ID = PACK.id
/** The Spanish course keeps its original names so existing progress is untouched. */
export const DB_NAME = PACK.id === 'es' ? 'aprende' : `aprende-${PACK.id}`
export const SETTINGS_KEY = PACK.id === 'es' ? 'aprende-settings' : `aprende-${PACK.id}-settings`
export const storageKey = (k: string): string => (PACK.id === 'es' ? k : `${PACK.id}:${k}`)
export const FEATURES = PACK.features
export const SPECIAL_CHARS = PACK.specialChars
