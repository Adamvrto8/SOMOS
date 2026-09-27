# Practice reminders (push notifications) — design

Date: 2026-09-27 · Status: approved in chat, awaiting spec review

## Goal

Adam gets **one push notification a day** on his Android phone (installed PWA), at a time he picks
in Nastavenia, **only when today's daily goal is not met yet**. The text shows what is waiting
(streak, cards to review, progress toward the goal). Tapping it opens SOMOS on Domov.
Everything stays free.

Non-goals: several reminders a day, several devices at once, streak freeze, custom texts, iOS.

## Why a server is needed

The web platform cannot schedule a notification for a given time on the device (Notification
Triggers were abandoned; Periodic Background Sync fires when Chrome decides, ≥12 h apart).
A timed reminder therefore needs a server that sends a Web Push message.
Vercel Cron on the Hobby plan runs at most once a day, only within the hour and in UTC, so the
scheduler is external: **cron-job.org** (free) calls our function every 15 minutes.
State lives in **Upstash Redis** (free tier: 500k commands/month; the 15-minute tick uses ~3k).

## Architecture

```
Phone (SOMOS)                          Vercel                         Upstash Redis
Nastavenia: turn on ──subscribe──────▶ api/reminder.ts  ──SET────▶  somos:reminder:sub
each answer / leaving the app ─progress▶ (POST, same-origin) ──SET──▶ somos:reminder:progress
cron-job.org every 15 min ──GET──────▶ api/reminder.ts  ◀─MGET───   somos:reminder:sent
  (Authorization: Bearer CRON_SECRET)    decide() → web-push ─▶ push service ─▶ service worker
                                                                     shows the notification
```

Three separate keys, so a progress report and a tick never overwrite each other's data.

### Stored state

```ts
// somos:reminder:sub
interface ReminderSub {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  time: string      // "19:00", phone-local
  timeZone: string  // IANA zone from the phone, e.g. "Europe/Bratislava"
  lastTestAt?: number
}
// somos:reminder:progress — as the phone computed it at report time
interface ReminderProgress {
  day: string          // phone-local day key "2026-09-27"
  done: number         // answers + reviews that day (what the daily goal counts)
  goal: number         // daily goal setting
  dueToday: number     // review cards due by the end of `day`
  dueTomorrow: number  // review cards due by the end of the next day
  streakDays: number   // computeStreak().days
  activeToday: boolean // computeStreak().activeToday
}
// somos:reminder:sent — day key of the last reminder sent, e.g. "2026-09-27"
```

`dueTomorrow` lets a reminder show a correct card count even when the app has not been opened
yet today (the last report is from yesterday).

## Server: `api/reminder.ts`

One self-contained file, like `api/translate.ts` (no local imports). New dependency: `web-push`
(encrypts the payload and signs it with the VAPID key). Upstash is called through its REST API
with `fetch`, no client library.

Environment variables:
- `VAPID_PRIVATE_KEY`: the public key is a constant in `src/lib/reminder.ts` and in this file.
  The VAPID subject is `https://somos-jade.vercel.app`.
- `CRON_SECRET`
- `KV_REST_API_URL` + `KV_REST_API_TOKEN`, falling back to `UPSTASH_REDIS_REST_URL` +
  `UPSTASH_REDIS_REST_TOKEN`: added automatically when the Upstash store is connected.

Any of them missing → `503 { error: 'not-configured' }`.

### `POST /api/reminder` (same-origin only, like translate)

Body is discriminated by `type`:

| type | body | effect |
|---|---|---|
| `subscribe` | `subscription, time, timeZone` | stores `sub` (replaces any older device) |
| `unsubscribe` | `endpoint` | deletes `sub` only if the endpoint matches |
| `progress` | `endpoint, progress` | stores `progress` only if the endpoint matches the stored one; else ignored |
| `test` | `endpoint` | if the endpoint matches, sends a test notification now (ignores the time window); at most once per minute (`lastTestAt`) |

Validation: `time` matches `HH:MM` (00:00–23:59); `timeZone` accepted by `Intl.DateTimeFormat`;
numbers are non-negative integers. Invalid input → `400`, wrong origin → `403`.

### `GET /api/reminder` (tick, `Authorization: Bearer <CRON_SECRET>`)

Wrong or missing secret → `401`. Otherwise loads the three keys, runs `decide()`, sends when told to,
and answers `{ sent, reason }` so the cron-job.org history shows what happened.

`decide(now, sub, progress, sentDay)` is a pure function:

1. No `sub` → `no-subscription`.
2. Local time in `sub.timeZone` (via `Intl.DateTimeFormat#formatToParts`, so DST is handled).
   Window = `[time, min(time + 2 h, 23:59)]`. Before it → `too-early`; after it → `too-late`.
   The window keeps a late-evening enable from firing at a surprising hour.
3. `sentDay === localDay` → `already-sent`.
4. Today's view from the last report:
   - report from today: `done`, `goal`, `due = dueToday`, `streak = streakDays`
   - report from yesterday: `done = 0`, `due = dueTomorrow`, `streak = activeToday ? streakDays : 0`
   - older or none: `done = 0`, `due` unknown, `streak = 0`, `goal = progress?.goal ?? 20`
5. `done >= goal` → `goal-met`.
6. Otherwise send `composeMessage(view)`.

After a successful send the tick writes `sent = localDay`. A failed send leaves it unset, so the next
tick retries within the window. A `404`/`410` from the push service deletes `sub`.

Push options: `TTL` 4 h (a reminder that arrives later is pointless), `topic: 'reminder'`
(a newer one replaces an undelivered one). Payload: `{ title, body, url: '/' }`.

### Texts (Slovak; plurals: 1 deň / 2–4 dni / 5+ dní, 1 kartička / 2–4 kartičky / 5+ kartičiek)

| situation | title | body |
|---|---|---|
| nothing today, streak ≥ 1 | 🔥 Séria 12 dní čaká na dnešok | Na zopakovanie: 14 kartičiek · stačí pár minút |
| nothing today, no streak | ¿Practicamos? 🇲🇽 | Na zopakovanie: 14 kartičiek |
| some done, goal not met | Ešte 8 do denného cieľa | Dnes 12/20 · séria 12 dní 🔥 |
| test | SOMOS | Skúšobná notifikácia — pripomienky fungujú ✓ |

When `due` is 0 or unknown, the body says `Denný cieľ: 20 odpovedí` instead of the card count
(first row keeps `· stačí pár minút`). With no streak, the third row drops the streak part.

## App

### `src/lib/reminder.ts`
- `VAPID_PUBLIC_KEY` constant.
- Device settings `{ enabled, time }` in localStorage (`somos-reminder`, default off / `19:00`),
  exposed through a `useSyncExternalStore` hook like `dailyGoal.ts`. Not part of the backup.
- `reminderSupport()`: `'ok' | 'unsupported' | 'denied'` (no `PushManager` / permission denied).
- `enableReminder(time)`: request permission → `navigator.serviceWorker.ready` →
  `pushManager.getSubscription() ?? subscribe({ userVisibleOnly: true, applicationServerKey })` →
  `POST subscribe` → save settings → report progress. Settings change only after the server said OK.
- `setReminderTime(time)`: `POST subscribe` with the new time.
- `disableReminder()`: `POST unsubscribe`, `subscription.unsubscribe()`, save settings.
- `sendTestReminder()`: `POST test`.
- `syncReminder()` at app start: when enabled and permitted, re-`subscribe` (covers a rotated
  endpoint or lost server state), then report progress. When enabled but the permission was revoked,
  it switches the setting off.
- `reportProgress()`: debounced (~3 s), skipped when disabled or offline, `fetch` with
  `keepalive: true`. Called from `recordAttempt` (lessons and reviews both go through it), after
  `setDailyGoal`, when the page becomes hidden, and from `syncReminder`. Failures are ignored.
- `buildProgress(attemptTimestamps, cards, goal, now)`: pure, unit-tested. Reuses
  `computeStreak`, `dayKey`, `endOfDay`, `addDays` and `cardOf`.

### `public/push-sw.js`
~30 lines, added to the generated service worker through `workbox.importScripts` in `vite.config.ts`,
so the existing generateSW setup and auto-update stay untouched.
- `push`: `showNotification(title, { body, icon: '/pwa-192x192.png', badge: '/badge-96x96.png',
  tag: 'somos-reminder', lang: 'sk', data: { url } })`.
- `notificationclick`: close it; focus an open SOMOS window and navigate it to `url`, otherwise
  `clients.openWindow(url)`.

`public/badge-96x96.png`: monochrome, transparent badge for the Android status bar (generated
from the app icon with sharp).

### `src/features/archive/ReminderSettings.tsx`
A section in Nastavenia under "Denný cieľ", titled "Pripomienka cvičenia":
- note "Raz denne, ak ešte nemáš splnený denný cieľ."
- on/off switch, `<input type="time">` (Android native picker) shown when on,
  button "Poslať skúšobnú notifikáciu"
- status lines:
  - unsupported: "Tento prehliadač notifikácie nepodporuje."
  - denied: "Notifikácie sú zablokované. Povoľ ich v Nastaveniach Androidu → Aplikácie → SOMOS → Upozornenia."
  - 503: "Pripomienky ešte nie sú na serveri nastavené."
  - offline or network error: "Potrebuješ internet."
- the switch is disabled while a request is running; ≥44 px tap targets.

## Error handling summary

| case | result |
|---|---|
| unsupported or denied | switch disabled, explanation shown |
| server not configured | message shown, setting stays off |
| offline while changing | "Potrebuješ internet.", setting unchanged |
| progress report fails | ignored, sent again with the next trigger |
| tick fails (Upstash/push down) | `sent` not written, retried next tick inside the window; visible on cron-job.org |
| subscription gone (404/410) | deleted on the server; app re-subscribes on next start |
| practised fully offline | server does not know, so the reminder still comes (accepted limitation) |

## Security

- POSTs require a same-origin `Origin` header (browsers enforce it; a forged request could at
  worst replace the subscription or trigger a test, which is rate-limited).
- The tick requires `CRON_SECRET`.
- Stored data: the push endpoint and practice counts, nothing personal. The VAPID private key only
  lives in Vercel env.

## Testing

- `api/_reminder.test.ts` (vitest; the underscore keeps Vercel from deploying it):
  - `decide()`: before / inside / after the window, already sent, goal met, report from today /
    yesterday / older, a DST-change day, window clamped at 23:59
  - `composeMessage()` texts and Slovak plurals
  - handler: 401 without the secret, 403 cross-origin, 503 not configured, endpoint mismatch ignored,
    test rate limit, `410` deletes the subscription, `sent` written only after a successful send
    (Redis and the sender are injected fakes)
- `src/lib/reminder.test.ts`: `buildProgress()`: done today, due today/tomorrow, streak.
- On the phone:
  1. enable, then send a test notification; tapping it opens Domov
  2. set the time a few minutes ahead with the goal not met: the reminder arrives
  3. meet the goal: no reminder
- `npm test`, `npm run build`.

## Setup Adam does once (after the deploy)

1. Vercel → project somos → Storage → Create → Upstash for Redis (Free) → connect to the project.
2. Vercel → Settings → Environment Variables: `VAPID_PRIVATE_KEY`, `CRON_SECRET` (values generated
   during implementation).
3. Redeploy so the variables apply.
4. cron-job.org: create an account → new cronjob → `https://somos-jade.vercel.app/api/reminder`,
   every 15 minutes, header `Authorization: Bearer <CRON_SECRET>`.
5. On the phone: Nastavenia → Pripomienka cvičenia → turn on → send a test notification.

## Docs

`CLAUDE.md`: a "Reminders" row in the tech-stack table (Web Push via `api/reminder.ts`, Upstash,
cron-job.org, env vars), and a mention in the Nastavenia/Archív screen description.
