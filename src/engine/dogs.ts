import type { DogName } from '../hooks/useOutfits'

export const DOG_NAMES: Record<DogName, string> = { leo: 'Leo', bonchita: 'Bonchita', luna: 'Luna' }
/** What each dog says when tapped (spoken aloud in Spanish). */
export const DOG_LINES: Record<DogName, string[]> = {
  leo: ['¡Guau!', '¡Vamos!', '¡Hola, amigo!', '¡Qué rico!', '¡Tengo una idea!'],
  bonchita: ['¡Guau, guau!', '¡Tengo hambre!', '¡Dale!', '¡Vamos a pasear!', '¡Qué calor!'],
  luna: ['¡Mira el mapa!', '¡Por aquí!', '¡Qué bonito!', '¡Sígueme!', '¡Casi llegamos!'],
}
