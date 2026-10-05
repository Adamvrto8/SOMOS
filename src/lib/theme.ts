import { useSyncExternalStore } from 'react'
import { parseLook, type Look } from './look'

export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

// Keep in sync with the inline script in index.html.
const STORAGE_KEY = 'somos-theme'
const LOOK_KEY = 'somos-look'
/** The page background of each style: what the phone paints its status bar with. */
const THEME_COLOR: Record<Look, Record<Theme, string>> = {
  classic: { light: '#F4F1EC', dark: '#161614' },
  talavera: { light: '#F2F5FB', dark: '#0B1124' },
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()
let currentPref: ThemePref = readThemePref()
let currentLook: Look = readLook()

function readLook(): Look {
  try {
    return parseLook(localStorage.getItem(LOOK_KEY)) ?? 'classic'
  } catch {
    return 'classic'
  }
}

function readThemePref(): ThemePref {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
  return 'system'
}

function writeThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Preference just won't survive a reload.
  }
}

function resolveTheme(pref: ThemePref): Theme {
  if (pref !== 'system') return pref
  return darkQuery.matches ? 'dark' : 'light'
}

function applyTheme(pref: ThemePref) {
  const theme = resolveTheme(pref)
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.look = currentLook
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[currentLook][theme])
}

// Follow the OS setting live while the preference is "system".
darkQuery.addEventListener('change', () => {
  if (currentPref === 'system') applyTheme('system')
})

/** Current preference outside React (the backup). */
export const getThemePref = () => currentPref

export function setThemePref(pref: ThemePref) {
  currentPref = pref
  writeThemePref(pref)
  applyTheme(pref)
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, () => currentPref)
}

/** Current style outside React (the backup). */
export const getLook = () => currentLook

export function setLook(look: Look) {
  currentLook = look
  try {
    localStorage.setItem(LOOK_KEY, look)
  } catch {
    // The choice just won't survive a reload.
  }
  applyTheme(currentPref)
  listeners.forEach((notify) => notify())
}

export function useLook(): Look {
  return useSyncExternalStore(subscribe, () => currentLook)
}
