// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it, vi } from 'vitest'
import { BATCHES_PER_HOUR, handleUsage, MAX_EVENTS, parseBatch, type UsageDeps, type UsageRow } from './usage.ts'

const DEVICE = '0b6f3a52-5c1e-4d7a-9a51-2f0d1c9e8b11'
const OPEN = { name: 'open', day: '2026-10-25', at: 1, props: {} }
const batch = (events: unknown[] = [OPEN]) => ({ device: DEVICE, version: 'abc1234', language: 'sk', events })
const SAME_SITE = { origin: 'https://somos.app', host: 'somos.app' }
const post = (body: unknown, headers: Record<string, string> = SAME_SITE) =>
  new Request('https://somos.app/api/usage', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })

function deps(over: Partial<UsageDeps> = {}) {
  const rows: UsageRow[] = []
  const d: UsageDeps = {
    insert: vi.fn(async (r: UsageRow[]) => void rows.push(...r)),
    rateHit: vi.fn(async () => true),
    ipKey: () => 'usage:x',
    ...over,
  }
  return { d, rows }
}

describe('parseBatch', () => {
  it('takes every event of the spec', () => {
    const events = [
      OPEN,
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
    ['a bad topic id', { name: 'lesson_start', day: '2026-10-25', at: 1, props: { type: 'cloze', level: 'A1', topic: 'Food & Drink', source: 'lesson' } }],
    ['a bad day', { name: 'open', day: '25.10.2026', at: 1, props: {} }],
  ])('refuses the batch with %s', (_, event) => {
    expect(parseBatch(batch([OPEN, event]))).toBeNull()
  })

  it('refuses a bad device, version or language, and an empty or too long batch', () => {
    expect(parseBatch({ ...batch(), device: 'abc' })).toBeNull()
    expect(parseBatch({ ...batch(), version: '' })).toBeNull()
    expect(parseBatch({ ...batch(), language: 'de' })).toBeNull()
    expect(parseBatch(batch([]))).toBeNull()
    expect(parseBatch(batch(Array<unknown>(MAX_EVENTS + 1).fill(OPEN)))).toBeNull()
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
    expect((await handleUsage(post(batch(), { host: 'somos.app' }), d)).status).toBe(403)
    expect((await handleUsage(new Request('https://somos.app/api/usage'), d)).status).toBe(405)
    expect((await handleUsage(post('{'), d)).status).toBe(400)
    expect((await handleUsage(post({ ...batch(), device: 'abc' }), d)).status).toBe(400)
    expect((await handleUsage(post('x'.repeat(40_000)), d)).status).toBe(413)
    expect(d.insert).not.toHaveBeenCalled()
  })

  it('stops at the hourly limit', async () => {
    const { d } = deps({ rateHit: vi.fn(async () => false) })
    expect((await handleUsage(post(batch()), d)).status).toBe(429)
    expect(d.rateHit).toHaveBeenCalledWith('usage:x', BATCHES_PER_HOUR)
    expect(d.insert).not.toHaveBeenCalled()
  })

  it('answers 500 when Supabase fails, and 503 without configuration', async () => {
    const { d } = deps({ insert: vi.fn(async () => Promise.reject(new Error('down'))) })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await handleUsage(post(batch()), d)).status).toBe(500)
    expect((await handleUsage(post(batch()), undefined)).status).toBe(503)
  })
})
