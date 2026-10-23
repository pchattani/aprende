import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { watchForUpdates } from './swUpdate'
import { watchForStaleChunks } from './recover'

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

watchForUpdates()
// the boot watchdog in index.html can stand down: the app's code loaded and is running
;(window as unknown as { __pawsportStarted?: () => void }).__pawsportStarted?.()
