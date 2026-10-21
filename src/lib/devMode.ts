import { useSyncExternalStore } from 'react'

// Developer mode: the tools for working on the app in Nastavenia (the sun, test reminders, the server's state).
// On by default on the dev server, off in the deployed app until the version line is tapped seven times.
// Kept on this device only: not in the backup, not synced to the account.
const STORAGE_KEY = 'somos-dev-mode'

/** Taps on the version line that switch developer mode on, as in Android. */
export const DEV_MODE_TAPS = 7

function readDevMode(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'on') return true
    if (stored === 'off') return false
  } catch {
    // Falls back to the default below.
  }
  return import.meta.env.DEV
}

let current = readDevMode()
const listeners = new Set<() => void>()

export const getDevMode = () => current

/** Stored either way, so the dev server can also show the app as a learner sees it. */
export function setDevMode(on: boolean) {
  current = on
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // The choice just won't survive a reload.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useDevMode(): boolean {
  return useSyncExternalStore(subscribe, () => current)
}
