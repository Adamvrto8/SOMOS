// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it, vi } from 'vitest'
import { handleReport, parseReport, REPORTS_PER_BLOCK, REPORTS_PER_HOUR, depsFromEnv as limitDeps, type ReportDeps, type ReportRow } from './report.ts'

const REPORT = {
  target: 'sentence:s001',
  detail: '0',
  exercise: 'cloze',
  reason: 'spanish',
  note: 'Chýba prízvuk.',
  answer: null,
  shown: { es: 'Mi hermana está en casa.', translation: 'Moja sestra je doma.' },
  version: 'abc1234',
  language: 'sk',
}
const SAME_SITE = { origin: 'https://somos.app', host: 'somos.app' }
const post = (body: unknown, headers: Record<string, string> = SAME_SITE) =>
  new Request('https://somos.app/api/report', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })

function deps(over: Partial<ReportDeps> = {}) {
  const rows: ReportRow[] = []
  const d: ReportDeps = {
    insert: vi.fn(async (r: ReportRow) => void rows.push(r)),
    rateHit: vi.fn(async () => true),
    ipKey: () => 'report:x',
    blockKey: () => 'report-block:x',
    ...over,
  }
  return { d, rows }
}

describe('parseReport', () => {
  it('takes a report from a lesson, a word page and a verb form', () => {
    expect(parseReport(REPORT)).toEqual(REPORT)
    expect(parseReport({ ...REPORT, target: 'word:papa-2', detail: '', exercise: 'word', reason: 'translation', note: '' })).not.toBeNull()
    expect(parseReport({ ...REPORT, target: 'verb:levantarse', detail: 'preterito:yo', exercise: 'conjugation', reason: 'answer', answer: 'me levante' })).not.toBeNull()
    expect(parseReport({ ...REPORT, target: 'word:casa', detail: 'sk-es', exercise: 'vocab', reason: 'other' })).not.toBeNull()
    // Verb ids are infinitives: extrañar, bañarse.
    expect(parseReport({ ...REPORT, target: 'verb:extrañar', detail: 'presente:yo', exercise: 'conjugation' })).not.toBeNull()
  })

  it.each([
    ['an unknown kind of target', { target: 'tip:ser-estar' }],
    ['a target with spaces', { target: 'word:la casa' }],
    ['a bad detail', { detail: 'x y' }],
    ['an unknown exercise', { exercise: 'duel' }],
    ['an unknown reason', { reason: 'rude' }],
    ['an answer without its reason', { answer: 'hablo' }],
    ['the answer reason without an answer', { reason: 'answer' }],
    ['a note over 500 characters', { note: 'x'.repeat(501) }],
    ['an answer over 200 characters', { reason: 'answer', answer: 'x'.repeat(201) }],
    ['a snapshot over 300 characters', { shown: { es: 'x'.repeat(301), translation: '' } }],
    ['a snapshot with more fields', { shown: { es: 'a', translation: 'b', user: 'c' } }],
    ['an extra field', { email: 'a@b.c' }],
    ['a bad language', { language: 'de' }],
    ['an empty version', { version: '' }],
  ])('refuses %s', (_, change) => {
    expect(parseReport({ ...REPORT, ...change })).toBeNull()
  })

  it('refuses a missing field', () => {
    const { note: _note, ...withoutNote } = REPORT
    expect(parseReport(withoutNote)).toBeNull()
  })
})

describe('handleReport', () => {
  it('stores the report and answers 204', async () => {
    const { d, rows } = deps()
    expect((await handleReport(post(REPORT), d)).status).toBe(204)
    expect(rows).toEqual([REPORT])
  })

  it('refuses other sites, other methods, bad and big bodies', async () => {
    const { d } = deps()
    expect((await handleReport(post(REPORT, { origin: 'https://evil.example', host: 'somos.app' }), d)).status).toBe(403)
    expect((await handleReport(post(REPORT, { host: 'somos.app' }), d)).status).toBe(403)
    expect((await handleReport(new Request('https://somos.app/api/report'), d)).status).toBe(405)
    expect((await handleReport(post('{'), d)).status).toBe(400)
    expect((await handleReport(post({ ...REPORT, reason: 'rude' }), d)).status).toBe(400)
    expect((await handleReport(post('x'.repeat(9000)), d)).status).toBe(413)
    expect(d.insert).not.toHaveBeenCalled()
  })

  it('stops at the hourly limit of a whole block of addresses too', async () => {
    const { d } = deps({ rateHit: vi.fn(async (key: string) => key !== 'report-block:x') })
    expect((await handleReport(post(REPORT), d)).status).toBe(429)
    expect(d.rateHit).toHaveBeenCalledWith('report-block:x', REPORTS_PER_BLOCK)
    expect(d.insert).not.toHaveBeenCalled()
  })

  it('stops at the hourly limit', async () => {
    const { d } = deps({ rateHit: vi.fn(async () => false) })
    expect((await handleReport(post(REPORT), d)).status).toBe(429)
    expect(d.rateHit).toHaveBeenCalledWith('report:x', REPORTS_PER_HOUR)
    expect(d.insert).not.toHaveBeenCalled()
  })

  it('answers 500 when Supabase fails, and 503 without configuration', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { d } = deps({ insert: vi.fn(async () => Promise.reject(new Error('down'))) })
    expect((await handleReport(post(REPORT), d)).status).toBe(500)
    expect((await handleReport(post(REPORT), undefined)).status).toBe(503)
  })
})

describe('the hourly limit key', () => {
  const keyOf = (ip: string) => limitDeps({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' })!.ipKey(new Request('https://somos.app', { headers: { 'x-forwarded-for': ip } }))

  it('counts an IPv6 connection by its /64: a phone can pick any address in it', () => {
    expect(keyOf('2a02:ab88:1234:5678::1')).toBe(keyOf('2a02:ab88:1234:5678:9abc:def0:1:2'))
    expect(keyOf('2a02:ab88:1234:5678::1')).not.toBe(keyOf('2a02:ab88:1234:5679::1'))
  })

  it('keeps IPv4 addresses apart, and never contains the address', () => {
    expect(keyOf('81.2.3.4')).not.toBe(keyOf('81.2.3.5'))
    expect(keyOf('81.2.3.4')).not.toContain('81.2.3.4')
  })
})

describe('the block limit key', () => {
  const blockOf = (ip: string) => limitDeps({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' })!.blockKey(new Request('https://somos.app', { headers: { 'x-forwarded-for': ip } }))

  it('is the /48 of IPv6 and the /24 of IPv4', () => {
    expect(blockOf('2a02:ab88:1234:5678::1')).toBe(blockOf('2a02:ab88:1234:ffff::9'))
    expect(blockOf('2a02:ab88:1234::1')).not.toBe(blockOf('2a02:ab88:1235::1'))
    expect(blockOf('81.2.3.4')).toBe(blockOf('81.2.3.200'))
    expect(blockOf('81.2.3.4')).not.toBe(blockOf('81.2.4.4'))
  })
})
