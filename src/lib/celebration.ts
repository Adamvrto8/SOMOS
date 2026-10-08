import { useSyncExternalStore } from 'react'

// The moment the daily goal is reached: recordAttempt announces it, <GoalCelebration> shows it
// over whatever screen is open and takes it away again.

export interface Celebration {
  goal: number
  /** Days in a row on which the goal was reached, today included. */
  streakDays: number
  /** When the answer that completed the goal was given: tells one celebration from the next. */
  at: number
}

let current: Celebration | null = null
const listeners = new Set<() => void>()

function show(next: Celebration | null) {
  current = next
  listeners.forEach((notify) => notify())
}

export const celebrateGoal = (celebration: Celebration) => show(celebration)

export const dismissCelebration = () => show(null)

/** Current celebration outside React. */
export const getCelebration = () => current

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useCelebration(): Celebration | null {
  return useSyncExternalStore(subscribe, getCelebration)
}
