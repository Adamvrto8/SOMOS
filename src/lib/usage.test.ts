import { describe, expect, it, vi } from 'vitest'
import { createUsage, MAX_QUEUE, screenOf, type SendResult, type UsageEnv } from './usage'

interface SentBatch {
  device: string
  version: string
  language: string
  events: { name: string; day: string; props: Record<string, unknown> }[]
}

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

const ID = '0b6f3a52-5c1e-4d7a-9a51-2f0d1c9e8b11'

function setup(over: Partial<UsageEnv> = {}) {
  const storage = memoryStorage()
  const sent: SentBatch[] = []
  let result: SendResult = 'sent'
  let clock = new Date(2026, 9, 25, 10, 0)
  const env: UsageEnv = {
    storage,
    send: vi.fn(async (body: string) => {
      sent.push(JSON.parse(body) as SentBatch)
      return result
    }),
    live: true,
    now: () => clock,
    version: () => 'abc1234',
    language: () => 'sk',
    newId: () => ID,
    ...over,
  }
  return {
    usage: createUsage(env),
    env,
    storage,
    sent,
    setResult: (r: SendResult) => (result = r),
    setClock: (d: Date) => (clock = d),
  }
}

describe('usage queue', () => {
  it('sends the queued events in one batch with the device id, and empties the queue', async () => {
    const { usage, sent } = setup()
    usage.track('screen', { name: 'search' })
    usage.track('welcome', { step: 'goal' })
    await usage.flush()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ device: ID, version: 'abc1234', language: 'sk' })
    expect(sent[0].events.map((e) => e.name)).toEqual(['screen', 'welcome'])
    expect(sent[0].events[0]).toMatchObject({ day: '2026-10-25', props: { name: 'search' } })
    await usage.flush()
    expect(sent).toHaveLength(1) // nothing left to send
  })

  it('keeps the queue when sending fails', async () => {
    const { usage, sent, setResult } = setup()
    usage.track('open')
    setResult('retry')
    await usage.flush()
    setResult('sent')
    await usage.flush()
    expect(sent.map((b) => b.events.length)).toEqual([1, 1])
  })

  it('drops a batch the server refuses', async () => {
    const { usage, sent, setResult } = setup()
    usage.track('open')
    setResult('drop')
    await usage.flush()
    setResult('sent')
    await usage.flush()
    expect(sent).toHaveLength(1)
  })

  it('keeps events tracked while a batch is on its way', async () => {
    const { usage, sent, env } = setup()
    usage.track('screen', { name: 'home' })
    vi.mocked(env.send).mockImplementationOnce(async (body) => {
      sent.push(JSON.parse(body) as SentBatch)
      usage.track('screen', { name: 'search' })
      return 'sent'
    })
    await usage.flush()
    await usage.flush()
    expect(sent.map((b) => b.events.map((e) => e.props.name))).toEqual([['home'], ['search']])
  })

  it(`keeps at most ${MAX_QUEUE} events, the newest`, async () => {
    const { usage, sent } = setup()
    for (let i = 0; i <= MAX_QUEUE; i++) usage.track('screen', { name: i === MAX_QUEUE ? 'duel' : 'home' })
    await usage.flush()
    await usage.flush()
    const events = sent.flatMap((b) => b.events)
    expect(events).toHaveLength(MAX_QUEUE)
    expect(events.at(-1)?.props.name).toBe('duel')
  })

  it('counts open once a day', async () => {
    const { usage, sent, setClock } = setup()
    usage.trackOpen()
    usage.trackOpen()
    setClock(new Date(2026, 9, 26, 9, 0))
    usage.trackOpen()
    await usage.flush()
    expect(sent[0].events.map((e) => `${e.name} ${e.day}`)).toEqual(['open 2026-10-25', 'open 2026-10-26'])
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
    expect([...storage.map.keys()]).toEqual(['somos-usage-off'])
    usage.setOn(true)
    expect(usage.isOn()).toBe(true)
    usage.track('open')
    await usage.flush()
    expect(sent[1].device).not.toBe(sent[0].device)
  })

  it('does nothing on the dev server', async () => {
    const { usage, env, storage } = setup({ live: false })
    usage.track('open')
    usage.trackOpen()
    await usage.flush()
    expect(env.send).not.toHaveBeenCalled()
    expect(storage.map.size).toBe(0)
  })

  it('works without storage', async () => {
    const denied = () => {
      throw new Error('denied')
    }
    const { usage } = setup({ storage: { getItem: denied, setItem: denied, removeItem: denied } })
    expect(() => usage.track('open')).not.toThrow()
    expect(() => usage.trackOpen()).not.toThrow()
    expect(() => usage.setOn(false)).not.toThrow()
    await expect(usage.flush()).resolves.toBeUndefined()
  })

  it('survives a broken queue in storage', async () => {
    const { usage, storage, sent } = setup()
    storage.setItem('somos-usage-queue', '{not json')
    usage.track('open')
    await usage.flush()
    expect(sent[0].events.map((e) => e.name)).toEqual(['open'])
  })
})

describe('screens', () => {
  it('names the route without its id', () => {
    expect(screenOf('/')).toBe('home')
    expect(screenOf('/search')).toBe('search')
    expect(screenOf('/word/casa')).toBe('word')
    expect(screenOf('/topic/food')).toBe('topic')
    expect(screenOf('/practice')).toBe('practice')
    expect(screenOf('/practice/grammar/ser-estar')).toBe('grammar')
    expect(screenOf('/practice/tests')).toBe('tests')
    expect(screenOf('/practice/test')).toBe('test')
    expect(screenOf('/duel/ABC123')).toBe('duel')
    expect(screenOf('/archive/new')).toBe('archive')
    expect(screenOf('/profile/goal')).toBe('profile')
    expect(screenOf('/review')).toBe('review')
    expect(screenOf('/stats')).toBe('stats')
    expect(screenOf('/practice/lesson')).toBeNull() // lessons have their own events
    expect(screenOf('/welcome')).toBeNull()
    expect(screenOf('/privacy')).toBeNull()
  })

  it('same screen twice counts once', async () => {
    const { usage, sent } = setup()
    usage.trackScreen('/word/casa')
    usage.trackScreen('/word/carro')
    usage.trackScreen('/search')
    usage.trackScreen('/practice/lesson')
    usage.trackScreen('/word/casa')
    await usage.flush()
    expect(sent[0].events.map((e) => e.props.name)).toEqual(['word', 'search', 'word'])
  })
})
