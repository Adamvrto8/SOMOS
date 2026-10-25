import { useSyncExternalStore } from 'react'
import type { Level } from '../data/types'
import { db } from './db'
import { getNumberedLessonCount, type LessonFilter } from './lesson'
import { getLastActiveLesson } from './lessonProgress'
import { track } from './usage'

// The welcome a new learner goes through once (src/features/onboarding). Kept on this device only:
// not in the backup and not synced, so the reason for learning never leaves the phone.

const STORAGE_KEY = 'somos-onboarding'

export type Motivation = 'travel' | 'work' | 'family' | 'school' | 'hobbies' | 'fun'

/** Why the learner learns, and the topic the first lessons come from. */
export const MOTIVATIONS: { id: Motivation; topic: string }[] = [
  { id: 'travel', topic: 'travel' },
  { id: 'work', topic: 'work' },
  { id: 'family', topic: 'family' },
  { id: 'school', topic: 'school' },
  { id: 'hobbies', topic: 'hobbies' },
  { id: 'fun', topic: 'greetings' },
]

export const START_LEVELS: Level[] = ['A1', 'A2', 'B1']

export interface OnboardingState {
  done: boolean
  at?: number
  motivation?: Motivation
  level?: Level
  /** "Ulož si pokrok" after the first lesson is offered once. */
  accountOffered?: boolean
}

function parse(raw: string | null): OnboardingState | null {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null
    if (typeof data !== 'object' || data === null) return null
    const { done, at, motivation, level, accountOffered } = data as Record<string, unknown>
    return {
      done: done === true,
      at: typeof at === 'number' ? at : undefined,
      motivation: MOTIVATIONS.some((m) => m.id === motivation) ? (motivation as Motivation) : undefined,
      level: START_LEVELS.includes(level as Level) ? (level as Level) : undefined,
      accountOffered: accountOffered === true,
    }
  } catch {
    return null
  }
}

function read(): OnboardingState | null {
  try {
    return parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

let state = read()
const listeners = new Set<() => void>()

function save(next: OnboardingState) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Without storage the welcome may come again; nothing is lost.
  }
  listeners.forEach((notify) => notify())
}

export const getOnboarding = () => state

export function useOnboarding(): OnboardingState | null {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    () => state,
  )
}

/** The answers so far, kept while the welcome runs, so a reload or the back button keeps them. */
export function updateOnboarding(change: Partial<OnboardingState>) {
  save({ done: false, ...state, ...change })
}

export function finishOnboarding() {
  track('welcome', { step: 'done' })
  save({ ...state, done: true, at: Date.now() })
}

/** Nástroje pre vývoj: the welcome once more, as a new learner sees it (the progress stays). */
export function resetOnboarding() {
  save({ done: false })
}

// Where the sign-in leads when it was opened from the welcome or the first lesson (else Profil).
// In sessionStorage, not the URL: Google returns to the one sign-in address it is allowed to.
const AFTER_SIGN_IN_KEY = 'somos-after-sign-in'

export function returnAfterSignIn(path: string) {
  try {
    sessionStorage.setItem(AFTER_SIGN_IN_KEY, path)
  } catch {
    // Without storage the sign-in ends in Profil, which works too.
  }
}

/** The address to go to after signing in, once. */
export function takeReturnAfterSignIn(): string | null {
  try {
    const path = sessionStorage.getItem(AFTER_SIGN_IN_KEY)
    sessionStorage.removeItem(AFTER_SIGN_IN_KEY)
    return path?.startsWith('/') ? path : null
  } catch {
    return null
  }
}

/** Unit tests: as on a device that has never started the app. */
export function forgetOnboardingForTesting() {
  state = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored.
  }
}

/** Anything a learner leaves behind: such a device is not new, even if it never saw the welcome. */
export async function hasHistory(): Promise<boolean> {
  if (getLastActiveLesson()) return true
  const counts = await Promise.all([db.attempts.count(), db.savedItems.count(), db.customWords.count()])
  return counts.some((n) => n > 0)
}

/**
 * Whether Domov leads to the welcome. A device used before the welcome existed is marked as done
 * the first time, so nobody who already learns sees it.
 */
export async function shouldOnboard(history: () => Promise<boolean> = hasHistory): Promise<boolean> {
  if (state?.done) return false
  if (state === null && (await history())) {
    save({ done: true, at: Date.now() })
    return false
  }
  return true
}

/**
 * Where the first lessons come from: the topic of the motivation at the chosen level, or every topic
 * when that topic has nothing at that level.
 */
export function startFilter(from: OnboardingState | null = state): LessonFilter {
  const level = from?.level ?? 'A1'
  const topic = MOTIVATIONS.find((m) => m.id === from?.motivation)?.topic
  if (topic && getNumberedLessonCount({ type: 'vocab', topic, level }) > 0) return { type: 'vocab', topic, level }
  return { type: 'vocab', topic: 'all', level }
}
