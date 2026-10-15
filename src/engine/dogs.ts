import type { DogName } from '../hooks/useOutfits'
import { ui } from './loader'

export const DOG_NAMES: Record<DogName, string> = { leo: 'Leo', bonchita: 'Bonchita', luna: 'Luna' }
/** What each dog says when tapped (spoken aloud in the target language). */
export const DOG_LINES: Record<DogName, string[]> = ui.dogLines
