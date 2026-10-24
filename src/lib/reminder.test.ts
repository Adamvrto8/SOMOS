import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReminderProgress } from './reminderProgress'

// The account and today's numbers come from Supabase and Dexie in the app; here the tests set them.
const fake = vi.hoisted(() => ({
  token: null as string | null,
  signedIn: false,
  accountListeners: [] as (() => void)[],
  progress: null as ReminderProgress | null,
}))
vi.mock('./account', () => ({
  accessToken: async () => fake.token,
  getAccount: () => (fake.signedIn ? { userId: 'user-1', email: 'adam@example.com' } : null),
  subscribeAccount: (notify: () => void) => {
    fake.accountListeners.push(notify)
    return () => {}
  },
}))
vi.mock('./reminderProgress', () => ({
  loadProgress: async () => {
    if (!fake.progress) throw new Error('no database in this test')
    return fake.progress
  },
}))

import {
  base64UrlToBytes,
  enableReminder,
  fetchReminderStatus,
  keepReminderSynced,
  noteAnswer,
  parseSettings,
  reminderProblem,
  reportProgress,
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

  it('names the device and never asks to take reminders over', async () => {
    const bodies: Record<string, unknown>[] = []
    stubDevice(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return Response.json({ ok: true })
    })
    await enableReminder('19:00')
    await syncReminder()
    for (const body of bodies.filter((b) => b.type === 'subscribe')) {
      expect(body).toMatchObject({ device: expect.any(String), receipts: true })
      expect(body).not.toHaveProperty('takeOver')
    }
    expect(bodies.filter((b) => b.type === 'subscribe')).toHaveLength(2)
  })

  it('links the device to the account signed in, and checks in again on sign-in and sign-out', async () => {
    const headers: Headers[] = []
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (JSON.parse(String(init?.body)).type === 'subscribe') headers.push(new Headers(init?.headers))
      return Response.json({ ok: true })
    })
    stubDevice(fetchMock)
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
    await enableReminder('19:00')
    expect(headers[0].has('authorization')).toBe(false)

    keepReminderSynced()
    await vi.waitFor(() => expect(headers).toHaveLength(2))
    fake.token = 'access-token'
    fake.signedIn = true
    fake.accountListeners.forEach((notify) => notify())
    await vi.waitFor(() => expect(headers).toHaveLength(3))
    expect(headers[2].get('authorization')).toBe('Bearer access-token')

    fake.token = null
    fake.signedIn = false
    fake.accountListeners.forEach((notify) => notify())
    await vi.waitFor(() => expect(headers).toHaveLength(4))
    expect(headers[3].has('authorization')).toBe(false)
  })

  it('says it is signed in when it could not get a token, so the server keeps the link', async () => {
    const bodies: Record<string, unknown>[] = []
    stubDevice(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return Response.json({ ok: true })
    })
    fake.signedIn = true
    await syncReminder()
    fake.signedIn = false
    await syncReminder()
    const subscribes = bodies.filter((b) => b.type === 'subscribe')
    expect(subscribes[0]).toMatchObject({ account: true })
    expect(subscribes[1]).not.toHaveProperty('account')
  })

  it('asks the server what it knows about this device', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true, status: { subscribed: true } }))
    stubDevice(fetchMock)
    expect(await fetchReminderStatus()).toEqual({ subscribed: true })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ type: 'status', endpoint: ENDPOINT })
  })
})

describe('progress reports', () => {
  const ENDPOINT = 'https://push.example/1'
  const subscription = { endpoint: ENDPOINT, toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => true }
  const today = (done: number): ReminderProgress => ({ day: '2026-07-01', done, goal: 20, dueToday: 5, dueTomorrow: 8, streakDays: 3, activeToday: done >= 20 })
  let reports: ReminderProgress[]

  beforeEach(async () => {
    vi.useFakeTimers()
    reports = []
    vi.stubEnv('DEV', false)
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: async () => 'granted' })
    vi.stubGlobal('window', { PushManager: class {}, Notification: {}, setTimeout, clearTimeout })
    const pushManager = { getSubscription: async () => subscription, subscribe: async () => subscription }
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { ready: Promise.resolve({ pushManager }) } })
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { type: string; progress?: ReminderProgress }
      if (body.type === 'progress') reports.push(body.progress!)
      return Response.json({ ok: true })
    })
    fake.progress = today(0)
    await enableReminder('19:00')
    // Turning it on reports at once (without waiting for it).
    await vi.waitFor(() => expect(reports).toHaveLength(1))
    reports = []
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fake.progress = null
  })

  it('sends nothing for an answer below the goal, and once for the answer that reaches it', async () => {
    fake.progress = today(5)
    noteAnswer()
    await vi.advanceTimersByTimeAsync(3000)
    expect(reports).toEqual([])

    fake.progress = today(20)
    noteAnswer()
    await vi.advanceTimersByTimeAsync(3000)
    expect(reports).toEqual([today(20)])

    fake.progress = today(21)
    noteAnswer()
    await vi.advanceTimersByTimeAsync(3000)
    expect(reports).toHaveLength(1)
  })

  it('reports a change from the settings, but not the same numbers twice', async () => {
    fake.progress = today(4)
    reportProgress()
    await vi.advanceTimersByTimeAsync(3000)
    reportProgress()
    await vi.advanceTimersByTimeAsync(3000)
    expect(reports).toEqual([today(4)])

    fake.progress = { ...today(4), goal: 30 }
    reportProgress()
    await vi.advanceTimersByTimeAsync(3000)
    expect(reports).toHaveLength(2)
  })

  it('reports again after checking in, since the server may have made the device anew', async () => {
    fake.progress = today(4)
    reportProgress()
    await vi.advanceTimersByTimeAsync(3000)
    await syncReminder()
    expect(reports).toEqual([today(4), today(4)])
  })
})
