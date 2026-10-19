import { useSyncExternalStore } from 'react'
import { syncOnce } from './engine'
import { subscribeOutbox } from './outbox'
import type { SyncServer } from './server'
import { subscribeStores } from './stores'

// When to sync: at start, when the app comes back to the foreground, when the device goes online, and a
// little after a change. One round at a time; a request during a round asks for one more after it.

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncedAt?: number
  error?: string
}

/** A change waits this long, so a lesson's answers go out together. */
export const CHANGE_DELAY = 4000

let status: SyncStatus = { state: 'idle' }
const listeners = new Set<() => void>()
let server: SyncServer | undefined
let running: Promise<void> | undefined
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
let unsubscribe: (() => void) | undefined

function setStatus(next: SyncStatus) {
  status = next
  listeners.forEach((notify) => notify())
}

export const getSyncStatus = () => status

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => {
        listeners.delete(notify)
      }
    },
    getSyncStatus,
  )
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** Runs a round now (or one more after the running one) and resolves when the rounds are over. */
export function syncNow(): Promise<void> {
  if (!server) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      const target = server
      if (!target) break
      setStatus({ ...status, state: 'syncing' })
      try {
        await syncOnce(target)
        setStatus({ state: 'idle', lastSyncedAt: Date.now() })
      } catch (error) {
        setStatus({
          state: isOffline() ? 'offline' : 'error',
          lastSyncedAt: status.lastSyncedAt,
          error: error instanceof Error ? error.message : String(error),
        })
        break // the next trigger tries again
      }
    } while (again)
  })().finally(() => {
    running = undefined
  })
  return running
}

export function requestSync(delay = CHANGE_DELAY): void {
  if (!server) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

const onVisible = () => {
  if (document.visibilityState === 'visible') requestSync(0)
}
const onOnline = () => requestSync(0)

/** Starts syncing with an account's server (after sign-in, or at start when signed in). */
export function startSync(target: SyncServer): void {
  stopSync()
  server = target
  const offOutbox = subscribeOutbox(() => requestSync())
  const offStores = subscribeStores(() => requestSync())
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
  }
  unsubscribe = () => {
    offOutbox()
    offStores()
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }
  requestSync(0)
}

/** Stops syncing; resolves once a round still running is over, so nothing it pulls lands after a wipe. */
export async function stopSync(): Promise<void> {
  clearTimeout(timer)
  unsubscribe?.()
  unsubscribe = undefined
  server = undefined // no further round starts
  await running?.catch(() => undefined)
  setStatus({ state: 'idle' })
}
