// Vercel function: POST /api/translate { text, from, to } → { translation, from, to }; Spanish is one of the two.
// `to` may be left out (older app versions): Slovak ↔ Spanish.
// The DeepL key lives only here (DEEPL_API_KEY in the Vercel project settings); the app never sees it.
// One key for everyone: a learner may look up LOOKUPS_PER_HOUR words an hour and IP_DAILY_CHARS characters a day,
// and all of them together DEEPL_DAILY_CHARS characters a day (the Free plan's 500 000 a month over 31 days),
// counted in Supabase (translate_allow in supabase/schema.sql).
// Kept free of local imports so Vercel can deploy it as a single file.
import { createHmac } from 'node:crypto'

export type Lang = 'sk' | 'en' | 'es'
const LANGS: Lang[] = ['sk', 'en', 'es']
const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang)

export const MAX_CHARS = 120
export const LOOKUPS_PER_HOUR = 30
/** Per /24 (IPv4) or /48 (IPv6): a home connection may get a whole /56 or /48 and switch its /64. */
export const LOOKUPS_PER_BLOCK = 100
/** Per address and day: a learner looks up words of 10–20 characters; a script must not empty everyone's day. */
export const IP_DAILY_CHARS = 2_000
export const DAILY_CHARS = 15_000
/** A slow Supabase must not hold up lookups: past this the lookup goes on without the limits. */
const LIMITS_TIMEOUT_MS = 2000

export type LimitVerdict = 'ok' | 'too-many' | 'daily-limit'
const VERDICTS: LimitVerdict[] = ['ok', 'too-many', 'daily-limit']

export interface TranslateLimits {
  /** Counts the lookup against every limit at once; rejects when they cannot be checked. */
  allow(lookup: { ip: string; block: string; chars: number }): Promise<LimitVerdict>
  ipKey(request: Request): string
  blockKey(request: Request): string
}

// Latin American Spanish when the DeepL account offers it, plain Spanish otherwise.
const TARGETS: Record<Lang, string[]> = { es: ['ES-419', 'ES'], sk: ['SK'], en: ['EN-US'] }

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Browsers send Origin on POST: only pages of this same deployment may spend the quota. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

function parseBody(body: unknown): { text: string; from: Lang; to: Lang } | undefined {
  if (!body || typeof body !== 'object') return undefined
  const { text, from, to = from === 'es' ? 'sk' : 'es' } = body as Record<string, unknown>
  if (typeof text !== 'string' || !isLang(from) || !isLang(to)) return undefined
  // Spanish on exactly one side: this is a Spanish dictionary, not a general translator.
  if ((from === 'es') === (to === 'es')) return undefined
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_CHARS) return undefined
  return { text: trimmed, from, to }
}

/** Which limit stops this lookup, if any. Supabase down: the lookup goes through (DeepL's own quota still holds). */
async function limited(request: Request, chars: number, limits: TranslateLimits): Promise<Response | null> {
  try {
    const verdict = await limits.allow({ ip: limits.ipKey(request), block: limits.blockKey(request), chars })
    if (verdict === 'too-many') return json({ error: 'too-many' }, 429)
    if (verdict === 'daily-limit') return json({ error: 'daily-limit' }, 503)
  } catch (error) {
    console.error('translate limits failed', error)
  }
  return null
}

export async function translate(request: Request, key: string | undefined, fetchImpl: typeof fetch = fetch, limits?: TranslateLimits): Promise<Response> {
  if (!key) return json({ error: 'not-configured' }, 503)
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  const input = parseBody(await request.json().catch(() => undefined))
  if (!input) return json({ error: 'bad-request' }, 400)
  const stop = limits && (await limited(request, input.text.length, limits))
  if (stop) return stop

  // Free-plan keys end in ":fx" and use their own host.
  const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'
  const targets = TARGETS[input.to]
  for (const [i, target] of targets.entries()) {
    const res = await fetchImpl(`https://${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [input.text], source_lang: input.from.toUpperCase(), target_lang: target }),
    })
    // 400 here means the target language is not offered: try the next one. DeepL bills no refused request,
    // so the text counted once against the limits above is right.
    if (res.status === 400 && i < targets.length - 1) continue
    if (res.status === 456) return json({ error: 'quota' }, 503)
    if (res.status === 403) return json({ error: 'not-configured' }, 503)
    if (!res.ok) return json({ error: 'failed' }, 502)

    const data = (await res.json()) as { translations?: { text?: string }[] }
    const translation = data.translations?.[0]?.text?.trim()
    if (!translation) return json({ error: 'failed' }, 502)
    return json({ translation, from: input.from, to: input.to })
  }
  return json({ error: 'failed' }, 502)
}

const clientIp = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

/** An IPv6 address counts by its /64: one connection gets a whole /64 (as ipNetwork() in api/reminder.ts). */
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

/** The /24 of an IPv4 address, the /48 of an IPv6 one (as ipBlock() in api/reminder.ts). */
export function ipBlock(ip: string): string {
  if (!ip.includes(':')) return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? `${ip.split('.').slice(0, 3).join('.')}.0/24` : ip
  return ipNetwork(ip).split(':').slice(0, 3).join(':') + '::/48'
}

/** The limits through Supabase (SUPABASE_URL or VITE_SUPABASE_URL, the service role key); none without them. */
export function limitsFromEnv(env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): TranslateLimits | undefined {
  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY
  if (!url || !key) return undefined
  const daily = Number(env.DEEPL_DAILY_CHARS)
  const dailyChars = Number.isInteger(daily) && daily > 0 ? daily : DAILY_CHARS
  // Keyed hashes: the address cannot be got back from the tables by trying every address.
  const hash = (value: string) => createHmac('sha256', `somos-translate:${key}`).update(value).digest('hex').slice(0, 32)
  return {
    allow: async ({ ip, block, chars }) => {
      const res = await fetchImpl(`${url}/rest/v1/rpc/translate_allow`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_ip: ip,
          p_block: block,
          p_chars: chars,
          p_ip_lookups: LOOKUPS_PER_HOUR,
          p_block_lookups: LOOKUPS_PER_BLOCK,
          p_ip_chars: IP_DAILY_CHARS,
          p_daily_chars: dailyChars,
        }),
        signal: AbortSignal.timeout(LIMITS_TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`Supabase translate_allow failed: ${res.status}`)
      const verdict: unknown = await res.json()
      if (!VERDICTS.includes(verdict as LimitVerdict)) throw new Error(`Supabase translate_allow said ${String(verdict)}`)
      return verdict as LimitVerdict
    },
    ipKey: (request) => `translate:${hash(ipNetwork(clientIp(request)))}`,
    blockKey: (request) => `translate-block:${hash(ipBlock(clientIp(request)))}`,
  }
}

export function POST(request: Request): Promise<Response> {
  return translate(request, process.env.DEEPL_API_KEY, fetch, limitsFromEnv(process.env))
}
