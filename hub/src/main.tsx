import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './hub.css'
import App from './App.tsx'
import { watchForUpdates } from '../../src/swUpdate'
import { watchForStaleChunks } from '../../src/recover'

watchForStaleChunks()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

watchForUpdates()
// the boot watchdog in index.html can stand down: the app's code loaded and is running
;(window as unknown as { __pawsportStarted?: () => void }).__pawsportStarted?.()
