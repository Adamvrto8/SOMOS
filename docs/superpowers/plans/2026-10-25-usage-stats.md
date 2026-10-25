# Anonymous Usage Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Learners' devices send anonymous usage events (opens, welcome steps, lessons, screens) to Supabase through a Vercel function, and Adam reads the aggregates on a page in Nástroje pre vývoj.

**Architecture:** `src/lib/usage.ts` queues events in localStorage under a random device id and flushes them in batches to `api/usage.ts`, which validates them and inserts them into `usage_events` with the service role key. `usage_report(p_days)` (security definer, only accounts in `usage_admins`) returns aggregates as JSON; `src/features/settings/UsageStats.tsx` shows them.

**Tech Stack:** React + TypeScript (Vite), Vercel functions (Web `Request`/`Response`), Supabase Postgres via PostgREST, Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-10-25-usage-stats-design.md](../specs/2026-10-25-usage-stats-design.md)

## Global Constraints

- UI strings in Slovak (`src/i18n/sk.ts`) with the English twin in `src/i18n/en.ts` (`Dictionary = typeof sk`); code and comments in English.
- Nothing is queued or sent on the dev server (`import.meta.env.DEV`) or in Vitest.
- No account id, IP, user agent, word ids or answers in any event; the request to `/api/usage` carries no Authorization header.
- `api/*.ts` files have no local imports (Vercel deploys each as one file); tests are `api/_*.test.ts`.
- Event names and props exactly as the spec's table; levels A1–B2; exercise types are `ExerciseType` from `src/lib/lesson.ts`.
- Rows older than 13 months are deleted; the device id is forgotten when the learner turns statistics off.
- Never stage `CLAUDE.md`, `.gitignore`, `docs/accounts-setup.md`, `poznaky.txt` (Adam's uncommitted edits): `git add` explicit paths only.
- Before pushing: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e -- --workers=2`.

## Review Focus

- A server 400 for a batch (old client after a schema change) must not leave the queue stuck forever → the client drops that batch (Task 2 test "drops a batch the server refuses").
- localStorage unavailable or full (private mode) must never throw into the app → every storage access is wrapped (Task 2 test "works without storage").
- Swiping through words on Detail slova must not send one `screen` event per word → consecutive same screens dedupe (Task 3 test "same screen twice counts once").
- A correction round ("Opraviť chyby") or a passed lesson's overview must not count as a new lesson → `lesson_start` only for fresh lessons (Task 4, e2e-free; checked by code review against the spec table).
- A signed-in account not in `usage_admins` opening the page sees "Tento účet nemá prístup.", not a crash or empty charts (Task 6 test of `parseReportError`).

---

### Task 1: Server — table, report function, Vercel function

**Files:**
- Modify: `supabase/schema.sql` (new section before "Practice reminders"; `push_cleanup` gets one line)
- Create: `api/usage.ts`
- Test: `api/_usage.test.ts`

**Interfaces:**
- Produces: `POST /api/usage` with body `UsageBatch` → 204 stored · 400 invalid · 403 not same-origin · 405 not POST · 413 too big · 429 rate limit · 503 not configured.
- Produces (SQL): `public.usage_report(p_days integer) returns jsonb` → `UsageReport` (shape in Task 6).

- [ ] **Step 1: Schema.** In `supabase/schema.sql`, before the line `-- Practice reminders, one row per device`, add:

```sql
-- ---------------------------------------------------------------------------------------------------------
-- Anonymous usage statistics (docs/superpowers/specs/2026-10-25-usage-stats-design.md). A random id per device,
-- never the account. Only api/usage.ts writes (service role); only accounts in usage_admins read the aggregates.

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  device uuid not null,
  day date not null,                       -- the device's local date
  received_at timestamptz not null default now(),
  name text not null,                      -- open, welcome, lesson_start, lesson_end, screen
  props jsonb not null default '{}'::jsonb,
  version text not null,                   -- the build's commit
  language text not null                   -- sk, en
);
create index if not exists usage_events_day on public.usage_events (day);
create index if not exists usage_events_device_day on public.usage_events (device, day);

create table if not exists public.usage_admins (user_id uuid primary key references auth.users on delete cascade);

alter table public.usage_events enable row level security;
alter table public.usage_admins enable row level security;
revoke all on public.usage_events, public.usage_admins from anon, authenticated;
grant select, insert, delete on public.usage_events to service_role;

-- What Profil → Nástroje pre vývoj → Štatistiky používania shows, for the last p_days days (1–400).
create or replace function public.usage_report(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare since date := current_date - (least(greatest(coalesce(p_days, 30), 1), 400) - 1);
begin
  if not exists (select 1 from public.usage_admins where user_id = (select auth.uid())) then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'since', since,
    'devices', (select count(distinct device) from public.usage_events where day >= since),
    'active', (select coalesce(jsonb_agg(jsonb_build_object('day', a.day, 'devices', a.n) order by a.day), '[]'::jsonb)
               from (select day, count(distinct device) as n from public.usage_events where day >= since group by day) a),
    'returning', (
      with firsts as (select device, min(day) as first from public.usage_events group by device)
      select jsonb_build_object(
        'new', count(*) filter (where f.first >= since),
        'nextDay', count(*) filter (where f.first >= since and exists (
          select 1 from public.usage_events e where e.device = f.device and e.day = f.first + 1)),
        'weekOld', count(*) filter (where f.first >= since and f.first <= current_date - 7),
        'withinWeek', count(*) filter (where f.first >= since and f.first <= current_date - 7 and exists (
          select 1 from public.usage_events e where e.device = f.device and e.day between f.first + 1 and f.first + 7)))
      from firsts f),
    'welcome', (select coalesce(jsonb_object_agg(w.step, w.n), '{}'::jsonb)
                from (select props->>'step' as step, count(distinct device) as n from public.usage_events
                      where name = 'welcome' and day >= since group by 1) w),
    'lessons', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from (
        select case when grouping(props->>'level') = 1 then 'type' else 'level' end as "by",
               case when grouping(props->>'level') = 1 then props->>'type' else coalesce(props->>'level', '-') end as "key",
               count(*) filter (where name = 'lesson_start') as started,
               count(*) filter (where name = 'lesson_end' and (props->>'finished')::boolean) as finished,
               count(*) filter (where name = 'lesson_end' and not (props->>'finished')::boolean) as quit,
               mode() within group (order by (props->>'answered')::int)
                 filter (where name = 'lesson_end' and not (props->>'finished')::boolean) as "usualStop"
        from public.usage_events where name in ('lesson_start', 'lesson_end') and day >= since
        group by grouping sets ((props->>'type'), (props->>'level'))) l),
    'screens', (select coalesce(jsonb_object_agg(s.screen, s.n), '{}'::jsonb)
                from (select props->>'name' as screen, count(distinct device) as n from public.usage_events
                      where name = 'screen' and day >= since group by 1) s)
  );
end $$;

revoke execute on function public.usage_report(integer) from public, anon;
grant execute on function public.usage_report(integer) to authenticated;
```

In `push_cleanup()` add after the `push_rate` line:

```sql
  delete from public.usage_events where day < current_date - interval '13 months';
```

- [ ] **Step 2: Write the failing tests** in `api/_usage.test.ts`:

```ts
// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it, vi } from 'vitest'
import { BATCHES_PER_HOUR, handleUsage, MAX_EVENTS, parseBatch, type UsageDeps, type UsageRow } from './usage.ts'

const DEVICE = '0b6f3a52-5c1e-4d7a-9a51-2f0d1c9e8b11'
const batch = (events: unknown[] = [{ name: 'open', day: '2026-10-25', at: 1, props: {} }]) => ({ device: DEVICE, version: 'abc1234', language: 'sk', events })
const post = (body: unknown, headers: Record<string, string> = { origin: 'https://somos.app', host: 'somos.app' }) =>
  new Request('https://somos.app/api/usage', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })

function deps(over: Partial<UsageDeps> = {}) {
  const rows: UsageRow[] = []
  const d: UsageDeps = { insert: vi.fn(async (r: UsageRow[]) => void rows.push(...r)), rateHit: vi.fn(async () => true), ipKey: () => 'usage:x', ...over }
  return { d, rows }
}

describe('parseBatch', () => {
  it('takes every event of the spec', () => {
    const events = [
      { name: 'open', day: '2026-10-25', at: 1, props: {} },
      { name: 'welcome', day: '2026-10-25', at: 1, props: { step: 'done' } },
      { name: 'lesson_start', day: '2026-10-25', at: 1, props: { type: 'cloze', level: 'B2', topic: 'food', source: 'first' } },
      { name: 'lesson_start', day: '2026-10-25', at: 1, props: { type: 'conjugation', level: null, topic: null, source: 'mistakes' } },
      { name: 'lesson_end', day: '2026-10-25', at: 1, props: { type: 'builder', level: 'A1', total: 10, answered: 3, finished: false } },
      { name: 'screen', day: '2026-10-25', at: 1, props: { name: 'duel' } },
    ]
    expect(parseBatch(batch(events))?.events).toHaveLength(6)
  })
  it.each([
    ['an unknown event', { name: 'click', day: '2026-10-25', at: 1, props: {} }],
    ['an extra prop', { name: 'open', day: '2026-10-25', at: 1, props: { user: 'x' } }],
    ['a missing prop', { name: 'screen', day: '2026-10-25', at: 1, props: {} }],
    ['an unknown screen', { name: 'screen', day: '2026-10-25', at: 1, props: { name: 'word/casa' } }],
    ['a bad level', { name: 'lesson_end', day: '2026-10-25', at: 1, props: { type: 'cloze', level: 'C1', total: 10, answered: 10, finished: true } }],
    ['a count over 100', { name: 'lesson_end', day: '2026-10-25', at: 1, props: { type: 'cloze', level: 'A1', total: 101, answered: 1, finished: false } }],
    ['a bad day', { name: 'open', day: '25.10.2026', at: 1, props: {} }],
  ])('refuses the batch with %s', (_, event) => {
    expect(parseBatch(batch([event]))).toBeNull()
  })
  it('refuses a bad device, language, empty or too long batch', () => {
    expect(parseBatch({ ...batch(), device: 'abc' })).toBeNull()
    expect(parseBatch({ ...batch(), language: 'de' })).toBeNull()
    expect(parseBatch(batch([]))).toBeNull()
    expect(parseBatch(batch(Array(MAX_EVENTS + 1).fill({ name: 'open', day: '2026-10-25', at: 1, props: {} })))).toBeNull()
  })
})

describe('handleUsage', () => {
  it('stores the events as rows and answers 204', async () => {
    const { d, rows } = deps()
    const res = await handleUsage(post(batch()), d)
    expect(res.status).toBe(204)
    expect(rows).toEqual([{ device: DEVICE, day: '2026-10-25', name: 'open', props: {}, version: 'abc1234', language: 'sk' }])
  })
  it('refuses other sites, other methods, bad and big bodies', async () => {
    const { d } = deps()
    expect((await handleUsage(post(batch(), { origin: 'https://evil.example', host: 'somos.app' }), d)).status).toBe(403)
    expect((await handleUsage(new Request('https://somos.app/api/usage'), d)).status).toBe(405)
    expect((await handleUsage(post('{'), d)).status).toBe(400)
    expect((await handleUsage(post('x'.repeat(40_000)), d)).status).toBe(413)
    expect(d.insert).not.toHaveBeenCalled()
  })
  it('stops at the hourly limit', async () => {
    const { d } = deps({ rateHit: vi.fn(async () => false) })
    expect((await handleUsage(post(batch()), d)).status).toBe(429)
    expect(d.rateHit).toHaveBeenCalledWith('usage:x', BATCHES_PER_HOUR)
    expect(d.insert).not.toHaveBeenCalled()
  })
  it('answers 503 without configuration', async () => {
    expect((await handleUsage(post(batch()), undefined)).status).toBe(503)
  })
})
```

- [ ] **Step 3: Run** `npx vitest run api/_usage.test.ts` — expected FAIL (cannot find `./usage.ts`).

- [ ] **Step 4: Implement** `api/usage.ts`:

```ts
// Vercel function: anonymous usage statistics (docs/superpowers/specs/2026-10-25-usage-stats-design.md).
//   POST /api/usage from the app (same-origin): { device, version, language, events: [{ name, day, at, props }] }
// Rows go to Supabase usage_events with the service role key. No account, no IP: the IP only counts the hourly
// limit, as a keyed hash in push_rate. Kept free of local imports so Vercel can deploy it as a single file.
import { createHmac } from 'node:crypto'

export const MAX_EVENTS = 100
export const MAX_BODY = 32_000
export const BATCHES_PER_HOUR = 120
const REQUEST_TIMEOUT_MS = 8000

type Props = Record<string, string | number | boolean | null>
export interface UsageEvent { name: string; day: string; at: number; props: Props }
export interface UsageBatch { device: string; version: string; language: 'sk' | 'en'; events: UsageEvent[] }
export interface UsageRow { device: string; day: string; name: string; props: Props; version: string; language: string }

export interface UsageDeps {
  insert(rows: UsageRow[]): Promise<void>
  rateHit(key: string, limit: number): Promise<boolean>
  ipKey(request: Request): string
}

// The lists mirror src/lib/lesson.ts (ExerciseType), src/data/types.ts (Level), the welcome's steps and screenOf().
const TYPES = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking']
const LEVELS = ['A1', 'A2', 'B1', 'B2']
const STEPS = ['welcome', 'motivation', 'level', 'goal', 'reminder', 'install', 'ready', 'done']
const SCREENS = ['home', 'search', 'word', 'topic', 'practice', 'grammar', 'tests', 'test', 'duel', 'archive', 'profile', 'review', 'stats']
const SOURCES = ['lesson', 'mistakes', 'test', 'first']

type Check = (value: unknown) => boolean
const oneOf = (list: string[]): Check => (v) => typeof v === 'string' && list.includes(v)
const orNull = (check: Check): Check => (v) => v === null || check(v)
const count: Check = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100
const bool: Check = (v) => typeof v === 'boolean'
const topic: Check = (v) => typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v)

/** Every event and exactly the props it has. */
const EVENTS: Record<string, Record<string, Check>> = {
  open: {},
  welcome: { step: oneOf(STEPS) },
  lesson_start: { type: oneOf(TYPES), level: orNull(oneOf(LEVELS)), topic: orNull(topic), source: oneOf(SOURCES) },
  lesson_end: { type: oneOf(TYPES), level: orNull(oneOf(LEVELS)), total: count, answered: count, finished: bool },
  screen: { name: oneOf(SCREENS) },
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isEvent(v: unknown): v is UsageEvent {
  if (!isRecord(v) || typeof v.name !== 'string' || !Object.hasOwn(EVENTS, v.name)) return false
  if (typeof v.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.day) || typeof v.at !== 'number' || !Number.isFinite(v.at)) return false
  const checks = EVENTS[v.name]
  const props = v.props
  if (!isRecord(props) || Object.keys(props).length !== Object.keys(checks).length) return false
  return Object.entries(checks).every(([key, check]) => Object.hasOwn(props, key) && check(props[key]))
}

/** The batch, or null when anything in it is not as the app sends it: one bad event refuses the whole batch. */
export function parseBatch(body: unknown): UsageBatch | null {
  if (!isRecord(body)) return null
  const { device, version, language, events } = body
  if (typeof device !== 'string' || !UUID.test(device)) return null
  if (typeof version !== 'string' || version.length < 1 || version.length > 40) return null
  if (language !== 'sk' && language !== 'en') return null
  if (!Array.isArray(events) || events.length < 1 || events.length > MAX_EVENTS || !events.every(isEvent)) return null
  return { device, version, language, events }
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Browsers send Origin on POST: only pages of this same deployment may send statistics. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

export async function handleUsage(request: Request, deps: UsageDeps | undefined): Promise<Response> {
  if (!deps) return json({ error: 'not-configured' }, 503)
  if (request.method !== 'POST') return json({ error: 'method' }, 405)
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  try {
    const text = await request.text()
    if (text.length > MAX_BODY) return json({ error: 'too-big' }, 413)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return json({ error: 'bad-request' }, 400)
    }
    const batch = parseBatch(body)
    if (!batch) return json({ error: 'bad-request' }, 400)
    if (!(await deps.rateHit(deps.ipKey(request), BATCHES_PER_HOUR))) return json({ error: 'too-many' }, 429)
    await deps.insert(
      batch.events.map((e) => ({ device: batch.device, day: e.day, name: e.name, props: e.props, version: batch.version, language: batch.language })),
    )
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('usage failed', error)
    return json({ error: 'failed' }, 500)
  }
}

/** SUPABASE_URL, or the app's own VITE_SUPABASE_URL (Vercel gives functions every variable). */
export function depsFromEnv(env: Record<string, string | undefined>): UsageDeps | undefined {
  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY
  if (!url || !key) return undefined
  const call = async (path: string, body: unknown, prefer?: string) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`)
    return res
  }
  return {
    insert: async (rows) => void (await call('usage_events', rows, 'return=minimal')),
    rateHit: async (rateKey, limit) => (await (await call('rpc/push_rate_hit', { p_key: rateKey, p_limit: limit })).json()) === true,
    ipKey: (request) => {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
      return `usage:${createHmac('sha256', `somos-usage:${key}`).update(ip).digest('hex').slice(0, 32)}`
    },
  }
}

export function POST(request: Request): Promise<Response> {
  return handleUsage(request, depsFromEnv(process.env))
}

export function GET(request: Request): Promise<Response> {
  return handleUsage(request, depsFromEnv(process.env))
}
```

- [ ] **Step 5: Run** `npx vitest run api/_usage.test.ts` — expected PASS. Then `npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql api/usage.ts api/_usage.test.ts
git commit -m "feat(usage): usage_events table, usage_report and the /api/usage function"
```

---

### Task 2: Client queue — `src/lib/usage.ts`

**Files:**
- Create: `src/lib/usage.ts`
- Test: `src/lib/usage.test.ts`

**Interfaces:**
- Consumes: `POST /api/usage` (Task 1); `dayKey(date)` from `src/lib/dates.ts`; `getLanguage()` from `src/lib/language.ts`.
- Produces: `createUsage(env: UsageEnv)`; module exports `track(name, props?)`, `trackScreen(pathname)`, `startUsage()`, `setUsageOn(on)`, `useUsageOn(): boolean`, `screenOf(pathname): Screen | null`, types `UsageProps`, `Screen`.

- [ ] **Step 1: Write the failing tests** `src/lib/usage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createUsage, MAX_QUEUE, screenOf, type SendResult, type UsageEnv } from './usage'

function memoryStorage() {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map }
}

function setup(over: Partial<UsageEnv> = {}) {
  const storage = memoryStorage()
  const sent: { device: string; events: { name: string; day: string }[] }[] = []
  let result: SendResult = 'sent'
  let clock = new Date(2026, 9, 25, 10, 0)
  const env: UsageEnv = {
    storage,
    send: vi.fn(async (body: string) => {
      sent.push(JSON.parse(body))
      return result
    }),
    live: true,
    now: () => clock,
    version: 'abc1234',
    language: () => 'sk',
    newId: () => '0b6f3a52-5c1e-4d7a-9a51-2f0d1c9e8b11',
    ...over,
  }
  return { usage: createUsage(env), env, storage, sent, setResult: (r: SendResult) => (result = r), setClock: (d: Date) => (clock = d) }
}

describe('usage queue', () => {
  it('sends the queued events in one batch with the device id, and empties the queue', async () => {
    const { usage, sent } = setup()
    usage.track('screen', { name: 'search' })
    usage.track('welcome', { step: 'goal' })
    await usage.flush()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ device: '0b6f3a52-5c1e-4d7a-9a51-2f0d1c9e8b11', version: 'abc1234', language: 'sk' })
    expect(sent[0].events.map((e) => e.name)).toEqual(['screen', 'welcome'])
    expect(sent[0].events[0].day).toBe('2026-10-25')
    await usage.flush()
    expect(sent).toHaveLength(1) // nothing left
  })

  it('keeps the queue when sending fails, and drops a batch the server refuses', async () => {
    const { usage, sent, setResult } = setup()
    usage.track('open')
    setResult('retry')
    await usage.flush()
    setResult('sent')
    await usage.flush()
    expect(sent).toHaveLength(2)
    usage.track('open')
    setResult('drop')
    await usage.flush()
    setResult('sent')
    await usage.flush()
    expect(sent).toHaveLength(3) // the refused one is gone
  })

  it(`keeps at most ${MAX_QUEUE} events, the newest`, async () => {
    const { usage, sent } = setup()
    for (let i = 0; i <= MAX_QUEUE; i++) usage.track('screen', { name: i === MAX_QUEUE ? 'duel' : 'home' })
    await usage.flush()
    await usage.flush()
    const events = sent.flatMap((b) => b.events)
    expect(events).toHaveLength(MAX_QUEUE)
    expect(events.at(-1)).toMatchObject({ name: 'screen' })
  })

  it('counts open once a day', async () => {
    const { usage, sent, setClock } = setup()
    usage.trackOpen()
    usage.trackOpen()
    setClock(new Date(2026, 9, 26, 9, 0))
    usage.trackOpen()
    await usage.flush()
    expect(sent[0].events.map((e) => e.day)).toEqual(['2026-10-25', '2026-10-26'])
  })

  it('off: nothing is kept, the device id and the queue are forgotten; on again makes a new id', async () => {
    let n = 0
    const { usage, sent, storage } = setup({ newId: () => `0b6f3a52-5c1e-4d7a-9a51-2f0d1c9e8b1${n++}` })
    usage.track('open')
    await usage.flush()
    usage.track('screen', { name: 'home' })
    usage.setOn(false)
    expect(usage.isOn()).toBe(false)
    usage.track('screen', { name: 'home' })
    await usage.flush()
    expect(sent).toHaveLength(1)
    expect(storage.map.has('somos-usage-device')).toBe(false)
    usage.setOn(true)
    usage.track('open')
    await usage.flush()
    expect(sent[1].device).not.toBe(sent[0].device)
  })

  it('does nothing on the dev server', async () => {
    const { usage, env } = setup({ live: false })
    usage.track('open')
    await usage.flush()
    expect(env.send).not.toHaveBeenCalled()
  })

  it('works without storage', async () => {
    const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
    const { usage } = setup({ storage: throwing })
    expect(() => usage.track('open')).not.toThrow()
    await expect(usage.flush()).resolves.toBeUndefined()
  })
})

describe('screens', () => {
  it('names the route without its id', () => {
    expect(screenOf('/')).toBe('home')
    expect(screenOf('/word/casa')).toBe('word')
    expect(screenOf('/practice/grammar/ser-estar')).toBe('grammar')
    expect(screenOf('/practice/tests')).toBe('tests')
    expect(screenOf('/practice/test')).toBe('test')
    expect(screenOf('/duel/ABC123')).toBe('duel')
    expect(screenOf('/profile/goal')).toBe('profile')
    expect(screenOf('/practice/lesson')).toBeNull() // lessons have their own events
    expect(screenOf('/welcome')).toBeNull()
  })

  it('same screen twice counts once', async () => {
    const { usage, sent } = setup()
    usage.trackScreen('/word/casa')
    usage.trackScreen('/word/carro')
    usage.trackScreen('/search')
    usage.trackScreen('/word/casa')
    await usage.flush()
    expect(sent[0].events.map((e) => (e as unknown as { props: { name: string } }).props.name)).toEqual(['word', 'search', 'word'])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/usage.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/usage.ts`:

```ts
import { useSyncExternalStore } from 'react'
import { dayKey } from './dates'
import { getLanguage } from './language'

// Anonymous usage statistics (docs/superpowers/specs/2026-10-25-usage-stats-design.md): which exercises are done
// and where learners stop. A random id per device, never the account; events wait in localStorage and go in
// batches to api/usage.ts. Nothing on the dev server or in tests; the learner can turn it off in Profil.

export type UsageProps = Record<string, string | number | boolean | null>
interface QueuedEvent { name: string; day: string; at: number; props: UsageProps }

/** What the server said about a batch: stored, try again later, or never (it is invalid: dropped). */
export type SendResult = 'sent' | 'retry' | 'drop'

export interface UsageEnv {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  send(body: string): Promise<SendResult>
  live: boolean
  now(): Date
  version: string
  language(): string
  newId(): string
}

const KEYS = { off: 'somos-usage-off', device: 'somos-usage-device', queue: 'somos-usage-queue', open: 'somos-usage-open' }
export const MAX_QUEUE = 200
const BATCH = 100

export type Screen = 'home' | 'search' | 'word' | 'topic' | 'practice' | 'grammar' | 'tests' | 'test' | 'duel' | 'archive' | 'profile' | 'review' | 'stats'

// First match wins; the lesson and the welcome have their own events.
const SCREENS: [RegExp, Screen][] = [
  [/^\/$/, 'home'],
  [/^\/search\/?$/, 'search'],
  [/^\/word\//, 'word'],
  [/^\/topic\//, 'topic'],
  [/^\/practice\/?$/, 'practice'],
  [/^\/practice\/grammar(\/|$)/, 'grammar'],
  [/^\/practice\/tests\/?$/, 'tests'],
  [/^\/practice\/test\/?$/, 'test'],
  [/^\/duel(\/|$)/, 'duel'],
  [/^\/archive(\/|$)/, 'archive'],
  [/^\/profile(\/|$)/, 'profile'],
  [/^\/review\/?$/, 'review'],
  [/^\/stats\/?$/, 'stats'],
]

/** The screen of a path, without the word, topic or room in it; null for screens not counted. */
export function screenOf(pathname: string): Screen | null {
  return SCREENS.find(([pattern]) => pattern.test(pathname))?.[1] ?? null
}

export function createUsage(env: UsageEnv) {
  const get = (key: string) => {
    try {
      return env.storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  const set = (key: string, value: string) => {
    try {
      env.storage?.setItem(key, value)
    } catch {
      // Full or blocked storage: the statistics just miss this.
    }
  }
  const remove = (key: string) => {
    try {
      env.storage?.removeItem(key)
    } catch {
      // Nothing to forget.
    }
  }
  const readQueue = (): QueuedEvent[] => {
    try {
      const parsed: unknown = JSON.parse(get(KEYS.queue) ?? '[]')
      return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : []
    } catch {
      return []
    }
  }
  const isOn = () => get(KEYS.off) === null
  let sending = false
  let lastScreen: Screen | null = null

  const track = (name: string, props: UsageProps = {}) => {
    if (!env.live || !isOn()) return
    const now = env.now()
    set(KEYS.queue, JSON.stringify([...readQueue(), { name, day: dayKey(now), at: now.getTime(), props }].slice(-MAX_QUEUE)))
  }

  return {
    isOn,
    track,
    /** At most once a local day: "used the app that day". */
    trackOpen() {
      if (!env.live || !isOn()) return
      const day = dayKey(env.now())
      if (get(KEYS.open) === day) return
      set(KEYS.open, day)
      track('open')
    },
    /** A route entered; the same screen again (swiping through words) counts once. */
    trackScreen(pathname: string) {
      const screen = screenOf(pathname)
      if (!screen || screen === lastScreen) return
      lastScreen = screen
      track('screen', { name: screen })
    },
    setOn(on: boolean) {
      if (on) return remove(KEYS.off)
      set(KEYS.off, '1')
      remove(KEYS.device)
      remove(KEYS.queue)
      remove(KEYS.open)
    },
    async flush(): Promise<void> {
      if (!env.live || !isOn() || sending) return
      const batch = readQueue().slice(0, BATCH)
      if (!batch.length) return
      let device = get(KEYS.device)
      if (!device) {
        device = env.newId()
        set(KEYS.device, device)
      }
      sending = true
      try {
        const result = await env.send(JSON.stringify({ device, version: env.version, language: env.language(), events: batch }))
        // Events tracked meanwhile were appended after the batch: only the batch leaves.
        if (result !== 'retry') set(KEYS.queue, JSON.stringify(readQueue().slice(batch.length)))
      } catch {
        // Offline or the server down: the queue waits for the next flush.
      } finally {
        sending = false
      }
    },
  }
}

async function send(body: string): Promise<SendResult> {
  try {
    // keepalive: the request survives the page going away, which is when the queue is flushed.
    const res = await fetch('/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
    if (res.ok) return 'sent'
    return res.status === 400 || res.status === 413 ? 'drop' : 'retry'
  } catch {
    return 'retry'
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

const usage = createUsage({
  storage: localStorageOrNull(),
  send,
  live: !import.meta.env.DEV,
  now: () => new Date(),
  version: __APP_VERSION__,
  language: getLanguage,
  newId: () => crypto.randomUUID(),
})

const listeners = new Set<() => void>()

export const track = usage.track
export const trackScreen = usage.trackScreen

export function setUsageOn(on: boolean) {
  usage.setOn(on)
  listeners.forEach((notify) => notify())
}

export function useUsageOn(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    usage.isOn,
  )
}

/** From main.tsx: today's open, the queue left from last time, and a flush whenever the app goes to the background. */
export function startUsage() {
  usage.trackOpen()
  void usage.flush()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void usage.flush()
    else usage.trackOpen()
  })
}
```

Note: `useSyncExternalStore`'s unsubscribe must return void: write `return () => { listeners.delete(notify) }` if lint complains.

- [ ] **Step 4: Run** `npx vitest run src/lib/usage.test.ts` — expected PASS. Then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/usage.ts src/lib/usage.test.ts
git commit -m "feat(usage): the event queue on the device"
```

---

### Task 3: Opens and screens

**Files:**
- Modify: `src/main.tsx` (call `startUsage()`), `src/App.tsx` (router subscription)

**Interfaces:**
- Consumes: `startUsage()`, `trackScreen(pathname)` (Task 2).

- [ ] **Step 1:** In `src/main.tsx` import `startUsage` from `./lib/usage` and call it after `watchKeyboard()`:

```ts
// Anonymous usage statistics: today's open and last session's queue (nothing on the dev server).
startUsage()
```

- [ ] **Step 2:** In `src/App.tsx`, after `const router = createBrowserRouter(...)`:

```ts
// Usage statistics: every screen entered (src/lib/usage.ts names it without its id).
trackScreen(router.state.location.pathname)
router.subscribe((state) => trackScreen(state.location.pathname))
```

and `import { trackScreen } from './lib/usage'`.

- [ ] **Step 3:** `npm run lint && npx tsc -b` — expected clean.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat(usage): count opens and screens"
```

---

### Task 4: Welcome and lesson events

**Files:**
- Modify: `src/features/onboarding/WelcomePage.tsx`, `src/lib/onboarding.ts` (`finishOnboarding`), `src/features/exercises/LessonPage.tsx`

**Interfaces:**
- Consumes: `track(name, props)` (Task 2).

- [ ] **Step 1: Welcome steps.** In `WelcomePage`, after `const index = steps.indexOf(step)`:

```ts
useEffect(() => {
  if (!alreadyDone) track('welcome', { step })
}, [step, alreadyDone])
```

(`alreadyDone` is declared below `index`; place the effect after the `useState` line that declares it, before the early returns. Import `useEffect` and `track`.)

- [ ] **Step 2: Welcome done.** In `src/lib/onboarding.ts` `finishOnboarding()`, before `save(...)`: `track('welcome', { step: 'done' })`, with `import { track } from './usage'`. (RestorePage's call counts too: a returning learner finished the welcome by signing in.)

- [ ] **Step 3: Lesson start.** In `LessonPage`, add below `const group = ...`:

```ts
const source = firstLesson ? 'first' : fromMistakes ? 'mistakes' : preparing ? 'test' : 'lesson'
const lessonProps = { type: filter.type, level: filter.level ?? null }
/** A fresh lesson (not a correction round, not a passed lesson's overview): counted for the usage statistics. */
const trackStart = (count: number) => {
  if (count > 0) track('lesson_start', { ...lessonProps, topic: filter.topic && filter.topic !== 'all' ? filter.topic : null, source })
}
```

Call it:
- in the `buildLesson(...).then` of the entry `useEffect`, after `setOverview(...)`: `if (!(record?.passed && next.length > 0)) trackStart(next.length)`;
- on the overview's "Opakovať" button: `onClick={() => { setOverview(null); trackStart(total) }}`;
- in `onRepeatAll` and `onNewLesson` where `start(next, …)` / `start(retryTasks(tasks))` is called: `trackStart(next.length)` / `trackStart(tasks.length)`.

`source`/`lessonProps`/`trackStart` are recomputed every render: fine, they are cheap; the entry effect's dependency list stays as it is (add `// eslint`-free: oxlint does not check exhaustive deps here — verify with `npm run lint`).

- [ ] **Step 4: Lesson end.**

```ts
// The result screen of a lesson (not of a correction round).
useEffect(() => {
  if (finished && round !== 'fix') track('lesson_end', { ...lessonProps, total, answered: answers.length, finished: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per result screen
}, [finished])
```

Only add the disable comment if lint asks for it. In `exit()`, first line:

```ts
if (tasks && total > 0 && !finished && !overview && round !== 'fix') track('lesson_end', { ...lessonProps, total, answered: answers.length, finished: false })
```

Clamp: `total` and `answered` are ≤ 100 by the server's check; lessons have 10–20 tasks, so `Math.min(…, 100)` on both to be safe.

- [ ] **Step 5:** `npm run lint && npx tsc -b && npm test` — expected clean/green; then `npx playwright test e2e/lesson.spec.ts e2e/onboarding.spec.ts --workers=2` — expected PASS (nothing is sent on the dev server, behaviour unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/WelcomePage.tsx src/lib/onboarding.ts src/features/exercises/LessonPage.tsx
git commit -m "feat(usage): welcome steps and lessons started and ended"
```

---

### Task 5: The switch in Profil

**Files:**
- Create: `src/features/settings/UsageSettings.tsx`
- Modify: `src/features/settings/SettingsPage.tsx` (row in the "Údaje" group), `src/features/settings/SettingsSectionPage.tsx` (`usage` section), `src/i18n/sk.ts`, `src/i18n/en.ts`
- Test: `e2e/settings.spec.ts`

- [ ] **Step 1: Texts.** In `sk.ts` under `settings`, after `backup`'s block, add:

```ts
    usage: {
      title: 'Anonymné štatistiky',
      toggle: 'Posielať anonymné štatistiky',
      toggleHint: 'Ktoré cvičenia robíš a kde lekciu ukončíš, bez mena, e-mailu a odpovedí.',
      about: 'Pomáhajú nám zistiť, ktoré časti aplikácie sa používajú a kde sa učenie zasekne. Nie sú spojené s tvojím účtom; zariadenie má na to vlastné náhodné číslo, ktoré sa vypnutím zabudne.',
      privacy: 'Viac v zásadách ochrany súkromia',
    },
```

In `en.ts` the same keys:

```ts
    usage: {
      title: 'Anonymous statistics',
      toggle: 'Send anonymous statistics',
      toggleHint: 'Which exercises you do and where you stop a lesson, without your name, e-mail or answers.',
      about: 'They help us see which parts of the app are used and where learning gets stuck. They are not linked to your account; the device has its own random number for them, forgotten when you turn this off.',
      privacy: 'More in the privacy policy',
    },
```

- [ ] **Step 2: Page** `src/features/settings/UsageSettings.tsx`:

```tsx
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { setUsageOn, useUsageOn } from '../../lib/usage'
import { SwitchRow } from './ChoiceList'
import { SettingsHint, SettingsSubpage } from './SettingsSubpage'

/** Profil → Anonymné štatistiky: on by default; off forgets this device's id and its unsent events. */
export function UsageSettings() {
  const text = useT().settings.usage
  const on = useUsageOn()
  return (
    <SettingsSubpage title={text.title}>
      <div>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <SwitchRow label={text.toggle} detail={text.toggleHint} checked={on} onChange={setUsageOn} />
        </div>
        <SettingsHint>
          {text.about}{' '}
          <Link to="/privacy" className="text-brick underline underline-offset-2">
            {text.privacy}
          </Link>
        </SettingsHint>
      </div>
    </SettingsSubpage>
  )
}
```

- [ ] **Step 3: Wire.** `SettingsSectionPage.tsx`: `usage: () => <UsageSettings />`. `SettingsPage.tsx`, group `settings-data`, between backup and privacy:

```tsx
<SettingsRow to="/profile/usage" icon={ChartNoAxesColumn} title={text.usage.title} value={usageOn ? text.on : text.off} />
```

with `const usageOn = useUsageOn()` and `ChartNoAxesColumn` from `lucide-react`. If `text.on` does not exist next to `text.off`, add `on: 'Zapnuté'` / `on: 'On'` beside `off`.

- [ ] **Step 4: E2E** in `e2e/settings.spec.ts` (follow the file's existing `test(...)` style and helpers):

```ts
test('anonymous statistics can be turned off and on, and the dev server sends none', async ({ page }) => {
  const sent: string[] = []
  page.on('request', (r) => r.url().includes('/api/usage') && sent.push(r.url()))
  await page.goto('/profile')
  await page.getByRole('link', { name: /Anonymné štatistiky/ }).click()
  const toggle = page.getByRole('switch', { name: /Posielať anonymné štatistiky/ })
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(toggle).not.toBeChecked()
  await page.reload()
  await expect(page.getByRole('switch', { name: /Posielať anonymné štatistiky/ })).not.toBeChecked()
  await page.getByRole('switch', { name: /Posielať anonymné štatistiky/ }).check()
  await page.goto('/search')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(sent).toEqual([])
})
```

If the e2e helpers skip the welcome with a seeded state (see `e2e/helpers.ts`), use that helper first as the other settings tests do.

- [ ] **Step 5:** `npx playwright test e2e/settings.spec.ts --workers=2` — expected PASS; `npm run lint && npx tsc -b`.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/UsageSettings.tsx src/features/settings/SettingsPage.tsx src/features/settings/SettingsSectionPage.tsx src/i18n/sk.ts src/i18n/en.ts e2e/settings.spec.ts
git commit -m "feat(usage): the switch in Profil"
```

---

### Task 6: Štatistiky používania (dev tools page)

**Files:**
- Create: `src/lib/usageReport.ts`, `src/lib/usageReport.test.ts`, `src/features/settings/UsageStats.tsx`
- Modify: `src/features/settings/SettingsSectionPage.tsx` (`usage-stats`, dev mode only), `src/features/settings/DevSettings.tsx` (link row when signed in), `src/i18n/sk.ts`, `src/i18n/en.ts`

**Interfaces:**
- Consumes: `usage_report(p_days)` (Task 1); `getClient()`, `useAccount()` from `src/lib/account.ts`.
- Produces: `loadUsageReport(days): Promise<UsageReport>`, `UsageReportError` (`'forbidden' | 'offline'`), `lessonRows(report, by)`, `percent(part, whole)`.

- [ ] **Step 1: Failing tests** `src/lib/usageReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { lessonRows, parseReportError, percent, type UsageReport } from './usageReport'

const report: UsageReport = {
  since: '2026-09-26',
  devices: 12,
  active: [{ day: '2026-10-24', devices: 5 }],
  returning: { new: 8, nextDay: 3, weekOld: 4, withinWeek: 2 },
  welcome: { welcome: 8, motivation: 7, done: 5 },
  lessons: [
    { by: 'type', key: 'cloze', started: 10, finished: 6, quit: 2, usualStop: 3 },
    { by: 'type', key: 'builder', started: 20, finished: 15, quit: 5, usualStop: null },
    { by: 'level', key: 'A1', started: 30, finished: 21, quit: 7, usualStop: 4 },
  ],
  screens: { search: 9, duel: 1 },
}

describe('usage report', () => {
  it('lists the lesson rows of one kind, most started first', () => {
    expect(lessonRows(report, 'type').map((r) => r.key)).toEqual(['builder', 'cloze'])
    expect(lessonRows(report, 'level').map((r) => r.key)).toEqual(['A1'])
  })
  it('rounds percentages and has none for nothing', () => {
    expect(percent(2, 3)).toBe(67)
    expect(percent(0, 0)).toBeNull()
  })
  it('tells a refused account from a failed request', () => {
    expect(parseReportError({ message: 'forbidden' })).toBe('forbidden')
    expect(parseReportError({ message: 'Failed to fetch' })).toBe('offline')
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/usageReport.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/usageReport.ts`:

```ts
import { getClient } from './account'

// Profil → Nástroje pre vývoj → Štatistiky používania: the aggregates of usage_report() (supabase/schema.sql).
// Only accounts in usage_admins get them; everyone else gets 'forbidden'.

export interface LessonRow { by: 'type' | 'level'; key: string; started: number; finished: number; quit: number; usualStop: number | null }

export interface UsageReport {
  since: string
  devices: number
  active: { day: string; devices: number }[]
  returning: { new: number; nextDay: number; weekOld: number; withinWeek: number }
  welcome: Record<string, number>
  lessons: LessonRow[]
  screens: Record<string, number>
}

export type UsageReportError = 'forbidden' | 'offline'

/** Fewer devices than this in the period: percentages would mislead. */
export const MIN_DEVICES = 5

export function parseReportError(error: { message?: string }): UsageReportError {
  return error.message?.includes('forbidden') ? 'forbidden' : 'offline'
}

export async function loadUsageReport(days: number): Promise<UsageReport> {
  const client = await getClient()
  const { data, error } = await client.rpc('usage_report', { p_days: days })
  if (error) throw parseReportError(error)
  return data as UsageReport
}

export function lessonRows(report: UsageReport, by: LessonRow['by']): LessonRow[] {
  return report.lessons.filter((r) => r.by === by).sort((a, b) => b.started - a.started)
}

export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}
```

- [ ] **Step 4: Run** the test — PASS.

- [ ] **Step 5: Texts.** In `sk.ts` under `settings.dev` add:

```ts
      usageStats: 'Štatistiky používania',
      usageStatsHint: 'Anonymné čísla zo všetkých zariadení. Vidí ich iba účet zapísaný v usage_admins (docs/usage-stats-setup.md).',
      usage: {
        days: (n: number) => `${n} dní`,
        learners: 'Učiaci',
        devices: (n: number) => `${n} ${pluralSk(n, ['zariadenie', 'zariadenia', 'zariadení'])} v období`,
        activePerDay: 'Aktívne zariadenia za deň',
        newDevices: 'Nové zariadenia',
        nextDay: 'Vrátili sa na druhý deň',
        withinWeek: 'Vrátili sa do 7 dní',
        welcome: 'Uvítanie',
        steps: { welcome: 'Úvod', motivation: 'Prečo', level: 'Úroveň', goal: 'Denný cieľ', reminder: 'Pripomienka', install: 'Na plochu', ready: 'Pripravené', done: 'Dokončené' },
        exercises: 'Cvičenia',
        levels: 'Úrovne',
        started: 'Začaté',
        finished: 'Dokončené',
        usualStop: 'Odchod pri úlohe',
        screens: 'Obrazovky',
        tooFew: 'Zatiaľ málo údajov.',
        forbidden: 'Tento účet nemá prístup.',
        failed: 'Štatistiky sa nepodarilo načítať.',
        retry: 'Skúsiť znova',
        signIn: 'Štatistiky vidí iba prihlásený správca.',
      },
```

Same keys in `en.ts` (Anonymous numbers from every device…, `days: (n) => \`${n} days\``, Learners, `devices: (n) => \`${n} device${n === 1 ? '' : 's'} in the period\``, Active devices per day, New devices, Came back the next day, Came back within 7 days, Welcome, steps: Intro / Why / Level / Daily goal / Reminder / Home screen / Ready / Finished, Exercises, Levels, Started, Finished, Leaves at task, Screens, Not enough data yet., This account has no access., The statistics could not be loaded., Try again, Only a signed-in admin sees the statistics.). Exercise-type names come from the existing `exerciseInfo(type).title` in `src/features/exercises/exercises.ts`; screen names reuse `dictionary.nav.*` where they exist, otherwise the raw id.

- [ ] **Step 6: Page** `src/features/settings/UsageStats.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Segmented } from '../../components/Segmented'
import { useT } from '../../i18n'
import { useAccount } from '../../lib/account'
import { lessonRows, loadUsageReport, MIN_DEVICES, percent, type UsageReport, type UsageReportError } from '../../lib/usageReport'
import { exerciseInfo } from '../exercises/exercises'
import { SettingsHint, SettingsPart, SettingsSubpage } from './SettingsSubpage'

const PERIODS = ['7', '30', '90'] as const
const STEP_ORDER = ['welcome', 'motivation', 'level', 'goal', 'reminder', 'install', 'ready', 'done'] as const

/** A row with a bar: label, bar scaled to `max`, number. */
function Bar({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
  return (
    <li className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
      <span className="truncate">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-brick" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </span>
      <span className="text-right text-ink-muted tabular-nums">
        {value}
        {note && ` · ${note}`}
      </span>
    </li>
  )
}

/** Nástroje pre vývoj → Štatistiky používania (docs/superpowers/specs/2026-10-25-usage-stats-design.md). */
export function UsageStats() {
  const dictionary = useT()
  const text = dictionary.settings.dev
  const t = text.usage
  const account = useAccount()
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('30')
  const [report, setReport] = useState<UsageReport | null>(null)
  const [error, setError] = useState<UsageReportError | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!account) return
    let active = true
    setError(null)
    loadUsageReport(Number(period)).then(
      (next) => active && setReport(next),
      (reason: unknown) => active && setError(reason === 'forbidden' ? 'forbidden' : 'offline'),
    )
    return () => {
      active = false
    }
  }, [account, period, attempt])

  const body = () => {
    if (!account) return <SettingsHint>{t.signIn}</SettingsHint>
    if (error === 'forbidden') return <SettingsHint>{t.forbidden}</SettingsHint>
    if (error) return (
      <div>
        <SettingsHint>{t.failed}</SettingsHint>
        <Button variant="secondary" onClick={() => setAttempt(attempt + 1)} className="mt-3">{t.retry}</Button>
      </div>
    )
    if (!report) return null
    const few = report.devices < MIN_DEVICES
    const pct = (part: number, whole: number) => (few ? undefined : `${percent(part, whole) ?? 0} %`)
    const maxActive = Math.max(0, ...report.active.map((d) => d.devices))
    const welcomeMax = report.welcome.welcome ?? 0
    const types = lessonRows(report, 'type')
    const levels = lessonRows(report, 'level')
    const screens = Object.entries(report.screens).sort((a, b) => b[1] - a[1])
    return (
      <>
        <p className="px-1 text-sm text-ink-muted">{t.devices(report.devices)}{few && ` · ${t.tooFew}`}</p>
        <SettingsPart id="usage-learners" title={t.learners}>
          <div className="space-y-3 rounded-card border border-line bg-surface p-4">
            <p className="text-sm text-ink-muted">{t.activePerDay}</p>
            <div className="flex h-20 items-end gap-0.5" aria-hidden>
              {report.active.map((d) => (
                <span key={d.day} title={`${d.day}: ${d.devices}`} className="flex-1 rounded-t bg-brick" style={{ height: `${maxActive ? (d.devices / maxActive) * 100 : 0}%` }} />
              ))}
            </div>
            <ul className="space-y-1 text-sm">
              <li>{t.newDevices}: <b className="tabular-nums">{report.returning.new}</b></li>
              <li>{t.nextDay}: <b className="tabular-nums">{report.returning.nextDay}</b>{pct(report.returning.nextDay, report.returning.new) && ` (${pct(report.returning.nextDay, report.returning.new)})`}</li>
              <li>{t.withinWeek}: <b className="tabular-nums">{report.returning.withinWeek}</b> / {report.returning.weekOld}</li>
            </ul>
          </div>
        </SettingsPart>
        <SettingsPart id="usage-welcome" title={t.welcome}>
          <ul className="space-y-2 rounded-card border border-line bg-surface p-4">
            {STEP_ORDER.filter((s) => report.welcome[s] !== undefined).map((s) => (
              <Bar key={s} label={t.steps[s]} value={report.welcome[s]} max={welcomeMax} note={pct(report.welcome[s], welcomeMax)} />
            ))}
          </ul>
        </SettingsPart>
        {([['usage-types', t.exercises, types], ['usage-levels', t.levels, levels]] as const).map(([id, title, rows]) => (
          <SettingsPart key={id} id={id} title={title}>
            <table className="w-full overflow-hidden rounded-card border border-line bg-surface text-sm">
              <thead className="text-left text-ink-muted">
                <tr><th className="px-3 py-2 font-normal" /><th className="px-2 py-2 font-normal">{t.started}</th><th className="px-2 py-2 font-normal">{t.finished}</th><th className="px-3 py-2 font-normal">{t.usualStop}</th></tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-line">
                    <td className="px-3 py-2">{id === 'usage-types' ? exerciseInfo(r.key as Parameters<typeof exerciseInfo>[0]).title : r.key}</td>
                    <td className="px-2 py-2">{r.started}</td>
                    <td className="px-2 py-2">{few ? r.finished : `${percent(r.finished, r.started) ?? 0} %`}</td>
                    <td className="px-3 py-2">{r.usualStop === null ? '–' : r.usualStop + 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SettingsPart>
        ))}
        <SettingsPart id="usage-screens" title={t.screens}>
          <ul className="space-y-2 rounded-card border border-line bg-surface p-4">
            {screens.map(([name, n]) => <Bar key={name} label={name} value={n} max={screens[0]?.[1] ?? 0} />)}
          </ul>
        </SettingsPart>
      </>
    )
  }

  return (
    <SettingsSubpage title={text.usageStats}>
      <Segmented mode="radio" label={text.usageStats} idPrefix="usage-period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ id: p, label: t.days(Number(p)) }))} />
      {body()}
    </SettingsSubpage>
  )
}
```

`usualStop` is the number of tasks answered before leaving, so the task they left at is `usualStop + 1`. Check `exerciseInfo`'s real return field name (`title` or `name`) in `src/features/exercises/exercises.ts` and use it.

- [ ] **Step 7: Wire.** `SettingsSectionPage.tsx`: add `'usage-stats': () => <UsageStats />` and treat it like `dev` (redirect outside developer mode): `if (!page || ((section === 'dev' || section === 'usage-stats') && !devMode))`. In `DevSettings.tsx`, a part after `dev-welcome`:

```tsx
<SettingsPart id="dev-usage" title={text.usageStats}>
  <Button variant="secondary" icon={ChartNoAxesColumn} onClick={() => void navigate('/profile/usage-stats')} className="w-full">
    {text.usageStats}
  </Button>
  <SettingsHint>{text.usageStatsHint}</SettingsHint>
</SettingsPart>
```

(The page itself says "sign in" when there is no account, so no extra condition is needed.)

- [ ] **Step 8:** `npm run lint && npx tsc -b && npm test`; check the page at 375 px on the dev server (`/profile/usage-stats`, signed out → the sign-in hint).

- [ ] **Step 9: Commit**

```bash
git add src/lib/usageReport.ts src/lib/usageReport.test.ts src/features/settings/UsageStats.tsx src/features/settings/SettingsSectionPage.tsx src/features/settings/DevSettings.tsx src/i18n/sk.ts src/i18n/en.ts
git commit -m "feat(usage): Štatistiky používania in Nástroje pre vývoj"
```

---

### Task 7: Privacy policy, setup guide, push

**Files:**
- Modify: `src/i18n/sk.ts`, `src/i18n/en.ts` (`privacy`)
- Create: `docs/usage-stats-setup.md`

- [ ] **Step 1: Ask Adam** for the controller line of the policy: his name as it should appear and the contact e-mail (`adam.vrto@gmail.com` or another). Do not guess.

- [ ] **Step 2: Policy (sk).** Set `updated` to the push date. Add sections (and their English twins in `en.ts`):
  - first: **Kto sme** — "Aplikáciu SOMOS prevádzkuje {name}, kontakt: {e-mail}. Na tento e-mail píš aj otázky k údajom a žiadosti o ich výmaz."
  - after "S účtom": **Duely** — "Pre duel si zvolíš prezývku; vidia ju ostatní hráči. Ukladáme miestnosti duelov a odpovede v nich (správne / nesprávne a čas), kým máš účet."
  - after "Hlásenia chýb": **Anonymné štatistiky** — "Aplikácia posiela, ktoré obrazovky a cvičenia otvoríš, kroky uvítania a koľko úloh lekcie si urobil. Patrí k nim náhodné číslo zariadenia, verzia aplikácie, jazyk a dátum, nie tvoj účet, e-mail, IP adresa ani odpovede. Slúžia iba na zlepšenie aplikácie a mažú sa po 13 mesiacoch. Vypneš ich v Profile → Anonymné štatistiky; vypnutím sa číslo zariadenia zabudne."
  - **Právny základ** (before "Ako dlho") — "Účet, progres, duely a pripomienky spracúvame, aby sme ti poskytli službu, o ktorú si požiadal (čl. 6 ods. 1 písm. b GDPR). Hlásenia chýb a anonymné štatistiky na základe oprávneného záujmu na fungujúcej a lepšej aplikácii (čl. 6 ods. 1 písm. f); štatistiky môžeš kedykoľvek vypnúť."
  - "Kto údaje spracúva": add "anonymné štatistiky Supabase" (already listed for accounts — just mention statistics in the sentence).

- [ ] **Step 3: Setup guide** `docs/usage-stats-setup.md` (Slovak, like the other setup docs): run `supabase/schema.sql` again in the SQL Editor; then

```sql
insert into public.usage_admins (user_id) select id from auth.users where email = 'tvoj@email';
```

expected "Success. 1 rows affected"; nothing to set in Vercel; where the page is (Profil → Nástroje pre vývoj → Štatistiky používania); the first numbers appear after the deploy once someone uses the app (the phone counts too; turn it off there in Profil if unwanted).

- [ ] **Step 4: Full check** — `npm run lint && npm run validate:data && npm test && npm run build && npm run test:e2e -- --workers=2`. All green (a single duel timing failure under load: re-run `e2e/duel.spec.ts` alone before calling it a failure).

- [ ] **Step 5: Commit and push** (only after Adam has run the SQL — the app works without it, but the function would 500 until the table exists; the client keeps the queue and retries, so pushing first is safe too):

```bash
git add src/i18n/sk.ts src/i18n/en.ts docs/usage-stats-setup.md
git commit -m "docs(privacy): controller, duels, legal basis and anonymous statistics"
git push origin main
```

Tell Adam the CLAUDE.md lines to update (tech stack row "Usage stats", §8 "Anonymous usage numbers" done) — do not edit his uncommitted CLAUDE.md.
