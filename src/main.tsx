import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startAccount } from './lib/account'
import { startErrorReports } from './lib/errorReports'
import { watchKeyboard } from './lib/keyboard'
import './lib/language' // sets <html lang> before the first render
import { registerServiceWorker } from './lib/pwa'
import { keepReminderSynced, startProgressReporting } from './lib/reminder'
import { syncPracticeCards } from './lib/practice'
import { syncReviewCards } from './lib/srs'

// Before anything that could crash: errors from here on are reported (once Sentry is set up).
startErrorReports()
// Accounts first: the outbox's hooks have to see every change, also the startup syncs below.
startAccount()
// Words saved before spaced repetition existed get their review cards here.
// Practised cards after the archive sync, which would otherwise not know them yet.
void syncReviewCards().then(syncPracticeCards)
registerServiceWorker()
// Daily reminder: report practice to the server and refresh this device's push subscription.
startProgressReporting()
keepReminderSynced()
watchKeyboard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
