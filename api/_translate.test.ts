// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it, vi } from 'vitest'
import { DAILY_CHARS, IP_DAILY_CHARS, limitsFromEnv, LOOKUPS_PER_BLOCK, LOOKUPS_PER_HOUR, translate, type TranslateLimits } from './translate.ts'

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
  const limits = (verdict: Awaited<ReturnType<TranslateLimits['allow']>> = 'ok'): TranslateLimits & { allow: ReturnType<typeof vi.fn> } => ({
    allow: vi.fn(async () => verdict),
    ipKey: () => 'translate:ip',
    blockKey: () => 'translate-block:ip',
  })

  it('asks the limits once, with the address, the block and the characters', async () => {
    const l = limits()
    const res = await translate(request({ text: ' zmrzlinár ', from: 'sk' }), KEY, deepl(OK()), l)
    expect(res.status).toBe(200)
    expect(l.allow).toHaveBeenCalledTimes(1)
    expect(l.allow).toHaveBeenCalledWith({ ip: 'translate:ip', block: 'translate-block:ip', chars: 'zmrzlinár'.length })
  })

  it('stops a learner over a limit before DeepL is asked', async () => {
    const fetchImpl = deepl(OK())
    const res = await translate(request({ text: 'zmrzlinár', from: 'sk' }), KEY, fetchImpl, limits('too-many'))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'too-many' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('stops everyone once the day has used its characters', async () => {
    const fetchImpl = deepl(OK())
    const res = await translate(request({ text: 'zmrzlinár', from: 'sk' }), KEY, fetchImpl, limits('daily-limit'))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'daily-limit' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('a bad request costs nothing', async () => {
    const l = limits()
    expect((await translate(request({ text: '', from: 'sk' }), KEY, deepl(OK()), l)).status).toBe(400)
    expect(l.allow).not.toHaveBeenCalled()
  })

  it('translates anyway when the limits cannot be checked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const l = { ...limits(), allow: vi.fn(async () => Promise.reject(new Error('down'))) }
    expect((await translate(request({ text: 'zmrzlinár', from: 'sk' }), KEY, deepl(OK()), l)).status).toBe(200)
  })
})

describe('api/translate limits in Supabase', () => {
  const ENV = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'secret' }
  const reply = (status: number, body: unknown) => vi.fn(async () => Response.json(body, { status }))

  it('is one call of translate_allow with every limit, under a short timeout', async () => {
    const fetchImpl = reply(200, 'ok')
    const l = limitsFromEnv(ENV, fetchImpl)!
    expect(await l.allow({ ip: 'a', block: 'b', chars: 9 })).toBe('ok')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://x.supabase.co/rest/v1/rpc/translate_allow')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer secret')
    expect(JSON.parse(init.body as string)).toEqual({
      p_ip: 'a',
      p_block: 'b',
      p_chars: 9,
      p_ip_lookups: LOOKUPS_PER_HOUR,
      p_block_lookups: LOOKUPS_PER_BLOCK,
      p_ip_chars: IP_DAILY_CHARS,
      p_daily_chars: DAILY_CHARS,
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('passes on the verdicts, and throws on anything else (the lookup then goes through)', async () => {
    expect(await limitsFromEnv(ENV, reply(200, 'too-many'))!.allow({ ip: 'a', block: 'b', chars: 1 })).toBe('too-many')
    expect(await limitsFromEnv(ENV, reply(200, 'daily-limit'))!.allow({ ip: 'a', block: 'b', chars: 1 })).toBe('daily-limit')
    await expect(limitsFromEnv(ENV, reply(404, { message: 'no such function' }))!.allow({ ip: 'a', block: 'b', chars: 1 })).rejects.toThrow()
    await expect(limitsFromEnv(ENV, reply(200, 'maybe'))!.allow({ ip: 'a', block: 'b', chars: 1 })).rejects.toThrow()
  })

  it('reads the daily budget from DEEPL_DAILY_CHARS, 15 000 without it', async () => {
    const fetchImpl = reply(200, 'ok')
    await limitsFromEnv({ ...ENV, DEEPL_DAILY_CHARS: '40000' }, fetchImpl)!.allow({ ip: 'a', block: 'b', chars: 1 })
    await limitsFromEnv({ ...ENV, DEEPL_DAILY_CHARS: 'lots' }, fetchImpl)!.allow({ ip: 'a', block: 'b', chars: 1 })
    const budgets = fetchImpl.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string).p_daily_chars)
    expect(budgets).toEqual([40_000, DAILY_CHARS])
    expect(DAILY_CHARS).toBe(15_000)
    expect(limitsFromEnv({})).toBeUndefined()
  })

  it('counts an IPv6 connection by its /64, its block by the /48, IPv4 by the address and the /24', () => {
    const l = limitsFromEnv(ENV)!
    const req = (ip: string) => new Request('https://somos.example', { headers: { 'x-forwarded-for': ip } })
    expect(l.ipKey(req('2a02:ab88:1234:5678::1'))).toBe(l.ipKey(req('2a02:ab88:1234:5678:9::2')))
    expect(l.ipKey(req('2a02:ab88:1234:5678::1'))).not.toBe(l.ipKey(req('2a02:ab88:1234:5679::1')))
    expect(l.blockKey(req('2a02:ab88:1234:5678::1'))).toBe(l.blockKey(req('2a02:ab88:1234:ffff::1')))
    expect(l.ipKey(req('81.2.3.4'))).not.toBe(l.ipKey(req('81.2.3.5')))
    expect(l.blockKey(req('81.2.3.4'))).toBe(l.blockKey(req('81.2.3.200')))
    expect(l.ipKey(req('81.2.3.4'))).not.toContain('81.2.3.4')
  })
})
