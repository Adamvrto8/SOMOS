# Anonymous usage statistics — design

Date: 2026-10-25 · Status: approved by Adam in chat (random device id, a page in the app, via a Vercel function)
Builds on: [2026-10-24-reminders-for-everyone-design.md](2026-10-24-reminders-for-everyone-design.md) (Vercel
function + Supabase with the service role key, `push_rate_hit`).

## Goal

Adam wants to know **which exercises learners do and where they stop**: how many use the app, whether they come
back, where they leave the welcome, which exercise types are started and finished, at which task a lesson is
given up, and which parts of the app are opened at all. Only Adam sees the numbers, in the app.

Non-goals: numbers for learners, anything per account, what a learner answered, A/B tests, a consent dialog,
a hosted analytics service, live dashboards (a page that loads aggregates is enough).

## Decisions

1. **A random id per device**, made the first time the app sends anything (`crypto.randomUUID()`, localStorage
   `somos-usage-device`). It has nothing to do with the account, the reminder's device id or the sync state.
   Turning the statistics off forgets it; turning them on again makes a new one.
2. **On by default, with a switch** in Profil ("Anonymné štatistiky"), described in the privacy policy. No
   consent dialog (Adam's choice). Nothing is sent from the dev server (`import.meta.env.DEV`), so e2e runs and
   local work never count.
3. **Through a Vercel function `api/usage.ts`**, like the reminder: same-origin only, a rate limit per hashed IP
   (`push_rate_hit`), the service role key only on the server. The request carries no sign-in, so the server
   could not link an event to an account even by mistake. The IP address is not stored (only its hash in
   `push_rate`, for an hour).
4. **Supabase table `usage_events`**, no policies (only the service role writes). Rows older than 13 months are
   deleted by the daily cleanup the reminder tick already runs.
5. **The page reads aggregates only**, from a `security definer` function `usage_report(p_days)` that refuses
   every account not listed in `usage_admins`. Adam adds his account once in the SQL Editor.

## Events

| name | props | sent when |
|---|---|---|
| `open` | — | the app starts or comes back, at most once per local day |
| `welcome` | `step`: welcome · motivation · level · goal · reminder · install · ready · `done` | a welcome step is shown; `done` when it hands over to the first lesson |
| `lesson_start` | `type` (ExerciseType), `level`, `topic` (id or null), `source`: lesson · mistakes (Precvičiť chyby) · test (preparing for a test) · first (the welcome's first lesson) | a fresh lesson's tasks are ready (not its "repeat mistakes" rounds) |
| `lesson_end` | `type`, `level`, `total`, `answered`, `finished` (bool) | the result screen shows (`finished: true`) or the learner leaves through the ✕ (`false`, `answered` = tasks answered) |
| `screen` | `name`: home · search · word · topic · practice · grammar · tests · test · duel · archive · profile · review · stats | a route is entered (route pattern, never the id in it) |

A lesson closed with the app (no `lesson_end`) counts as **unfinished, step unknown** (`lesson_start` minus
`lesson_end`).

Every event also has `day` (the device's local date) and `at` (device time, ms). The server adds the receive
time, and the batch carries `version` (the build's commit) and `language` (sk / en). Nothing else: no IP,
account, user agent, word ids or answers.

## Client — `src/lib/usage.ts`

- `track(name, props)` appends to a queue in localStorage (`somos-usage-queue`, at most 200 events; the oldest
  drop first). Does nothing when off, on the dev server, or without localStorage (wrapped in try/catch).
- `open` is deduplicated by the last day stored in `somos-usage-open`.
- **Flush**: on start (after the app has rendered), and when the page goes hidden
  (`visibilitychange`), `fetch('/api/usage', { method: 'POST', keepalive: true })` with up to 100 events. The
  queue is cleared only after a 2xx; a failure keeps it for the next flush. Offline it simply waits.
- `usageOn()` / `setUsageOn(bool)` + a hook for the switch; off clears the queue and the device id.
- Calls: `open` in the app shell, `screen` from a small route listener, `welcome` from `WelcomePage` steps,
  `lesson_start` / `lesson_end` from `LessonPage`.

## Server — `api/usage.ts`

- `POST` only, same-origin, body ≤ 32 KB: `{ device, version, language, events: [{ name, day, at, props }] }`.
- Validation: `device` is a UUID, `language` sk | en, `version` ≤ 40 chars, 1–100 events, every name in the
  table above, props exactly the listed keys with the listed values (types from a list, levels A1–B2, steps,
  screen names, numbers 0–100, topic ids `^[a-z0-9-]{1,40}$`), `day` `YYYY-MM-DD`. One invalid event → 400 for
  the batch (the client's bug, not worth half-storing).
- Rate limit: `push_rate_hit('usage:' + hash(ip), 120)` per hour; over it → 429, the client keeps the queue.
- Inserts the rows with the service role key; answers `204`.
- Kept free of local imports (Vercel deploys it as one file), tested in `api/_usage.test.ts`.

## Database — `supabase/schema.sql`

```sql
usage_events (id bigint identity, device uuid, day date, received_at timestamptz default now(),
              name text, props jsonb, version text, language text)
  index on (day), index on (device, day)
usage_admins (user_id uuid primary key references auth.users on delete cascade)
```

RLS on both, no policies; `service_role` may insert into `usage_events`. `push_cleanup()` also deletes
`usage_events` older than 13 months.

`usage_report(p_days integer) returns jsonb`, `security definer`, granted to `authenticated`; raises
`forbidden` unless `auth.uid()` is in `usage_admins`. It returns:

- `active`: per day of the last `p_days`, distinct devices with any event;
- `devices`: new devices in the period (first event ever falls in it), how many came back the next day, and
  how many came back within 7 days (only devices first seen ≥ 7 days ago count in the second);
- `welcome`: distinct devices per step, in step order;
- `lessons`: per `type` and per `level`: started, finished, left through ✕, and the most common `answered` among
  the ✕ ones;
- `screens`: distinct devices per screen name.

## The page — Profil → Nástroje pre vývoj → Štatistiky používania

Shown only when signed in. Period chips 7 / 30 / 90 days, then the five blocks above: a small bar chart of
active devices, the return numbers, the welcome funnel as bars, a table of exercise types (started, finished %,
usual stop), the same per level, and screens. Fewer than 5 devices in the period → "Zatiaľ málo údajov" instead
of percentages. `forbidden` → "Tento účet nemá prístup." Offline / error → the usual retry message.

## Settings

Profil gets a row **Anonymné štatistiky** (switch on its subpage, a two-sentence explanation and a link to
`/privacy`). Its value is a device setting, not synced or backed up (it is about this device).

## Privacy policy

A section "Anonymné štatistiky" (what is sent, that it is not linked to the account, 13 months, the switch).
The rest of the policy update (controller and contact, duels, legal basis) follows in the same change.

## Setup for Adam (docs/usage-stats-setup.md)

1. Run `supabase/schema.sql` again in the SQL Editor.
2. `insert into public.usage_admins (user_id) select id from auth.users where email = '<his e-mail>';`
3. Nothing in Vercel: the function uses `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` like the reminder.

## Testing

- Unit: `usage.test.ts` (queue cap, `open` once a day, off forgets id and queue, flush keeps the queue on
  failure, nothing on the dev server); `api/_usage.test.ts` (validation per event, same-origin, rate limit,
  rows written).
- E2E: the switch in Profil turns off and on; no request to `/api/usage` from the dev server.
- `usage_report` is SQL: checked by hand on Adam's Supabase after the first events arrive.
