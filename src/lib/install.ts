// Adding the app to the home screen. Chrome on Android offers it once with `beforeinstallprompt`, which
// fires early and only once per page: it is caught at start (main.tsx) and kept for the welcome's button.
// Safari on the iPhone has no such event: there the welcome explains Share → Add to Home Screen.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null

export function catchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // no mini-infobar: the welcome asks at its own moment
    deferred = event as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
  })
}

/** Already opened from the home screen. */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** iPhone or iPad, where adding to the home screen goes by hand (iPadOS reports itself as a Mac with touch). */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

/** How this browser adds the app: its own dialog, steps to follow by hand, or not at all. */
export function installWay(): 'prompt' | 'ios' | null {
  if (isStandalone()) return null
  if (deferred) return 'prompt'
  return isIos() ? 'ios' : null
}

/** Shows Chrome's dialog; true when the learner added the app. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  deferred = null // the event can be used once
  await event.prompt()
  return (await event.userChoice).outcome === 'accepted'
}
