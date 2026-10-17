/** The three dogs' drawings and names, keyed by id. */
import type { ReactNode } from 'react'
import { LeoArt, BonchitaArt, LunaArt, type DogArtProps } from './dogArt'
import { portraitBox } from './dogPortraits'

export type DogId = 'leo' | 'bonchita' | 'luna'
export const DOG_ART: Record<DogId, (p: DogArtProps) => ReactNode> = { leo: LeoArt, bonchita: BonchitaArt, luna: LunaArt }
export const DOG_LABEL: Record<DogId, string> = { leo: 'Leo', bonchita: 'Bonchita', luna: 'Luna' }
/** Size (px) from which the full painterly treatment is used. */
export const HI_DETAIL_PX = 64
/** Bust crop (x, y, size in the 120 box) for stamps and portraits: head, neck and chest, never a floating head. */
export const PORTRAIT: Record<DogId, [number, number, number]> = { leo: portraitBox('leo'), bonchita: portraitBox('bonchita'), luna: portraitBox('luna') }
