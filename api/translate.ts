// Vercel function: POST /api/translate { text, from: 'sk' | 'es' } → { translation, from, to }.
// The DeepL key lives only here (DEEPL_API_KEY in the Vercel project settings); the app never sees it.
// Kept free of local imports so Vercel can deploy it as a single file.

export type Lang = 'sk' | 'es'

export const MAX_CHARS = 120

// Latin American Spanish when the DeepL account offers it, plain Spanish otherwise.
const TARGETS: Record<Lang, string[]> = { sk: ['ES-419', 'ES'], es: ['SK'] }

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

function parseBody(body: unknown): { text: string; from: Lang } | undefined {
  if (!body || typeof body !== 'object') return undefined
  const { text, from } = body as Record<string, unknown>
  if (typeof text !== 'string' || (from !== 'sk' && from !== 'es')) return undefined
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_CHARS) return undefined
  return { text: trimmed, from }
}

export async function translate(request: Request, key: string | undefined, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!key) return json({ error: 'not-configured' }, 503)
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  const input = parseBody(await request.json().catch(() => undefined))
  if (!input) return json({ error: 'bad-request' }, 400)

  // Free-plan keys end in ":fx" and use their own host.
  const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'
  const targets = TARGETS[input.from]
  for (const [i, target] of targets.entries()) {
    const res = await fetchImpl(`https://${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [input.text], source_lang: input.from.toUpperCase(), target_lang: target }),
    })
    // 400 here means the target language is not offered: try the next one.
    if (res.status === 400 && i < targets.length - 1) continue
    if (res.status === 456) return json({ error: 'quota' }, 503)
    if (res.status === 403) return json({ error: 'not-configured' }, 503)
    if (!res.ok) return json({ error: 'failed' }, 502)

    const data = (await res.json()) as { translations?: { text?: string }[] }
    const translation = data.translations?.[0]?.text?.trim()
    if (!translation) return json({ error: 'failed' }, 502)
    return json({ translation, from: input.from, to: input.from === 'sk' ? 'es' : 'sk' })
  }
  return json({ error: 'failed' }, 502)
}

export function POST(request: Request): Promise<Response> {
  return translate(request, process.env.DEEPL_API_KEY)
}
