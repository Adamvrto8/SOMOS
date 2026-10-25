import { useSyncExternalStore } from 'react'
import { dayKey } from './dates'
import { getLanguage } from './language'

// Anonymous usage statistics (docs/superpowers/specs/2026-10-25-usage-stats-design.md): which exercises are done
// and where learners stop. A random id per device, never the account; events wait in localStorage and go in
// batches to api/usage.ts. Nothing on the dev server or in tests; the learner can turn it off in Profil.

export type UsageProps = Record<string, string | number | boolean | null>

interface QueuedEvent {
  name: string
  day: string // local date
  at: number // ms
  props: UsageProps
}

/** What the server said about a batch: stored, try again later, or never (it is invalid: dropped). */
export type SendResult = 'sent' | 'retry' | 'drop'

export interface UsageEnv {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  send(body: string): Promise<SendResult>
  /** False on the dev server: nothing is kept or sent. */
  live: boolean
  now(): Date
  version(): string
  language(): string
  newId(): string
}

const KEYS = { off: 'somos-usage-off', device: 'somos-usage-device', queue: 'somos-usage-queue', open: 'somos-usage-open' }
export const MAX_QUEUE = 200
const BATCH = 100

export type Screen = 'home' | 'search' | 'word' | 'topic' | 'practice' | 'grammar' | 'tests' | 'test' | 'duel' | 'archive' | 'profile' | 'review' | 'stats'

// First match wins. The lesson and the welcome have their own events. Mirrored in api/usage.ts (SCREENS).
const SCREENS: [RegExp, Screen][] = [
  [/^\/$/, 'home'],
  [/^\/search\/?$/, 'search'],
  [/^\/word\//, 'word'],
  [/^\/topic\//, 'topic'],
  [/^\/practice\/?$/, 'practice'],
  [/^\/practice\/grammar(\/|$)/, 'grammar'],
  [/^\/practice\/tests\/?$/, 'tests'],
  [/^\/practice\/test\/?$/, 'test'],
  [/^\/duel(\/|$)/, 'duel'],
  [/^\/archive(\/|$)/, 'archive'],
  [/^\/profile(\/|$)/, 'profile'],
  [/^\/review\/?$/, 'review'],
  [/^\/stats\/?$/, 'stats'],
]

/** The screen of a path, without the word, topic or room in it; null for screens not counted. */
export function screenOf(pathname: string): Screen | null {
  return SCREENS.find(([pattern]) => pattern.test(pathname))?.[1] ?? null
}

export function createUsage(env: UsageEnv) {
  const get = (key: string) => {
    try {
      return env.storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  const set = (key: string, value: string) => {
    try {
      env.storage?.setItem(key, value)
    } catch {
      // Full or blocked storage: the statistics just miss this.
    }
  }
  const remove = (key: string) => {
    try {
      env.storage?.removeItem(key)
    } catch {
      // Nothing to forget.
    }
  }
  const readQueue = (): QueuedEvent[] => {
    try {
      const parsed: unknown = JSON.parse(get(KEYS.queue) ?? '[]')
      return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : []
    } catch {
      return []
    }
  }
  const isOn = () => get(KEYS.off) === null
  let sending = false
  let lastScreen: Screen | null = null

  const track = (name: string, props: UsageProps = {}) => {
    if (!env.live || !isOn()) return
    const now = env.now()
    set(KEYS.queue, JSON.stringify([...readQueue(), { name, day: dayKey(now), at: now.getTime(), props }].slice(-MAX_QUEUE)))
  }

  return {
    isOn,
    track,
    /** At most once a local day: "used the app that day". */
    trackOpen() {
      if (!env.live || !isOn()) return
      const day = dayKey(env.now())
      if (get(KEYS.open) === day) return
      set(KEYS.open, day)
      track('open')
    },
    /** A route entered; the same screen again (swiping through words) counts once. */
    trackScreen(pathname: string) {
      const screen = screenOf(pathname)
      if (!screen || screen === lastScreen) return
      lastScreen = screen
      track('screen', { name: screen })
    },
    /** Off forgets the device id, the unsent events and today's open; on again starts as a new device. */
    setOn(on: boolean) {
      if (on) return remove(KEYS.off)
      set(KEYS.off, '1')
      remove(KEYS.device)
      remove(KEYS.queue)
      remove(KEYS.open)
    },
    async flush(): Promise<void> {
      if (!env.live || !isOn() || sending) return
      const batch = readQueue().slice(0, BATCH)
      if (!batch.length) return
      let device = get(KEYS.device)
      if (!device) {
        device = env.newId()
        set(KEYS.device, device)
      }
      sending = true
      try {
        const result = await env.send(JSON.stringify({ device, version: env.version(), language: env.language(), events: batch }))
        // Events tracked meanwhile were appended after the batch: only the batch leaves.
        if (result !== 'retry') set(KEYS.queue, JSON.stringify(readQueue().slice(batch.length)))
      } catch {
        // Offline or the server down: the queue waits for the next flush.
      } finally {
        sending = false
      }
    },
  }
}

async function send(body: string): Promise<SendResult> {
  try {
    // keepalive: the request survives the page going away, which is when the queue is flushed.
    const res = await fetch('/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
    if (res.ok) return 'sent'
    return res.status === 400 || res.status === 413 ? 'drop' : 'retry'
  } catch {
    return 'retry'
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

const usage = createUsage({
  storage: localStorageOrNull(),
  send,
  live: !import.meta.env.DEV,
  now: () => new Date(),
  version: () => __APP_VERSION__, // read when sending: tests have no __APP_VERSION__
  language: getLanguage,
  newId: () => crypto.randomUUID(),
})

const listeners = new Set<() => void>()

export const track = usage.track
export const trackScreen = usage.trackScreen

export function setUsageOn(on: boolean) {
  usage.setOn(on)
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useUsageOn(): boolean {
  return useSyncExternalStore(subscribe, usage.isOn)
}

/** From main.tsx: today's open, the queue left from last time, and a flush whenever the app goes to the background. */
export function startUsage() {
  usage.trackOpen()
  void usage.flush()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void usage.flush()
    else usage.trackOpen()
  })
}
