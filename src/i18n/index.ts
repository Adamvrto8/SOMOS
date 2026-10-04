import { useSyncExternalStore } from 'react'
import { getLanguage, subscribeLanguage, type Language } from '../lib/language'
import { en } from './en'
import { sk, type Dictionary } from './sk'

// Interface texts. sk.ts is the model; en.ts has to have its shape, or the build fails.

export type { Dictionary }
export { pluralEn } from './en'

export const dictionaries: Record<Language, Dictionary> = { sk, en }

/** The texts in the current language, outside React. Call it from a component that uses useT(). */
export const t = (): Dictionary => dictionaries[getLanguage()]

/** The texts in the current language; the component re-renders when the language changes. */
export function useT(): Dictionary {
  return useSyncExternalStore(subscribeLanguage, t)
}
