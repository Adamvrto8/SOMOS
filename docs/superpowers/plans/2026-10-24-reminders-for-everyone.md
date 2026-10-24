# Reminders for every learner — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (Adam prefers inline execution).
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every device that turns the reminder on gets its own daily reminder; the server no longer keeps one.

**Architecture:** `api/reminder.ts` stays one self-contained Vercel function, but its state moves from one set of
Upstash keys to one Supabase row per device (`push_devices`), read and written with the service role key over
PostgREST. The tick asks Postgres which devices are inside their window, runs the existing pure `decide()` on
each, and for signed-in learners counts the daily goal over all devices of the account.

**Tech stack:** Vercel functions (Node, Web `Request`/`Response`), Supabase Postgres + PostgREST + Auth, web-push,
vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-10-24-reminders-for-everyone-design.md](../specs/2026-10-24-reminders-for-everyone-design.md)

## Global constraints

- `api/reminder.ts` has no local imports (Vercel deploys it as a single file); no supabase-js on the server.
- The app never loads supabase-js for the reminder; a learner without an account needs no Supabase session.
- UI strings in Slovak and English (`src/i18n/sk.ts`, `en.ts`); code and comments in English.
- `SUPABASE_SERVICE_ROLE_KEY` is never a `VITE_` variable and never leaves the function.
- New Supabase keys (`sb_secret_…`) go only in the `apikey` header; a legacy JWT key (`eyJ…`) also as `Authorization: Bearer`.
- Push endpoint hosts allowed: `fcm.googleapis.com`, `*.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`.
- Old cached apps keep working: `takeOver` is ignored, frequent progress reports are accepted.
- Before push: `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` (CI runs the same).

## Review focus

1. A device re-subscribing at every app start must not count against the per-IP limit or the table ceiling
   (only a new device does) → test in Task 3.
2. A time zone Node accepts but Postgres does not must not break the tick for everyone → `reminders_due` joins
   `pg_timezone_names` (Task 1), and the store test covers a row it does not return (Task 5).
3. Two devices of one account in different states (one reported yesterday, one today) → `bestProgress` tests (Task 2).
4. The tick hitting its time budget halfway must leave the unhandled devices for the next tick, not mark them
   → test in Task 4.
5. Signing out, signing in and deleting the account must move the device row along (link cleared / set /
   re-created anonymously) → test in Task 6.

---

### Task 1: Database tables and functions

**Files:**
- Modify: `supabase/schema.sql` (new section at the end)
- Modify: `vercel.json` (`functions` → `api/reminder.ts` → `maxDuration: 60`)

- [ ] Append the section:

```sql
-- ---------------------------------------------------------------------------------------------------------
-- Practice reminders (docs/superpowers/specs/2026-10-24-reminders-for-everyone-design.md): one row per device.
-- Only api/reminder.ts reads and writes these, with the service role key: no policies, no grants.

create table if not exists public.push_devices (
  device text primary key,
  user_id uuid references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  time text not null check (time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  time_zone text not null,
  language text not null default 'sk' check (language in ('sk', 'en')),
  receipts boolean not null default false,
  progress jsonb,
  handled_day text,        -- sent or skipped because the goal was met
  sent_day text,           -- the last day a reminder went out
  delivery jsonb,
  last_decision jsonb,     -- { at, reason }
  test_at timestamptz,
  test_later boolean not null default false,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index if not exists push_devices_user on public.push_devices (user_id) where user_id is not null;

create table if not exists public.push_gone (endpoint text primary key, at timestamptz not null default now());
create table if not exists public.push_ticks (
  id smallint primary key default 1 check (id = 1), at timestamptz not null, reason text not null, sent integer not null default 0);
create table if not exists public.push_rate (key text primary key, hour timestamptz not null, count integer not null);

alter table public.push_devices enable row level security;
alter table public.push_gone enable row level security;
alter table public.push_ticks enable row level security;
alter table public.push_rate enable row level security;

-- Devices inside their window [time, min(time + 2 h, 23:59)] that have not been handled today, and every
-- test asked for later. Minutes of the day, not time + interval (that wraps past midnight). A zone Postgres
-- does not know drops out here instead of failing the query for everyone.
create or replace function public.reminders_due(p_now timestamptz, p_limit integer)
returns setof public.push_devices language sql stable set search_path = '' as $$
  select d.* from public.push_devices d
  join pg_catalog.pg_timezone_names z on z.name = d.time_zone
  cross join lateral (select p_now at time zone d.time_zone as t) l
  cross join lateral (select
      extract(hour from l.t)::int * 60 + extract(minute from l.t)::int as minutes,
      to_char(l.t, 'YYYY-MM-DD') as day,
      split_part(d.time, ':', 1)::int * 60 + split_part(d.time, ':', 2)::int as start) m
  where d.test_later
     or (m.minutes between m.start and least(m.start + 120, 1439) and d.handled_day is distinct from m.day)
  order by d.device
  limit p_limit;
$$;

-- One more new device from this key (a hash of the IP) this hour: true while under the limit.
create or replace function public.push_rate_hit(p_key text, p_limit integer) returns boolean
language plpgsql set search_path = '' as $$
declare this_hour timestamptz := date_trunc('hour', now()); n integer;
begin
  insert into public.push_rate as r (key, hour, count) values (p_key, this_hour, 1)
  on conflict (key) do update set count = case when r.hour = this_hour then r.count + 1 else 1 end, hour = this_hour
  returning count into n;
  return n <= p_limit;
end $$;

-- Once a day from the tick: devices silent for 60 days, old gone endpoints and rate rows.
create or replace function public.push_cleanup() returns void language sql set search_path = '' as $$
  delete from public.push_devices where seen_at < now() - interval '60 days';
  delete from public.push_gone where at < now() - interval '30 days';
  delete from public.push_rate where hour < now() - interval '1 day';
$$;

revoke execute on function public.reminders_due(timestamptz, integer), public.push_rate_hit(text, integer), public.push_cleanup()
  from public, anon, authenticated;
```

- [ ] `vercel.json`: add `"functions": { "api/reminder.ts": { "maxDuration": 60 } }`.
- [ ] Run the SQL against Adam's project is **his** step (setup guide, Task 8); here only check it parses:
  paste into the Supabase SQL editor of a scratch project if available, otherwise review by eye.
- [ ] Commit: `feat(reminder): tables for one reminder per device`.

### Task 2: Server types, validation and pure helpers

**Files:** Modify `api/reminder.ts`, `api/_reminder.test.ts`

**Produces:**
```ts
export interface DeviceRow {
  device: string; userId: string | null; endpoint: string; p256dh: string; auth: string
  time: string; timeZone: string; language: 'sk' | 'en'; receipts: boolean
  progress: ReminderProgress | null; handledDay: string | null; sentDay: string | null
  delivery: Delivery | null; lastDecision: LastTick | null; testAt: string | null; testLater: boolean
}
export const isPushHost: (endpoint: string) => boolean
export function bestProgress(own: ReminderProgress | null, others: ReminderProgress[], day: string): ReminderProgress | null
export const subOf: (row: DeviceRow) => ReminderSub // for decide() and deliver()
```

- [ ] Tests first:
  - `isPushHost`: accepts `https://fcm.googleapis.com/fcm/send/x`, `https://updates.push.services.mozilla.com/wpush/v2/x`,
    `https://web.push.apple.com/x`, `https://db5p.notify.windows.com/w/?token=x`; rejects `https://push.example/x`,
    `https://fcm.googleapis.com.evil.example/x`, `http://fcm.googleapis.com/x`, `not a url`.
  - `isReminderSub` now rejects a non-push host (existing fixtures switch to `https://fcm.googleapis.com/fcm/send/abc`).
  - `bestProgress`: of reports from today the highest `done` wins; a report from today beats one from yesterday
    with more `done`; only yesterday's reports → the one with the highest `done`; none for today or yesterday →
    `own`; no reports → `null`.
- [ ] Implement: `isPushHost` parses with `URL`, requires `https:` and a host equal to or ending in `.` + one of
  the allowed suffixes; `isPushSub` calls it. `bestProgress` as tested. `subOf` maps a row to `ReminderSub`.
- [ ] `npm test -- api/_reminder` → pass. Commit: `feat(reminder): push hosts only, the best report of an account`.

### Task 3: Device store and the app's requests

**Files:** Modify `api/reminder.ts`, `api/_reminder.test.ts`

**Produces:**
```ts
export interface DeviceStore {
  byEndpoint(endpoint: string): Promise<DeviceRow | null>
  byDevice(device: string): Promise<DeviceRow | null>
  save(row: DeviceRow): Promise<void>           // upsert by device; deletes another row holding the endpoint first
  update(device: string, fields: Partial<DeviceRow>): Promise<void>
  remove(device: string): Promise<void>
  due(now: Date, limit: number): Promise<DeviceRow[]>
  reportsOf(userIds: string[]): Promise<{ userId: string; device: string; progress: ReminderProgress }[]>
  isGone(endpoint: string): Promise<boolean>
  markGone(endpoint: string): Promise<void>
  lastTick(): Promise<LastTick | null>
  recordTick(tick: LastTick & { sent: number }): Promise<void>
  count(): Promise<number>
  rateHit(key: string, limit: number): Promise<boolean>
  cleanup(): Promise<void>
}
export interface Deps {
  store: DeviceStore; send: Sender; now: () => Date; cronSecret: string
  userOf: (token: string) => Promise<string | null | 'invalid'> // Supabase user id; 'invalid' = keep the old link
  ipOf: (request: Request) => string                             // hashed
}
export const MAX_DEVICES = 50_000
export const NEW_DEVICES_PER_HOUR = 20
```

`ReminderStatus` becomes:
```ts
{ subscribed: boolean; time; timeZone; serverClock; sentDay; progress; lastTick /* the cron, global */;
  lastDecision: LastTick | null /* this device */; dropped: boolean; delivery; testPending: boolean }
```

- [ ] Replace `memoryStore` in the test with `memoryDevices()` implementing `DeviceStore` over a `Map`
  (`due` filters with `decide()`-compatible logic: `testLater || (inside window && handledDay !== local day)`
  using the exported `localClock`). Rewrite the POST tests:
  - subscribe stores a row (keys stripped of `expirationTime`), language/receipts as before, `device` required (400 without)
  - two devices subscribe → two rows; each `progress` / `test` / `received` / `status` touches only its own row
  - the same device with a new endpoint → one row, new endpoint; an endpoint held by another device's row moves
  - a gone endpoint → 410; status of a gone endpoint → `dropped: true`
  - `takeOver` in the body is ignored; no request answers `other-device`
  - with a valid token the row gets `userId`; without a token `userId` becomes null; `'invalid'` keeps the old value
  - a new device over `NEW_DEVICES_PER_HOUR` from one IP → 429; at `MAX_DEVICES` → 503 `full`;
    an existing device re-subscribing is never limited (**review focus 1**)
  - non-push host → 400; wrong origin → 403; test once a minute per device (`testAt`), another device can test at once
  - status: only this device's data, never the endpoint or keys in the JSON
- [ ] Implement `handlePost` against `DeviceStore`; the token comes from `Authorization: Bearer …` on the request.
  Delete `KEYS`, `Store`, `upstashStore`, the `other-device` branch and their tests.
- [ ] `npm test -- api/_reminder` → pass. Commit: `feat(reminder): a row per device for the app's requests`.

### Task 4: The tick for many devices

**Files:** Modify `api/reminder.ts`, `api/_reminder.test.ts`

**Produces:** `export const TICK_LIMIT = 500`, `export const TICK_BUDGET_MS = 45_000`, `export const SEND_CONCURRENCY = 20`;
`Deps.clock?: () => number` (ms, for the budget; defaults to `Date.now`).

- [ ] Tests first:
  - two devices at 19:00 Bratislava and 19:00 New York: a tick at 17:10 UTC sends only to the first, in its language
  - account of two devices: the tablet reports today `done = goal`, the phone yesterday → the phone's tick says
    `goal-met` and sets `handledDay`; a learner without an account is unaffected by another's report
  - `goal-met` and `sent` set `handledDay`; `failed` (500) does not, so the next tick retries
  - 410 removes only that row and marks the endpoint gone
  - `test_later` is sent at the next tick outside the window and cleared
  - the budget: with `clock` jumping past `TICK_BUDGET_MS` after the first send, the rest stay unhandled and
    the tick reason is `partial` (**review focus 4**)
  - `push_ticks` gets `{ at, reason, sent }`; the response is `{ sent: n, reason }`
  - `cleanup` runs once per local day of the server (first tick after 03:00 UTC)
- [ ] Implement: `due(now, TICK_LIMIT)` → `reportsOf` for the user ids in it → per row
  `bestProgress(row.progress, others, day)` → `decide()` → `deliver()`; a small pool runs `SEND_CONCURRENCY`
  at a time and checks the budget before taking the next row. Every row's result goes to `update()`
  (`handledDay`, `sentDay`, `delivery`, `lastDecision`, `testLater`).
- [ ] `npm test -- api/_reminder` → pass. Commit: `feat(reminder): the tick reminds every device in its window`.

### Task 5: Supabase over REST and the environment

**Files:** Modify `api/reminder.ts`, `api/_reminder.test.ts`

**Produces:** `export function supabaseStore(url: string, key: string, fetchImpl?: typeof fetch): DeviceStore`,
`export function supabaseUser(url: string, key: string, fetchImpl?): Deps['userOf']`, `depsFromEnv` reading
`SUPABASE_URL ?? VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_SECRET_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`.

- [ ] Tests with a fake `fetch` recording calls:
  - `byEndpoint` → `GET {url}/rest/v1/push_devices?endpoint=eq.<encoded>&select=*`, `apikey` header; a `sb_secret_`
    key has no `Authorization`, an `eyJ` key has `Authorization: Bearer`
  - rows map snake_case ↔ camelCase both ways (`time_zone` ↔ `timeZone`…); invalid stored JSON (`progress`) → null
  - `save` deletes `endpoint=eq.X&device=neq.Y`, then `POST … Prefer: resolution=merge-duplicates`
  - `due` → `POST /rest/v1/rpc/reminders_due` with `{ p_now, p_limit }`; a row the RPC leaves out is simply not
    there (**review focus 2** is in SQL; the test pins that the store does not refilter)
  - `count` reads `Content-Range` of a `HEAD … Prefer: count=exact`
  - an error status throws with the PostgREST message
  - `supabaseUser`: 200 → id, 401/403 → `'invalid'`, network error → `'invalid'`
  - `depsFromEnv`: both URL names, both key names, missing anything → undefined; Upstash variables alone → undefined
  - `ipOf`: first address of `x-forwarded-for`, SHA-256 hex with a fixed prefix, never the raw IP
- [ ] Implement; remove the `upstashStore` tests. `npm test` → pass.
  Commit: `feat(reminder): devices kept in Supabase instead of Upstash`.

### Task 6: The app

**Files:** Modify `src/lib/reminder.ts`, `src/lib/reminder.test.ts`, `src/lib/account.ts`,
`src/features/settings/ReminderSettings.tsx`, `src/i18n/sk.ts`, `src/i18n/en.ts`

**Produces in `account.ts`:** `export function subscribeAccount(notify: () => void): () => void` (the existing
listener set) and `export async function accessToken(): Promise<string | null>` (null when signed out or the client
fails; uses `getClient()` only when `getAccount()` is set).

- [ ] Tests first (`reminder.test.ts`):
  - `subscribe` body has `device` and no `takeOver`; signed in → `Authorization: Bearer <token>` header; signed out → none
  - an account change (sign-in, sign-out) triggers a `subscribe` (**review focus 5**)
  - an attempt below the goal sends nothing; the attempt that reaches it sends one `progress`; a second one that day does not
  - going to the background sends `progress` once; a second time with the same numbers does not
  - `reportProgress()` (settings) sends when the numbers changed (a goal change changes `goal`) and skips
    when they equal the last report; test both
  - remove the "other device" test
- [ ] Implement: drop `takeOver`, `'elsewhere'`, `useReminderElsewhere`; `post()` takes optional headers;
  `register()` adds the token; `keepReminderSynced()` adds `subscribeAccount(() => void syncReminder())`;
  the Dexie hook calls `noteAnswer()` (debounced `loadProgress()` → post only when `done >= goal` and not yet
  reported for that day); `reportProgressNow()` skips a body equal to the last sent one.
  No `deviceId()` → `reminderSupport()` answers `'unsupported'`.
- [ ] `ReminderSettings.tsx`: remove the move-here button and `elsewhere`; i18n: remove `elsewhere`,
  `moveHere`, `movedHere`, `status.otherDevice`, `errors.elsewhere` in both languages (the i18n type check finds leftovers).
- [ ] `npm test`, `npm run lint` → pass. Commit: `feat(reminder): every device keeps its own reminder`.

### Task 7: Status for one device

**Files:** Modify `src/lib/reminderStatus.ts`, `src/lib/reminderStatus.test.ts`, `src/i18n/sk.ts`, `src/i18n/en.ts`

- [ ] Tests first: `subscribed` → "Server pozná toto zariadenie, pripomienka o 19:00."; `lastDecision` →
  "Naposledy pre toto zariadenie: 19:10 – cieľ splnený" (reasons from the existing map); no `thisDevice` anywhere.
- [ ] Implement: `ReminderStatus` mirrors the server's; `describeStatus` first line from `subscribed`/`dropped`,
  then the cron line (global), then the device's last decision, then the rest as now.
  Texts: `sk` `thisDevice` → `Server pozná toto zariadenie, pripomienka o ${time}.`, new
  `decision: (time, reason) => \`Naposledy pre toto zariadenie: ${time} – ${reason}\``; `en` likewise
  (`The server knows this device; the reminder is at ${time}.`, `Last for this device: ${time} – ${reason}`).
- [ ] `npm test`, `npm run test:e2e` (Nastavenia → Pripomienka still renders, no move-here box) → pass.
  Commit: `feat(reminder): the status speaks of this device`.

### Task 8: Docs, privacy, setup and the whole check

**Files:** Modify `CLAUDE.md` (tech-stack row "Reminders" if present, else add: Web Push via `api/reminder.ts`,
one Supabase row per device, cron-job.org; remove the "reminder per user" item from the public-release list),
`docs/accounts-setup.md` (new section "Pripomienky pre všetkých": run the new SQL, add `SUPABASE_SERVICE_ROLE_KEY`,
redeploy, open the app, check Stav pripomienky, after a day remove Upstash), the privacy page text in both languages
(what a device row holds and when it is deleted), memory file for this project.

- [ ] Write the docs.
- [ ] `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` → all pass.
- [ ] One final review agent over the branch (Adam's preference allows one), fix what it finds.
- [ ] Commit: `docs(reminder): setup and privacy for reminders on every device`.
- [ ] Order of going live: Adam first runs the new SQL and adds `SUPABASE_SERVICE_ROLE_KEY` (the old code ignores
  both), then the push. Pushed earlier, the live reminder would answer `not-configured` until he does.
