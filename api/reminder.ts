// Vercel function: the daily practice reminder (Web Push).
//   POST /api/reminder: from the app (same-origin): subscribe | unsubscribe | progress | test
//   GET  /api/reminder: from cron-job.org every 15 minutes (Authorization: Bearer CRON_SECRET)
// Design: docs/superpowers/specs/2026-09-27-push-reminders-design.md.
// Kept free of local imports so Vercel can deploy it as a single file.

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
