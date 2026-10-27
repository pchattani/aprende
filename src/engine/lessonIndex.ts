/**
 * Every lesson's vocabulary and grammar ids, without its text: the `?vocab` YAML projection of
 * the unit files (vite.config.ts). Small enough to load whole, so pages that need "the words of
 * these lessons" (the taught-words gate, the games' finished pool) never load the unit files.
 * Imported dynamically (through engine/taughtData.ts and engine/finishedData.ts) so the main
 * chunk stays light.
 */
import { z } from 'zod'
import { levels } from './loader'

const files = import.meta.glob('@content/units/*/*.yaml', { eager: true, query: '?vocab', import: 'default' }) as Record<string, unknown>
const UnitIds = z.object({
  id: z.string(),
  lessons: z.array(z.object({ id: z.string(), vocab: z.array(z.string()).default([]), grammar: z.array(z.string()).default([]) })).default([]),
})
export type LessonIds = z.infer<typeof UnitIds>['lessons'][number]

/** The authored units with their lessons' ids. */
export const unitIds = Object.values(files).map((d) => UnitIds.parse(d))

/** Lessons in syllabus order (levels, then units as the syllabus lists them, then lessons in file order). */
export const lessonOrder: readonly LessonIds[] = (() => {
  const byId = new Map(unitIds.map((u) => [u.id, u]))
  return levels.flatMap((l) => l.units.flatMap((u) => byId.get(u.id)?.lessons ?? []))
})()

/** Lesson id → its vocabulary and grammar ids. */
export const lessonIds: ReadonlyMap<string, LessonIds> = new Map(lessonOrder.map((l) => [l.id, l]))
