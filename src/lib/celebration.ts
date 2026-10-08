import { useSyncExternalStore } from 'react'

// The moment the daily goal is reached: recordAttempt announces it, <GoalCelebration> shows it
// over whatever screen is open and takes it away again. A screen about to move on (the next card
// of a review) waits for celebrationOver(), so the celebration is seen where it was earned.

export interface Celebration {
  goal: number
  /** Days in a row on which the goal was reached, today included. */
  streakDays: number
  /** When the answer that completed the goal was given: tells one celebration from the next. */
  at: number
}

let current: Celebration | null = null
const listeners = new Set<() => void>()
/** From the moment a celebration is expected until it is dismissed. */
let over: Promise<void> | null = null
let finish: (() => void) | null = null

function show(next: Celebration | null) {
  current = next
  listeners.forEach((notify) => notify())
}

/** The goal is known to be reached, the celebration follows in a moment: whoever moves on waits from here. */
export function expectCelebration() {
  over ??= new Promise((resolve) => {
    finish = resolve
  })
}

export function celebrateGoal(celebration: Celebration) {
  expectCelebration()
  show(celebration)
}

export function dismissCelebration() {
  show(null)
  finish?.()
  over = finish = null
}

/** Resolves once no celebration is on screen or on its way; at once when there is none. */
export const celebrationOver = (): Promise<void> => over ?? Promise.resolve()

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
