/**
 * Recovering from a stale copy of the app. An installed app or an open tab can still run an older
 * version whose files a newer deploy replaced; loading one of its lazy parts then fails. Reload once
 * onto the latest version, and offer a repair (drop this page's service worker and cached files,
 * keep the learner's progress) when that is not enough.
 */
const KEY = 'pawsport:recoveredAt'
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|module script|ChunkLoadError|Loading chunk|Failed to fetch/i

export function isChunkError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR.test(`${error.name}: ${error.message}`)
}

/** Reload onto the newest version, at most once every 30 s (so a real outage can't loop). Returns false when it already tried. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* sessionStorage unavailable: reload anyway */
  }
  const go = () => location.reload()
  if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then((r) => r?.update()).finally(go)
  else go()
  return true
}

/** Unregister this page's service worker and delete its cached files (progress in IndexedDB is kept), then reload. */
export async function repairAndReload(): Promise<void> {
  const scope = new URL('./', location.href).href
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.filter((r) => r.scope === scope).map((r) => r.unregister()))
    const names = (await caches?.keys()) ?? []
    await Promise.all(names.filter((n) => n.endsWith(scope)).map((n) => caches.delete(n)))
  } catch {
    /* best effort */
  }
  location.replace(location.pathname + location.hash)
}

/** Lazy parts that fail to load (vite:preloadError) trigger one reload onto the latest version. */
export function watchForStaleChunks(): void {
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadOnce()) e.preventDefault()
  })
}
