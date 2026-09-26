import { registerSW } from 'virtual:pwa-register'

// Screens whose state lives only in memory (a lesson, a review session, an unsaved form):
// a reload there would throw the learner's progress away.
const BUSY_PATHS = /^\/(practice\/lesson|review|archive\/(new|custom\/))/

const isBusy = () => BUSY_PATHS.test(window.location.pathname)

let reloadScheduled = false

/** Show the new version right away, or as soon as the learner leaves a busy screen. */
function reloadWhenIdle() {
  if (!isBusy()) return window.location.reload()
  if (reloadScheduled) return
  reloadScheduled = true
  const timer = window.setInterval(() => {
    if (isBusy()) return
    window.clearInterval(timer)
    window.location.reload()
  }, 1000)
}

/**
 * Keeps the installed app up to date. A new deploy downloads in the background and the page
 * then reloads itself, so one launch is enough to get it. Android keeps an installed PWA alive
 * in the background, so it also checks for a new version whenever the app comes back to the front.
 */
export function registerServiceWorker() {
  registerSW({
    immediate: true,
    onNeedReload: reloadWhenIdle,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {})
      })
    },
  })
}
