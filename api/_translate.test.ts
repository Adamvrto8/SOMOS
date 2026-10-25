// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it, vi } from 'vitest'
import { limitsFromEnv, LOOKUPS_PER_BLOCK, LOOKUPS_PER_HOUR, translate, type TranslateLimits } from './translate.ts'

const KEY = 'test-key:fx'

const request = (body: unknown, origin = 'https://somos.example') =>
  new Request('https://somos.example/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin, host: 'somos.example' },
    body: JSON.stringify(body),
  })

const deepl = (...responses: [number, unknown?][]) => {
  const queue = [...responses]
  return vi.fn(async () => {
    const [status, body] = queue.shift()!
    return Response.json(body ?? {}, { status })
  })
}

describe('api/translate', () => {
  it('translates Slovak to Latin American Spanish via the free host', async () => {
    const fetchImpl = deepl([200, { translations: [{ text: 'heladero' }] }])
    const res = await translate(request({ text: ' zmrzlinár ', from: 'sk' }), KEY, fetchImpl)
    expect(await res.json()).toEqual({ translation: 'heladero', from: 'sk', to: 'es' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api-free.deepl.com/v2/translate')
    expect(new Headers(init.headers).get('authorization')).toBe(`DeepL-Auth-Key ${KEY}`)
    expect(JSON.parse(init.body as string)).toEqual({ text: ['zmrzlinár'], source_lang: 'SK', target_lang: 'ES-419' })
  })

  it('falls back to plain Spanish when ES-419 is not offered', async () => {
    const fetchImpl = deepl([400, { message: 'Value for target_lang not supported' }], [200, { translations: [{ text: 'heladero' }] }])
    const res = await translate(request({ text: 'zmrzlinár', from: 'sk' }), KEY, fetchImpl)
    expect(res.status).toBe(200)
    expect(JSON.parse((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).target_lang).toBe('ES')
  })

  it('translates Spanish to Slovak with a paid key on the paid host', async () => {
    const fetchImpl = deepl([200, { translations: [{ text: 'zmrzlinár' }] }])
    const res = await translate(request({ text: 'heladero', from: 'es' }), 'paid-key', fetchImpl)
    expect(await res.json()).toEqual({ translation: 'zmrzlinár', from: 'es', to: 'sk' })
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://api.deepl.com/v2/translate')
  })

  it('reports a missing key, an exhausted quota and other DeepL errors', async () => {
    expect(await (await translate(request({ text: 'dom', from: 'sk' }), undefined)).json()).toEqual({ error: 'not-configured' })
    expect(await (await translate(request({ text: 'dom', from: 'sk' }), KEY, deepl([456]))).json()).toEqual({ error: 'quota' })
    expect(await (await translate(request({ text: 'dom', from: 'sk' }), KEY, deepl([403]))).json()).toEqual({ error: 'not-configured' })
    expect((await translate(request({ text: 'dom', from: 'sk' }), KEY, deepl([500]))).status).toBe(502)
  })

  it('rejects other sites, bad input and long texts without calling DeepL', async () => {
    const fetchImpl = deepl()
    expect((await translate(request({ text: 'dom', from: 'sk' }, 'https://evil.example'), KEY, fetchImpl)).status).toBe(403)
    expect((await translate(request({ text: 'dom', from: 'de' }), KEY, fetchImpl)).status).toBe(400)
    expect((await translate(request({ text: '   ', from: 'sk' }), KEY, fetchImpl)).status).toBe(400)
    expect((await translate(request({ text: 'a'.repeat(121), from: 'sk' }), KEY, fetchImpl)).status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('api/translate: the English pair', () => {
  it('translates English to Latin American Spanish and Spanish to American English', async () => {
    const fetchImpl = deepl([200, { translations: [{ text: 'heladero' }] }], [200, { translations: [{ text: 'ice cream seller' }] }])
    const toSpanish = await translate(request({ text: 'ice cream seller', from: 'en', to: 'es' }), KEY, fetchImpl)
    expect(await toSpanish.json()).toEqual({ translation: 'heladero', from: 'en', to: 'es' })
    await translate(request({ text: 'heladero', from: 'es', to: 'en' }), KEY, fetchImpl)
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][]
    const sent = calls.map(([, init]) => JSON.parse(String(init.body)) as unknown)
    expect(sent).toEqual([
      { text: ['ice cream seller'], source_lang: 'EN', target_lang: 'ES-419' },
      { text: ['heladero'], source_lang: 'ES', target_lang: 'EN-US' },
    ])
  })

  it('wants Spanish on exactly one side', async () => {
    const fetchImpl = deepl([200])
    expect((await translate(request({ text: 'dom', from: 'sk', to: 'en' }), KEY, fetchImpl)).status).toBe(400)
    expect((await translate(request({ text: 'casa', from: 'es', to: 'es' }), KEY, fetchImpl)).status).toBe(400)
    expect((await translate(request({ text: 'casa', from: 'es', to: 'fr' }), KEY, fetchImpl)).status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('api/translate limits', () => {
  const OK = (): [number, unknown] => [200, { translations: [{ text: 'heladero' }] }]
  const limits = (over: Partial<TranslateLimits> = {}): TranslateLimits => ({
    rateHit: vi.fn(async () => true),
    budgetHit: vi.fn(async () => true),
    ipKey: () => 'translate:ip',
    blockKey: () => 'translate-block:ip',
    dailyChars: 15_000,
    ...over,
  })

  it('counts every lookup per address and per block, and its characters in the day', async () => {
    const l = limits()
    const res = await translate(request({ text: ' zmrzlinár ', from: 'sk' }), KEY, deepl(OK()), l)
    expect(res.status).toBe(200)
    expect(l.rateHit).toHaveBeenCalledWith('translate:ip', LOOKUPS_PER_HOUR)
    expect(l.rateHit).toHaveBeenCalledWith('translate-block:ip', LOOKUPS_PER_BLOCK)
    expect(l.budgetHit).toHaveBeenCalledWith('zmrzlinár'.length, 15_000)
  })

  it('stops a learner over the hourly limit before DeepL is asked', async () => {
    const fetchImpl = deepl(OK())
    const res = await translate(request({ text: 'zmrzlinár', from: 'sk' }), KEY, fetchImpl, limits({ rateHit: vi.fn(async (key: string) => key !== 'translate:ip') }))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'too-many' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('stops everyone once the day has used its characters', async () => {
    const fetchImpl = deepl(OK())
    const l = limits({ budgetHit: vi.fn(async () => false) })
    const res = await translate(request({ text: 'zmrzlinár', from: 'sk' }), KEY, fetchImpl, l)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'daily-limit' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('a bad request costs nothing', async () => {
    const l = limits()
    expect((await translate(request({ text: '', from: 'sk' }), KEY, deepl(OK()), l)).status).toBe(400)
    expect(l.rateHit).not.toHaveBeenCalled()
    expect(l.budgetHit).not.toHaveBeenCalled()
  })

  it('translates anyway when the limits cannot be checked (Supabase down)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const l = limits({ rateHit: vi.fn(async () => Promise.reject(new Error('down'))), budgetHit: vi.fn(async () => Promise.reject(new Error('down'))) })
    const res = await translate(request({ text: 'zmrzlinár', from: 'sk' }), KEY, deepl(OK()), l)
    expect(res.status).toBe(200)
  })

  it('reads the daily budget from DEEPL_DAILY_CHARS, 15 000 without it', () => {
    const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' }
    expect(limitsFromEnv(env)?.dailyChars).toBe(15_000)
    expect(limitsFromEnv({ ...env, DEEPL_DAILY_CHARS: '40000' })?.dailyChars).toBe(40_000)
    expect(limitsFromEnv({ ...env, DEEPL_DAILY_CHARS: 'lots' })?.dailyChars).toBe(15_000)
    expect(limitsFromEnv({})).toBeUndefined()
  })

  it('counts an IPv6 connection by its /64 and its block by the /48', () => {
    const l = limitsFromEnv({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' })!
    const req = (ip: string) => new Request('https://somos.example', { headers: { 'x-forwarded-for': ip } })
    expect(l.ipKey(req('2a02:ab88:1234:5678::1'))).toBe(l.ipKey(req('2a02:ab88:1234:5678:9::2')))
    expect(l.ipKey(req('2a02:ab88:1234:5678::1'))).not.toBe(l.ipKey(req('2a02:ab88:1234:5679::1')))
    expect(l.blockKey(req('2a02:ab88:1234:5678::1'))).toBe(l.blockKey(req('2a02:ab88:1234:ffff::1')))
    expect(l.ipKey(req('81.2.3.4'))).not.toContain('81.2.3.4')
  })
})
