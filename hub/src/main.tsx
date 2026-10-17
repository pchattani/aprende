import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './hub.css'
import App from './App.tsx'
import { watchForUpdates } from '../../src/swUpdate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

watchForUpdates()
