import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/pwa'
import { keepReminderSynced, startProgressReporting } from './lib/reminder'
import { syncPracticeCards } from './lib/practice'
import { syncReviewCards } from './lib/srs'

// Words saved before spaced repetition existed get their review cards here.
// Practised cards after the archive sync, which would otherwise not know them yet.
void syncReviewCards().then(syncPracticeCards)
registerServiceWorker()
// Daily reminder: report practice to the server and refresh this device's push subscription.
startProgressReporting()
keepReminderSynced()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
