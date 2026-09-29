// Vercel function: the daily practice reminder (Web Push).
//   POST /api/reminder: from the app (same-origin): subscribe | unsubscribe | progress | test
//   GET  /api/reminder: from cron-job.org every 15 minutes (Authorization: Bearer CRON_SECRET)
// Design: docs/superpowers/specs/2026-09-27-push-reminders-design.md.
// Kept free of local imports so Vercel can deploy it as a single file.
import webpush from 'web-push'

// ---------- types (ReminderProgress mirrors src/lib/reminderProgress.ts) ----------

export interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface ReminderSub {
  subscription: PushSub
  time: string // "19:00", phone-local
  timeZone: string // IANA zone from the phone, e.g. "Europe/Bratislava"
}

/** What the phone last reported, computed in its local time. */
export interface ReminderProgress {
  day: string // "2026-09-27"
  done: number // answers + reviews that day
  goal: number
  dueToday: number // review cards due by the end of `day`
  dueTomorrow: number // … by the end of the next day
  streakDays: number
  activeToday: boolean
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

// ---------- validation (requests and stored data) ----------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isPositive = (v: unknown): v is number => isCount(v) && v > 0

export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

export function isTimeZone(v: unknown): v is string {
  if (typeof v !== 'string' || !v) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: v })
    return true
  } catch {
    return false
  }
}

export function isPushSub(v: unknown): v is PushSub {
  if (!isRecord(v) || typeof v.endpoint !== 'string' || !v.endpoint.startsWith('https://') || !isRecord(v.keys)) return false
  return typeof v.keys.p256dh === 'string' && typeof v.keys.auth === 'string'
}

export const isReminderSub = (v: unknown): v is ReminderSub =>
  isRecord(v) && isPushSub(v.subscription) && isTime(v.time) && isTimeZone(v.timeZone)

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

/** Slovak plural form: 1 deň, 2–4 dni, 5+ dní (same as src/lib/text.ts). */
function pluralSk(count: number, [one, few, many]: [string, string, string]): string {
  if (count === 1) return one
  if (count >= 2 && count <= 4) return few
  return many
}

const days = (n: number) => `${n} ${pluralSk(n, ['deň', 'dni', 'dní'])}`

export function composeMessage({ done, goal, due, streak }: TodayView): Message {
  if (done > 0) {
    const streakPart = streak > 0 ? ` · séria ${days(streak)} 🔥` : ''
    return { title: `Ešte ${goal - done} do denného cieľa`, body: `Dnes ${done}/${goal}${streakPart}` }
  }
  const waiting = due
    ? `Na zopakovanie: ${due} ${pluralSk(due, ['kartička', 'kartičky', 'kartičiek'])}`
    : `Denný cieľ: ${goal} ${pluralSk(goal, ['odpoveď', 'odpovede', 'odpovedí'])}`
  if (streak > 0) return { title: `🔥 Séria ${days(streak)} čaká na dnešok`, body: `${waiting} · stačí pár minút` }
  return { title: '¿Practicamos? 🇲🇽', body: waiting }
}

export const TEST_MESSAGE: Message = { title: 'SOMOS', body: 'Skúšobná notifikácia — pripomienky fungujú ✓' }

/** Whether the tick at `now` should send today's reminder. */
export function decide(now: Date, sub: ReminderSub, progress: ReminderProgress | null, sentDay: string | null): Decision {
  const { day, minutes } = localClock(now, sub.timeZone)
  const start = toMinutes(sub.time)
  if (minutes < start) return { send: false, reason: 'too-early' }
  if (minutes > Math.min(start + WINDOW_MINUTES, LAST_MINUTE)) return { send: false, reason: 'too-late' }
  if (sentDay === day) return { send: false, reason: 'already-sent' }
  const view = todayView(progress, day)
  if (view.done >= view.goal) return { send: false, reason: 'goal-met' }
  return { send: true, day, message: composeMessage(view) }
}

// ---------- storage: Upstash Redis over REST ----------

export const KEYS = {
  sub: 'somos:reminder:sub',
  progress: 'somos:reminder:progress',
  sent: 'somos:reminder:sent', // day key of the last reminder sent
  test: 'somos:reminder:test', // exists for 60 s after a test notification
  gone: 'somos:reminder:gone', // endpoint the push service dropped: the app must replace it, not re-register it
} as const

export interface Store {
  mget(keys: string[]): Promise<(string | null)[]>
  set(key: string, value: string): Promise<void>
  del(key: string): Promise<void>
  /** SET … EX ttl NX: true when the key did not exist yet. */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>
}

export function upstashStore(url: string, token: string, fetchImpl: typeof fetch = fetch): Store {
  const run = async (command: (string | number)[]): Promise<unknown> => {
    const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(command) })
    const data = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string }
    if (!res.ok || data.error) throw new Error(`Upstash ${command[0]} failed: ${data.error ?? res.status}`)
    return data.result
  }
  return {
    mget: async (keys) => (await run(['MGET', ...keys])) as (string | null)[],
    set: async (key, value) => {
      await run(['SET', key, value])
    },
    del: async (key) => {
      await run(['DEL', key])
    },
    setIfAbsent: async (key, value, ttlSeconds) => (await run(['SET', key, value, 'EX', ttlSeconds, 'NX'])) === 'OK',
  }
}

/** Stored JSON that no longer parses or validates counts as missing. */
function parseStored<T>(raw: string | null | undefined, isValid: (v: unknown) => v is T): T | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    return isValid(value) ? value : null
  } catch {
    return null
  }
}

// ---------- sending ----------

// Public half of the VAPID key pair (the private half is VAPID_PRIVATE_KEY). Same value in src/lib/reminder.ts.
export const VAPID_PUBLIC_KEY = 'BPTIxlaW9JLc2601tsFgNg6FVwR8CUB4GHBVze_ERU7m0EEuYrWb4Y8XwBVAIMRjYgB_aBVi48EnbCx4-isXD_Q'
const VAPID_SUBJECT = 'https://somos-jade.vercel.app'
const REMINDER_TTL = 4 * 60 * 60 // seconds; a reminder that arrives hours late is pointless

export interface SendOptions {
  ttl: number
  topic: string
}

/** Delivers one push message; rejects with `{ statusCode }` when the push service refuses it. */
export type Sender = (subscription: PushSub, payload: string, options: SendOptions) => Promise<void>

export function webPushSender(privateKey: string): Sender {
  return async (subscription, payload, { ttl, topic }) => {
    await webpush.sendNotification(subscription, payload, {
      vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey },
      TTL: ttl,
      topic,
      urgency: 'normal',
    })
  }
}

export interface Deps {
  store: Store
  send: Sender
  now: () => Date
  cronSecret: string
}

type Delivery = 'sent' | 'gone' | 'failed'

const statusOf = (error: unknown) => (isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : undefined)

/** Sends a message; forgets a subscription the push service no longer knows. */
async function deliver(deps: Deps, sub: ReminderSub, message: Message, topic: string): Promise<Delivery> {
  try {
    await deps.send(sub.subscription, JSON.stringify({ ...message, url: '/' }), { ttl: REMINDER_TTL, topic })
    return 'sent'
  } catch (error) {
    const status = statusOf(error)
    if (status === 404 || status === 410) {
      await deps.store.del(KEYS.sub)
      await deps.store.set(KEYS.gone, sub.subscription.endpoint)
      return 'gone'
    }
    console.error('push failed', status ?? error)
    return 'failed'
  }
}

// ---------- HTTP ----------

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Browsers send Origin on POST: only pages of this same deployment may change the reminder. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

async function tick(deps: Deps): Promise<Response> {
  const [rawSub, rawProgress, sentDay] = await deps.store.mget([KEYS.sub, KEYS.progress, KEYS.sent])
  const sub = parseStored(rawSub, isReminderSub)
  if (!sub) return json({ sent: false, reason: 'no-subscription' })
  const decision = decide(deps.now(), sub, parseStored(rawProgress, isProgress), sentDay ?? null)
  if (!decision.send) return json({ sent: false, reason: decision.reason })
  const result = await deliver(deps, sub, decision.message, 'reminder')
  if (result === 'sent') await deps.store.set(KEYS.sent, decision.day)
  return json({ sent: result === 'sent', reason: result }, result === 'failed' ? 502 : 200)
}

async function handlePost(request: Request, deps: Deps): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  const body: unknown = await request.json().catch(() => undefined)
  if (!isRecord(body)) return json({ error: 'bad-request' }, 400)

  const [rawSub, goneEndpoint] = await deps.store.mget([KEYS.sub, KEYS.gone])
  const stored = parseStored(rawSub, isReminderSub)
  // Only the device that gets the reminders may change or feed them.
  const fromStoredDevice = typeof body.endpoint === 'string' && stored?.subscription.endpoint === body.endpoint

  switch (body.type) {
    case 'subscribe': {
      const sub = { subscription: body.subscription, time: body.time, timeZone: body.timeZone }
      if (!isReminderSub(sub)) return json({ error: 'bad-request' }, 400)
      // Chrome may still hold a subscription the push service dropped; 410 tells the app to make a new one.
      if (sub.subscription.endpoint === goneEndpoint) return json({ error: 'gone' }, 410)
      const { endpoint, keys } = sub.subscription
      const clean: ReminderSub = { subscription: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, time: sub.time, timeZone: sub.timeZone }
      await deps.store.set(KEYS.sub, JSON.stringify(clean))
      return json({ ok: true })
    }
    case 'unsubscribe':
      if (fromStoredDevice) await deps.store.del(KEYS.sub)
      return json({ ok: true })
    case 'progress':
      if (!isProgress(body.progress)) return json({ error: 'bad-request' }, 400)
      if (fromStoredDevice) await deps.store.set(KEYS.progress, JSON.stringify(body.progress))
      return json({ ok: true })
    case 'test': {
      if (!stored || !fromStoredDevice) return json({ error: 'not-subscribed' }, 409)
      if (!(await deps.store.setIfAbsent(KEYS.test, '1', 60))) return json({ error: 'too-many' }, 429)
      const result = await deliver(deps, stored, TEST_MESSAGE, 'test')
      if (result === 'sent') return json({ ok: true })
      return json({ error: result }, result === 'gone' ? 410 : 502)
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

/** Upstash adds KV_REST_API_* when connected from the Vercel dashboard; UPSTASH_REDIS_REST_* is its own naming. */
export function depsFromEnv(env: Record<string, string | undefined>): Deps | undefined {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  const privateKey = env.VAPID_PRIVATE_KEY
  const cronSecret = env.CRON_SECRET
  if (!url || !token || !privateKey || !cronSecret) return undefined
  return { store: upstashStore(url, token), send: webPushSender(privateKey), now: () => new Date(), cronSecret }
}

export function GET(request: Request): Promise<Response> {
  return handleReminder(request, depsFromEnv(process.env))
}

export function POST(request: Request): Promise<Response> {
  return handleReminder(request, depsFromEnv(process.env))
}
