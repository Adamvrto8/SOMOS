import { useEffect, useSyncExternalStore } from 'react'
import { useAccount } from '../../lib/account'
import { useDevMode } from '../../lib/devMode'

// Screens with their own button at the bottom (Začať lekciu, + on Pridané) hide SOMO's pill while they are shown, so
// the two never sit on top of each other.
let hiders = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Keeps SOMO's pill off the screen while the calling component is mounted. */
export function useHideSomo(): void {
  useEffect(() => {
    hiders++
    emit()
    return () => {
      hiders--
      emit()
    }
  }, [])
}

export const useSomoHidden = (): boolean => useSyncExternalStore(subscribe, () => hiders > 0, () => false)

/** The prototype: SOMO is offered in developer mode to a signed-in account (the server allows only its own list). */
export function useSomoAvailable(): boolean {
  const devMode = useDevMode()
  const account = useAccount()
  return devMode && account !== null
}

/** SOMO's sheet is open on this history entry: it is pushed as the same address with `somo` in its state. */
export const isSomoOpen = (state: unknown): boolean => typeof state === 'object' && state !== null && (state as { somo?: unknown }).somo === true
