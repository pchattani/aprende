/**
 * The dialogues of every authored unit, without the lessons (the `?dialogues` YAML
 * projection in vite.config.ts), for the listening list. Imported only by the Listen
 * pages, so it lives in their lazy chunk.
 */
import { z } from 'zod'
import { Dialogue } from './schema'
import { readers } from './loader'
import { buildListening, type ListenPiece, type UnitDialogues } from './listening'

const files = import.meta.glob('@content/units/*/*.yaml', { eager: true, query: '?dialogues', import: 'default' }) as Record<string, unknown>
const UnitDialoguesSchema = z.object({ id: z.string(), dialogues: z.array(Dialogue).default([]) })

export const unitDialogues: UnitDialogues[] = Object.values(files).map((d) => UnitDialoguesSchema.parse(d))

/** Every listening piece of the course, in list order. */
export const listeningPieces: ListenPiece[] = buildListening(readers, unitDialogues)
const byId = new Map(listeningPieces.map((p) => [p.id, p]))
export function listeningPiece(id: string): ListenPiece | undefined {
  return byId.get(id)
}
