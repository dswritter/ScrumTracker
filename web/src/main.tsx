import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerOfflineFallbackServiceWorker } from './registerOfflineServiceWorker'

registerOfflineFallbackServiceWorker()

/** Drop legacy persist bucket so dev runs don’t keep broken v1 data around. */
if (import.meta.env.DEV) {
  try {
    localStorage.removeItem('scrum-tracker-v1')
  } catch {
    /* ignore private mode / quota */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
