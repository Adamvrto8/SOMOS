// Vercel function: the daily practice reminder (Web Push), one for every device that turns it on.
//   POST /api/reminder: from the app (same-origin): subscribe | unsubscribe | progress | test | test-later | status
//                       from its service worker: received (a message arrived and was shown, or why not)
//   GET  /api/reminder: from cron-job.org every 15 minutes (Authorization: Bearer CRON_SECRET)
// Design: docs/superpowers/specs/2026-09-27-push-reminders-design.md; one row per device in Supabase
// (push_devices in supabase/schema.sql) since docs/superpowers/specs/2026-10-24-reminders-for-everyone-design.md.
// Kept free of local imports so Vercel can deploy it as a single file.
import { createHmac } from 'node:crypto'
import webpush from 'web-push'

// ---------- types (ReminderProgress mirrors src/lib/reminderProgress.ts) ----------

export interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** What decide() needs to know about a device. */
export interface ReminderSub {
  subscription: PushSub
  time: string // "19:00", device-local
  timeZone: string // IANA zone from the device, e.g. "Europe/Bratislava"
  language?: 'en' // the app's language; missing = Slovak
}

/** What the device last reported, computed in its local time. */
export interface ReminderProgress {
  day: string // "2026-09-27"
  done: number // right answers + reviews that day
  goal: number
  dueToday: number // review cards due by the end of `day`
  dueTomorrow: number // … by the end of the next day
  streakDays: number
  activeToday: boolean
}

/** A cron tick, or the tick's last word on one device: when, and what it decided ("sent", "goal-met"…). */
export interface LastTick {
  at: string // ISO time
  reason: string
}

/**
 * The last message handed to the push service, and what the device said about it. The push service
 * accepting a message says nothing about the device getting it: only the device can tell.
 */
export interface Delivery {
  kind: 'reminder' | 'test'
  sentAt: string // ISO time; also the id the message carries and its receipt answers to
  receipts: boolean // the device's app is one that confirms: without it, silence means nothing
  receivedAt?: string // the service worker got the message
  shown?: boolean // … and the system took the notification
  error?: string // why not
}

/** One device that has the reminder on (a row of push_devices). */
export interface DeviceRow {
  device: string // the app's own id for the device: outlives a rotated subscription
  userId: string | null // the account signed in on it
  endpoint: string
  p256dh: string
  auth: string
  time: string
  timeZone: string
  language: 'sk' | 'en'
  receipts: boolean // its service worker confirms what it receives
  progress: ReminderProgress | null
  handledDay: string | null // local day the reminder was sent, or skipped because the goal was met
  sentDay: string | null // local day of the last reminder sent
  delivery: Delivery | null
  lastDecision: LastTick | null
  testAt: string | null // the last test notification
  testLater: boolean // a test waits for the next tick
  seenAt: string // the last subscribe or progress report
}

/** What the server knows about the asking device, for "Stav pripomienky". The subscription is never included. */
export interface ReminderStatus {
  subscribed: boolean // the server reminds this device
  time: string | null
  timeZone: string | null
  serverClock: { day: string; time: string } | null // now, in that time zone
  sentDay: string | null // day of the last reminder sent
  progress: ReminderProgress | null
  lastTick: LastTick | null // the cron's last call (for every device)
  lastDecision: LastTick | null // what that call, or an earlier one, decided for this device
  dropped: boolean // not reminded because the push service dropped its subscription
  delivery: Delivery | null
  testPending: boolean // a test notification waits for the next tick
}

export interface Message {
  title: string
  body: string
}

/** Today as far as the server knows. */
export interface TodayView {
  done: number
  goal: number
  due: number | null // null = unknown (no report from today or yesterday)
  streak: number // days of a streak that is still alive
}

export type SkipReason = 'too-early' | 'too-late' | 'already-sent' | 'goal-met'
export type Decision = { send: true; day: string; message: Message } | { send: false; reason: SkipReason }

/** Minutes after the chosen time during which a reminder may still go out. */
const WINDOW_MINUTES = 120
const LAST_MINUTE = 23 * 60 + 59
const DEFAULT_GOAL = 20

/** Devices the server keeps at most; a new one beyond it is refused. */
export const MAX_DEVICES = 50_000
/** New devices from one IP address (an IPv6 /64) in an hour. */
export const NEW_DEVICES_PER_HOUR = 20
/**
 * New devices from one block of addresses (IPv4 /24, IPv6 /48) in an hour: one source with many addresses.
 * No limit for everyone together: one source could then lock every new learner out. The table itself is
 * held by MAX_DEVICES and the clean-up of dropped and silent devices.
 */
export const NEW_DEVICES_PER_HOUR_BLOCK = 100
/** Devices one page of a tick looks at; a tick takes pages until none are left or its time is up. */
export const TICK_LIMIT = 500
/** A tick stops taking devices after this long (maxDuration in vercel.json is 60 s). */
export const TICK_BUDGET_MS = 45_000
export const SEND_CONCURRENCY = 20
const TEST_EVERY_MS = 60_000
/** One request to Supabase or a push service; a hung one must not use up the tick. */
const REQUEST_TIMEOUT_MS = 10_000

// ---------- validation (requests and stored data) ----------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isPositive = (v: unknown): v is number => isCount(v) && v > 0

export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** The zone's canonical IANA name ("europe/bratislava" → "Europe/Bratislava"), as Postgres knows it. */
export const canonicalZone = (zone: string) => new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone

export function isTimeZone(v: unknown): v is string {
  if (typeof v !== 'string' || !v) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: v })
    return true
  } catch {
    return false
  }
}

/** The push services of Chrome, Firefox, Safari and Edge: the server sends nowhere else. */
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'web.push.apple.com', 'notify.windows.com']

export function isPushHost(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

/** How many bytes a base64url string holds, or -1 when it is not one. */
function base64UrlBytes(value: unknown): number {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+=*$/.test(value)) return -1
  return Buffer.from(value, 'base64url').length
}

/** The keys a browser makes: an uncompressed P-256 point (65 bytes) and a 16-byte secret. */
const isPushKeys = (v: unknown): v is PushSub['keys'] =>
  isRecord(v) && base64UrlBytes(v.p256dh) === 65 && Buffer.from(String(v.p256dh), 'base64url')[0] === 4 && base64UrlBytes(v.auth) === 16

export function isPushSub(v: unknown): v is PushSub {
  return isRecord(v) && typeof v.endpoint === 'string' && isPushHost(v.endpoint) && isPushKeys(v.keys)
}

export const isDevice = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{8,64}$/.test(v)

export const isReminderSub = (v: unknown): v is ReminderSub =>
  isRecord(v) && isPushSub(v.subscription) && isTime(v.time) && isTimeZone(v.timeZone) && (v.language === undefined || v.language === 'en')

export const isProgress = (v: unknown): v is ReminderProgress =>
  isRecord(v) &&
  typeof v.day === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v.day) &&
  isCount(v.done) &&
  isPositive(v.goal) &&
  isCount(v.dueToday) &&
  isCount(v.dueTomorrow) &&
  isCount(v.streakDays) &&
  typeof v.activeToday === 'boolean'

const isLastTick = (v: unknown): v is LastTick => isRecord(v) && typeof v.at === 'string' && typeof v.reason === 'string'

const isDelivery = (v: unknown): v is Delivery =>
  isRecord(v) && (v.kind === 'reminder' || v.kind === 'test') && typeof v.sentAt === 'string' && typeof v.receipts === 'boolean'

// ---------- time ----------

/** The calendar day and minute of the day at `now` in `timeZone` (DST-aware). */
export function localClock(now: Date, timeZone: string): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00'
  return { day: `${part('year')}-${part('month')}-${part('day')}`, minutes: Number(part('hour')) * 60 + Number(part('minute')) }
}

/** "2026-03-01" → "2026-02-28". */
export function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// ---------- what to send ----------

export function todayView(progress: ReminderProgress | null, day: string): TodayView {
  if (progress?.day === day) {
    return { done: progress.done, goal: progress.goal, due: progress.dueToday, streak: progress.streakDays }
  }
  if (progress && progress.day === previousDay(day)) {
    return { done: 0, goal: progress.goal, due: progress.dueTomorrow, streak: progress.activeToday ? progress.streakDays : 0 }
  }
  return { done: 0, goal: progress?.goal ?? DEFAULT_GOAL, due: null, streak: 0 }
}

/**
 * The report to judge a device of an account by: every device knows only what it has synced, so of the
 * reports from `day` the one with the most done (the best lower bound), else the same of yesterday's.
 * The goal stays the device's own.
 */
export function bestProgress(own: ReminderProgress | null, others: ReminderProgress[], day: string): ReminderProgress | null {
  const reports = own ? [own, ...others] : others
  for (const wanted of [day, previousDay(day)]) {
    const best = reports.filter((p) => p.day === wanted).sort((a, b) => b.done - a.done)[0]
    if (best) return own && best !== own ? { ...best, goal: own.goal } : best
  }
  return own
}

/** Slovak plural form: 1 deň, 2–4 dni, 5+ dní (same as src/lib/text.ts). */
function pluralSk(count: number, [one, few, many]: [string, string, string]): string {
  if (count === 1) return one
  if (count >= 2 && count <= 4) return few
  return many
}

const days = (n: number) => `${n} ${pluralSk(n, ['deň', 'dni', 'dní'])}`

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function composeEnglish({ done, goal, due, streak }: TodayView): Message {
  if (done > 0) {
    const streakPart = streak > 0 ? ` · ${streak}-day streak 🔥` : ''
    return { title: `${goal - done} to go for the daily goal`, body: `Today ${done}/${goal}${streakPart}` }
  }
  const waiting = due ? `To review: ${plural(due, 'card', 'cards')}` : `Daily goal: ${plural(goal, 'correct answer', 'correct answers')}`
  if (streak > 0) return { title: `🔥 A ${streak}-day streak is waiting for today`, body: `${waiting} · a few minutes is enough` }
  return { title: '¿Practicamos? 🇲🇽', body: waiting }
}

export function composeMessage(view: TodayView, language?: 'sk' | 'en'): Message {
  if (language === 'en') return composeEnglish(view)
  const { done, goal, due, streak } = view
  if (done > 0) {
    const streakPart = streak > 0 ? ` · séria ${days(streak)} 🔥` : ''
    return { title: `Ešte ${goal - done} do denného cieľa`, body: `Dnes ${done}/${goal}${streakPart}` }
  }
  const waiting = due
    ? `Na zopakovanie: ${due} ${pluralSk(due, ['kartička', 'kartičky', 'kartičiek'])}`
    : `Denný cieľ: ${goal} ${pluralSk(goal, ['správna odpoveď', 'správne odpovede', 'správnych odpovedí'])}`
  if (streak > 0) return { title: `🔥 Séria ${days(streak)} čaká na dnešok`, body: `${waiting} · stačí pár minút` }
  return { title: '¿Practicamos? 🇲🇽', body: waiting }
}

export const TEST_MESSAGE: Message = { title: 'SOMOS', body: 'Skúšobná notifikácia — pripomienky fungujú ✓' }
export const TEST_MESSAGE_EN: Message = { title: 'SOMOS', body: 'Test notification — reminders work ✓' }

const testMessage = (row: DeviceRow) => (row.language === 'en' ? TEST_MESSAGE_EN : TEST_MESSAGE)

/** Whether the tick at `now` should send today's reminder. `handledDay`: the day it was already sent or skipped. */
export function decide(now: Date, sub: ReminderSub, progress: ReminderProgress | null, handledDay: string | null): Decision {
  const { day, minutes } = localClock(now, sub.timeZone)
  const start = toMinutes(sub.time)
  if (minutes < start) return { send: false, reason: 'too-early' }
  if (minutes > Math.min(start + WINDOW_MINUTES, LAST_MINUTE)) return { send: false, reason: 'too-late' }
  if (handledDay === day) return { send: false, reason: 'already-sent' }
  const view = todayView(progress, day)
  if (view.done >= view.goal) return { send: false, reason: 'goal-met' }
  return { send: true, day, message: composeMessage(view, sub.language) }
}

export const subOf = (row: DeviceRow): ReminderSub => ({
  subscription: { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
  time: row.time,
  timeZone: row.timeZone,
  ...(row.language === 'en' ? { language: 'en' as const } : {}),
})

// ---------- storage ----------

export interface DeviceStore {
  byEndpoint(endpoint: string): Promise<DeviceRow | null>
  byDevice(device: string): Promise<DeviceRow | null>
  /** Stores the device's row; another row still holding its endpoint goes. */
  save(row: DeviceRow): Promise<void>
  update(device: string, fields: Partial<DeviceRow>): Promise<void>
  remove(device: string): Promise<void>
  /** Devices inside their window and not handled today, and those with a test waiting (reminders_due). */
  due(now: Date, limit: number): Promise<DeviceRow[]>
  /** The last reports of every device of these accounts. */
  reportsOf(userIds: string[]): Promise<{ userId: string; device: string; progress: ReminderProgress }[]>
  isGone(endpoint: string): Promise<boolean>
  markGone(endpoint: string): Promise<void>
  lastTick(): Promise<LastTick | null>
  recordTick(tick: LastTick & { sent: number }): Promise<void>
  count(): Promise<number>
  /** Counts one new device for `key` this hour: false once over `limit`. */
  rateHit(key: string, limit: number): Promise<boolean>
  /** Notes a test notification at `now` unless one went out within the last minute: false then (atomic). */
  claimTest(device: string, now: Date): Promise<boolean>
  cleanup(): Promise<void>
}

const EMPTY_STATE = {
  progress: null,
  handledDay: null,
  sentDay: null,
  delivery: null,
  lastDecision: null,
  testAt: null,
  testLater: false,
} satisfies Partial<DeviceRow>

/** Columns of push_devices, by DeviceRow field. */
const COLUMNS = {
  device: 'device',
  userId: 'user_id',
  endpoint: 'endpoint',
  p256dh: 'p256dh',
  auth: 'auth',
  time: 'time',
  timeZone: 'time_zone',
  language: 'language',
  receipts: 'receipts',
  progress: 'progress',
  handledDay: 'handled_day',
  sentDay: 'sent_day',
  delivery: 'delivery',
  lastDecision: 'last_decision',
  testAt: 'test_at',
  testLater: 'test_later',
  seenAt: 'seen_at',
} as const satisfies Record<keyof DeviceRow, string>

const str = (v: unknown) => (typeof v === 'string' ? v : null)
const valid = <T>(v: unknown, isValid: (x: unknown) => x is T): T | null => (isValid(v) ? v : null)

/** A row as PostgREST returns it; stored JSON that no longer validates counts as missing. */
export function toDeviceRow(r: unknown): DeviceRow | null {
  if (!isRecord(r)) return null
  const { device, endpoint, p256dh, auth, time, time_zone: timeZone } = r
  if (typeof device !== 'string' || typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') return null
  if (typeof time !== 'string' || typeof timeZone !== 'string') return null
  return {
    device,
    userId: str(r.user_id),
    endpoint,
    p256dh,
    auth,
    time,
    timeZone,
    language: r.language === 'en' ? 'en' : 'sk',
    receipts: r.receipts === true,
    progress: valid(r.progress, isProgress),
    handledDay: str(r.handled_day),
    sentDay: str(r.sent_day),
    delivery: valid(r.delivery, isDelivery),
    lastDecision: valid(r.last_decision, isLastTick),
    testAt: str(r.test_at),
    testLater: r.test_later === true,
    seenAt: str(r.seen_at) ?? new Date(0).toISOString(),
  }
}

export function fromDeviceRow(fields: Partial<DeviceRow>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [field, column] of Object.entries(COLUMNS)) {
    const value = fields[field as keyof DeviceRow]
    if (value !== undefined) out[column] = value
  }
  return out
}

/**
 * Supabase's REST API (PostgREST) with the service role key, so the function needs no supabase-js.
 * A new secret key (sb_secret_…) goes only in `apikey`; a legacy one is a JWT and also the bearer.
 */
export function supabaseStore(url: string, key: string, fetchImpl: typeof fetch = fetch): DeviceStore {
  const base = url.replace(/\/+$/, '')
  const auth = key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}
  const call = async (path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<Response> => {
    const res = await fetchImpl(`${base}/rest/v1/${path}`, {
      method: init.method ?? 'GET',
      headers: { apikey: key, ...auth, 'Content-Type': 'application/json', ...(init.prefer ? { Prefer: init.prefer } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      throw new Error(`Supabase ${path.split('?')[0]} failed: ${data.message ?? res.status}`)
    }
    return res
  }
  const json = async (res: Response): Promise<unknown> => {
    const text = await res.text()
    return text ? (JSON.parse(text) as unknown) : null
  }
  const rows = async (res: Response) => {
    const data = await json(res)
    return Array.isArray(data) ? data.flatMap((r) => toDeviceRow(r) ?? []) : []
  }
  const eq = (value: string) => `eq.${encodeURIComponent(value)}`
  const quiet = 'return=minimal'

  return {
    byEndpoint: async (endpoint) => (await rows(await call(`push_devices?endpoint=${eq(endpoint)}&select=*`)))[0] ?? null,
    byDevice: async (device) => (await rows(await call(`push_devices?device=${eq(device)}&select=*`)))[0] ?? null,
    save: async (row) => {
      await call(`push_devices?endpoint=${eq(row.endpoint)}&device=neq.${encodeURIComponent(row.device)}`, { method: 'DELETE', prefer: quiet })
      await call('push_devices', { method: 'POST', body: fromDeviceRow(row), prefer: `resolution=merge-duplicates,${quiet}` })
    },
    update: async (device, fields) => {
      if (Object.keys(fields).length) await call(`push_devices?device=${eq(device)}`, { method: 'PATCH', body: fromDeviceRow(fields), prefer: quiet })
    },
    remove: async (device) => {
      await call(`push_devices?device=${eq(device)}`, { method: 'DELETE', prefer: quiet })
    },
    due: async (now, limit) => rows(await call('rpc/reminders_due', { method: 'POST', body: { p_now: now.toISOString(), p_limit: limit } })),
    reportsOf: async (userIds) => {
      if (!userIds.length) return []
      // In the body: hundreds of ids in the URL would be too long for the gateway.
      const data = await json(await call('rpc/push_reports', { method: 'POST', body: { p_users: userIds } }))
      if (!Array.isArray(data)) return []
      return data.flatMap((r: unknown) =>
        isRecord(r) && typeof r.user_id === 'string' && typeof r.device === 'string' && isProgress(r.progress)
          ? [{ userId: r.user_id, device: r.device, progress: r.progress }]
          : [],
      )
    },
    isGone: async (endpoint) => {
      const data = await json(await call(`push_gone?endpoint=${eq(endpoint)}&select=endpoint`))
      return Array.isArray(data) && data.length > 0
    },
    markGone: async (endpoint) => {
      await call('push_gone', { method: 'POST', body: { endpoint }, prefer: `resolution=ignore-duplicates,${quiet}` })
    },
    lastTick: async () => {
      const data = await json(await call('push_ticks?id=eq.1&select=at,reason'))
      return Array.isArray(data) ? valid(data[0], isLastTick) : null
    },
    recordTick: async ({ at, reason, sent }) => {
      await call('push_ticks', { method: 'POST', body: { id: 1, at, reason, sent }, prefer: `resolution=merge-duplicates,${quiet}` })
    },
    count: async () => {
      const res = await call('push_devices?select=device', { method: 'HEAD', prefer: 'count=exact' })
      // "0-24/1234", or "*/0" for an empty table.
      const total = Number(res.headers.get('content-range')?.split('/')[1])
      return Number.isFinite(total) ? total : 0
    },
    claimTest: async (device, now) => {
      const since = new Date(now.getTime() - TEST_EVERY_MS).toISOString()
      // One conditional update: two tests at once cannot both pass the check.
      const filter = `device=${eq(device)}&or=(test_at.is.null,test_at.lt.${encodeURIComponent(since)})&select=device`
      const data = await json(await call(`push_devices?${filter}`, { method: 'PATCH', body: { test_at: now.toISOString() }, prefer: 'return=representation' }))
      return Array.isArray(data) && data.length > 0
    },
    rateHit: async (rateKey, limit) => (await json(await call('rpc/push_rate_hit', { method: 'POST', body: { p_key: rateKey, p_limit: limit } }))) === true,
    cleanup: async () => {
      await call('rpc/push_cleanup', { method: 'POST', body: {} })
    },
  }
}

/** The account of a Supabase access token; null when it cannot be told (expired, invalid, Supabase down). */
export function supabaseUser(url: string, key: string, fetchImpl: typeof fetch = fetch): (token: string) => Promise<string | null> {
  const base = url.replace(/\/+$/, '')
  return async (token) => {
    try {
      const res = await fetchImpl(`${base}/auth/v1/user`, {
        headers: { apikey: key, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { id?: unknown }
      return typeof data.id === 'string' ? data.id : null
    } catch {
      return null
    }
  }
}

/**
 * The key the per-IP limit counts under. The address itself is never stored, and a keyed hash cannot be
 * turned back into it by trying every address.
 */
export function ipKeys(request: Request, secret: string): { address: string; block: string } {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const hash = (value: string) => createHmac('sha256', `somos-reminder:${secret}`).update(value).digest('hex')
  return { address: hash(ipNetwork(ip)), block: hash(ipBlock(ip)) }
}

/** The /24 of an IPv4 address, the /48 of an IPv6 one. */
export function ipBlock(ip: string): string {
  if (!ip.includes(':')) return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? `${ip.split('.').slice(0, 3).join('.')}.0/24` : ip
  return ipNetwork(ip).split(':').slice(0, 3).join(':') + '::/48'
}

/** An IPv6 address counts by its /64: one connection gets a whole /64 and can pick any address in it. */
export function ipNetwork(ip: string): string {
  if (!ip.includes(':')) return ip
  const [head, tail = ''] = ip.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

// ---------- sending ----------

// Public half of the VAPID key pair (the private half is VAPID_PRIVATE_KEY). Same value in src/lib/reminder.ts.
export const VAPID_PUBLIC_KEY = 'BPTIxlaW9JLc2601tsFgNg6FVwR8CUB4GHBVze_ERU7m0EEuYrWb4Y8XwBVAIMRjYgB_aBVi48EnbCx4-isXD_Q'
const VAPID_SUBJECT = 'https://somos-jade.vercel.app'
const REMINDER_TTL = 4 * 60 * 60 // seconds; a reminder that arrives hours late is pointless
// With 'normal' Android holds the message while the phone sleeps (Doze): it showed up late or never.
const REMINDER_URGENCY = 'high'

export interface SendOptions {
  ttl: number
  topic: string
  urgency: 'normal' | 'high'
}

/** Delivers one push message; rejects with `{ statusCode }` when the push service refuses it. */
export type Sender = (subscription: PushSub, payload: string, options: SendOptions) => Promise<void>

export function webPushSender(privateKey: string): Sender {
  return async (subscription, payload, { ttl, topic, urgency }) => {
    await webpush.sendNotification(subscription, payload, {
      vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey },
      TTL: ttl,
      topic,
      urgency,
      timeout: REQUEST_TIMEOUT_MS,
    })
  }
}

export interface Deps {
  store: DeviceStore
  send: Sender
  now: () => Date
  cronSecret: string
  /** The account of a Supabase access token, or null when it cannot be told. */
  userOf: (token: string) => Promise<string | null>
  /** Keys for the limits on new devices: the address (an IPv6 /64) and its block. */
  ipOf: (request: Request) => { address: string; block: string }
  /** Milliseconds for the tick's time budget; Date.now unless a test drives it. */
  clock?: () => number
}

type Sent = { outcome: 'sent'; delivery: Delivery } | { outcome: 'gone' | 'failed' }

const statusOf = (error: unknown) => (isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : undefined)

/** Sends a message; forgets a device whose subscription the push service no longer knows. */
async function deliver(deps: Deps, row: DeviceRow, message: Message, kind: Delivery['kind']): Promise<Sent> {
  try {
    const sentAt = deps.now().toISOString()
    // `id` is what the service worker's receipt names; `lang` tells it how to mark the notification (Slovak is its default).
    const payload = { ...message, url: '/', id: sentAt, ...(row.language === 'en' ? { lang: 'en' } : {}) }
    await deps.send(subOf(row).subscription, JSON.stringify(payload), { ttl: REMINDER_TTL, topic: kind, urgency: REMINDER_URGENCY })
    return { outcome: 'sent', delivery: { kind, sentAt, receipts: row.receipts } }
  } catch (error) {
    const status = statusOf(error)
    // 404/410: the subscription is gone; 400: the push service will never take it (a made-up one). Not 401/403:
    // those say our own VAPID key is wrong, and would drop every device.
    if (status === 400 || status === 404 || status === 410) {
      await deps.store.remove(row.device)
      await deps.store.markGone(row.endpoint)
      return { outcome: 'gone' }
    }
    console.error('push failed', status ?? error)
    return { outcome: 'failed' }
  }
}

// ---------- HTTP ----------

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Browsers send Origin on POST: only pages of this same deployment may change a reminder. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

const bearer = (request: Request) => /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1]

/** One device in a tick: a test asked for later, then today's reminder. */
async function remind(deps: Deps, row: DeviceRow, reports: { userId: string; device: string; progress: ReminderProgress }[], now: Date): Promise<string> {
  const fields: Partial<DeviceRow> = {}
  // A test the learner asked to get later, with the app closed and the phone asleep: the real conditions.
  if (row.testLater) {
    fields.testLater = false
    const test = await deliver(deps, row, testMessage(row), 'test')
    if (test.outcome === 'gone') return 'gone'
    if (test.outcome === 'sent') fields.delivery = test.delivery
  }
  // The daily goal counts for the whole account: practice on the tablet keeps the phone quiet.
  const others = row.userId ? reports.filter((r) => r.userId === row.userId && r.device !== row.device).map((r) => r.progress) : []
  const { day } = localClock(now, row.timeZone)
  const decision = decide(now, subOf(row), bestProgress(row.progress, others, day), row.handledDay)
  let reason: string
  if (!decision.send) {
    reason = decision.reason
    if (reason === 'goal-met') fields.handledDay = day
  } else {
    const result = await deliver(deps, row, decision.message, 'reminder')
    if (result.outcome === 'gone') return 'gone'
    reason = result.outcome
    if (result.outcome === 'sent') Object.assign(fields, { delivery: result.delivery, handledDay: decision.day, sentDay: decision.day })
  }
  fields.lastDecision = { at: now.toISOString(), reason }
  await deps.store.update(row.device, fields)
  return reason
}

async function tick(deps: Deps): Promise<Response> {
  const now = deps.now()
  const clock = deps.clock ?? Date.now
  const started = clock()
  const outOfTime = () => clock() - started > TICK_BUDGET_MS
  // Devices this tick has looked at: a page may bring them again (a send that failed stays due).
  const seen = new Set<string>()
  let sent = 0
  let partial = false

  // Page after page: most learners keep the default time, so thousands can be due at the same tick.
  for (;;) {
    if (outOfTime()) {
      partial = true
      break
    }
    const due = await deps.store.due(now, TICK_LIMIT)
    const page = due.filter((r) => !seen.has(r.device))
    if (!page.length) break
    page.forEach((r) => seen.add(r.device))
    const userIds = [...new Set(page.flatMap((r) => (r.userId ? [r.userId] : [])))]
    const reports = userIds.length ? await deps.store.reportsOf(userIds) : []

    const queue = [...page]
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        // Out of time: the rest stay unhandled, and the next tick is still inside their window.
        if (outOfTime()) {
          partial = true
          queue.length = 0
          return
        }
        try {
          if ((await remind(deps, row, reports, now)) === 'sent') sent++
        } catch (error) {
          console.error('reminder failed for a device', error)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, page.length) }, worker))
    if (partial || due.length < TICK_LIMIT) break
  }

  // Once a day, at the first tick after 03:00 UTC.
  if (now.getUTCHours() === 3 && now.getUTCMinutes() < 15) await deps.store.cleanup()
  const reason = seen.size === 0 ? 'nothing-due' : partial ? 'partial' : 'done'
  await deps.store.recordTick({ at: now.toISOString(), reason, sent })
  return json({ sent, reason })
}

async function subscribe(request: Request, body: Record<string, unknown>, deps: Deps): Promise<Response> {
  const sub = { subscription: body.subscription, time: body.time, timeZone: body.timeZone }
  if (!isReminderSub(sub) || !isDevice(body.device)) return json({ error: 'bad-request' }, 400)
  const { endpoint, keys } = sub.subscription
  // Chrome may still hold a subscription the push service dropped; 410 tells the app to make a new one.
  if (await deps.store.isGone(endpoint)) return json({ error: 'gone' }, 410)
  // The same device (perhaps with a new subscription), or a subscription that moved to a new device id (storage cleared).
  const [own, holder] = await Promise.all([deps.store.byDevice(body.device), deps.store.byEndpoint(endpoint)])
  const existing = own ?? holder
  // Only a new device counts toward the limits: every app checks in at every start.
  if (!existing) {
    if ((await deps.store.count()) >= MAX_DEVICES) return json({ error: 'full' }, 503)
    const { address, block } = deps.ipOf(request)
    if (!(await deps.store.rateHit(address, NEW_DEVICES_PER_HOUR))) return json({ error: 'too-many-devices' }, 429)
    if (!(await deps.store.rateHit(block, NEW_DEVICES_PER_HOUR_BLOCK))) return json({ error: 'too-many-devices' }, 429)
  }
  // Signed in: the device counts its practice with the account's other devices. A token that cannot be
  // checked right now, or an app signed in that could not get one (`account`), keeps the link as it was;
  // neither means signed out.
  const token = bearer(request)
  const keepLink = existing?.userId ?? null
  const userId = token ? ((await deps.userOf(token)) ?? keepLink) : body.account === true ? keepLink : null
  const settings = {
    userId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    time: sub.time,
    timeZone: canonicalZone(sub.timeZone),
    language: body.language === 'en' ? ('en' as const) : ('sk' as const),
    receipts: body.receipts === true,
    seenAt: deps.now().toISOString(),
  }
  if (own) {
    // Only what the device says about itself: what a tick or a report wrote meanwhile stays.
    if (holder && holder.device !== own.device) await deps.store.remove(holder.device)
    await deps.store.update(own.device, settings)
  } else {
    await deps.store.save({ ...EMPTY_STATE, ...holder, device: body.device, ...settings })
  }
  return json({ ok: true })
}

async function handlePost(request: Request, deps: Deps): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  const body: unknown = await request.json().catch(() => undefined)
  if (!isRecord(body)) return json({ error: 'bad-request' }, 400)
  if (body.type === 'subscribe') return subscribe(request, body, deps)

  // Every other request names its device by the endpoint, which only the browser and the push service know.
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null
  const row = endpoint ? await deps.store.byEndpoint(endpoint) : null
  const now = deps.now()

  switch (body.type) {
    case 'unsubscribe':
      if (row) await deps.store.remove(row.device)
      return json({ ok: true })
    case 'progress':
      if (!isProgress(body.progress)) return json({ error: 'bad-request' }, 400)
      if (row) await deps.store.update(row.device, { progress: body.progress, seenAt: now.toISOString() })
      return json({ ok: true })
    case 'test': {
      if (!row) return json({ error: 'not-subscribed' }, 409)
      if (!(await deps.store.claimTest(row.device, now))) return json({ error: 'too-many' }, 429)
      const result = await deliver(deps, row, testMessage(row), 'test')
      if (result.outcome === 'sent') {
        await deps.store.update(row.device, { delivery: result.delivery })
        return json({ ok: true })
      }
      return json({ error: result.outcome }, result.outcome === 'gone' ? 410 : 502)
    }
    case 'test-later':
      if (!row) return json({ error: 'not-subscribed' }, 409)
      await deps.store.update(row.device, { testLater: true })
      return json({ ok: true })
    case 'received': {
      if (typeof body.id !== 'string' || typeof body.shown !== 'boolean') return json({ error: 'bad-request' }, 400)
      // Only about the message that is the last one sent to this device.
      const delivery = row?.delivery
      if (row && delivery?.sentAt === body.id) {
        const error = typeof body.error === 'string' && !body.shown ? { error: body.error.slice(0, 200) } : {}
        const receipt: Delivery = { kind: delivery.kind, sentAt: delivery.sentAt, receipts: delivery.receipts, receivedAt: now.toISOString(), shown: body.shown, ...error }
        await deps.store.update(row.device, { delivery: receipt })
      }
      return json({ ok: true })
    }
    case 'status': {
      const [lastTick, dropped] = await Promise.all([deps.store.lastTick(), !row && endpoint ? deps.store.isGone(endpoint) : false])
      const clock = row ? localClock(now, row.timeZone) : null
      const status: ReminderStatus = {
        subscribed: row !== null,
        time: row?.time ?? null,
        timeZone: row?.timeZone ?? null,
        serverClock: clock && { day: clock.day, time: toTime(clock.minutes) },
        sentDay: row?.sentDay ?? null,
        progress: row?.progress ?? null,
        lastTick,
        lastDecision: row?.lastDecision ?? null,
        dropped,
        delivery: row?.delivery ?? null,
        testPending: row?.testLater ?? false,
      }
      return json({ ok: true, status })
    }
    default:
      return json({ error: 'bad-request' }, 400)
  }
}

export async function handleReminder(request: Request, deps: Deps | undefined): Promise<Response> {
  if (!deps) return json({ error: 'not-configured' }, 503)
  try {
    if (request.method === 'GET') {
      if (request.headers.get('authorization') !== `Bearer ${deps.cronSecret}`) return json({ error: 'unauthorized' }, 401)
      return await tick(deps)
    }
    return await handlePost(request, deps)
  } catch (error) {
    console.error('reminder failed', error)
    return json({ error: 'failed' }, 500)
  }
}

/** SUPABASE_URL, or the app's own VITE_SUPABASE_URL (Vercel gives functions every variable). */
export function depsFromEnv(env: Record<string, string | undefined>): Deps | undefined {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY
  const privateKey = env.VAPID_PRIVATE_KEY
  const cronSecret = env.CRON_SECRET
  if (!url || !key || !privateKey || !cronSecret) return undefined
  return {
    store: supabaseStore(url, key),
    send: webPushSender(privateKey),
    now: () => new Date(),
    cronSecret,
    userOf: supabaseUser(url, key),
    ipOf: (request) => ipKeys(request, privateKey),
  }
}

export function GET(request: Request): Promise<Response> {
  return handleReminder(request, depsFromEnv(process.env))
}

export function POST(request: Request): Promise<Response> {
  return handleReminder(request, depsFromEnv(process.env))
}
