import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  base64UrlToBytes,
  enableReminder,
  fetchReminderStatus,
  parseSettings,
  reminderProblem,
  sendTestReminder,
  syncReminder,
  VAPID_PUBLIC_KEY,
} from './reminder'

describe('parseSettings', () => {
  it('reads stored settings', () => {
    expect(parseSettings('{"enabled":true,"time":"07:30"}')).toEqual({ enabled: true, time: '07:30' })
  })

  it('remembers a reminder the app had to turn off', () => {
    expect(parseSettings('{"enabled":false,"time":"07:30","lost":true}')).toEqual({ enabled: false, time: '07:30', lost: true })
    // Turned on again: the note is gone.
    expect(parseSettings('{"enabled":true,"time":"07:30","lost":true}')).toEqual({ enabled: true, time: '07:30' })
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

describe('a reminder that stopped working', () => {
  const ENDPOINT = 'https://push.example/1'
  const subscription = { endpoint: ENDPOINT, toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => true }
  const serverOk = async () => Response.json({ ok: true })

  function stubDevice(fetchMock: typeof fetch) {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: async () => 'granted' })
    vi.stubGlobal('window', { PushManager: class {}, Notification: {}, setTimeout, clearTimeout })
    const pushManager = { getSubscription: async () => subscription, subscribe: async () => subscription }
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { ready: Promise.resolve({ pushManager }) } })
    vi.stubGlobal('fetch', fetchMock)
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('says so when the server cannot be reached, and recovers on the next sync', async () => {
    stubDevice(serverOk)
    await enableReminder('19:00')
    expect(reminderProblem()).toBeNull()

    vi.stubGlobal('fetch', async () => Promise.reject(new TypeError('network')))
    await syncReminder()
    expect(reminderProblem()).toContain('Server je z tejto siete nedostupný')

    vi.stubGlobal('fetch', serverOk)
    await syncReminder()
    expect(reminderProblem()).toBeNull()
  })

  it('says so when Android took the notification permission back', async () => {
    stubDevice(serverOk)
    await enableReminder('19:00')
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: async () => 'default' })
    await syncReminder()
    expect(reminderProblem()).toContain('Zapni ju znova')

    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: async () => 'granted' })
    await enableReminder('19:00')
    expect(reminderProblem()).toBeNull()
  })

  it('says that the reminders go to another device, and takes them only when asked', async () => {
    const bodies: Record<string, unknown>[] = []
    // Like api/reminder.ts with another device stored: checking in is refused, asking for them here is not.
    const server = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      bodies.push(body)
      return body.type === 'subscribe' && body.takeOver !== true ? Response.json({ error: 'other-device' }, { status: 409 }) : Response.json({ ok: true })
    }
    stubDevice(server)
    await enableReminder('19:00')
    expect(bodies[0]).toMatchObject({ type: 'subscribe', takeOver: true })
    expect(reminderProblem()).toBeNull()

    await syncReminder()
    expect(bodies.at(-1)).toMatchObject({ type: 'subscribe' })
    expect(bodies.at(-1)).not.toHaveProperty('takeOver')
    expect(reminderProblem()).toContain('Pripomienky chodia na iné zariadenie')

    await sendTestReminder()
    expect(reminderProblem()).toBeNull()
  })

  it('asks the server what it knows about this device', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true, status: { subscribed: true } }))
    stubDevice(fetchMock)
    expect(await fetchReminderStatus()).toEqual({ subscribed: true })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ type: 'status', endpoint: ENDPOINT })
  })
})