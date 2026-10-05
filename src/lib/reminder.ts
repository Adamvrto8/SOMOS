import { useSyncExternalStore } from 'react'
import { t } from '../i18n'
import { db } from './db'
import { getLanguage, subscribeLanguage } from './language'
import { loadProgress } from './reminderProgress'
import type { ReminderStatus } from './reminderStatus'

// Daily practice reminder (Web Push). The server side is api/reminder.ts; the design is in
// docs/superpowers/specs/2026-09-27-push-reminders-design.md. Settings are per device, like the daily goal.

/** Public half of the VAPID key pair; the same value as in api/reminder.ts. */
export const VAPID_PUBLIC_KEY = 'BPTIxlaW9JLc2601tsFgNg6FVwR8CUB4GHBVze_ERU7m0EEuYrWb4Y8XwBVAIMRjYgB_aBVi48EnbCx4-isXD_Q'

// ---------- settings ----------

export interface ReminderSettings {
  enabled: boolean
  time: string // "19:00"
  /** Turned off by the app, not the learner: Android took the notification permission back. */
  lost?: true
}

const STORAGE_KEY = 'somos-reminder'
const DEFAULT_SETTINGS: ReminderSettings = { enabled: false, time: '19:00' }
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function parseSettings(raw: string | null): ReminderSettings {
  try {
    const value: unknown = JSON.parse(raw ?? '')
    if (typeof value === 'object' && value !== null) {
      const { enabled, time } = value as Record<string, unknown>
      const { lost } = value as Record<string, unknown>
      if (typeof enabled === 'boolean' && typeof time === 'string' && TIME.test(time)) {
        return lost === true && !enabled ? { enabled, time, lost } : { enabled, time }
      }
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

/** Current settings outside React (the backup). */
export const getReminderSettings = () => settings

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
  | 'elsewhere'
  | 'failed'

export class ReminderFailure extends Error {
  code: ReminderError
  /** The underlying cause for 'failed' (browser error or HTTP status), shown small under the message. */
  detail?: string
  constructor(code: ReminderError, detail?: string) {
    super(code)
    this.code = code
    this.detail = detail
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

/** Resolves with the server's JSON answer. */
async function post(body: Record<string, unknown>, keepalive = false): Promise<unknown> {
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
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (res.ok) return data
  if (data.error === 'not-configured') throw new ReminderFailure('not-configured')
  if (res.status === 429) throw new ReminderFailure('too-many')
  if (res.status === 410) throw new ReminderFailure('gone')
  if (data.error === 'other-device') throw new ReminderFailure('elsewhere')
  throw new ReminderFailure('failed', `server ${res.status}${data.error ? ` ${data.error}` : ''}`)
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
  } catch (error) {
    if (!navigator.onLine) throw new ReminderFailure('offline')
    throw new ReminderFailure('failed', error instanceof Error ? `${error.name}: ${error.message}` : String(error))
  }
}

const DEVICE_KEY = 'somos-reminder-device'

/** This device's own name for the server: a subscription can change, the device stays. */
function deviceId(): string | undefined {
  try {
    const stored = localStorage.getItem(DEVICE_KEY)
    if (stored) return stored
    const fresh = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, fresh)
    return fresh
  } catch {
    return undefined // no storage: the server then takes this for an app from before device ids
  }
}

/**
 * Tells the server where and when to remind (also refreshes a rotated subscription).
 * The server reminds one device. `takeOver` moves the reminders here from another one; without it
 * the server refuses ('elsewhere'), so that merely opening the app somewhere does not move them.
 */
function register(subscription: PushSubscription, time: string, takeOver: boolean): Promise<unknown> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // receipts: this app's service worker confirms the messages it gets (public/push-sw.js).
  const here = { device: deviceId(), ...(takeOver ? { takeOver: true } : {}) }
  return post({ type: 'subscribe', subscription: subscription.toJSON(), time, timeZone, language: getLanguage(), receipts: true, ...here })
}

/** Registers this device; replaces a subscription the push service dropped (the server answers 410). */
async function registerDevice(time: string, takeOver: boolean): Promise<PushSubscription> {
  const subscription = await ensureSubscription()
  try {
    await register(subscription, time, takeOver)
    return subscription
  } catch (error) {
    if (!isGone(error)) throw error
    await subscription.unsubscribe()
    const fresh = await ensureSubscription()
    await register(fresh, time, takeOver)
    return fresh
  }
}

// ---------- actions (Nastavenia) ----------

// What the learner does here (turn on, change the time, send a test) brings the reminders to this device.

/** Asks for permission, subscribes this device and turns the reminder on. */
export async function enableReminder(time: string): Promise<void> {
  assertReady()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new ReminderFailure(permission === 'denied' ? 'denied' : 'not-allowed')
  await registerDevice(time, true)
  saveSettings({ enabled: true, time })
  synced()
  void reportProgressNow()
}

export async function setReminderTime(time: string): Promise<void> {
  if (!settings.enabled) return saveSettings({ ...settings, time })
  assertReady()
  await registerDevice(time, true)
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
  saveSettings({ enabled: false, time: settings.time })
  setSyncFailure(null)
}

/** Registers this device again (in case the server lost it) and asks for a test notification. */
export async function sendTestReminder(): Promise<void> {
  assertReady()
  const attempt = async () => {
    const subscription = await registerDevice(settings.time, true)
    await post({ type: 'test', endpoint: subscription.endpoint })
  }
  try {
    await attempt()
  } catch (error) {
    if (!isGone(error)) throw error
    // The push service just dropped the subscription; the server now answers 410 for it, so this round replaces it.
    await attempt()
  }
  synced()
}

/**
 * Asks for a test notification at the timer's next call (within 15 minutes): the way to try the
 * reminder as it really comes, with the app closed and the phone asleep.
 */
export async function sendTestLater(): Promise<void> {
  assertReady()
  const subscription = await registerDevice(settings.time, true)
  await post({ type: 'test-later', endpoint: subscription.endpoint })
  synced()
}

// ---------- keeping the server's copy alive ----------

// A reminder that stops working is silent by nature, so the app has to say it: on Domov and in Nastavenia.
let syncFailure: ReminderFailure | null = null
let lastSync = 0
const SYNC_EVERY = 30 * 60_000

function setSyncFailure(next: ReminderFailure | null) {
  if (syncFailure === next) return
  syncFailure = next
  listeners.forEach((notify) => notify())
}

function synced() {
  lastSync = Date.now()
  setSyncFailure(null)
}

/** What to tell the learner when the reminder they turned on is not working, or null. */
export function reminderProblem(): string | null {
  const text = t().reminder
  if (settings.lost) return text.lost
  if (!settings.enabled || !syncFailure) return null
  if (syncFailure.code === 'elsewhere') return text.elsewhere
  const why = syncFailure.code === 'offline' ? text.problemOffline : syncFailure.code === 'failed' ? text.problemFailed : text.errors[syncFailure.code]
  return text.problem(why)
}

export function useReminderProblem(): string | null {
  return useSyncExternalStore(subscribe, reminderProblem)
}

/** The reminder is on here, but the server sends it to another device (and this one did not take it). */
export function useReminderElsewhere(): boolean {
  return useSyncExternalStore(subscribe, () => settings.enabled && syncFailure?.code === 'elsewhere')
}

/**
 * Keeps the server's copy fresh (Chrome can rotate a subscription, the push service can drop it)
 * and turns the setting off, visibly, when Android took the notification permission back.
 * Never takes the reminders from another device: that it only reports.
 */
export async function syncReminder(): Promise<void> {
  if (!settings.enabled) return
  const support = reminderSupport()
  if (support === 'unavailable') return
  if (support !== 'ok' || Notification.permission !== 'granted') return saveSettings({ enabled: false, time: settings.time, lost: true })
  if (!navigator.onLine) return
  try {
    await registerDevice(settings.time, false)
    synced()
    await reportProgressNow()
  } catch (error) {
    // Shown as reminderProblem(); the next start or return to the app tries again.
    setSyncFailure(error instanceof ReminderFailure ? error : new ReminderFailure('failed', String(error)))
  }
}

/**
 * At app start and whenever the app comes back to the front: Android keeps an installed PWA alive
 * for days, so a subscription lost meanwhile would otherwise stay lost until a full restart.
 */
export function keepReminderSynced(): void {
  void syncReminder()
  // The notification is written by the server: it has to hear about a switch.
  subscribeLanguage(() => void syncReminder())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (syncFailure || Date.now() - lastSync > SYNC_EVERY) void syncReminder()
  })
}

/** What the server knows about this device's reminder (see reminderStatus.ts). */
export async function fetchReminderStatus(): Promise<ReminderStatus> {
  const subscription = reminderSupport() === 'ok' ? await existingSubscription().catch(() => null) : null
  const data = (await post({ type: 'status', endpoint: subscription?.endpoint })) as { status?: ReminderStatus }
  if (!data.status) throw new ReminderFailure('failed', 'no status')
  return data.status
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
