# Practice reminders for every learner — design

Date: 2026-10-24 · Status: approved by Adam in chat (Supabase; every device with the reminder on)
Builds on: [2026-09-27-push-reminders-design.md](2026-09-27-push-reminders-design.md) (the reminder itself),
[2026-10-19-accounts-design.md](2026-10-19-accounts-design.md) (optional accounts, Supabase).

## Goal

Today the server reminds **one device**: one subscription under `somos:reminder:sub` in Upstash, and a second
device is refused (`other-device`) unless the learner moves the reminders to it (`takeOver`). For a public
release every installed app that turns the reminder on gets its own daily reminder, at its own time, in its
own language, with its own diagnostics, and nothing one learner does changes another learner's reminder.

What stays as it is: one reminder a day at a time picked in Nastavenia, only when the daily goal is not met,
the texts, the 2-hour window, the receipts from the service worker, the test notifications, cron-job.org every
15 minutes. The account stays optional: the reminder works without one.

Non-goals: several reminders a day, reminder settings synced between devices, a reminder time per account,
push for other purposes (duel invites can reuse this later, see the end), our own analytics.

## Decisions

1. **Storage moves from Upstash to Supabase (Postgres).** Supabase is already set up for accounts and duels.
   A table answers "who is due now" with one query (time zones in SQL), links a device to an account, and
   deletes a device with its account. Upstash would need a scan of every key on every tick or time buckets that
   move with daylight saving. Upstash is removed when the move is done.
2. **One row per device**, keyed by the id the app already makes (`somos-reminder-device`). The reminder time,
   time zone, language and progress belong to the device, as today.
3. **Two devices of one account**: each device with the reminder turned on gets it (the learner turned it on
   there), but the **daily goal counts for the account**: when the learner practised on the tablet, the phone
   does not remind. (Adam: "každé, kde je zapnutá pripomienka".)
4. **The server API stays one Vercel function** (`api/reminder.ts`), now talking to Supabase with the service
   role key. The app never talks to the table directly, so a learner without an account needs no Supabase
   session.
5. **Fewer progress reports**: on app start, when the app goes to the background, and when the daily goal is
   reached. No longer after every answer (with many learners that would use up the Vercel invocation quota).

## Data

```sql
-- One row per installed app that has the reminder on. Only api/reminder.ts (service role) reads and writes it.
create table if not exists public.push_devices (
  device text primary key,                 -- the app's own id: outlives a rotated subscription
  user_id uuid references auth.users on delete cascade, -- the account signed in on the device, or null
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  time text not null check (time ~ '^([01]\d|2[0-3]):[0-5]\d$'), -- "19:00", device-local
  time_zone text not null,                 -- IANA zone from the device
  language text not null default 'sk' check (language in ('sk', 'en')),
  progress jsonb,                          -- ReminderProgress, as the device last reported it
  handled_day text,                        -- local day the reminder was sent or skipped because the goal was met
  delivery jsonb,                          -- Delivery: the last message handed to the push service + receipt
  last_reason text,                        -- the last decision for this device ("sent", "goal-met", "failed"…)
  test_at timestamptz,                     -- last test notification: at most one a minute
  test_later boolean not null default false,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now() -- last subscribe or progress report
);
create index if not exists push_devices_user on public.push_devices (user_id) where user_id is not null;

-- Endpoints the push service dropped (404/410): subscribing one again gets 410, so the app makes a new one.
create table if not exists public.push_gone (endpoint text primary key, at timestamptz not null default now());

-- Cron health for "Stav pripomienky": when the tick last came and how it went.
create table if not exists public.push_ticks (id smallint primary key default 1 check (id = 1),
  at timestamptz not null, reason text not null, sent integer not null default 0);

alter table public.push_devices enable row level security; -- no policies, no grants: anon and users see nothing
alter table public.push_gone enable row level security;
alter table public.push_ticks enable row level security;
```

`reminders_due(p_now timestamptz, p_limit int)` (SQL function, service role only) returns the devices whose
local time at `p_now` is inside `[time, min(time + 2 h, 23:59)]` and whose `handled_day` is not today's local
day, plus every device with `test_later`. Window arithmetic in minutes of the day, not `time + interval`
(that wraps past midnight). `decide()` in TypeScript still runs on every returned row and stays the single
source of the rule; the SQL only narrows the rows.

Clean-up, done by the tick once a day: devices not seen for 60 days, `push_gone` rows older than 30 days.

## Server: `api/reminder.ts`

Still self-contained (no local imports). The `Store` interface is replaced by a `DeviceStore`, so tests keep
an in-memory fake:

```ts
interface DeviceStore {
  get(device: string): Promise<DeviceRow | null>
  upsert(row: NewDevice): Promise<void>          // subscribe; also frees an endpoint held by another row
  remove(device: string): Promise<void>
  update(device: string, fields: Partial<DeviceRow>): Promise<void>
  due(now: Date, limit: number): Promise<DeviceRow[]>
  progressOf(userIds: string[]): Promise<{ userId: string; progress: ReminderProgress }[]> // siblings' reports
  isGone(endpoint: string): Promise<boolean>
  markGone(device: string, endpoint: string): Promise<void>
  recordTick(tick: LastTick & { sent: number }): Promise<void>
  lastTick(): Promise<LastTick | null>
}
```

Implemented with `fetch` against Supabase's REST API (PostgREST tables and `rpc/reminders_due`), like the
Upstash client today, so the function does not pull in supabase-js.

Environment: `SUPABASE_URL` (falls back to `VITE_SUPABASE_URL`, already set), `SUPABASE_SERVICE_ROLE_KEY`
(secret, never a `VITE_` variable), `VAPID_PRIVATE_KEY`, `CRON_SECRET`. Missing → `503 not-configured`.
The Upstash variables are no longer read.

### `POST /api/reminder` (same-origin)

Every request names its row by `endpoint` (unique; known only to the browser and the push service, so it serves
as the device's secret, and the service worker's receipt already sends it). `subscribe` also names the `device`:
a new endpoint from the same device replaces its old one, and an endpoint still held by another row moves to
this one.

| type | change against today |
|---|---|
| `subscribe` | upserts this device's row. No `other-device`, no `takeOver` (ignored when an old app sends it). `device` is required. An `Authorization: Bearer <Supabase access token>` header links the row to that account (checked once with `GET /auth/v1/user`); without it `user_id` is cleared. |
| `unsubscribe` | deletes this device's row |
| `progress` | stores `progress` and `seen_at` on this device's row |
| `test`, `test-later` | as today, per device (`test_at` replaces the shared 60-second key) |
| `received` | the receipt goes to this device's `delivery` |
| `status` | this device only: its row, its `delivery`, its `last_reason`, plus the global last tick |

`ReminderStatus.thisDevice` goes away: `subscribed` now means "the server reminds this device".

### Abuse limits (needed once the URL is public)

- The endpoint host must be a known push service: `fcm.googleapis.com`, `*.push.services.mozilla.com`,
  `web.push.apple.com`, `*.notify.windows.com`. Otherwise `400`. This also keeps the tick from sending
  requests to arbitrary servers.
- `subscribe`: at most 20 new devices per IP address per hour (a small `push_rate` table keyed by a hash of
  the IP and the hour), and a ceiling on the table (e.g. 50 000 rows) after which new devices get `503`.
- The `Origin` check stays; it stops other websites, not scripts, which is what the two limits above are for.

### `GET /api/reminder` (tick, `CRON_SECRET`)

1. `due(now, 500)`.
2. For rows with a `user_id`, load the progress of all devices of those accounts (`progressOf`). For the
   device's local day the account's view is the report with the highest `done` (each device only knows what it
   has synced; the highest is the best lower bound), with `dueToday` / `streakDays` from that same report.
3. Per row: `test_later` → send the test. Then `decide(now, sub, progress, handledDay)` → send or skip.
   `goal-met` also sets `handled_day`, so the device is not looked at again that day.
4. Send with a concurrency of ~20. A 404/410 removes the row and notes `push_gone`.
5. Write each row's `handled_day` / `delivery` / `last_reason`, then `push_ticks`
   (`reason`: `sent n`, `nothing-due`, `partial` when it stopped early).
6. If 500 rows came back, or about 45 s have passed (`maxDuration` 60 s in `vercel.json`), stop and leave the rest to the next tick: the 2-hour
   window gives 8 ticks, so a busy 19:00 is spread out instead of timing out.

Rough size: one push takes ~100–300 ms, so 500 devices at 20 at a time take a few seconds.

## App

`src/lib/reminder.ts`:
- `register()` loses `takeOver`; `registerDevice()` loses its second parameter. `ReminderError` loses
  `'elsewhere'`, `useReminderElsewhere()` goes, and with it the "Pripomienky chodia na iné zariadenie" box in
  [ReminderSettings.tsx](../../../src/features/settings/ReminderSettings.tsx) and the `elsewhere` texts in
  `sk.ts` / `en.ts`.
- When signed in, `subscribe` carries the access token (taken from `account.ts` only if it is already loaded;
  the reminder must not load supabase-js for a learner without an account). Sign-in, sign-out and account
  deletion call `syncReminder()`, so the row follows the account.
- Without `deviceId()` (no localStorage) the reminder reports `unsupported`.
- `startProgressReporting()`: no Dexie hook per answer. Reports at start, on going to the background, and when
  today's `done` reaches the goal (one check after an answer, without a request unless the goal was just met).
  A report identical to the last one sent is skipped. Settings that change the goal or the due cards still
  report at once.

`src/lib/reminderStatus.ts` ("Stav pripomienky", dev mode): drops `thisDevice`; shows this device's last
decision next to the cron's last tick.

Old app versions still cached on a phone keep working: they send `takeOver` (ignored) and report progress
more often (allowed).

## Moving from Upstash

No data migration: every app with the reminder on registers itself again at its next start or return to the
front (`syncReminder()`), which creates its row. Adam's phone: open the app once after the deploy, check
"Stav pripomienky". Once it shows the new server, remove the Upstash integration and its variables from Vercel.

## Privacy

Stored per device: the push endpoint and keys, the reminder time, the time zone, the language, practice
counts, the link to an account. Deleted with the account (foreign key), on turning the reminder off, when the
push service drops the endpoint, and after 60 days without contact. The privacy page (`/privacy`) gets a
paragraph on this.

## Not solved here, but noted

- **iPhone**: Web Push works only for an app added to the home screen, iOS 16.4+, and the permission must be
  asked from a tap. The code path is the same; it needs a test on a real iPhone.
- **Vercel Hobby** is for non-commercial use, and its monthly function invocation quota is shared by all
  learners: the reduced progress reports matter here.
- **Duel invites** later: "send to every device of user X" is one query on `push_devices.user_id`.

## Testing

- `api/_reminder.test.ts`, with an in-memory `DeviceStore`:
  - two devices subscribe and both stay; each gets its own reminder at its own time and language
  - a request with the right device but the wrong endpoint changes nothing
  - two devices of one account: practice reported on one stops the reminder on the other
  - a 410 removes only that device
  - endpoint host not a push service → 400; the per-IP limit → 429
  - the tick stops at its limit and the next tick picks up the rest
  - `decide()`, texts, receipts and test rate limit: the existing tests, moved to per-device state
- SQL: `reminders_due` checked against a few time zones and a daylight-saving day (a test script run against
  the Supabase project, as for the duel functions).
- `src/lib/reminder.test.ts`: no `takeOver`; the token is sent only when signed in.
- Playwright: Nastavenia without the "iné zariadenie" box.
- On the phone: test notification, a reminder at a time a few minutes ahead, the goal met → none; with a
  second device (or a second browser profile): both get theirs.

## Adam's one-time setup

1. Supabase → SQL editor: run the new part of `supabase/schema.sql`.
2. Vercel → Environment Variables: `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API keys).
   Redeploy.
3. Open the app on the phone, check "Stav pripomienky", send a test notification.
4. After a day of working reminders: remove the Upstash store from the Vercel project.
