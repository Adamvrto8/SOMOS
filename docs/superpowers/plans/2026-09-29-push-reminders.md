# Practice Reminders (Push Notifications) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Web Push reminder a day, at a time Adam picks in Nastavenia, sent only when today's daily goal is not met yet.

**Architecture:** cron-job.org calls the Vercel function `api/reminder.ts` every 15 minutes. The function reads state from Upstash Redis (subscription + time + time zone, the phone's last progress report, the day of the last reminder), decides with a pure `decide()` and sends through `web-push`. The app subscribes via `pushManager`, reports progress after answers and when hidden, and a small `public/push-sw.js` imported into the generated service worker shows the notification.

**Tech Stack:** Vite 8 + React 19 + TypeScript 6, vite-plugin-pwa (generateSW), Dexie 4, vitest 5, Vercel functions (Web `Request`/`Response`, Node 24), `web-push` 3.6, Upstash Redis REST, cron-job.org.

**Spec:** `docs/superpowers/specs/2026-09-27-push-reminders-design.md`

## Global Constraints

- All user-facing strings in Slovak; code, comments and commit messages in English.
- No `any`; keep components small and typed.
- `api/*.ts` functions stay self-contained (no local imports); their tests are named `api/_*.test.ts` so Vercel does not deploy them.
- Only free services; the only new dependency is `web-push` (+ `@types/web-push` as a dev dependency). No new client dependencies.
- Reminder window: `[time, min(time + 2 h, 23:59)]` in the phone's time zone; at most one reminder per local day; never when `done >= goal`.
- Push options: `TTL` 4 h (14 400 s), `topic` `'reminder'` (test: `'test'`), payload `{ title, body, url: '/' }`.
- Redis keys: `somos:reminder:sub`, `somos:reminder:progress`, `somos:reminder:sent`, `somos:reminder:test`.
- VAPID subject `https://somos-jade.vercel.app`; the VAPID private key and `CRON_SECRET` are never committed. They live in the session scratchpad `C:/Users/adamv/AppData/Local/Temp/claude/c--CODE-SOMOS/0704de08-a509-40fb-9cea-200cf49d5586/scratchpad` (Git Bash: `/c/Users/adamv/AppData/Local/Temp/claude/c--CODE-SOMOS/0704de08-a509-40fb-9cea-200cf49d5586/scratchpad`, below `$SCRATCH`) until handed to Adam.
- Tap targets ≥ 44 px, mobile first (375 px).
- Git: stage explicit paths only. Adam's uncommitted `.gitignore` edit must stay unstaged. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never stop Adam's dev server on port 5173.
- `npm test` after `src/lib`/`api` changes, `npm run build` and `npm run lint` before the final commit.

## Review Focus

1. **Tapping a reminder while a lesson is open**: SOMOS must just come to the front with the lesson intact (no navigation/reload). Pinned in Task 4 (focus-only click handler + manual check in Task 7).
2. **Phone time zone vs. server UTC, including the DST switch**: the reminder follows local time and the day turns at local midnight. Pinned in Task 1 (`localClock` tests for summer, winter and midnight).
3. **First reminder after days without opening the app, or right after enabling**: the text must not show a stale card count or a dead streak. Pinned in Task 1 (`todayView` tests for yesterday / older / missing reports).
4. **Unreadable or older-format data in Redis**: the tick treats it as missing and still sends a sensible reminder instead of failing every 15 minutes. Pinned in Task 2 ("treats unreadable stored data as missing").
5. **Notifications blocked in Android settings after enabling**: at the next start the setting switches itself off, and the switch can always be turned off. Pinned in Task 5 (`syncReminder`) and Task 6 (switch `disabled` rule), checked on the phone in Task 7.

---

### Task 1: Reminder decision logic (server, pure)

**Files:**
- Create: `api/reminder.ts`
- Test: `api/_reminder.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `api/reminder.ts`):
  - types `PushSub`, `ReminderSub`, `ReminderProgress`, `Message`, `TodayView`, `SkipReason`, `Decision`
  - `isTime(v: unknown): v is string`, `isTimeZone(v: unknown): v is string`, `isPushSub(v: unknown): v is PushSub`, `isReminderSub(v: unknown): v is ReminderSub`, `isProgress(v: unknown): v is ReminderProgress`
  - `localClock(now: Date, timeZone: string): { day: string; minutes: number }`
  - `previousDay(day: string): string`
  - `todayView(progress: ReminderProgress | null, day: string): TodayView`
  - `composeMessage(view: TodayView): Message`, `TEST_MESSAGE: Message`
  - `decide(now: Date, sub: ReminderSub, progress: ReminderProgress | null, sentDay: string | null): Decision`

- [ ] **Step 1: Write the failing tests**

Create `api/_reminder.test.ts`:

```ts
// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it } from 'vitest'
import {
  composeMessage,
  decide,
  isProgress,
  isReminderSub,
  localClock,
  previousDay,
  todayView,
  type ReminderProgress,
  type ReminderSub,
} from './reminder.ts'

const TZ = 'Europe/Bratislava'
const SUB: ReminderSub = {
  subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } },
  time: '19:00',
  timeZone: TZ,
}
const progress = (over: Partial<ReminderProgress> = {}): ReminderProgress => ({
  day: '2026-07-01',
  done: 0,
  goal: 20,
  dueToday: 14,
  dueTomorrow: 17,
  streakDays: 12,
  activeToday: false,
  ...over,
})
// 2026-07-01 is summer time (UTC+2): 17:10 UTC = 19:10 in Bratislava.
const SUMMER_1910 = new Date('2026-07-01T17:10:00Z')

describe('localClock', () => {
  it('uses the phone time zone, in summer and in winter time', () => {
    expect(localClock(SUMMER_1910, TZ)).toEqual({ day: '2026-07-01', minutes: 19 * 60 + 10 })
    // Summer time ends on 2026-10-25: 17:10 UTC is 18:10 CET that evening.
    expect(localClock(new Date('2026-10-25T17:10:00Z'), TZ)).toEqual({ day: '2026-10-25', minutes: 18 * 60 + 10 })
  })

  it('turns the day at local midnight, not UTC', () => {
    expect(localClock(new Date('2026-07-01T22:30:00Z'), TZ)).toEqual({ day: '2026-07-02', minutes: 30 })
  })
})

describe('previousDay', () => {
  it('handles month and year boundaries', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2027-01-01')).toBe('2026-12-31')
  })
})

describe('todayView', () => {
  it('uses a report from today as is', () => {
    expect(todayView(progress({ done: 5, activeToday: true, streakDays: 13 }), '2026-07-01')).toEqual({ done: 5, goal: 20, due: 14, streak: 13 })
  })

  it('rolls a report from yesterday over to today', () => {
    expect(todayView(progress({ day: '2026-06-30', done: 25, activeToday: true }), '2026-07-01')).toEqual({ done: 0, goal: 20, due: 17, streak: 12 })
    // No practice yesterday: the streak is already broken today.
    expect(todayView(progress({ day: '2026-06-30', activeToday: false }), '2026-07-01').streak).toBe(0)
  })

  it('knows nothing from an older or missing report', () => {
    expect(todayView(progress({ day: '2026-06-20', goal: 30 }), '2026-07-01')).toEqual({ done: 0, goal: 30, due: null, streak: 0 })
    expect(todayView(null, '2026-07-01')).toEqual({ done: 0, goal: 20, due: null, streak: 0 })
  })
})

describe('composeMessage', () => {
  it('nudges a running streak with the cards waiting', () => {
    expect(composeMessage({ done: 0, goal: 20, due: 14, streak: 12 })).toEqual({
      title: '🔥 Séria 12 dní čaká na dnešok',
      body: 'Na zopakovanie: 14 kartičiek · stačí pár minút',
    })
  })

  it('uses Slovak plural forms', () => {
    expect(composeMessage({ done: 0, goal: 20, due: 1, streak: 1 })).toEqual({
      title: '🔥 Séria 1 deň čaká na dnešok',
      body: 'Na zopakovanie: 1 kartička · stačí pár minút',
    })
    expect(composeMessage({ done: 0, goal: 20, due: 3, streak: 3 }).title).toBe('🔥 Séria 3 dni čaká na dnešok')
    expect(composeMessage({ done: 0, goal: 20, due: 3, streak: 0 }).body).toBe('Na zopakovanie: 3 kartičky')
  })

  it('falls back to the daily goal without cards to review', () => {
    expect(composeMessage({ done: 0, goal: 20, due: 0, streak: 0 })).toEqual({ title: '¿Practicamos? 🇲🇽', body: 'Denný cieľ: 20 odpovedí' })
    expect(composeMessage({ done: 0, goal: 10, due: null, streak: 2 }).body).toBe('Denný cieľ: 10 odpovedí · stačí pár minút')
  })

  it('counts down to the goal once practice has started', () => {
    expect(composeMessage({ done: 12, goal: 20, due: 3, streak: 12 })).toEqual({ title: 'Ešte 8 do denného cieľa', body: 'Dnes 12/20 · séria 12 dní 🔥' })
    expect(composeMessage({ done: 12, goal: 20, due: 3, streak: 0 }).body).toBe('Dnes 12/20')
  })
})

describe('decide', () => {
  // Bratislava summer time.
  const at = (hhmm: string, day = '2026-07-01') => new Date(`${day}T${hhmm}:00+02:00`)

  it('sends inside the window when the goal is not met', () => {
    expect(decide(SUMMER_1910, SUB, progress({ day: '2026-06-30', activeToday: true }), null)).toEqual({
      send: true,
      day: '2026-07-01',
      message: { title: '🔥 Séria 12 dní čaká na dnešok', body: 'Na zopakovanie: 17 kartičiek · stačí pár minút' },
    })
  })

  it('waits for the chosen time and gives up two hours later', () => {
    expect(decide(at('18:59'), SUB, null, null)).toEqual({ send: false, reason: 'too-early' })
    expect(decide(at('19:00'), SUB, null, null).send).toBe(true)
    expect(decide(at('21:00'), SUB, null, null).send).toBe(true)
    expect(decide(at('21:01'), SUB, null, null)).toEqual({ send: false, reason: 'too-late' })
  })

  it('never runs the window past midnight', () => {
    const late = { ...SUB, time: '23:00' }
    expect(decide(at('23:59'), late, null, null).send).toBe(true)
    expect(decide(at('00:10', '2026-07-02'), late, null, null)).toEqual({ send: false, reason: 'too-early' })
  })

  it('sends once a day', () => {
    expect(decide(SUMMER_1910, SUB, null, '2026-07-01')).toEqual({ send: false, reason: 'already-sent' })
    expect(decide(SUMMER_1910, SUB, null, '2026-06-30').send).toBe(true)
  })

  it('stays quiet once the daily goal is met', () => {
    expect(decide(SUMMER_1910, SUB, progress({ done: 20, activeToday: true }), null)).toEqual({ send: false, reason: 'goal-met' })
  })
})

describe('validation', () => {
  it('accepts well-formed data only', () => {
    expect(isReminderSub(SUB)).toBe(true)
    expect(isReminderSub({ ...SUB, time: '7:00' })).toBe(false)
    expect(isReminderSub({ ...SUB, time: '24:00' })).toBe(false)
    expect(isReminderSub({ ...SUB, timeZone: 'Mars/Olympus' })).toBe(false)
    expect(isReminderSub({ ...SUB, subscription: { endpoint: 'http://push.example', keys: { p256dh: 'p', auth: 'a' } } })).toBe(false)
    expect(isProgress(progress())).toBe(true)
    expect(isProgress(progress({ done: -1 }))).toBe(false)
    expect(isProgress(progress({ goal: 0 }))).toBe(false)
    expect(isProgress({ ...progress(), day: 'yesterday' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_reminder.test.ts`
Expected: FAIL: `Failed to load url ./reminder.ts` / cannot find module.

- [ ] **Step 3: Write the implementation**

Create `api/reminder.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_reminder.test.ts`
Expected: PASS (all `localClock`, `previousDay`, `todayView`, `composeMessage`, `decide`, `validation` tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add api/reminder.ts api/_reminder.test.ts
git commit -m "feat(reminder): decide when to send the daily reminder and what it says

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Reminder endpoint (storage, sending, HTTP)

**Files:**
- Modify: `api/reminder.ts` (add import at the top, append sections at the end)
- Modify: `api/_reminder.test.ts` (replace the import block, append tests)
- Modify: `package.json`, `package-lock.json` (via npm)

**Interfaces:**
- Consumes (Task 1): `ReminderSub`, `PushSub`, `Message`, `isRecord`, `isReminderSub`, `isProgress`, `decide`, `TEST_MESSAGE`.
- Produces (exported from `api/reminder.ts`):
  - `KEYS = { sub, progress, sent, test }` (Redis key names)
  - `interface Store { mget(keys: string[]): Promise<(string | null)[]>; set(key: string, value: string): Promise<void>; del(key: string): Promise<void>; setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> }`
  - `upstashStore(url: string, token: string, fetchImpl?: typeof fetch): Store`
  - `VAPID_PUBLIC_KEY: string`
  - `interface SendOptions { ttl: number; topic: string }`, `type Sender = (subscription: PushSub, payload: string, options: SendOptions) => Promise<void>`
  - `webPushSender(privateKey: string): Sender`
  - `interface Deps { store: Store; send: Sender; now: () => Date; cronSecret: string }`
  - `handleReminder(request: Request, deps: Deps | undefined): Promise<Response>`
  - `depsFromEnv(env: Record<string, string | undefined>): Deps | undefined`
  - Vercel entry points `GET(request)`, `POST(request)`
- HTTP contract (the app relies on it in Task 5): `POST` JSON `{ type: 'subscribe', subscription, time, timeZone }` | `{ type: 'unsubscribe', endpoint }` | `{ type: 'progress', endpoint, progress }` | `{ type: 'test', endpoint }` → `200 { ok: true }`; errors `{ error }` with 400 `bad-request`, 403 `forbidden`, 409 `not-subscribed`, 410 `gone`, 429 `too-many`, 502 `failed`, 503 `not-configured`, 500 `failed`.

- [ ] **Step 1: Install web-push**

Run: `npm install web-push@^3.6.7 && npm install -D @types/web-push@^3.6.4`
Expected: both added to `package.json` (`dependencies` / `devDependencies`), no errors.

- [ ] **Step 2: Generate the VAPID key pair (outside the repo)**

```bash
SCRATCH=/c/Users/adamv/AppData/Local/Temp/claude/c--CODE-SOMOS/0704de08-a509-40fb-9cea-200cf49d5586/scratchpad
npx web-push generate-vapid-keys --json > "$SCRATCH/vapid.json"
node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).publicKey)" "$SCRATCH/vapid.json"
```

Expected: an 87-character base64url string starting with `B`. This is the **public key** used in Step 5 and in Task 5. Do not print or commit the private key.

- [ ] **Step 3: Write the failing tests**

In `api/_reminder.test.ts`, replace the two import statements at the top with:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  composeMessage,
  decide,
  handleReminder,
  isProgress,
  isReminderSub,
  KEYS,
  localClock,
  previousDay,
  todayView,
  upstashStore,
  type Deps,
  type ReminderProgress,
  type ReminderSub,
  type Sender,
  type Store,
} from './reminder.ts'
```

Append at the end of the file:

```ts
// ---------- HTTP ----------

const SECRET = 'cron-secret'
const OTHER_DEVICE = 'https://push.example/other-device'

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, string>(Object.entries(initial).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))
  const store: Store & { data: Map<string, string> } = {
    data,
    mget: async (keys) => keys.map((k) => data.get(k) ?? null),
    set: async (k, v) => {
      data.set(k, v)
    },
    del: async (k) => {
      data.delete(k)
    },
    setIfAbsent: async (k, v) => {
      if (data.has(k)) return false
      data.set(k, v)
      return true
    },
  }
  return store
}

const noop: Sender = async () => {}
const deps = (store: Store, send: Sender = noop, now = SUMMER_1910): Deps => ({ store, send, now: () => now, cronSecret: SECRET })

const cron = (secret = SECRET) => new Request('https://somos.example/api/reminder', { headers: { authorization: `Bearer ${secret}` } })
const post = (body: unknown, origin = 'https://somos.example') =>
  new Request('https://somos.example/api/reminder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin, host: 'somos.example' },
    body: JSON.stringify(body),
  })
const pushError = (statusCode: number) => Object.assign(new Error('push refused'), { statusCode })

describe('api/reminder: cron tick', () => {
  it('refuses a request without the cron secret', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    expect((await handleReminder(cron('wrong'), deps(store))).status).toBe(401)
    expect((await handleReminder(new Request('https://somos.example/api/reminder'), deps(store))).status).toBe(401)
  })

  it('reports a missing configuration', async () => {
    const res = await handleReminder(cron(), undefined)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not-configured' })
  })

  it('sends the reminder and remembers the day', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB, [KEYS.progress]: progress({ day: '2026-06-30', activeToday: true }) })
    const send = vi.fn<Sender>(async () => {})
    const res = await handleReminder(cron(), deps(store, send))
    expect(await res.json()).toEqual({ sent: true, reason: 'sent' })
    expect(send).toHaveBeenCalledWith(
      SUB.subscription,
      JSON.stringify({ title: '🔥 Séria 12 dní čaká na dnešok', body: 'Na zopakovanie: 17 kartičiek · stačí pár minút', url: '/' }),
      { ttl: 14_400, topic: 'reminder' },
    )
    expect(store.data.get(KEYS.sent)).toBe('2026-07-01')
  })

  it('explains why it stayed quiet', async () => {
    const send = vi.fn<Sender>(async () => {})
    const store = memoryStore({ [KEYS.sub]: SUB, [KEYS.progress]: progress({ done: 20, activeToday: true }) })
    expect(await (await handleReminder(cron(), deps(store, send))).json()).toEqual({ sent: false, reason: 'goal-met' })
    expect(await (await handleReminder(cron(), deps(memoryStore(), send))).json()).toEqual({ sent: false, reason: 'no-subscription' })
    expect(send).not.toHaveBeenCalled()
  })

  it('treats unreadable stored data as missing', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB, [KEYS.progress]: '{not json', [KEYS.sent]: null })
    const send = vi.fn<Sender>(async () => {})
    expect(await (await handleReminder(cron(), deps(store, send))).json()).toEqual({ sent: true, reason: 'sent' })
    expect(send.mock.calls[0][1]).toContain('Denný cieľ: 20 odpovedí')
  })

  it('forgets a subscription the push service no longer knows', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    const res = await handleReminder(cron(), deps(store, async () => Promise.reject(pushError(410))))
    expect(await res.json()).toEqual({ sent: false, reason: 'gone' })
    expect(store.data.has(KEYS.sub)).toBe(false)
    expect(store.data.has(KEYS.sent)).toBe(false)
  })

  it('leaves the day open for the next tick after a failed send', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = memoryStore({ [KEYS.sub]: SUB })
    const res = await handleReminder(cron(), deps(store, async () => Promise.reject(pushError(500))))
    expect(res.status).toBe(502)
    expect(store.data.has(KEYS.sent)).toBe(false)
    expect(store.data.has(KEYS.sub)).toBe(true)
  })
})

describe('api/reminder: requests from the app', () => {
  it('only accepts requests from its own pages', async () => {
    const store = memoryStore()
    const res = await handleReminder(post({ type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: TZ }, 'https://evil.example'), deps(store))
    expect(res.status).toBe(403)
    expect(store.data.size).toBe(0)
  })

  it('stores a subscription with its time and time zone', async () => {
    const store = memoryStore()
    const body = { type: 'subscribe', subscription: { ...SUB.subscription, expirationTime: null }, time: '19:00', timeZone: TZ }
    expect((await handleReminder(post(body), deps(store))).status).toBe(200)
    expect(JSON.parse(store.data.get(KEYS.sub)!)).toEqual(SUB)
  })

  it('rejects malformed requests', async () => {
    const store = memoryStore()
    const bodies = [
      { type: 'subscribe', subscription: SUB.subscription, time: '25:00', timeZone: TZ },
      { type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: 'Nowhere/City' },
      { type: 'subscribe', subscription: { endpoint: 'https://push.example/x' }, time: '19:00', timeZone: TZ },
      { type: 'launch-rockets' },
      'not an object',
    ]
    for (const body of bodies) expect((await handleReminder(post(body), deps(store))).status).toBe(400)
    expect(store.data.size).toBe(0)
  })

  it('keeps progress only from the subscribed device', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    await handleReminder(post({ type: 'progress', endpoint: OTHER_DEVICE, progress: progress({ done: 3 }) }), deps(store))
    expect(store.data.has(KEYS.progress)).toBe(false)
    await handleReminder(post({ type: 'progress', endpoint: SUB.subscription.endpoint, progress: progress({ done: 3 }) }), deps(store))
    expect(JSON.parse(store.data.get(KEYS.progress)!)).toEqual(progress({ done: 3 }))
    const invalid = post({ type: 'progress', endpoint: SUB.subscription.endpoint, progress: { day: 'x' } })
    expect((await handleReminder(invalid, deps(store))).status).toBe(400)
  })

  it('unsubscribes only the device that asks', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    await handleReminder(post({ type: 'unsubscribe', endpoint: OTHER_DEVICE }), deps(store))
    expect(store.data.has(KEYS.sub)).toBe(true)
    await handleReminder(post({ type: 'unsubscribe', endpoint: SUB.subscription.endpoint }), deps(store))
    expect(store.data.has(KEYS.sub)).toBe(false)
  })

  it('sends a test notification at most once a minute', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    const send = vi.fn<Sender>(async () => {})
    const test = () => handleReminder(post({ type: 'test', endpoint: SUB.subscription.endpoint }), deps(store, send))
    expect((await test()).status).toBe(200)
    expect(send).toHaveBeenCalledWith(
      SUB.subscription,
      JSON.stringify({ title: 'SOMOS', body: 'Skúšobná notifikácia — pripomienky fungujú ✓', url: '/' }),
      { ttl: 14_400, topic: 'test' },
    )
    expect((await test()).status).toBe(429)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('refuses a test for a device that is not subscribed', async () => {
    const res = await handleReminder(post({ type: 'test', endpoint: OTHER_DEVICE }), deps(memoryStore({ [KEYS.sub]: SUB })))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'not-subscribed' })
  })
})

describe('upstashStore', () => {
  it('sends Redis commands to the REST endpoint', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ result: 'OK' }))
    const store = upstashStore('https://redis.example', 'token', fetchImpl)
    expect(await store.setIfAbsent(KEYS.test, '1', 60)).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://redis.example')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token')
    expect(JSON.parse(init.body as string)).toEqual(['SET', KEYS.test, '1', 'EX', 60, 'NX'])
  })

  it('throws on an Upstash error', async () => {
    const store = upstashStore('https://redis.example', 'token', vi.fn(async () => Response.json({ error: 'WRONGPASS' }, { status: 401 })))
    await expect(store.mget([KEYS.sub])).rejects.toThrow('WRONGPASS')
  })
})
```

Note on `memoryStore({ …, [KEYS.sent]: null })`: `JSON.stringify(null)` stores the string `"null"`, which is not a day key, so the tick treats it as "not sent". This mirrors what a broken value in Redis would do.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run api/_reminder.test.ts`
Expected: FAIL. The new tests error with `handleReminder is not a function` / `KEYS is undefined`; the Task 1 tests still pass.

- [ ] **Step 5: Write the implementation**

In `api/reminder.ts`, directly below the header comment block (before the `// ---------- types` line), add:

```ts
import webpush from 'web-push'
```

Append to the end of `api/reminder.ts` (replace `PUBLIC_KEY_FROM_STEP_2` with the public key printed in Step 2):

```ts
// ---------- storage: Upstash Redis over REST ----------

export const KEYS = {
  sub: 'somos:reminder:sub',
  progress: 'somos:reminder:progress',
  sent: 'somos:reminder:sent', // day key of the last reminder sent
  test: 'somos:reminder:test', // exists for 60 s after a test notification
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
export const VAPID_PUBLIC_KEY = 'PUBLIC_KEY_FROM_STEP_2'
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

  const [rawSub] = await deps.store.mget([KEYS.sub])
  const stored = parseStored(rawSub, isReminderSub)
  // Only the device that gets the reminders may change or feed them.
  const fromStoredDevice = typeof body.endpoint === 'string' && stored?.subscription.endpoint === body.endpoint

  switch (body.type) {
    case 'subscribe': {
      const sub = { subscription: body.subscription, time: body.time, timeZone: body.timeZone }
      if (!isReminderSub(sub)) return json({ error: 'bad-request' }, 400)
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run api/_reminder.test.ts`
Expected: PASS (Task 1 tests plus the new "cron tick", "requests from the app" and "upstashStore" groups).

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no type errors. `import webpush from 'web-push'` compiles because `module: nodenext` implies `esModuleInterop`. oxlint reports 0 errors.

- [ ] **Step 8: Commit**

```bash
git add api/reminder.ts api/_reminder.test.ts package.json package-lock.json
git commit -m "feat(reminder): endpoint for subscriptions, progress and the cron tick

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Progress report computed on the phone

**Files:**
- Modify: `src/lib/dailyGoal.ts` (add a getter)
- Create: `src/lib/reminderProgress.ts`
- Test: `src/lib/reminderProgress.test.ts`

**Interfaces:**
- Consumes: `computeStreak(activeDays: Set<string>, now: Date): Streak` (`src/lib/stats.ts`), `dayKey`, `endOfDay`, `addDays` (`src/lib/dates.ts`), `cardOf(rc: ReviewCard): Card` (`src/lib/srs.ts`), `db.attempts`, `db.reviewCards` (`src/lib/db.ts`).
- Produces:
  - `getDailyGoal(): number` in `src/lib/dailyGoal.ts`
  - `interface ReminderProgress` (same shape as in `api/reminder.ts`)
  - `buildProgress(attemptTimestamps: number[], dueDates: Date[], goal: number, now: Date): ReminderProgress`
  - `loadProgress(now?: Date): Promise<ReminderProgress>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reminderProgress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildProgress } from './reminderProgress'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('buildProgress', () => {
  const now = at(2026, 9, 29, 18)

  it('counts today’s answers and the running streak', () => {
    const attempts = [at(2026, 9, 27, 9), at(2026, 9, 28, 9), at(2026, 9, 29, 8), at(2026, 9, 29, 9)].map((d) => d.getTime())
    expect(buildProgress(attempts, [], 20, now)).toEqual({
      day: '2026-09-29',
      done: 2,
      goal: 20,
      dueToday: 0,
      dueTomorrow: 0,
      streakDays: 3,
      activeToday: true,
    })
  })

  it('keeps yesterday’s streak alive before today’s first answer', () => {
    expect(buildProgress([at(2026, 9, 28, 9).getTime()], [], 30, now)).toMatchObject({ done: 0, goal: 30, streakDays: 1, activeToday: false })
  })

  it('counts cards due by the end of today and by the end of tomorrow', () => {
    const due = [at(2026, 9, 20), at(2026, 9, 29, 23), at(2026, 9, 30, 8), at(2026, 10, 1, 8)]
    expect(buildProgress([], due, 20, now)).toMatchObject({ dueToday: 2, dueTomorrow: 3 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/reminderProgress.test.ts`
Expected: FAIL: cannot resolve `./reminderProgress`.

- [ ] **Step 3: Add the goal getter**

In `src/lib/dailyGoal.ts`, directly below `let goal = readGoal()` and the `listeners` line, add:

```ts
/** Current goal outside React (the reminder's progress report). */
export const getDailyGoal = () => goal
```

- [ ] **Step 4: Write the implementation**

Create `src/lib/reminderProgress.ts`:

```ts
import { getDailyGoal } from './dailyGoal'
import { addDays, dayKey, endOfDay } from './dates'
import { db } from './db'
import { cardOf } from './srs'
import { computeStreak } from './stats'

// What the phone tells api/reminder.ts about today, so the reminder only goes out while the daily
// goal is not met and can say what is waiting. Keep in sync with ReminderProgress in api/reminder.ts.
export interface ReminderProgress {
  day: string // local day key, "2026-09-29"
  done: number // answers + reviews today (what the daily goal counts)
  goal: number
  dueToday: number // review cards due by the end of today
  dueTomorrow: number // … by the end of tomorrow (for a reminder before the app is opened again)
  streakDays: number
  activeToday: boolean
}

export function buildProgress(attemptTimestamps: number[], dueDates: Date[], goal: number, now: Date): ReminderProgress {
  const today = dayKey(now)
  const activeDays = new Set(attemptTimestamps.map((t) => dayKey(new Date(t))))
  const streak = computeStreak(activeDays, now)
  const endToday = endOfDay(now).getTime()
  const endTomorrow = endOfDay(addDays(now, 1)).getTime()
  return {
    day: today,
    done: attemptTimestamps.filter((t) => dayKey(new Date(t)) === today).length,
    goal,
    dueToday: dueDates.filter((d) => d.getTime() <= endToday).length,
    dueTomorrow: dueDates.filter((d) => d.getTime() <= endTomorrow).length,
    streakDays: streak.days,
    activeToday: streak.activeToday,
  }
}

export async function loadProgress(now = new Date()): Promise<ReminderProgress> {
  const [timestamps, cards] = await Promise.all([db.attempts.orderBy('at').keys() as Promise<number[]>, db.reviewCards.toArray()])
  return buildProgress(
    timestamps,
    cards.map((c) => cardOf(c).due),
    getDailyGoal(),
    now,
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/reminderProgress.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dailyGoal.ts src/lib/reminderProgress.ts src/lib/reminderProgress.test.ts
git commit -m "feat(reminder): compute today's progress report on the phone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Service worker push handler and status-bar badge

**Files:**
- Create: `public/push-sw.js`
- Modify: `scripts/generate-icons.ts` (badge icon)
- Create (generated): `public/badge-96x96.png`
- Modify: `vite.config.ts` (`workbox.importScripts`)
- Modify: `vercel.json` (no-cache header for `/push-sw.js`)

**Interfaces:**
- Consumes: push payload `{ title, body, url }` from Task 2.
- Produces: notifications with `tag: 'somos-reminder'`; tap opens or focuses the app.

- [ ] **Step 1: Write the push handler**

Create `public/push-sw.js`:

```js
// Imported into the generated service worker (vite.config.ts → workbox.importScripts).
// Shows the practice reminder sent by api/reminder.ts and brings SOMOS up when it is tapped.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Not JSON: fall back to the defaults below.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SOMOS', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      tag: 'somos-reminder',
      lang: 'sk',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Focus as it is: navigating an open window could throw away a lesson in progress.
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      return open ? open.focus() : self.clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 2: Add the badge icon to the icon script**

In `scripts/generate-icons.ts`, add this function directly after the `iconSvg` function:

```ts
// Android status-bar badge: only the alpha channel is shown, so a white "S" on transparency.
function badgeSvg(): string {
  const height = 400
  const scale = height / S_HEIGHT
  const x = (CANVAS - S_WIDTH * scale) / 2
  const y = (CANVAS - height) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <path transform="translate(${round(x)} ${round(y)}) scale(${round(scale)})" fill="#FFFFFF" d="${S_PATH}"/>
</svg>
`
}
```

and add at the end of the file:

```ts
await renderPng(badgeSvg(), 96, 'badge-96x96.png')
```

- [ ] **Step 3: Generate the badge**

Run: `npm run icons && git status --short public`
Expected: the log lists `public/badge-96x96.png` among the outputs, and `?? public/badge-96x96.png` shows as new. If any existing icon also shows as modified (` M public/...`), restore it so only the badge changes:
`git restore public/favicon.svg public/pwa-192x192.png public/pwa-512x512.png public/maskable-icon-512x512.png public/apple-touch-icon-180x180.png`

- [ ] **Step 4: Import the handler into the service worker**

In `vite.config.ts`, inside `workbox: { … }`, add directly after the `navigateFallbackDenylist` line:

```ts
        // Practice reminders (api/reminder.ts): shows the push notification, handles the tap.
        importScripts: ['push-sw.js'],
```

In `vercel.json`, add a second entry to `headers` so the phone always checks for a new handler:

```json
    {
      "source": "/push-sw.js",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    }
```

(The `headers` array then holds the existing `/sw.js` entry followed by this one.)

- [ ] **Step 5: Verify the build wires it in**

Run: `npm run build && grep -o 'importScripts("push-sw.js")' dist/sw.js && ls dist/push-sw.js dist/badge-96x96.png`
Expected: build succeeds; grep prints `importScripts("push-sw.js")`; both files exist in `dist/`.

- [ ] **Step 6: Commit**

```bash
git add public/push-sw.js public/badge-96x96.png scripts/generate-icons.ts vite.config.ts vercel.json
git commit -m "feat(reminder): show push notifications from the service worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Reminder client (subscription, settings, progress reporting)

**Files:**
- Create: `src/lib/reminder.ts`
- Test: `src/lib/reminder.test.ts`
- Modify: `src/main.tsx`
- Modify: `api/_reminder.test.ts` (key-match test)

**Interfaces:**
- Consumes: HTTP contract of `POST /api/reminder` (Task 2), `loadProgress()` (Task 3), `db.attempts` hook (Dexie).
- Produces (exported from `src/lib/reminder.ts`, used by Task 6):
  - `VAPID_PUBLIC_KEY: string`
  - `interface ReminderSettings { enabled: boolean; time: string }`, `parseSettings(raw: string | null): ReminderSettings`, `useReminderSettings(): ReminderSettings`
  - `type ReminderError = 'unavailable' | 'unsupported' | 'denied' | 'not-allowed' | 'offline' | 'not-configured' | 'too-many' | 'failed'`, `REMINDER_ERRORS: Record<ReminderError, string>`, `class ReminderFailure extends Error { code: ReminderError }`
  - `type ReminderSupport = 'ok' | 'unavailable' | 'unsupported' | 'denied'`, `reminderSupport(): ReminderSupport`
  - `base64UrlToBytes(value: string): Uint8Array<ArrayBuffer>`
  - `enableReminder(time: string): Promise<void>`, `setReminderTime(time: string): Promise<void>`, `disableReminder(): Promise<void>`, `sendTestReminder(): Promise<void>`
  - `syncReminder(): Promise<void>`, `reportProgress(): void`, `startProgressReporting(): void`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reminder.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { base64UrlToBytes, parseSettings, VAPID_PUBLIC_KEY } from './reminder'

describe('parseSettings', () => {
  it('reads stored settings', () => {
    expect(parseSettings('{"enabled":true,"time":"07:30"}')).toEqual({ enabled: true, time: '07:30' })
  })

  it('falls back to off at 19:00 for missing or broken values', () => {
    for (const raw of [null, '', '{', '{"enabled":"yes","time":"07:30"}', '{"enabled":true,"time":"7:30"}']) {
      expect(parseSettings(raw)).toEqual({ enabled: false, time: '19:00' })
    }
  })
})

describe('base64UrlToBytes', () => {
  it('decodes base64url without padding', () => {
    expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })

  it('turns the VAPID public key into an uncompressed P-256 point', () => {
    const bytes = base64UrlToBytes(VAPID_PUBLIC_KEY)
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(4)
  })
})
```

Append to `api/_reminder.test.ts` (and add `import { readFile } from 'node:fs/promises'` as the first import line of that file, and `VAPID_PUBLIC_KEY,` to its import list from `./reminder.ts`):

```ts
describe('VAPID public key', () => {
  it('is the same in the app and on the server', async () => {
    const app = await readFile(new URL('../src/lib/reminder.ts', import.meta.url), 'utf8')
    expect(app).toContain(`export const VAPID_PUBLIC_KEY = '${VAPID_PUBLIC_KEY}'`)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/reminder.test.ts api/_reminder.test.ts`
Expected: FAIL: `./reminder` cannot be resolved in the src test; the key test fails with ENOENT.

- [ ] **Step 3: Write the implementation**

Create `src/lib/reminder.ts` (replace `PUBLIC_KEY_FROM_TASK_2` with the exact `VAPID_PUBLIC_KEY` value from `api/reminder.ts`):

```ts
import { useSyncExternalStore } from 'react'
import { db } from './db'
import { loadProgress } from './reminderProgress'

// Daily practice reminder (Web Push). The server side is api/reminder.ts; the design is in
// docs/superpowers/specs/2026-09-27-push-reminders-design.md. Settings are per device, like the daily goal.

/** Public half of the VAPID key pair; the same value as in api/reminder.ts. */
export const VAPID_PUBLIC_KEY = 'PUBLIC_KEY_FROM_TASK_2'

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

export type ReminderError = 'unavailable' | 'unsupported' | 'denied' | 'not-allowed' | 'offline' | 'not-configured' | 'too-many' | 'failed'

export const REMINDER_ERRORS: Record<ReminderError, string> = {
  unavailable: 'Pripomienky fungujú len v nasadenej aplikácii, nie na lokálnom serveri.',
  unsupported: 'Tento prehliadač notifikácie nepodporuje.',
  denied: 'Notifikácie sú zablokované. Povoľ ich v Nastaveniach Androidu → Aplikácie → SOMOS → Upozornenia.',
  'not-allowed': 'Bez povolenia notifikácií pripomienky nefungujú.',
  offline: 'Potrebuješ internet.',
  'not-configured': 'Pripomienky ešte nie sú na serveri nastavené.',
  'too-many': 'Skúšobnú notifikáciu môžeš poslať raz za minútu.',
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
  throw new ReminderFailure('failed')
}

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

// ---------- actions (Nastavenia) ----------

/** Asks for permission, subscribes this device and turns the reminder on. */
export async function enableReminder(time: string): Promise<void> {
  assertReady()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new ReminderFailure(permission === 'denied' ? 'denied' : 'not-allowed')
  await register(await ensureSubscription(), time)
  saveSettings({ enabled: true, time })
  void reportProgressNow()
}

export async function setReminderTime(time: string): Promise<void> {
  if (!settings.enabled) return saveSettings({ ...settings, time })
  assertReady()
  await register(await ensureSubscription(), time)
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
  const subscription = await ensureSubscription()
  await register(subscription, settings.time)
  await post({ type: 'test', endpoint: subscription.endpoint })
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
    await register(await ensureSubscription(), settings.time)
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/reminder.test.ts api/_reminder.test.ts`
Expected: PASS, including "is the same in the app and on the server" and the 65-byte key check.

- [ ] **Step 5: Wire it into app start**

In `src/main.tsx`, add the import below the `syncReviewCards` import:

```ts
import { startProgressReporting, syncReminder } from './lib/reminder'
```

and below `registerServiceWorker()`:

```ts
// Daily reminder: report practice to the server and refresh this device's push subscription.
startProgressReporting()
void syncReminder()
```

- [ ] **Step 6: Type-check, lint and run all tests**

Run: `npx tsc -b && npm run lint && npm test`
Expected: no type errors, 0 lint errors, all test files pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reminder.ts src/lib/reminder.test.ts src/main.tsx api/_reminder.test.ts
git commit -m "feat(reminder): subscribe the phone and report daily progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Reminder card in Nastavenia

**Files:**
- Create: `src/features/archive/ReminderSettings.tsx`
- Modify: `src/features/archive/SettingsPage.tsx`

**Interfaces:**
- Consumes (Task 5): `useReminderSettings`, `reminderSupport`, `enableReminder`, `disableReminder`, `setReminderTime`, `sendTestReminder`, `reportProgress`, `REMINDER_ERRORS`, `ReminderFailure`. Components `Button` (`variant`, `icon`), `SectionTitle` (`id`).
- Produces: `<ReminderSettings />`.

- [ ] **Step 1: Write the component**

Create `src/features/archive/ReminderSettings.tsx`:

```tsx
import { BellRing } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import {
  disableReminder,
  enableReminder,
  REMINDER_ERRORS,
  ReminderFailure,
  reminderSupport,
  sendTestReminder,
  setReminderTime,
  useReminderSettings,
} from '../../lib/reminder'

type Status = { tone: 'ok' | 'error'; text: string } | null

export function ReminderSettings() {
  const settings = useReminderSettings()
  const support = reminderSupport()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  // Local draft, so typing a time on a keyboard is not reset mid-way.
  const [time, setTime] = useState(settings.time)

  async function run(action: () => Promise<void>, doneText?: string) {
    setBusy(true)
    setStatus(null)
    try {
      await action()
      if (doneText) setStatus({ tone: 'ok', text: doneText })
    } catch (error) {
      setStatus({ tone: 'error', text: REMINDER_ERRORS[error instanceof ReminderFailure ? error.code : 'failed'] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="reminder-heading">
      <SectionTitle id="reminder-heading">Pripomienka cvičenia</SectionTitle>

      <div className="divide-y divide-line rounded-card border border-line bg-surface">
        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block leading-snug">Pripomínať cvičenie</span>
            <span className="block text-sm text-ink-muted">Raz denne, ak ešte nemáš splnený denný cieľ.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.enabled}
            // Turning off always works; turning on needs a device that supports it.
            disabled={busy || (!settings.enabled && support !== 'ok')}
            onChange={(e) => {
              const on = e.target.checked
              void run(() => (on ? enableReminder(time) : disableReminder()))
            }}
            className="size-6 shrink-0 accent-brick"
          />
        </label>

        {settings.enabled && (
          <label className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
            <span>Čas</span>
            <input
              type="time"
              value={time}
              onChange={(e) => {
                const next = e.target.value
                setTime(next)
                if (next) void run(() => setReminderTime(next))
              }}
              className="h-11 rounded-xl border border-line bg-surface-2 px-3 tabular-nums"
            />
          </label>
        )}
      </div>

      {support !== 'ok' && <p className="mt-2 text-sm text-ink-muted">{REMINDER_ERRORS[support]}</p>}
      {status && (
        <p role="status" className={`mt-2 text-sm ${status.tone === 'error' ? 'text-error' : 'text-leaf'}`}>
          {status.text}
        </p>
      )}

      {settings.enabled && (
        <Button
          variant="secondary"
          icon={BellRing}
          disabled={busy}
          onClick={() => void run(sendTestReminder, 'Odoslané. Notifikácia by mala prísť o pár sekúnd.')}
          className="mt-3 w-full"
        >
          Poslať skúšobnú notifikáciu
        </Button>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Add it to Nastavenia and report goal changes**

In `src/features/archive/SettingsPage.tsx`:

Add imports (keep alphabetical order of the local imports):

```tsx
import { reportProgress } from '../../lib/reminder'
import { ReminderSettings } from './ReminderSettings'
```

Change the goal `onChange` so the server hears about a new goal:

```tsx
          onChange={(v) => {
            setDailyGoal(Number(v))
            reportProgress()
          }}
```

Insert `<ReminderSettings />` between the closing `</section>` of the "Denný cieľ" section and `<VoiceSettings />`:

```tsx
      <ReminderSettings />
      <VoiceSettings />
```

- [ ] **Step 3: Type-check, lint and build**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: no type errors, 0 lint errors, build succeeds.

- [ ] **Step 4: Check the card in the dev server**

Run (in the background, port 5199 so Adam's server on 5173 is untouched): `npx vite --port 5199 --strictPort`
Then: `curl -s http://localhost:5199/archive/settings | grep -c 'id="root"'` → `1` (the page serves).
Code check: in DEV, `reminderSupport()` returns `'unavailable'`, so the switch renders disabled with the text "Pripomienky fungujú len v nasadenej aplikácii, nie na lokálnom serveri." (the visual check happens on the phone in Task 7).
Then stop the 5199 server only (never the one on 5173): find its PID with `netstat -ano | grep ':5199'` and run `taskkill //PID <that pid> //F`.

- [ ] **Step 5: Commit**

```bash
git add src/features/archive/ReminderSettings.tsx src/features/archive/SettingsPage.tsx
git commit -m "feat(reminder): reminder card in Nastavenia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs, deploy and first real reminder

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above; Adam's Vercel/Upstash/cron-job.org setup.
- Produces: a deployed, configured reminder.

- [ ] **Step 1: Update CLAUDE.md**

In §2 Tech stack, add a row after the "Online lookup" row:

```markdown
| Reminders | Web Push: `api/reminder.ts` (Vercel function, `web-push`) keeps state in Upstash Redis and is called every 15 min by cron-job.org (`Authorization: Bearer CRON_SECRET`); env `VAPID_PRIVATE_KEY`, `CRON_SECRET`, Upstash `KV_REST_API_URL`/`KV_REST_API_TOKEN`. `public/push-sw.js` is imported into the service worker. One reminder a day at the chosen time (±2 h window), only while the daily goal is not met |
```

In §5 Screens, change the Archív line's settings list from
`settings: export/import backup, theme, daily goal, TTS voice.` to
`settings: export/import backup, theme, daily goal, practice reminder (push, time), TTS voice.`

In §7 Project structure, change the `lib/` line to:

```
  lib/             db.ts (Dexie), search.ts, checkAnswer.ts, conjugate.ts, srs.ts, tts.ts, reminder.ts (push reminder)
```

- [ ] **Step 2: Full verification**

Run: `npm run lint && npm test && npm run build`
Expected: 0 lint errors; all tests pass (5 existing files plus `api/_reminder.test.ts`, `src/lib/reminderProgress.test.ts`, `src/lib/reminder.test.ts`); build succeeds.

- [ ] **Step 3: Commit and push (Vercel deploys main automatically)**

```bash
git add CLAUDE.md
git commit -m "docs: practice reminders in CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 4: Verify the deploy**

After the Vercel deploy finishes (1–2 min), run:
`curl -s -w ' %{http_code}\n' https://somos-jade.vercel.app/api/reminder` → `{"error":"not-configured"} 503` (the function is live, env not set yet).
`curl -s -o /dev/null -w '%{http_code}\n' https://somos-jade.vercel.app/push-sw.js` → `200`.

- [ ] **Step 5: Prepare the secrets for Adam**

```bash
SCRATCH=/c/Users/adamv/AppData/Local/Temp/claude/c--CODE-SOMOS/0704de08-a509-40fb-9cea-200cf49d5586/scratchpad
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" > "$SCRATCH/cron-secret.txt"
node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).privateKey)" "$SCRATCH/vapid.json"
cat "$SCRATCH/cron-secret.txt"
```

Give Adam both values in the reply (they go only into Vercel and cron-job.org, never into the repo), together with the setup steps:
1. Vercel → project somos → Storage → Create Database → Upstash for Redis (Free) → Connect to project somos. Keep the default env prefix, then check that `KV_REST_API_URL` and `KV_REST_API_TOKEN` appear under Settings → Environment Variables.
2. Settings → Environment Variables: add `VAPID_PRIVATE_KEY` and `CRON_SECRET` (all environments).
3. Deployments → latest → Redeploy.
4. cron-job.org: sign up → Create cronjob → URL `https://somos-jade.vercel.app/api/reminder`, every 15 minutes, Advanced → Headers: `Authorization` = `Bearer <CRON_SECRET>`.
5. Phone: close and reopen SOMOS, Nastavenia → Pripomienka cvičenia → turn on → allow notifications → "Poslať skúšobnú notifikáciu".

- [ ] **Step 6: Verify the configured server (after Adam's steps 1–4)**

Run: `curl -s -H "Authorization: Bearer $(cat "$SCRATCH/cron-secret.txt")" https://somos-jade.vercel.app/api/reminder`
Expected before the phone is enabled: `{"sent":false,"reason":"no-subscription"}`. After enabling on the phone: a `too-early` / `too-late` / `goal-met` / `sent` reason.

- [ ] **Step 7: Phone test (Adam, Android)**

1. Test notification arrives within seconds, shows the SOMOS icon and a white "S" badge in the status bar; tapping it opens Domov.
2. Open a lesson, answer one task, leave it open, send another test (after 1 min): tapping the notification brings the lesson back **as it was** (Review Focus 1).
3. Set the time 5–10 minutes ahead with the daily goal not met, close the app: the reminder arrives within 15 minutes of that time.
4. Meet the daily goal, set the time a few minutes ahead again the next day: no reminder (cron-job.org history shows `goal-met`).
5. Android Settings → Apps → SOMOS → Notifications off → reopen SOMOS: the switch in Nastavenia is off (Review Focus 5).
