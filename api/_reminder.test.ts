// Underscore prefix: Vercel does not deploy this file as a function.
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  composeMessage,
  decide,
  handleReminder,
  isProgress,
  isReminderSub,
  KEYS,
  localClock,
  previousDay,
  todayView,
  upstashStore,
  VAPID_PUBLIC_KEY,
  depsFromEnv,
  type Deps,
  type ReminderProgress,
  type ReminderSub,
  type Sender,
  type Store,
} from './reminder.ts'

const TZ = 'Europe/Bratislava'
const SUB: ReminderSub = {
  subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } },
  time: '19:00',
  timeZone: TZ,
}
const progress = (over: Partial<ReminderProgress> = {}): ReminderProgress => ({
  day: '2026-07-01',
  done: 0,
  goal: 20,
  dueToday: 14,
  dueTomorrow: 17,
  streakDays: 12,
  activeToday: false,
  ...over,
})
// 2026-07-01 is summer time (UTC+2): 17:10 UTC = 19:10 in Bratislava.
const SUMMER_1910 = new Date('2026-07-01T17:10:00Z')

describe('localClock', () => {
  it('uses the phone time zone, in summer and in winter time', () => {
    expect(localClock(SUMMER_1910, TZ)).toEqual({ day: '2026-07-01', minutes: 19 * 60 + 10 })
    // Summer time ends on 2026-10-25: 17:10 UTC is 18:10 CET that evening.
    expect(localClock(new Date('2026-10-25T17:10:00Z'), TZ)).toEqual({ day: '2026-10-25', minutes: 18 * 60 + 10 })
  })

  it('turns the day at local midnight, not UTC', () => {
    expect(localClock(new Date('2026-07-01T22:30:00Z'), TZ)).toEqual({ day: '2026-07-02', minutes: 30 })
  })
})

describe('previousDay', () => {
  it('handles month and year boundaries', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2027-01-01')).toBe('2026-12-31')
  })
})

describe('todayView', () => {
  it('uses a report from today as is', () => {
    expect(todayView(progress({ done: 5, activeToday: true, streakDays: 13 }), '2026-07-01')).toEqual({ done: 5, goal: 20, due: 14, streak: 13 })
  })

  it('rolls a report from yesterday over to today', () => {
    expect(todayView(progress({ day: '2026-06-30', done: 25, activeToday: true }), '2026-07-01')).toEqual({ done: 0, goal: 20, due: 17, streak: 12 })
    // No practice yesterday: the streak is already broken today.
    expect(todayView(progress({ day: '2026-06-30', activeToday: false }), '2026-07-01').streak).toBe(0)
  })

  it('knows nothing from an older or missing report', () => {
    expect(todayView(progress({ day: '2026-06-20', goal: 30 }), '2026-07-01')).toEqual({ done: 0, goal: 30, due: null, streak: 0 })
    expect(todayView(null, '2026-07-01')).toEqual({ done: 0, goal: 20, due: null, streak: 0 })
  })
})

describe('composeMessage', () => {
  it('nudges a running streak with the cards waiting', () => {
    expect(composeMessage({ done: 0, goal: 20, due: 14, streak: 12 })).toEqual({
      title: '🔥 Séria 12 dní čaká na dnešok',
      body: 'Na zopakovanie: 14 kartičiek · stačí pár minút',
    })
  })

  it('uses Slovak plural forms', () => {
    expect(composeMessage({ done: 0, goal: 20, due: 1, streak: 1 })).toEqual({
      title: '🔥 Séria 1 deň čaká na dnešok',
      body: 'Na zopakovanie: 1 kartička · stačí pár minút',
    })
    expect(composeMessage({ done: 0, goal: 20, due: 3, streak: 3 }).title).toBe('🔥 Séria 3 dni čaká na dnešok')
    expect(composeMessage({ done: 0, goal: 20, due: 3, streak: 0 }).body).toBe('Na zopakovanie: 3 kartičky')
  })

  it('falls back to the daily goal without cards to review', () => {
    expect(composeMessage({ done: 0, goal: 20, due: 0, streak: 0 })).toEqual({ title: '¿Practicamos? 🇲🇽', body: 'Denný cieľ: 20 správnych odpovedí' })
    expect(composeMessage({ done: 0, goal: 10, due: null, streak: 2 }).body).toBe('Denný cieľ: 10 správnych odpovedí · stačí pár minút')
  })

  it('counts down to the goal once practice has started', () => {
    expect(composeMessage({ done: 12, goal: 20, due: 3, streak: 12 })).toEqual({ title: 'Ešte 8 do denného cieľa', body: 'Dnes 12/20 · séria 12 dní 🔥' })
    expect(composeMessage({ done: 12, goal: 20, due: 3, streak: 0 }).body).toBe('Dnes 12/20')
  })
})

describe('decide', () => {
  // Bratislava summer time.
  const at = (hhmm: string, day = '2026-07-01') => new Date(`${day}T${hhmm}:00+02:00`)

  it('sends inside the window when the goal is not met', () => {
    expect(decide(SUMMER_1910, SUB, progress({ day: '2026-06-30', activeToday: true }), null)).toEqual({
      send: true,
      day: '2026-07-01',
      message: { title: '🔥 Séria 12 dní čaká na dnešok', body: 'Na zopakovanie: 17 kartičiek · stačí pár minút' },
    })
  })

  it('waits for the chosen time and gives up two hours later', () => {
    expect(decide(at('18:59'), SUB, null, null)).toEqual({ send: false, reason: 'too-early' })
    expect(decide(at('19:00'), SUB, null, null).send).toBe(true)
    expect(decide(at('21:00'), SUB, null, null).send).toBe(true)
    expect(decide(at('21:01'), SUB, null, null)).toEqual({ send: false, reason: 'too-late' })
  })

  it('never runs the window past midnight', () => {
    const late = { ...SUB, time: '23:00' }
    expect(decide(at('23:59'), late, null, null).send).toBe(true)
    expect(decide(at('00:10', '2026-07-02'), late, null, null)).toEqual({ send: false, reason: 'too-early' })
  })

  it('sends once a day', () => {
    expect(decide(SUMMER_1910, SUB, null, '2026-07-01')).toEqual({ send: false, reason: 'already-sent' })
    expect(decide(SUMMER_1910, SUB, null, '2026-06-30').send).toBe(true)
  })

  it('stays quiet once the daily goal is met', () => {
    expect(decide(SUMMER_1910, SUB, progress({ done: 20, activeToday: true }), null)).toEqual({ send: false, reason: 'goal-met' })
  })
})

describe('validation', () => {
  it('accepts well-formed data only', () => {
    expect(isReminderSub(SUB)).toBe(true)
    expect(isReminderSub({ ...SUB, time: '7:00' })).toBe(false)
    expect(isReminderSub({ ...SUB, time: '24:00' })).toBe(false)
    expect(isReminderSub({ ...SUB, timeZone: 'Mars/Olympus' })).toBe(false)
    expect(isReminderSub({ ...SUB, subscription: { endpoint: 'http://push.example', keys: { p256dh: 'p', auth: 'a' } } })).toBe(false)
    expect(isProgress(progress())).toBe(true)
    expect(isProgress(progress({ done: -1 }))).toBe(false)
    expect(isProgress(progress({ goal: 0 }))).toBe(false)
    expect(isProgress({ ...progress(), day: 'yesterday' })).toBe(false)
  })
})

// ---------- HTTP ----------

const SECRET = 'cron-secret'
const OTHER_DEVICE = 'https://push.example/other-device'

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, string>(Object.entries(initial).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))
  const store: Store & { data: Map<string, string> } = {
    data,
    mget: async (keys) => keys.map((k) => data.get(k) ?? null),
    set: async (k, v) => {
      data.set(k, v)
    },
    del: async (k) => {
      data.delete(k)
    },
    setIfAbsent: async (k, v) => {
      if (data.has(k)) return false
      data.set(k, v)
      return true
    },
  }
  return store
}

const noop: Sender = async () => {}
const deps = (store: Store, send: Sender = noop, now = SUMMER_1910): Deps => ({ store, send, now: () => now, cronSecret: SECRET })

const cron = (secret = SECRET) => new Request('https://somos.example/api/reminder', { headers: { authorization: `Bearer ${secret}` } })
const post = (body: unknown, origin = 'https://somos.example') =>
  new Request('https://somos.example/api/reminder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin, host: 'somos.example' },
    body: JSON.stringify(body),
  })
const statusOf = async (res: Response) => ((await res.json()) as { status: unknown }).status
const pushError = (statusCode: number) => Object.assign(new Error('push refused'), { statusCode })

describe('api/reminder: cron tick', () => {
  it('refuses a request without the cron secret', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    expect((await handleReminder(cron('wrong'), deps(store))).status).toBe(401)
    expect((await handleReminder(new Request('https://somos.example/api/reminder'), deps(store))).status).toBe(401)
  })

  it('reports a missing configuration', async () => {
    const res = await handleReminder(cron(), undefined)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not-configured' })
  })

  it('sends the reminder and remembers the day', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB, [KEYS.progress]: progress({ day: '2026-06-30', activeToday: true }) })
    const send = vi.fn<Sender>(async () => {})
    const res = await handleReminder(cron(), deps(store, send))
    expect(await res.json()).toEqual({ sent: true, reason: 'sent' })
    expect(send).toHaveBeenCalledWith(
      SUB.subscription,
      JSON.stringify({ title: '🔥 Séria 12 dní čaká na dnešok', body: 'Na zopakovanie: 17 kartičiek · stačí pár minút', url: '/', id: '2026-07-01T17:10:00.000Z' }),
      { ttl: 14_400, topic: 'reminder', urgency: 'high' },
    )
    expect(store.data.get(KEYS.sent)).toBe('2026-07-01')
  })

  it('explains why it stayed quiet', async () => {
    const send = vi.fn<Sender>(async () => {})
    const store = memoryStore({ [KEYS.sub]: SUB, [KEYS.progress]: progress({ done: 20, activeToday: true }) })
    expect(await (await handleReminder(cron(), deps(store, send))).json()).toEqual({ sent: false, reason: 'goal-met' })
    expect(await (await handleReminder(cron(), deps(memoryStore(), send))).json()).toEqual({ sent: false, reason: 'no-subscription' })
    expect(send).not.toHaveBeenCalled()
  })

  it('treats unreadable stored data as missing', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB, [KEYS.progress]: '{not json', [KEYS.sent]: null })
    const send = vi.fn<Sender>(async () => {})
    expect(await (await handleReminder(cron(), deps(store, send))).json()).toEqual({ sent: true, reason: 'sent' })
    expect(send.mock.calls[0][1]).toContain('Denný cieľ: 20 správnych odpovedí')
  })

  it('forgets a subscription the push service no longer knows', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    const res = await handleReminder(cron(), deps(store, async () => Promise.reject(pushError(410))))
    expect(await res.json()).toEqual({ sent: false, reason: 'gone' })
    expect(store.data.has(KEYS.sub)).toBe(false)
    expect(store.data.has(KEYS.sent)).toBe(false)
  })

  it('makes the app replace a subscription the push service dropped', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    await handleReminder(cron(), deps(store, async () => Promise.reject(pushError(410))))
    const again = { type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: TZ }
    const res = await handleReminder(post(again), deps(store))
    expect(res.status).toBe(410)
    expect(await res.json()).toEqual({ error: 'gone' })
    expect(store.data.has(KEYS.sub)).toBe(false)
    const fresh = { ...again, subscription: { ...SUB.subscription, endpoint: 'https://push.example/fresh' } }
    expect((await handleReminder(post(fresh), deps(store))).status).toBe(200)
  })

  it('remembers when the last tick came and what it decided', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB, [KEYS.progress]: progress({ done: 20, activeToday: true }) })
    await handleReminder(cron(), deps(store))
    expect(JSON.parse(store.data.get(KEYS.tick)!)).toEqual({ at: '2026-07-01T17:10:00.000Z', reason: 'goal-met' })
    const empty = memoryStore()
    await handleReminder(cron(), deps(empty))
    expect(JSON.parse(empty.data.get(KEYS.tick)!)).toEqual({ at: '2026-07-01T17:10:00.000Z', reason: 'no-subscription' })
    // A request without the secret is not a tick.
    const untouched = memoryStore()
    await handleReminder(cron('wrong'), deps(untouched))
    expect(untouched.data.has(KEYS.tick)).toBe(false)
  })

  it('leaves the day open for the next tick after a failed send', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = memoryStore({ [KEYS.sub]: SUB })
    const res = await handleReminder(cron(), deps(store, async () => Promise.reject(pushError(500))))
    expect(res.status).toBe(502)
    expect(store.data.has(KEYS.sent)).toBe(false)
    expect(store.data.has(KEYS.sub)).toBe(true)
  })
})

describe('api/reminder: requests from the app', () => {
  it('only accepts requests from its own pages', async () => {
    const store = memoryStore()
    const res = await handleReminder(post({ type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: TZ }, 'https://evil.example'), deps(store))
    expect(res.status).toBe(403)
    expect(store.data.size).toBe(0)
  })

  it('stores a subscription with its time and time zone', async () => {
    const store = memoryStore()
    const body = { type: 'subscribe', subscription: { ...SUB.subscription, expirationTime: null }, time: '19:00', timeZone: TZ }
    expect((await handleReminder(post(body), deps(store))).status).toBe(200)
    expect(JSON.parse(store.data.get(KEYS.sub)!)).toEqual(SUB)
  })

  it('rejects malformed requests', async () => {
    const store = memoryStore()
    const bodies = [
      { type: 'subscribe', subscription: SUB.subscription, time: '25:00', timeZone: TZ },
      { type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: 'Nowhere/City' },
      { type: 'subscribe', subscription: { endpoint: 'https://push.example/x' }, time: '19:00', timeZone: TZ },
      { type: 'launch-rockets' },
      'not an object',
    ]
    for (const body of bodies) expect((await handleReminder(post(body), deps(store))).status).toBe(400)
    expect(store.data.size).toBe(0)
  })

  it('keeps progress only from the subscribed device', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    await handleReminder(post({ type: 'progress', endpoint: OTHER_DEVICE, progress: progress({ done: 3 }) }), deps(store))
    expect(store.data.has(KEYS.progress)).toBe(false)
    await handleReminder(post({ type: 'progress', endpoint: SUB.subscription.endpoint, progress: progress({ done: 3 }) }), deps(store))
    expect(JSON.parse(store.data.get(KEYS.progress)!)).toEqual(progress({ done: 3 }))
    const invalid = post({ type: 'progress', endpoint: SUB.subscription.endpoint, progress: { day: 'x' } })
    expect((await handleReminder(invalid, deps(store))).status).toBe(400)
  })

  it('unsubscribes only the device that asks', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    await handleReminder(post({ type: 'unsubscribe', endpoint: OTHER_DEVICE }), deps(store))
    expect(store.data.has(KEYS.sub)).toBe(true)
    await handleReminder(post({ type: 'unsubscribe', endpoint: SUB.subscription.endpoint }), deps(store))
    expect(store.data.has(KEYS.sub)).toBe(false)
  })

  it('sends a test notification at most once a minute', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    const send = vi.fn<Sender>(async () => {})
    const test = () => handleReminder(post({ type: 'test', endpoint: SUB.subscription.endpoint }), deps(store, send))
    expect((await test()).status).toBe(200)
    expect(send).toHaveBeenCalledWith(
      SUB.subscription,
      JSON.stringify({ title: 'SOMOS', body: 'Skúšobná notifikácia — pripomienky fungujú ✓', url: '/', id: '2026-07-01T17:10:00.000Z' }),
      { ttl: 14_400, topic: 'test', urgency: 'high' },
    )
    expect((await test()).status).toBe(429)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('reports a subscription dropped during a test, and refuses it afterwards', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    const test = post({ type: 'test', endpoint: SUB.subscription.endpoint })
    expect((await handleReminder(test, deps(store, async () => Promise.reject(pushError(410))))).status).toBe(410)
    const again = post({ type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: TZ })
    expect((await handleReminder(again, deps(store))).status).toBe(410)
  })

  it('tells what the server knows, without giving the subscription away', async () => {
    const tick = { at: '2026-07-01T17:00:30.000Z', reason: 'sent' }
    const store = memoryStore({ [KEYS.sub]: SUB, [KEYS.progress]: progress({ done: 3 }), [KEYS.sent]: '2026-07-01', [KEYS.tick]: tick })
    const res = await handleReminder(post({ type: 'status', endpoint: SUB.subscription.endpoint }), deps(store))
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      ok: true,
      status: {
        subscribed: true,
        thisDevice: true,
        time: '19:00',
        timeZone: TZ,
        serverClock: { day: '2026-07-01', time: '19:10' },
        sentDay: '2026-07-01',
        progress: progress({ done: 3 }),
        lastTick: tick,
        dropped: false,
        delivery: null,
        testPending: false,
      },
    })
    expect(text).not.toContain('push.example')

    const other = await handleReminder(post({ type: 'status', endpoint: OTHER_DEVICE }), deps(store))
    expect(await statusOf(other)).toMatchObject({ subscribed: true, thisDevice: false })
  })

  it('tells that it has no device, and whether the push service dropped it', async () => {
    const none = await handleReminder(post({ type: 'status' }), deps(memoryStore()))
    expect(await statusOf(none)).toEqual({
      subscribed: false,
      thisDevice: false,
      time: null,
      timeZone: null,
      serverClock: null,
      sentDay: null,
      progress: null,
      lastTick: null,
      dropped: false,
      delivery: null,
      testPending: false,
    })
    const dropped = await handleReminder(post({ type: 'status' }), deps(memoryStore({ [KEYS.gone]: SUB.subscription.endpoint })))
    expect(await statusOf(dropped)).toMatchObject({ subscribed: false, dropped: true })
  })

  it('refuses a test for a device that is not subscribed', async () => {
    const res = await handleReminder(post({ type: 'test', endpoint: OTHER_DEVICE }), deps(memoryStore({ [KEYS.sub]: SUB })))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'not-subscribed' })
  })
})

describe('api/reminder: did the phone get it', () => {
  const endpoint = SUB.subscription.endpoint
  const SENT_AT = '2026-07-01T17:10:00.000Z'
  const LATER = new Date('2026-07-01T17:10:04Z')
  const deliveryOf = (store: { data: Map<string, string> }) => JSON.parse(store.data.get(KEYS.delivery) ?? 'null') as unknown

  it('remembers what it sent and when', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    await handleReminder(cron(), deps(store))
    expect(deliveryOf(store)).toEqual({ kind: 'reminder', sentAt: SENT_AT, receipts: false })
    await handleReminder(post({ type: 'test', endpoint }), deps(store, noop, LATER))
    expect(deliveryOf(store)).toEqual({ kind: 'test', sentAt: '2026-07-01T17:10:04.000Z', receipts: false })
  })

  it('notes that the phone can confirm, once its app says so', async () => {
    const store = memoryStore()
    await handleReminder(post({ type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: TZ, receipts: true }), deps(store))
    expect(JSON.parse(store.data.get(KEYS.sub)!)).toEqual({ ...SUB, receipts: true })
    await handleReminder(cron(), deps(store))
    expect(deliveryOf(store)).toEqual({ kind: 'reminder', sentAt: SENT_AT, receipts: true })
  })

  it('takes the phone’s word that it showed the message, or why it could not', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    await handleReminder(cron(), deps(store))
    await handleReminder(post({ type: 'received', endpoint, id: SENT_AT, shown: true }), deps(store, noop, LATER))
    expect(deliveryOf(store)).toEqual({ kind: 'reminder', sentAt: SENT_AT, receipts: false, receivedAt: '2026-07-01T17:10:04.000Z', shown: true })

    await handleReminder(post({ type: 'received', endpoint, id: SENT_AT, shown: false, error: 'NotAllowedError: no permission' }), deps(store, noop, LATER))
    expect(deliveryOf(store)).toMatchObject({ shown: false, error: 'NotAllowedError: no permission' })
  })

  it('ignores a receipt from another device, or for another message', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    await handleReminder(cron(), deps(store))
    await handleReminder(post({ type: 'received', endpoint: OTHER_DEVICE, id: SENT_AT, shown: true }), deps(store, noop, LATER))
    await handleReminder(post({ type: 'received', endpoint, id: '2026-06-30T17:00:00.000Z', shown: true }), deps(store, noop, LATER))
    const res = await handleReminder(post({ type: 'received', endpoint, id: SENT_AT }), deps(store, noop, LATER))
    expect(res.status).toBe(400)
    expect(deliveryOf(store)).toEqual({ kind: 'reminder', sentAt: SENT_AT, receipts: false })
  })

  it('sends a test asked for later at the next tick, whatever the hour', async () => {
    const MORNING = new Date('2026-07-01T06:00:00Z')
    const store = memoryStore({ [KEYS.sub]: SUB })
    const send = vi.fn<Sender>(async () => {})
    expect((await handleReminder(post({ type: 'test-later', endpoint: OTHER_DEVICE }), deps(store, send, MORNING))).status).toBe(409)
    expect((await handleReminder(post({ type: 'test-later', endpoint }), deps(store, send, MORNING))).status).toBe(200)
    expect(send).not.toHaveBeenCalled()
    expect(await statusOf(await handleReminder(post({ type: 'status', endpoint }), deps(store, send, MORNING)))).toMatchObject({ testPending: true })

    // The tick sends it, and still decides about the reminder itself.
    expect(await (await handleReminder(cron(), deps(store, send, MORNING))).json()).toEqual({ sent: false, reason: 'too-early' })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1]).toContain('Skúšobná notifikácia')
    expect(send.mock.calls[0][2]).toMatchObject({ topic: 'test' })
    expect(deliveryOf(store)).toMatchObject({ kind: 'test', sentAt: '2026-07-01T06:00:00.000Z' })

    // Once: the next tick has nothing left to send.
    await handleReminder(cron(), deps(store, send, MORNING))
    expect(send).toHaveBeenCalledTimes(1)
    expect(await statusOf(await handleReminder(post({ type: 'status', endpoint }), deps(store, send, MORNING)))).toMatchObject({
      testPending: false,
      delivery: { kind: 'test', sentAt: '2026-07-01T06:00:00.000Z', receipts: false },
    })
  })
})

describe('api/reminder: one device, and it stays where the learner put it', () => {
  const PHONE = 'phone-device-1'
  const LAPTOP = 'laptop-device-2'
  const LAPTOP_SUB = { ...SUB.subscription, endpoint: OTHER_DEVICE }
  const subscribe = (subscription: unknown, extra: Record<string, unknown>) => post({ type: 'subscribe', subscription, time: '19:00', timeZone: TZ, ...extra })
  const storedEndpoint = (store: { data: Map<string, string> }) => (JSON.parse(store.data.get(KEYS.sub)!) as ReminderSub).subscription.endpoint

  it('does not hand the reminders to another device that only opened the app', async () => {
    const store = memoryStore({ [KEYS.sub]: { ...SUB, device: PHONE } })
    const res = await handleReminder(subscribe(LAPTOP_SUB, { device: LAPTOP }), deps(store))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'other-device' })
    expect(storedEndpoint(store)).toBe(SUB.subscription.endpoint)
  })

  it('moves them when the learner asks for them there', async () => {
    const store = memoryStore({ [KEYS.sub]: { ...SUB, device: PHONE } })
    expect((await handleReminder(subscribe(LAPTOP_SUB, { device: LAPTOP, takeOver: true }), deps(store))).status).toBe(200)
    expect(JSON.parse(store.data.get(KEYS.sub)!)).toEqual({ ...SUB, subscription: LAPTOP_SUB, device: LAPTOP })
  })

  it('follows the same device to a new subscription', async () => {
    const store = memoryStore({ [KEYS.sub]: { ...SUB, device: PHONE } })
    const rotated = { ...SUB.subscription, endpoint: 'https://push.example/rotated' }
    expect((await handleReminder(subscribe(rotated, { device: PHONE }), deps(store))).status).toBe(200)
    expect(storedEndpoint(store)).toBe(rotated.endpoint)
  })

  it('keeps a phone stored before devices had ids, and learns its id when it checks in', async () => {
    const store = memoryStore({ [KEYS.sub]: SUB })
    expect((await handleReminder(subscribe(LAPTOP_SUB, { device: LAPTOP }), deps(store))).status).toBe(409)
    expect((await handleReminder(subscribe(SUB.subscription, { device: PHONE }), deps(store))).status).toBe(200)
    expect(JSON.parse(store.data.get(KEYS.sub)!)).toEqual({ ...SUB, device: PHONE })
  })

  it('takes the first device when there is none, and ignores an id that is not one', async () => {
    const store = memoryStore()
    expect((await handleReminder(subscribe(SUB.subscription, { device: PHONE }), deps(store))).status).toBe(200)
    expect(JSON.parse(store.data.get(KEYS.sub)!)).toEqual({ ...SUB, device: PHONE })
    const other = memoryStore()
    await handleReminder(subscribe(SUB.subscription, { device: 'x y' }), deps(other))
    expect(JSON.parse(other.data.get(KEYS.sub)!)).toEqual(SUB)
  })
})

describe('upstashStore', () => {
  it('sends Redis commands to the REST endpoint', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ result: 'OK' }))
    const store = upstashStore('https://redis.example', 'token', fetchImpl)
    expect(await store.setIfAbsent(KEYS.test, '1', 60)).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://redis.example')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token')
    expect(JSON.parse(init.body as string)).toEqual(['SET', KEYS.test, '1', 'EX', 60, 'NX'])
  })

  it('throws on an Upstash error', async () => {
    const store = upstashStore('https://redis.example', 'token', vi.fn(async () => Response.json({ error: 'WRONGPASS' }, { status: 401 })))
    await expect(store.mget([KEYS.sub])).rejects.toThrow('WRONGPASS')
  })
})

describe('VAPID public key', () => {
  it('is the same in the app and on the server', async () => {
    const app = await readFile(new URL('../src/lib/reminder.ts', import.meta.url), 'utf8')
    expect(app).toContain(`export const VAPID_PUBLIC_KEY = '${VAPID_PUBLIC_KEY}'`)
  })
})

describe('depsFromEnv', () => {
  const base = { VAPID_PRIVATE_KEY: 'priv', CRON_SECRET: 'secret' }

  it('accepts KV_REST_API_*', () => {
    const deps = depsFromEnv({ ...base, KV_REST_API_URL: 'https://url', KV_REST_API_TOKEN: 'tok' })
    expect(deps).toBeDefined()
    expect(deps?.cronSecret).toBe('secret')
  })

  it('accepts STORAGE_KV_REST_API_* from Vercel storage default prefix', () => {
    const deps = depsFromEnv({ ...base, STORAGE_KV_REST_API_URL: 'https://url', STORAGE_KV_REST_API_TOKEN: 'tok' })
    expect(deps).toBeDefined()
    expect(deps?.cronSecret).toBe('secret')
  })

  it('accepts UPSTASH_REDIS_REST_*', () => {
    const deps = depsFromEnv({ ...base, UPSTASH_REDIS_REST_URL: 'https://url', UPSTASH_REDIS_REST_TOKEN: 'tok' })
    expect(deps).toBeDefined()
  })

  it('returns undefined if any key is missing', () => {
    expect(depsFromEnv({ ...base, STORAGE_KV_REST_API_URL: 'https://url' })).toBeUndefined()
    expect(depsFromEnv({ KV_REST_API_URL: 'https://url', KV_REST_API_TOKEN: 'tok' })).toBeUndefined()
  })
})


describe('the reminder in the learner\'s language', () => {
  const EN_SUB: ReminderSub = { ...SUB, language: 'en' }

  it('composes the message in English', () => {
    expect(composeMessage({ done: 0, goal: 20, due: 14, streak: 12 }, 'en')).toEqual({
      title: '🔥 A 12-day streak is waiting for today',
      body: 'To review: 14 cards · a few minutes is enough',
    })
    expect(composeMessage({ done: 0, goal: 20, due: 1, streak: 0 }, 'en').body).toBe('To review: 1 card')
    expect(composeMessage({ done: 0, goal: 1, due: null, streak: 0 }, 'en')).toEqual({ title: '¿Practicamos? 🇲🇽', body: 'Daily goal: 1 correct answer' })
    expect(composeMessage({ done: 12, goal: 20, due: 3, streak: 1 }, 'en')).toEqual({ title: '8 to go for the daily goal', body: 'Today 12/20 · 1-day streak 🔥' })
  })

  it('stays Slovak for a subscription stored before there were two languages', () => {
    expect(isReminderSub(SUB)).toBe(true)
    expect(isReminderSub(EN_SUB)).toBe(true)
    expect(isReminderSub({ ...SUB, language: 'de' })).toBe(false)
    const decision = decide(SUMMER_1910, SUB, progress({ day: '2026-06-30', activeToday: true }), null)
    expect(decision.send && decision.message.title).toBe('🔥 Séria 12 dní čaká na dnešok')
  })

  it('keeps the language of a subscribing phone and sends the reminder in it', async () => {
    const store = memoryStore({})
    const body = { type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: TZ, language: 'en' }
    expect((await handleReminder(post(body), deps(store))).status).toBe(200)
    expect(JSON.parse(store.data.get(KEYS.sub)!)).toEqual(EN_SUB)

    const send = vi.fn<Sender>(async () => {})
    await handleReminder(cron(), deps(store, send))
    expect(JSON.parse(send.mock.calls[0][1])).toEqual({ title: '¿Practicamos? 🇲🇽', body: 'Daily goal: 20 correct answers', url: '/', id: '2026-07-01T17:10:00.000Z', lang: 'en' })

    // The test notification too.
    await handleReminder(post({ type: 'test', endpoint: SUB.subscription.endpoint }), deps(store, send))
    expect(JSON.parse(send.mock.calls[1][1])).toMatchObject({ body: 'Test notification — reminders work ✓', lang: 'en' })
  })

  it('stores nothing extra for a Slovak phone, and ignores a language it does not know', async () => {
    for (const language of ['sk', 'de', undefined]) {
      const store = memoryStore({})
      await handleReminder(post({ type: 'subscribe', subscription: SUB.subscription, time: '19:00', timeZone: TZ, language }), deps(store))
      expect(JSON.parse(store.data.get(KEYS.sub)!)).toEqual(SUB)
    }
  })
})
