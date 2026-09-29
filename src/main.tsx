import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/pwa'
import { startProgressReporting, syncReminder } from './lib/reminder'
import { syncReviewCards } from './lib/srs'

// Words saved before spaced repetition existed get their review cards here.
void syncReviewCards()
registerServiceWorker()
// Daily reminder: report practice to the server and refresh this device's push subscription.
startProgressReporting()
void syncReminder()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
