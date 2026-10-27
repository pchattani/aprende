import type { Page } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { load } from 'js-yaml'

// What the demo learner has finished, worked out independently of the app: the lessons with
// completions > 0 in the course's IndexedDB, and their `vocab` read straight from the content YAML.

const LANG = process.env.VITE_LANG ?? 'es'
const DB = LANG === 'es' ? 'aprende' : `aprende-${LANG}`
const dir = `content/${LANG}`

interface Row {
  id: string
  completions: number
}
type Entry = { id: string; lemma: string; en: string[] }

/** Lesson rows straight from IndexedDB. */
async function lessonRows(page: Page): Promise<Row[]> {
  return page.evaluate(
    (name) =>
      new Promise<Row[]>((resolve, reject) => {
        const open = indexedDB.open(name)
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const req = open.result.transaction('lessons').objectStore('lessons').getAll()
          req.onsuccess = () => {
            open.result.close()
            resolve(req.result as Row[])
          }
          req.onerror = () => reject(req.error)
        }
      }),
    DB,
  )
}

let lessonVocab: Map<string, string[]> | undefined
let entries: Map<string, Entry> | undefined
function content() {
  if (!lessonVocab || !entries) {
    lessonVocab = new Map()
    for (const level of readdirSync(`${dir}/units`))
      for (const f of readdirSync(`${dir}/units/${level}`).filter((x) => x.endsWith('.yaml'))) {
        const unit = load(readFileSync(`${dir}/units/${level}/${f}`, 'utf8')) as { lessons?: { id: string; vocab?: string[] }[] }
        for (const l of unit.lessons ?? []) lessonVocab.set(l.id, l.vocab ?? [])
      }
    entries = new Map()
    for (const f of readdirSync(`${dir}/vocab`).filter((x) => x.endsWith('.yaml')))
      for (const e of (load(readFileSync(`${dir}/vocab/${f}`, 'utf8')) as Entry[] | null) ?? []) entries.set(e.id, e)
  }
  return { lessonVocab, entries }
}

/** The finished words (lemmas and glosses) and the words of lessons started but not finished. */
export async function finishedWords(page: Page): Promise<{ lemmas: Set<string>; glosses: Set<string>; startedOnly: Set<string> }> {
  const rows = await lessonRows(page)
  const { lessonVocab, entries } = content()
  const ids = new Set(rows.filter((r) => r.completions > 0).flatMap((r) => lessonVocab.get(r.id) ?? []))
  const lemmas = new Set([...ids].flatMap((id) => (entries.get(id) ? [entries.get(id)!.lemma] : [])))
  const glosses = new Set([...ids].flatMap((id) => entries.get(id)?.en.slice(0, 1) ?? []))
  const started = rows.filter((r) => r.completions === 0).flatMap((r) => lessonVocab.get(r.id) ?? [])
  const startedOnly = new Set(started.filter((id) => !ids.has(id)).flatMap((id) => (entries.get(id) && !lemmas.has(entries.get(id)!.lemma) ? [entries.get(id)!.lemma] : [])))
  return { lemmas, glosses, startedOnly }
}
