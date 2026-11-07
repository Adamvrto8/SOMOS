import { useSyncExternalStore } from 'react'
import type { ExerciseType } from './lesson'

// The order of the exercises in Cvičiť: by recency (the one played last first) or the learner's own.
// Stored per device and carried by the settings (backup and account sync).

export const EXERCISE_TYPES = [
  'cloze', 'choice', 'vocab', 'conjugation', 'builder', 'translation', 'dictation', 'speaking', 'truefalse', 'findmistake', 'matching',
] as const satisfies readonly ExerciseType[]
// Every exercise type is in the list: this fails to compile when one is added to ExerciseType and not here.
const _complete: Exclude<ExerciseType, (typeof EXERCISE_TYPES)[number]> extends never ? true : never = true
void _complete

export type ExerciseOrderMode = 'recent' | 'custom'
export interface ExerciseOrder {
  mode: ExerciseOrderMode
  custom: ExerciseType[] // the learner's own order; empty until the learner arranges it
}

const STORAGE_KEY = 'somos-exercise-order'
const DEFAULT: ExerciseOrder = { mode: 'recent', custom: [] }

const isType = (value: unknown): value is ExerciseType => (EXERCISE_TYPES as readonly unknown[]).includes(value)

/** A valid order from stored or synced data; undefined when there is none. */
export function parseExerciseOrder(data: unknown): ExerciseOrder | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const { mode, custom } = data as Record<string, unknown>
  if (mode !== 'recent' && mode !== 'custom') return undefined
  const types = Array.isArray(custom) ? custom.filter(isType) : []
  return { mode, custom: [...new Set(types)] }
}

function read(): ExerciseOrder {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return (raw && parseExerciseOrder(JSON.parse(raw))) || DEFAULT
  } catch {
    return DEFAULT
  }
}

let current = read()
const listeners = new Set<() => void>()

/** The order outside React (the settings backup). */
export const getExerciseOrder = () => current

export function setExerciseOrder(order: ExerciseOrder) {
  current = order
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    // The order just won't survive a reload.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useExerciseOrder(): ExerciseOrder {
  return useSyncExternalStore(subscribe, () => current)
}

/**
 * The exercises in the order to show. `recent`: the one played last first, never played ones after in
 * `types` order. `custom`: the learner's list, types missing from it (new exercises) at the end.
 */
export function orderExercises<T extends ExerciseType>(types: readonly T[], order: ExerciseOrder, lastPlayed: ReadonlyMap<ExerciseType, number>): T[] {
  if (order.mode === 'custom') {
    const rank = (type: T) => {
      const at = order.custom.indexOf(type)
      return at === -1 ? order.custom.length + types.indexOf(type) : at
    }
    return [...types].sort((a, b) => rank(a) - rank(b))
  }
  return [...types].sort((a, b) => (lastPlayed.get(b) ?? 0) - (lastPlayed.get(a) ?? 0))
}

/** Moves `type` one place up (-1) or down (+1) in the shown order; the result becomes the custom order. */
export function moveExercise(shown: readonly ExerciseType[], type: ExerciseType, by: -1 | 1): ExerciseType[] {
  const from = shown.indexOf(type)
  const to = from + by
  if (from === -1 || to < 0 || to >= shown.length) return [...shown]
  const next = [...shown]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}
