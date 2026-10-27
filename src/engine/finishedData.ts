/**
 * The games' finished pool (engine/finished.ts) over this course's lesson index. Imported
 * dynamically (hooks/useFinishedWords.ts) so the lesson index stays out of the main chunk.
 */
import type { LessonRow } from './types'
import { vocab } from './loader'
import { lessonIds, lessonOrder } from './lessonIndex'
import { finishedPool, makeFinished, type Finished } from './finished'

export function finishedFrom(rows: Iterable<Pick<LessonRow, 'id' | 'completions'>>): Finished {
  return makeFinished(finishedPool(rows, lessonIds), lessonOrder, (id) => vocab.get(id))
}
