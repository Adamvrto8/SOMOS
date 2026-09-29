import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { base64UrlToBytes, enableReminder, parseSettings, sendTestReminder, VAPID_PUBLIC_KEY } from './reminder'

describe('parseSettings', () => {
  it('reads stored settings', () => {
    expect(parseSettings('{"enabled":true,"time":"07:30"}')).toEqual({ enabled: true, time: '07:30' })
  })

  it('falls back to off at 19:00 for missing or broken values', () => {
    for (const raw of [null, '', '{', '{"enabled":"yes","time":"07:30"}', '{"enabled":true,"time":"7:30"}']) {
      expect(parseSettings(raw)).toEqual({ enabled: false, time: '19:00' })
    }
  })
})

describe('base64UrlToBytes', () => {
  it('decodes base64url without padding', () => {
    expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })

  it('turns the VAPID public key into an uncompressed P-256 point', () => {
    const bytes = base64UrlToBytes(VAPID_PUBLIC_KEY)
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(4)
  })
})

describe('a subscription the push service dropped', () => {
  const DEAD = 'https://push.example/1'

  /** Chrome still holds subscription 1, which the push service no longer accepts. */
  function fakePushManager() {
    let count = 0
    const manager = {
      current: null as ReturnType<typeof make> | null,
      getSubscription: async () => manager.current,
      subscribe: async () => (manager.current = make()),
    }
    function make() {
      const endpoint = `https://push.example/${++count}`
      const sub = {
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
        unsubscribe: async () => {
          if (manager.current === sub) manager.current = null
          return true
        },
      }
      return sub
    }
    manager.current = make()
    return manager
  }

  /** Answers like api/reminder.ts: a test to the dead endpoint is 410, and so is re-subscribing it afterwards. */
  function fakeServer(deadKnown: boolean) {
    const calls: string[] = []
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { type: string; endpoint?: string; subscription?: { endpoint: string } }
      const endpoint = body.subscription?.endpoint ?? body.endpoint
      if (body.type !== 'progress') calls.push(`${body.type} ${endpoint}`)
      if (endpoint === DEAD && body.type === 'test') deadKnown = true
      if (endpoint === DEAD && (body.type === 'test' || (body.type === 'subscribe' && deadKnown))) {
        return Response.json({ error: 'gone' }, { status: 410 })
      }
      return Response.json({ ok: true })
    })
    return { fetchMock, calls }
  }

  function stubDevice(fetchMock: typeof fetch) {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: async () => 'granted' })
    vi.stubGlobal('window', { PushManager: class {}, Notification: {}, setTimeout, clearTimeout })
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { ready: Promise.resolve({ pushManager: fakePushManager() }) } })
    vi.stubGlobal('fetch', fetchMock)
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('is replaced with a fresh one when the reminder is turned on', async () => {
    const server = fakeServer(true)
    stubDevice(server.fetchMock)
    await enableReminder('19:00')
    expect(server.calls).toEqual([`subscribe ${DEAD}`, 'subscribe https://push.example/2'])
  })

  it('is replaced, and the test sent again, when a test notification finds it dead', async () => {
    const server = fakeServer(false)
    stubDevice(server.fetchMock)
    await sendTestReminder()
    expect(server.calls).toEqual([
      `subscribe ${DEAD}`,
      `test ${DEAD}`,
      `subscribe ${DEAD}`,
      'subscribe https://push.example/2',
      'test https://push.example/2',
    ])
  })
})
