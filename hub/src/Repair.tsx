/**
 * "A language won't open?" A course page that crashes on load can't repair itself, but the hub
 * (same site) can: drop that course's service worker and cached app files, then open it fresh.
 * Progress stays. As a last resort, download the course's progress and start it fresh on this device.
 */
import { useState } from 'react'
import type { HubCourse } from 'virtual:pawsport-courses'

async function clearCourseApp(course: HubCourse): Promise<void> {
  const scope = new URL(course.href, location.href).href
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
  await Promise.all(regs.filter((r) => r.scope === scope).map((r) => r.unregister()))
  if ('caches' in window) {
    const names = await caches.keys()
    await Promise.all(names.filter((n) => n.endsWith(scope)).map((n) => caches.delete(n)))
  }
}

function dumpDatabase(name: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const stores = [...db.objectStoreNames]
      const out: { database: string; exportedAt: string; stores: Record<string, unknown[]> } = { database: name, exportedAt: new Date().toISOString(), stores: {} }
      if (!stores.length) {
        db.close()
        return resolve(out)
      }
      const tx = db.transaction(stores, 'readonly')
      let left = stores.length
      for (const s of stores) {
        const r = tx.objectStore(s).getAll()
        r.onsuccess = () => {
          out.stores[s] = r.result
          if (--left === 0) {
            db.close()
            resolve(out)
          }
        }
        r.onerror = () => reject(r.error)
      }
    }
  })
}

/** Open a course fresh (a new URL, so nothing stale answers the request). */
function openFresh(c: HubCourse): void {
  location.href = `${c.href}?fresh=${Date.now()}`
}

async function repair(c: HubCourse, setNote: (s: string) => void): Promise<void> {
  setNote(`Repairing ${c.name}…`)
  await clearCourseApp(c).catch(() => {})
  openFresh(c)
}

async function reset(c: HubCourse): Promise<void> {
  if (!confirm(`Delete your ${c.name} progress on this device? Download a copy first if you want to keep it.`)) return
  await clearCourseApp(c).catch(() => {})
  await new Promise<void>((done) => {
    const del = indexedDB.deleteDatabase(c.dbName)
    del.onsuccess = del.onerror = del.onblocked = () => done()
  })
  openFresh(c)
}

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

/** What the course's last start recorded (index.html breadcrumbs): shown so a crash can be traced. */
function bootNote(c: HubCourse): string | undefined {
  try {
    const b = JSON.parse(localStorage.getItem(`pawsport:boot:${c.slug}`) ?? 'null') as { stage?: string; failed?: number; safe?: boolean; lastStop?: string; lastFailAt?: number } | null
    if (!b) return undefined
    const STAGE: Record<string, string> = { html: 'before its code loaded', code: 'while starting', rendered: 'right after starting', journey: 'after drawing the journey' }
    if (b.stage && b.stage !== 'ready') return `Last start stopped ${STAGE[b.stage] ?? b.stage}${b.failed ? ` · ${b.failed + 1} failed starts` : ''}`
    if (b.lastStop) return `Started fine last time · an earlier start stopped ${STAGE[b.lastStop] ?? b.lastStop}`
    return undefined
  } catch {
    return undefined
  }
}

export function RepairCourses({ courses }: { courses: HubCourse[] }) {
  const [note, setNote] = useState('')
  const backup = async (c: HubCourse) => {
    try {
      const data = await dumpDatabase(c.dbName)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
      a.download = `pawsport-${c.slug}-progress-${dayStamp()}.json`
      a.click()
      setNote(`${c.name} progress saved to a file.`)
    } catch (e) {
      setNote(`Could not read ${c.name} progress: ${(e as Error).message}`)
    }
  }
  return (
    <details className="mt-8 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">A language won't open?</summary>
      <p className="mt-2 text-ink-2">Repair downloads that course's app again. Your progress is kept.</p>
      <ul className="mt-3 grid gap-2">
        {courses.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-[7.5rem] font-semibold">
              {c.flag} {c.name}
            </span>
            {bootNote(c) && <span className="basis-full text-xs text-ink-2">{bootNote(c)}</span>}
            <button type="button" className="rounded-xl bg-[var(--blue)] px-3 py-1.5 text-xs font-bold text-white shadow-[0_2px_0_0_color-mix(in_srgb,var(--blue)_60%,#000)]" onClick={() => void repair(c, setNote)}>
              Repair
            </button>
            <button type="button" className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-[0_2px_0_0_var(--line-strong)]" onClick={() => void backup(c)}>
              Download progress
            </button>
            <button type="button" className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-[0_2px_0_0_var(--line-strong)] text-[var(--bad)]" onClick={() => void reset(c)}>
              Start fresh
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-2">Still stuck after a repair? Download your progress, then start that course fresh on this device.</p>
      {note && (
        <p className="mt-2 text-xs font-semibold" role="status">
          {note}
        </p>
      )}
    </details>
  )
}
