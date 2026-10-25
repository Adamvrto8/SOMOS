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
export interface UsageEvent {
  name: string
  day: string // the device's local date
  at: number // device time, ms
  props: Props
}
export interface UsageBatch {
  device: string // a random id of the device, never the account
  version: string
  language: 'sk' | 'en'
  events: UsageEvent[]
}
/** A row of usage_events (received_at is the database's own). */
export interface UsageRow {
  device: string
  day: string
  name: string
  props: Props
  version: string
  language: string
}

export interface UsageDeps {
  insert(rows: UsageRow[]): Promise<void>
  rateHit(key: string, limit: number): Promise<boolean>
  ipKey(request: Request): string
}

// The lists mirror src/lib/lesson.ts (ExerciseType), src/data/types.ts (Level), the welcome's steps and
// screenOf() in src/lib/usage.ts.
const TYPES = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking']
const LEVELS = ['A1', 'A2', 'B1', 'B2']
const STEPS = ['welcome', 'motivation', 'level', 'goal', 'reminder', 'install', 'ready', 'done']
const SCREENS = ['home', 'search', 'word', 'topic', 'practice', 'grammar', 'tests', 'test', 'duel', 'archive', 'profile', 'review', 'stats']
const SOURCES = ['lesson', 'mistakes', 'test', 'first']

type Check = (value: unknown) => boolean
const oneOf =
  (list: string[]): Check =>
  (v) =>
    typeof v === 'string' && list.includes(v)
const orNull =
  (check: Check): Check =>
  (v) =>
    v === null || check(v)
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
  if (typeof v.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.day)) return false
  if (typeof v.at !== 'number' || !Number.isFinite(v.at)) return false
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
    insert: async (rows) => {
      await call('usage_events', rows, 'return=minimal')
    },
    rateHit: async (rateKey, limit) => (await (await call('rpc/push_rate_hit', { p_key: rateKey, p_limit: limit })).json()) === true,
    // A keyed hash: the address cannot be got back from push_rate by trying every address.
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
