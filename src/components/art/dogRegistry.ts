/** The three dogs' drawings and names, keyed by id. */
import type { ReactNode } from 'react'
import { LeoArt, BonchitaArt, LunaArt, type DogArtProps } from './dogArt'

export type DogId = 'leo' | 'bonchita' | 'luna'
export const DOG_ART: Record<DogId, (p: DogArtProps) => ReactNode> = { leo: LeoArt, bonchita: BonchitaArt, luna: LunaArt }
export const DOG_LABEL: Record<DogId, string> = { leo: 'Leo', bonchita: 'Bonchita', luna: 'Luna' }
/** Size (px) from which the full painterly treatment is used. */
export const HI_DETAIL_PX = 64
