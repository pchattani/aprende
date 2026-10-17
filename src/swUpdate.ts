/**
 * Apply app updates promptly and safely. When a new service worker takes over an open page
 * (a deploy happened while the app was open), reload so the page never runs old code against
 * new files. Reloads wait while a lesson, checkpoint, exam or quiz is in progress, and happen on
 * the next navigation away from it instead. Also checks for updates when the app comes back to
 * the foreground.
 */
const BUSY = /^#\/(lesson|checkpoint|exam|quiz|placement)\b/

export function watchForUpdates(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // first install: no previous worker, nothing stale to replace
  const hadController = Boolean(navigator.serviceWorker.controller)
  let pending = false
  const reloadWhenIdle = () => {
    if (!BUSY.test(location.hash)) location.reload()
    else pending = true
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) reloadWhenIdle()
  })
  window.addEventListener('hashchange', () => {
    if (pending && !BUSY.test(location.hash)) location.reload()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void navigator.serviceWorker.getRegistration().then((r) => r?.update())
  })
}
