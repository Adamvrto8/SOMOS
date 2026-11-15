import { useSyncExternalStore } from 'react'
import type { Turn } from './chat'

// The assistant's finished turns, kept in this module so they survive in-app navigation (a link in an answer leaves
// /assistant) and vanish on a reload, as the spec says. Nothing is stored on the device.

export interface Shown extends Turn {
  truncated?: boolean
  calls?: number
}

let turns: readonly Shown[] = []
const listeners = new Set<() => void>()

export const getTurns = () => turns

export function addTurn(turn: Shown) {
  turns = [...turns, turn]
  listeners.forEach((notify) => notify())
}

export function clearTurns() {
  turns = []
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useTurns(): readonly Shown[] {
  return useSyncExternalStore(subscribe, getTurns)
}
