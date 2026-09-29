import { useSyncExternalStore } from 'react'
import { db } from './db'
import { loadProgress } from './reminderProgress'

// Daily practice reminder (Web Push). The server side is api/reminder.ts; the design is in
// docs/superpowers/specs/2026-09-27-push-reminders-design.md. Settings are per device, like the daily goal.

/** Public half of the VAPID key pair; the same value as in api/reminder.ts. */
export const VAPID_PUBLIC_KEY = 'BPTIxlaW9JLc2601tsFgNg6FVwR8CUB4GHBVze_ERU7m0EEuYrWb4Y8XwBVAIMRjYgB_aBVi48EnbCx4-isXD_Q'

// ---------- settings ----------

export interface ReminderSettings {
  enabled: boolean
  time: string // "19:00"
}

const STORAGE_KEY = 'somos-reminder'
const DEFAULT_SETTINGS: ReminderSettings = { enabled: false, time: '19:00' }
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function parseSettings(raw: string | null): ReminderSettings {
  try {
    const value: unknown = JSON.parse(raw ?? '')
    if (typeof value === 'object' && value !== null) {
      const { enabled, time } = value as Record<string, unknown>
      if (typeof enabled === 'boolean' && typeof time === 'string' && TIME.test(time)) return { enabled, time }
    }
  } catch {
    // Missing or corrupted: the defaults.
  }
  return DEFAULT_SETTINGS
}

function readSettings(): ReminderSettings {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_SETTINGS
  }
}

let settings = readSettings()
const listeners = new Set<() => void>()

function saveSettings(next: ReminderSettings) {
  settings = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The choice just won't survive a reload.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useReminderSettings(): ReminderSettings {
  return useSyncExternalStore(subscribe, () => settings)
}

// ---------- errors and support ----------

export type ReminderError =
  | 'unavailable'
  | 'unsupported'
  | 'denied'
  | 'not-allowed'
  | 'offline'
  | 'not-configured'
  | 'too-many'
  | 'gone'
  | 'failed'

export const REMINDER_ERRORS: Record<ReminderError, string> = {
  unavailable: 'Pripomienky fungujú len v nasadenej aplikácii, nie na lokálnom serveri.',
  unsupported: 'Tento prehliadač notifikácie nepodporuje.',
  denied: 'Notifikácie sú zablokované. Povoľ ich v Nastaveniach Androidu → Aplikácie → SOMOS → Upozornenia.',
  'not-allowed': 'Bez povolenia notifikácií pripomienky nefungujú.',
  offline: 'Potrebuješ internet.',
  'not-configured': 'Pripomienky ešte nie sú na serveri nastavené.',
  'too-many': 'Skúšobnú notifikáciu môžeš poslať raz za minútu.',
  gone: 'Prihlásenie na notifikácie vypršalo. Skús to znova.',
  failed: 'Nepodarilo sa. Skús to znova.',
}

export class ReminderFailure extends Error {
  code: ReminderError
  constructor(code: ReminderError) {
    super(code)
    this.code = code
  }
}

export type ReminderSupport = 'ok' | 'unavailable' | 'unsupported' | 'denied'

/** Whether this device can get reminders (the Vite dev server has no service worker and no /api). */
export function reminderSupport(): ReminderSupport {
  if (import.meta.env.DEV) return 'unavailable'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return Notification.permission === 'denied' ? 'denied' : 'ok'
}

function assertReady() {
  const support = reminderSupport()
  if (support !== 'ok') throw new ReminderFailure(support)
  if (!navigator.onLine) throw new ReminderFailure('offline')
}

// ---------- server and push subscription ----------

async function post(body: Record<string, unknown>, keepalive = false): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
    })
  } catch {
    throw new ReminderFailure('offline')
  }
  if (res.ok) return
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (data.error === 'not-configured') throw new ReminderFailure('not-configured')
  if (res.status === 429) throw new ReminderFailure('too-many')
  if (res.status === 410) throw new ReminderFailure('gone')
  throw new ReminderFailure('failed')
}

const isGone = (error: unknown) => error instanceof ReminderFailure && error.code === 'gone'

/** VAPID keys are base64url; pushManager.subscribe wants the raw bytes. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function existingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

async function ensureSubscription(): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing
  try {
    return await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) })
  } catch {
    throw new ReminderFailure(navigator.onLine ? 'failed' : 'offline')
  }
}

/** Tells the server where and when to remind (also refreshes a rotated subscription). */
function register(subscription: PushSubscription, time: string): Promise<void> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return post({ type: 'subscribe', subscription: subscription.toJSON(), time, timeZone })
}

/** Registers this device; replaces a subscription the push service dropped (the server answers 410). */
async function registerDevice(time: string): Promise<PushSubscription> {
  const subscription = await ensureSubscription()
  try {
    await register(subscription, time)
    return subscription
  } catch (error) {
    if (!isGone(error)) throw error
    await subscription.unsubscribe()
    const fresh = await ensureSubscription()
    await register(fresh, time)
    return fresh
  }
}

// ---------- actions (Nastavenia) ----------

/** Asks for permission, subscribes this device and turns the reminder on. */
export async function enableReminder(time: string): Promise<void> {
  assertReady()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new ReminderFailure(permission === 'denied' ? 'denied' : 'not-allowed')
  await registerDevice(time)
  saveSettings({ enabled: true, time })
  void reportProgressNow()
}

export async function setReminderTime(time: string): Promise<void> {
  if (!settings.enabled) return saveSettings({ ...settings, time })
  assertReady()
  await registerDevice(time)
  saveSettings({ ...settings, time })
}

/** Works even when notifications were blocked meanwhile: then only the local setting changes. */
export async function disableReminder(): Promise<void> {
  if (reminderSupport() === 'ok') {
    if (!navigator.onLine) throw new ReminderFailure('offline')
    const subscription = await existingSubscription()
    if (subscription) {
      await post({ type: 'unsubscribe', endpoint: subscription.endpoint })
      await subscription.unsubscribe()
    }
  }
  saveSettings({ ...settings, enabled: false })
}

/** Registers this device again (in case the server lost it) and asks for a test notification. */
export async function sendTestReminder(): Promise<void> {
  assertReady()
  const attempt = async () => {
    const subscription = await registerDevice(settings.time)
    await post({ type: 'test', endpoint: subscription.endpoint })
  }
  try {
    await attempt()
  } catch (error) {
    if (!isGone(error)) throw error
    // The push service just dropped the subscription; the server now answers 410 for it, so this round replaces it.
    await attempt()
  }
}

/**
 * At app start: keeps the server's copy fresh (Chrome can rotate a subscription) and turns the
 * setting off when notifications were blocked in Android settings meanwhile.
 */
export async function syncReminder(): Promise<void> {
  if (!settings.enabled) return
  const support = reminderSupport()
  if (support === 'unavailable') return
  if (support !== 'ok' || Notification.permission !== 'granted') return saveSettings({ ...settings, enabled: false })
  if (!navigator.onLine) return
  try {
    await registerDevice(settings.time)
    await reportProgressNow()
  } catch {
    // The next start tries again.
  }
}

// ---------- progress reports ----------

const REPORT_DELAY = 3000
let reportTimer: number | undefined

/** Sends today's numbers soon; answers in quick succession make one request. */
export function reportProgress(): void {
  if (!settings.enabled) return
  window.clearTimeout(reportTimer)
  reportTimer = window.setTimeout(() => void reportProgressNow(), REPORT_DELAY)
}

async function reportProgressNow(keepalive = false): Promise<void> {
  if (!settings.enabled || reminderSupport() !== 'ok' || !navigator.onLine) return
  try {
    const subscription = await existingSubscription()
    if (!subscription) return
    await post({ type: 'progress', endpoint: subscription.endpoint, progress: await loadProgress() }, keepalive)
  } catch {
    // Best effort: the next answer or app start reports again.
  }
}

/** Reports after every answer or review, and when the app goes to the background. */
export function startProgressReporting(): void {
  // A Dexie "creating" hook must not return a value: it would become the new record's key.
  db.attempts.hook('creating', () => {
    reportProgress()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !settings.enabled) return
    window.clearTimeout(reportTimer)
    void reportProgressNow(true)
  })
}
