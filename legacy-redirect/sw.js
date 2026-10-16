// Replaces the old Aprende service workers (same URL, /aprende/sw.js and /aprende/<slug>/sw.js):
// take over, clear their caches, unregister, and reload open pages so they hit the redirect.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
    })(),
  )
})
