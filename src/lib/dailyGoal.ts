import { useSyncExternalStore } from 'react'

// Daily goal = answers + reviews per day. Stored per device in localStorage.

const STORAGE_KEY = 'somos-daily-goal'
export const GOAL_OPTIONS = [10, 20, 30, 50] as const
const DEFAULT_GOAL = 20

function readGoal(): number {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    if ((GOAL_OPTIONS as readonly number[]).includes(value)) return value
  } catch {
    // Storage unavailable: use the default.
  }
  return DEFAULT_GOAL
}

let goal = readGoal()
const listeners = new Set<() => void>()

/** Current goal outside React (the reminder's progress report). */
export const getDailyGoal = () => goal

export function setDailyGoal(value: number) {
  goal = value
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
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

export function useDailyGoal(): number {
  return useSyncExternalStore(subscribe, () => goal)
}
