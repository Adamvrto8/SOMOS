// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it, vi } from 'vitest'
import { translate } from './translate.ts'

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
