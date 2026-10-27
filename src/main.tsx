import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { watchForUpdates } from './swUpdate'
import { watchForStaleChunks } from './recover'

type BootWindow = { __pawsportBoot?: (stage: string) => void; __pawsportSafe?: boolean; __pawsportStarted?: () => void }
const boot = (window as unknown as BootWindow).__pawsportBoot ?? (() => {})
boot('code')
watchForStaleChunks()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

// Demo learner for screenshots and end-to-end tests: loaded on demand only, never in the main chunk.
try {
  if (sessionStorage.getItem('e2e') === '1' || /[?&]demo\b/.test(location.search)) {
    void import('./dev/demo').then((m) => {
      ;(window as unknown as { __pawsportDemo?: typeof m.seedDemo }).__pawsportDemo = m.seedDemo
    })
  }
} catch {
  /* sessionStorage unavailable */
}

// the offline copy (service worker), except in safe mode – see index.html
if (!(window as unknown as BootWindow).__pawsportSafe && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {}))
}
watchForUpdates()
boot('rendered')
// a start that stays up counts as a good one (index.html's breadcrumbs); the journey reports its own milestones
setTimeout(() => boot('ready'), 10000)
// the boot watchdog in index.html can stand down: the app's code loaded and is running
;(window as unknown as BootWindow).__pawsportStarted?.()
