// Vercel function: reports of wrong content (docs/superpowers/specs/2026-10-25-content-reports-design.md).
//   POST /api/report from the app (same-origin): one report, see ReportBody.
// Stored in Supabase content_reports with the service role key. No account, no IP: the IP only counts the hourly
// limit, as a keyed hash in push_rate. Kept free of local imports so Vercel can deploy it as a single file.
import { createHmac } from 'node:crypto'

export const MAX_BODY = 8_000
export const REPORTS_PER_HOUR = 20
/** Per /24 (IPv4) or /48 (IPv6): a home connection may get a whole /56 or /48 and switch its /64. */
export const REPORTS_PER_BLOCK = 60
const REQUEST_TIMEOUT_MS = 8000

/** What the app sends; also the row of content_reports (the database adds id, created_at, status). */
export interface ReportBody {
  target: string // sentence:s001, word:casa, verb:tener
  detail: string // cloze index, verb form (preterito:yo), vocab direction
  exercise: string
  reason: 'spanish' | 'translation' | 'answer' | 'other'
  note: string
  answer: string | null // the learner's answer, only with reason answer
  shown: { es: string; translation: string } // as the learner saw it
  version: string
  language: 'sk' | 'en'
}
export type ReportRow = ReportBody

export interface ReportDeps {
  insert(row: ReportRow): Promise<void>
  rateHit(key: string, limit: number): Promise<boolean>
  ipKey(request: Request): string
  blockKey(request: Request): string
}

// Mirrors src/lib/contentReport.ts (ExerciseType + word, ReportReason, TARGET_PATTERN).
const EXERCISES = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking', 'word']
const REASONS = ['spanish', 'translation', 'answer', 'other']
const KEYS = ['target', 'detail', 'exercise', 'reason', 'note', 'answer', 'shown', 'version', 'language']

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max

/** The report, or null when anything in it is not as the app sends it. */
export function parseReport(body: unknown): ReportBody | null {
  if (!isRecord(body) || Object.keys(body).length !== KEYS.length || !KEYS.every((k) => Object.hasOwn(body, k))) return null
  const { target, detail, exercise, reason, note, answer, shown, version, language } = body
  if (typeof target !== 'string' || !/^(sentence|word|verb):[a-z0-9ñ-]{1,60}$/.test(target)) return null
  if (typeof detail !== 'string' || !/^[a-z0-9:-]{0,40}$/.test(detail)) return null
  if (typeof exercise !== 'string' || !EXERCISES.includes(exercise)) return null
  if (typeof reason !== 'string' || !REASONS.includes(reason)) return null
  if (!text(note, 500)) return null
  if (reason === 'answer' ? !text(answer, 200, 1) : answer !== null) return null
  if (!isRecord(shown) || Object.keys(shown).length !== 2 || !text(shown.es, 300) || !text(shown.translation, 300)) return null
  if (!text(version, 40, 1) || (language !== 'sk' && language !== 'en')) return null
  return {
    target,
    detail,
    exercise,
    reason: reason as ReportBody['reason'],
    note,
    answer: answer as string | null,
    shown: { es: shown.es, translation: shown.translation },
    version,
    language,
  }
}

const clientIp = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Browsers send Origin on POST: only pages of this same deployment may send reports. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

export async function handleReport(request: Request, deps: ReportDeps | undefined): Promise<Response> {
  if (!deps) return json({ error: 'not-configured' }, 503)
  if (request.method !== 'POST') return json({ error: 'method' }, 405)
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  try {
    const body = await request.text()
    if (body.length > MAX_BODY) return json({ error: 'too-big' }, 413)
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      return json({ error: 'bad-request' }, 400)
    }
    const report = parseReport(parsed)
    if (!report) return json({ error: 'bad-request' }, 400)
    if (!(await deps.rateHit(deps.ipKey(request), REPORTS_PER_HOUR))) return json({ error: 'too-many' }, 429)
    if (!(await deps.rateHit(deps.blockKey(request), REPORTS_PER_BLOCK))) return json({ error: 'too-many' }, 429)
    await deps.insert(report)
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('report failed', error)
    return json({ error: 'failed' }, 500)
  }
}

/** An IPv6 address counts by its /64: one connection gets a whole /64 and can pick any address in it.
 *  The same as ipNetwork() in api/reminder.ts (functions are deployed one file each). */
/** The /24 of an IPv4 address, the /48 of an IPv6 one (as ipBlock() in api/reminder.ts). */
export function ipBlock(ip: string): string {
  if (!ip.includes(':')) return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? `${ip.split('.').slice(0, 3).join('.')}.0/24` : ip
  return ipNetwork(ip).split(':').slice(0, 3).join(':') + '::/48'
}

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

/** SUPABASE_URL, or the app's own VITE_SUPABASE_URL (Vercel gives functions every variable). */
export function depsFromEnv(env: Record<string, string | undefined>): ReportDeps | undefined {
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
  const hash = (value: string) => createHmac('sha256', `somos-report:${key}`).update(value).digest('hex').slice(0, 32)
  return {
    insert: async (row) => {
      await call('content_reports', row, 'return=minimal')
    },
    rateHit: async (rateKey, limit) => (await (await call('rpc/push_rate_hit', { p_key: rateKey, p_limit: limit })).json()) === true,
    // Keyed hashes: the address cannot be got back from push_rate by trying every address.
    ipKey: (request) => `report:${hash(ipNetwork(clientIp(request)))}`,
    blockKey: (request) => `report-block:${hash(ipBlock(clientIp(request)))}`,
  }
}

export function POST(request: Request): Promise<Response> {
  return handleReport(request, depsFromEnv(process.env))
}

export function GET(request: Request): Promise<Response> {
  return handleReport(request, depsFromEnv(process.env))
}
