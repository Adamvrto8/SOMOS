import { useSyncExternalStore } from 'react'

// The language of the interface and of the teaching content. Stored per device; until the learner
// chooses, it follows the phone.

export type Language = 'sk' | 'en'
export const LANGUAGES: Language[] = ['sk', 'en']

const STORAGE_KEY = 'somos-language'

export const parseLanguage = (raw: unknown): Language | undefined => (raw === 'sk' || raw === 'en' ? raw : undefined)

/** Slovak for a Slovak or Czech phone, English for everybody else. Only the first choice counts. */
export function detectLanguage(languages: readonly string[]): Language {
  return /^(sk|cs)\b/i.test(languages[0] ?? '') ? 'sk' : 'en'
}

function readLanguage(): Language {
  try {
    const stored = parseLanguage(localStorage.getItem(STORAGE_KEY))
    if (stored) return stored
  } catch {
    // No storage (private mode, unit tests): the phone's language.
  }
  return detectLanguage(typeof navigator === 'undefined' ? [] : (navigator.languages ?? []))
}

let language = readLanguage()
const listeners = new Set<() => void>()

function apply() {
  if (typeof document !== 'undefined') document.documentElement.lang = language
}
apply()

/** Current language outside React (texts built in src/lib, the backup). */
export const getLanguage = () => language

export function setLanguage(next: Language) {
  language = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // The choice just won't survive a reload.
  }
  apply()
  listeners.forEach((notify) => notify())
}

export function subscribeLanguage(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getLanguage)
}
