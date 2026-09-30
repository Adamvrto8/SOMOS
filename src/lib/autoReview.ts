import { useSyncExternalStore } from 'react'

// Automatic review of practised words (Slovná zásoba, Časovanie): on/off and the daily limit.
// Stored per device in localStorage, like the daily goal.

const STORAGE_KEY = 'somos-auto-review'
export const AUTO_REVIEW_LIMITS = [10, 20, 30, 50] as const
export type AutoReviewLimit = (typeof AUTO_REVIEW_LIMITS)[number]

export interface AutoReviewSettings {
  enabled: boolean
  limit: AutoReviewLimit // practised-only words per day
}

export const DEFAULT_AUTO_REVIEW: AutoReviewSettings = { enabled: true, limit: 20 }

const isLimit = (v: unknown): v is AutoReviewLimit => (AUTO_REVIEW_LIMITS as readonly unknown[]).includes(v)

export function parseAutoReview(raw: string | null): AutoReviewSettings {
  try {
    const value: unknown = JSON.parse(raw ?? '')
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const { enabled, limit } = value as Record<string, unknown>
      if (typeof enabled === 'boolean' && isLimit(limit)) return { enabled, limit }
    }
  } catch {
    // Missing or corrupted: the defaults.
  }
  return DEFAULT_AUTO_REVIEW
}

function readSettings(): AutoReviewSettings {
  try {
    return parseAutoReview(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_AUTO_REVIEW
  }
}

let settings = readSettings()
const listeners = new Set<() => void>()

/** Current settings outside React (due counts for the review queue and the reminder). */
export const getAutoReview = () => settings

export function setAutoReview(next: AutoReviewSettings) {
  settings = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Choice just won't survive a reload.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useAutoReviewSettings(): AutoReviewSettings {
  return useSyncExternalStore(subscribe, () => settings)
}
