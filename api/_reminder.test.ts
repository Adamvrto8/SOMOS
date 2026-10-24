// Underscore prefix: Vercel does not deploy this file as a function.
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  ipNetwork,
  NEW_DEVICES_PER_HOUR_TOTAL,
  bestProgress,
  composeMessage,
  decide,
  depsFromEnv,
  fromDeviceRow,
  handleReminder,
  ipKey,
  isProgress,
  isPushHost,
  isReminderSub,
  localClock,
  MAX_DEVICES,
  NEW_DEVICES_PER_HOUR,
  previousDay,
  supabaseStore,
  supabaseUser,
  TICK_BUDGET_MS,
  TICK_LIMIT,
  todayView,
  toDeviceRow,
  VAPID_PUBLIC_KEY,
  type DeviceRow,
  type DeviceStore,
  type Deps,
  type LastTick,
  type ReminderProgress,
  type ReminderSub,
  type Sender,
} from './reminder.ts'

const TZ = 'Europe/Bratislava'
// The shapes a browser makes: an uncompressed P-256 point (65 bytes) and a 16-byte secret.
const P256DH = Buffer.from([4, ...Array<number>(64).fill(7)]).toString('base64url')
const AUTH = Buffer.alloc(16, 9).toString('base64url')
const P256DH_2 = Buffer.from([4, ...Array<number>(64).fill(8)]).toString('base64url')
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc'
const SUB: ReminderSub = {
  subscription: { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH } },
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

describe('bestProgress', () => {
  const DAY = '2026-07-01'

  it('takes the report from today with the most done', () => {
    const phone = progress({ done: 3 })
    const tablet = progress({ done: 12 })
    expect(bestProgress(phone, [tablet], DAY)).toEqual(tablet)
    expect(bestProgress(tablet, [phone], DAY)).toBe(tablet)
  })

  it('keeps the device’s own goal', () => {
    const phone = progress({ done: 3, goal: 20 })
    const tablet = progress({ done: 30, goal: 50 })
    expect(bestProgress(phone, [tablet], DAY)).toEqual({ ...tablet, goal: 20 })
    expect(bestProgress(null, [tablet], DAY)).toBe(tablet)
  })

  it('prefers a report from today over a busier one from yesterday', () => {
    const today = progress({ done: 1 })
    const yesterday = progress({ day: '2026-06-30', done: 30 })
    expect(bestProgress(yesterday, [today], DAY)).toEqual(today)
  })

  it('falls back to the busiest report from yesterday, then to the device’s own', () => {
    const a = progress({ day: '2026-06-30', done: 4 })
    const b = progress({ day: '2026-06-30', done: 9 })
    expect(bestProgress(a, [b], DAY)).toEqual(b)
    const old = progress({ day: '2026-06-01' })
    expect(bestProgress(old, [progress({ day: '2026-05-01' })], DAY)).toBe(old)
    expect(bestProgress(null, [], DAY)).toBeNull()
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

  it('composes the message in English', () => {
    expect(composeMessage({ done: 0, goal: 20, due: 14, streak: 12 }, 'en')).toEqual({
      title: '🔥 A 12-day streak is waiting for today',
      body: 'To review: 14 cards · a few minutes is enough',
    })
    expect(composeMessage({ done: 0, goal: 20, due: 1, streak: 0 }, 'en').body).toBe('To review: 1 card')
    expect(composeMessage({ done: 0, goal: 1, due: null, streak: 0 }, 'en')).toEqual({ title: '¿Practicamos? 🇲🇽', body: 'Daily goal: 1 correct answer' })
    expect(composeMessage({ done: 12, goal: 20, due: 3, streak: 1 }, 'en')).toEqual({ title: '8 to go for the daily goal', body: 'Today 12/20 · 1-day streak 🔥' })
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

  it('speaks the device’s language', () => {
    const decision = decide(SUMMER_1910, { ...SUB, language: 'en' }, null, null)
    expect(decision.send && decision.message.body).toBe('Daily goal: 20 correct answers')
  })
})

describe('validation', () => {
  it('accepts well-formed data only', () => {
    expect(isReminderSub(SUB)).toBe(true)
    expect(isReminderSub({ ...SUB, language: 'en' })).toBe(true)
    expect(isReminderSub({ ...SUB, language: 'de' })).toBe(false)
    expect(isReminderSub({ ...SUB, time: '7:00' })).toBe(false)
    expect(isReminderSub({ ...SUB, time: '24:00' })).toBe(false)
    expect(isReminderSub({ ...SUB, timeZone: 'Mars/Olympus' })).toBe(false)
    expect(isProgress(progress())).toBe(true)
    expect(isProgress(progress({ done: -1 }))).toBe(false)
    expect(isProgress(progress({ goal: 0 }))).toBe(false)
    expect(isProgress({ ...progress(), day: 'yesterday' })).toBe(false)
  })

  it('sends only to the push services of the browsers', () => {
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/x',
      'https://updates.push.services.mozilla.com/wpush/v2/x',
      'https://web.push.apple.com/x',
      'https://db5p.notify.windows.com/w/?token=x',
    ]) {
      expect(isPushHost(ok)).toBe(true)
    }
    for (const bad of ['https://push.example/x', 'https://fcm.googleapis.com.evil.example/x', 'https://evilfcm.googleapis.com.example/x', 'http://fcm.googleapis.com/x', 'not a url']) {
      expect(isPushHost(bad)).toBe(false)
    }
    expect(isReminderSub({ ...SUB, subscription: { endpoint: 'https://push.example/x', keys: { p256dh: P256DH, auth: AUTH } } })).toBe(false)
  })

  it('takes only keys of the shape a browser makes', () => {
    const withKeys = (p256dh: unknown, auth: unknown) => isReminderSub({ ...SUB, subscription: { endpoint: ENDPOINT, keys: { p256dh, auth } } })
    expect(withKeys(P256DH, AUTH)).toBe(true)
    expect(withKeys('p', 'a')).toBe(false)
    expect(withKeys(Buffer.alloc(65, 4).toString('base64url'), AUTH)).toBe(true)
    expect(withKeys(Buffer.from([2, ...Array<number>(64).fill(7)]).toString('base64url'), AUTH)).toBe(false) // compressed point
    expect(withKeys(P256DH, Buffer.alloc(15).toString('base64url'))).toBe(false)
    expect(withKeys(`${P256DH}!`, AUTH)).toBe(false)
  })
})

// ---------- HTTP, with the devices in memory ----------

const SECRET = 'cron-secret'
const PHONE = 'phone-device-1'
const TABLET = 'tablet-device-2'
const TABLET_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/tablet'

const device = (over: Partial<DeviceRow> = {}): DeviceRow => ({
  device: PHONE,
  userId: null,
  endpoint: ENDPOINT,
  p256dh: P256DH,
  auth: AUTH,
  time: '19:00',
  timeZone: TZ,
  language: 'sk',
  receipts: false,
  progress: null,
  handledDay: null,
  sentDay: null,
  delivery: null,
  lastDecision: null,
  testAt: null,
  testLater: false,
  seenAt: '2026-07-01T00:00:00.000Z',
  ...over,
})
const tablet = (over: Partial<DeviceRow> = {}) => device({ device: TABLET, endpoint: TABLET_ENDPOINT, ...over })

/** Like push_devices and reminders_due, in memory. */
function memoryDevices(initial: DeviceRow[] = []) {
  const rows = new Map(initial.map((r) => [r.device, r]))
  const gone = new Set<string>()
  const rate = new Map<string, number>()
  const state = { tick: null as (LastTick & { sent: number }) | null, cleanups: 0 }
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  const store: DeviceStore & { rows: typeof rows; gone: typeof gone; state: typeof state } = {
    rows,
    gone,
    state,
    byEndpoint: async (endpoint) => [...rows.values()].find((r) => r.endpoint === endpoint) ?? null,
    byDevice: async (id) => rows.get(id) ?? null,
    save: async (row) => {
      for (const r of [...rows.values()]) if (r.endpoint === row.endpoint && r.device !== row.device) rows.delete(r.device)
      rows.set(row.device, row)
    },
    update: async (id, fields) => {
      const r = rows.get(id)
      if (r) rows.set(id, { ...r, ...fields })
    },
    remove: async (id) => {
      rows.delete(id)
    },
    due: async (now, limit) =>
      [...rows.values()]
        .filter((r) => {
          const clock = localClock(now, r.timeZone)
          const start = minutes(r.time)
          return r.testLater || (clock.minutes >= start && clock.minutes <= Math.min(start + 120, 1439) && r.handledDay !== clock.day)
        })
        // Like reminders_due: looked at longest ago first.
        .sort((a, b) => (a.lastDecision?.at ?? '').localeCompare(b.lastDecision?.at ?? '') || a.device.localeCompare(b.device))
        .slice(0, limit),
    reportsOf: async (userIds) =>
      [...rows.values()].flatMap((r) => (r.userId && userIds.includes(r.userId) && r.progress ? [{ userId: r.userId, device: r.device, progress: r.progress }] : [])),
    isGone: async (endpoint) => gone.has(endpoint),
    markGone: async (endpoint) => {
      gone.add(endpoint)
    },
    lastTick: async () => state.tick && { at: state.tick.at, reason: state.tick.reason },
    recordTick: async (tick) => {
      state.tick = tick
    },
    count: async () => rows.size,
    claimTest: async (id, now) => {
      const r = rows.get(id)
      if (!r || (r.testAt && now.getTime() - new Date(r.testAt).getTime() < 60_000)) return false
      rows.set(id, { ...r, testAt: now.toISOString() })
      return true
    },
    rateHit: async (key, limit) => {
      const n = (rate.get(key) ?? 0) + 1
      rate.set(key, n)
      return n <= limit
    },
    cleanup: async () => {
      state.cleanups++
    },
  }
  return store
}

const noop: Sender = async () => {}
const deps = (store: DeviceStore, send: Sender = noop, now = SUMMER_1910, over: Partial<Deps> = {}): Deps => ({
  store,
  send,
  now: () => now,
  cronSecret: SECRET,
  userOf: async () => null,
  ipOf: () => 'ip-1',
  ...over,
})

const cron = (secret = SECRET) => new Request('https://somos.example/api/reminder', { headers: { authorization: `Bearer ${secret}` } })
const post = (body: unknown, { origin = 'https://somos.example', token }: { origin?: string; token?: string } = {}) =>
  new Request('https://somos.example/api/reminder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin, host: 'somos.example', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
const subscribeBody = (over: Record<string, unknown> = {}) => ({
  type: 'subscribe',
  subscription: { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH } },
  time: '19:00',
  timeZone: TZ,
  device: PHONE,
  ...over,
})
const tabletSubscription = { endpoint: TABLET_ENDPOINT, keys: { p256dh: P256DH_2, auth: AUTH } }
const statusOf = async (res: Response) => ((await res.json()) as { status: Record<string, unknown> }).status
const pushError = (statusCode: number) => Object.assign(new Error('push refused'), { statusCode })

describe('api/reminder: requests from the app', () => {
  it('only accepts requests from its own pages', async () => {
    const store = memoryDevices()
    const res = await handleReminder(post(subscribeBody(), { origin: 'https://evil.example' }), deps(store))
    expect(res.status).toBe(403)
    expect(store.rows.size).toBe(0)
  })

  it('reports a missing configuration', async () => {
    const res = await handleReminder(post(subscribeBody()), undefined)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not-configured' })
  })

  it('stores a device with its time, time zone, language and receipts', async () => {
    const store = memoryDevices()
    const body = subscribeBody({ subscription: { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH }, expirationTime: null }, language: 'en', receipts: true })
    expect((await handleReminder(post(body), deps(store))).status).toBe(200)
    expect(store.rows.get(PHONE)).toEqual(device({ language: 'en', receipts: true, seenAt: SUMMER_1910.toISOString() }))
  })

  it('keeps Slovak for any language it does not know', async () => {
    for (const language of ['sk', 'de', undefined]) {
      const store = memoryDevices()
      await handleReminder(post(subscribeBody({ language })), deps(store))
      expect(store.rows.get(PHONE)?.language).toBe('sk')
    }
  })

  it('rejects malformed requests', async () => {
    const store = memoryDevices()
    const bodies = [
      subscribeBody({ time: '25:00' }),
      subscribeBody({ timeZone: 'Nowhere/City' }),
      subscribeBody({ subscription: { endpoint: ENDPOINT } }),
      subscribeBody({ subscription: { endpoint: 'https://push.example/x', keys: { p256dh: P256DH, auth: AUTH } } }),
      subscribeBody({ device: undefined }),
      subscribeBody({ device: 'x y' }),
      { type: 'launch-rockets' },
      'not an object',
    ]
    for (const body of bodies) expect((await handleReminder(post(body), deps(store))).status).toBe(400)
    expect(store.rows.size).toBe(0)
  })

  it('keeps every device that subscribes, each with its own settings', async () => {
    const store = memoryDevices()
    await handleReminder(post(subscribeBody()), deps(store))
    const res = await handleReminder(post(subscribeBody({ device: TABLET, subscription: tabletSubscription, time: '08:00', language: 'en' })), deps(store))
    expect(res.status).toBe(200)
    expect(store.rows.size).toBe(2)
    expect(store.rows.get(PHONE)).toMatchObject({ time: '19:00', language: 'sk' })
    expect(store.rows.get(TABLET)).toMatchObject({ time: '08:00', language: 'en', endpoint: TABLET_ENDPOINT })
  })

  it('ignores takeOver from an older app: there is nothing to take over', async () => {
    const store = memoryDevices([device()])
    const res = await handleReminder(post(subscribeBody({ device: TABLET, subscription: tabletSubscription, takeOver: true })), deps(store))
    expect(res.status).toBe(200)
    expect(store.rows.size).toBe(2)
  })

  it('follows a device to a new subscription, and keeps what it knew', async () => {
    const store = memoryDevices([device({ sentDay: '2026-06-30', progress: progress() })])
    const rotated = { endpoint: 'https://fcm.googleapis.com/fcm/send/rotated', keys: { p256dh: P256DH_2, auth: AUTH } }
    await handleReminder(post(subscribeBody({ subscription: rotated })), deps(store))
    expect(store.rows.size).toBe(1)
    expect(store.rows.get(PHONE)).toMatchObject({ endpoint: rotated.endpoint, p256dh: P256DH_2, sentDay: '2026-06-30', progress: progress() })
  })

  it('moves a subscription to the new id of the same browser (storage cleared)', async () => {
    const store = memoryDevices([device({ sentDay: '2026-06-30' })])
    await handleReminder(post(subscribeBody({ device: 'fresh-device-id' })), deps(store))
    expect([...store.rows.keys()]).toEqual(['fresh-device-id'])
    expect(store.rows.get('fresh-device-id')?.sentDay).toBe('2026-06-30')
  })

  it('links the device to the account of a valid token, and unlinks it without one', async () => {
    const store = memoryDevices()
    const userOf = vi.fn(async (token: string) => (token === 'good' ? 'user-1' : null))
    await handleReminder(post(subscribeBody(), { token: 'good' }), deps(store, noop, SUMMER_1910, { userOf }))
    expect(store.rows.get(PHONE)?.userId).toBe('user-1')
    // A token that cannot be checked right now keeps the link.
    await handleReminder(post(subscribeBody(), { token: 'expired' }), deps(store, noop, SUMMER_1910, { userOf }))
    expect(store.rows.get(PHONE)?.userId).toBe('user-1')
    // Signed out.
    await handleReminder(post(subscribeBody()), deps(store, noop, SUMMER_1910, { userOf }))
    expect(store.rows.get(PHONE)?.userId).toBeNull()
  })

  it('keeps the link of an app that is signed in but could not get a token', async () => {
    const store = memoryDevices([device({ userId: 'user-1' })])
    await handleReminder(post(subscribeBody({ account: true })), deps(store))
    expect(store.rows.get(PHONE)?.userId).toBe('user-1')
  })

  it('changes only the device’s own settings when it checks in, not what a tick or a report wrote', async () => {
    const store = memoryDevices([device({ time: '18:00' })])
    // The tick sends and a report arrives while the check-in waits on Supabase Auth.
    const userOf = async () => {
      await store.update(PHONE, { handledDay: '2026-07-01', sentDay: '2026-07-01', progress: progress({ done: 20 }) })
      return 'user-1'
    }
    await handleReminder(post(subscribeBody({ time: '19:30' }), { token: 'good' }), deps(store, noop, SUMMER_1910, { userOf }))
    expect(store.rows.get(PHONE)).toMatchObject({ time: '19:30', userId: 'user-1', handledDay: '2026-07-01', sentDay: '2026-07-01', progress: progress({ done: 20 }) })
  })

  it('frees a new endpoint of the device from a row that still holds it', async () => {
    const store = memoryDevices([device(), tablet()])
    await handleReminder(post(subscribeBody({ subscription: tabletSubscription })), deps(store))
    expect([...store.rows.keys()]).toEqual([PHONE])
    expect(store.rows.get(PHONE)?.endpoint).toBe(TABLET_ENDPOINT)
  })

  it('stores the time zone under the name Postgres knows', async () => {
    const store = memoryDevices()
    await handleReminder(post(subscribeBody({ timeZone: 'europe/bratislava' })), deps(store))
    expect(store.rows.get(PHONE)?.timeZone).toBe('Europe/Bratislava')
  })

  it('limits new devices per IP address, but never a device checking in again', async () => {
    const store = memoryDevices()
    for (let i = 0; i < NEW_DEVICES_PER_HOUR; i++) {
      const body = subscribeBody({ device: `device-number-${i}`, subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/${i}`, keys: { p256dh: P256DH, auth: AUTH } } })
      expect((await handleReminder(post(body), deps(store))).status).toBe(200)
    }
    const one = subscribeBody({ device: 'one-too-many', subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: P256DH, auth: AUTH } } })
    const res = await handleReminder(post(one), deps(store))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'too-many-devices' })
    // Every app checks in at every start: that is not a new device.
    const again = subscribeBody({ device: 'device-number-0', subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/0', keys: { p256dh: P256DH, auth: AUTH } } })
    expect((await handleReminder(post(again), deps(store))).status).toBe(200)
    // Another address may still add one.
    expect((await handleReminder(post(one), deps(store, noop, SUMMER_1910, { ipOf: () => 'ip-2' }))).status).toBe(200)
  })

  it('limits new devices from everywhere together too', async () => {
    const store = memoryDevices()
    for (let i = 0; i < NEW_DEVICES_PER_HOUR_TOTAL; i++) await store.rateHit('all', NEW_DEVICES_PER_HOUR_TOTAL)
    const res = await handleReminder(post(subscribeBody()), deps(store, noop, SUMMER_1910, { ipOf: () => 'fresh-address' }))
    expect(res.status).toBe(429)
    expect(store.rows.size).toBe(0)
  })

  it('refuses a new device once the server is full', async () => {
    const store = memoryDevices([device()])
    store.count = async () => MAX_DEVICES
    const res = await handleReminder(post(subscribeBody({ device: TABLET, subscription: tabletSubscription })), deps(store))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'full' })
    expect((await handleReminder(post(subscribeBody()), deps(store))).status).toBe(200)
  })

  it('keeps progress on the device that reports it', async () => {
    const store = memoryDevices([device(), tablet()])
    const LATER = new Date('2026-07-01T17:20:00Z')
    await handleReminder(post({ type: 'progress', endpoint: TABLET_ENDPOINT, progress: progress({ done: 3 }) }), deps(store, noop, LATER))
    expect(store.rows.get(TABLET)).toMatchObject({ progress: progress({ done: 3 }), seenAt: LATER.toISOString() })
    expect(store.rows.get(PHONE)?.progress).toBeNull()
    // A device the server does not know: nothing to keep.
    await handleReminder(post({ type: 'progress', endpoint: 'https://fcm.googleapis.com/fcm/send/unknown', progress: progress() }), deps(store))
    expect(store.rows.size).toBe(2)
    const invalid = post({ type: 'progress', endpoint: ENDPOINT, progress: { day: 'x' } })
    expect((await handleReminder(invalid, deps(store))).status).toBe(400)
  })

  it('unsubscribes only the device that asks', async () => {
    const store = memoryDevices([device(), tablet()])
    await handleReminder(post({ type: 'unsubscribe', endpoint: TABLET_ENDPOINT }), deps(store))
    expect([...store.rows.keys()]).toEqual([PHONE])
  })

  it('sends a test notification at most once a minute per device', async () => {
    const store = memoryDevices([device(), tablet({ language: 'en' })])
    const send = vi.fn<Sender>(async () => {})
    const test = (endpoint: string, now = SUMMER_1910) => handleReminder(post({ type: 'test', endpoint }), deps(store, send, now))
    expect((await test(ENDPOINT)).status).toBe(200)
    expect(send).toHaveBeenCalledWith(
      SUB.subscription,
      JSON.stringify({ title: 'SOMOS', body: 'Skúšobná notifikácia — pripomienky fungujú ✓', url: '/', id: '2026-07-01T17:10:00.000Z' }),
      { ttl: 14_400, topic: 'test', urgency: 'high' },
    )
    expect(store.rows.get(PHONE)?.delivery).toEqual({ kind: 'test', sentAt: '2026-07-01T17:10:00.000Z', receipts: false })
    expect((await test(ENDPOINT)).status).toBe(429)
    // Another device is not held up, and gets it in its own language.
    expect((await test(TABLET_ENDPOINT)).status).toBe(200)
    expect(JSON.parse(send.mock.calls[1][1])).toMatchObject({ body: 'Test notification — reminders work ✓', lang: 'en' })
    expect((await test(ENDPOINT, new Date('2026-07-01T17:11:01Z'))).status).toBe(200)
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('refuses a test for a device that is not subscribed', async () => {
    const res = await handleReminder(post({ type: 'test', endpoint: TABLET_ENDPOINT }), deps(memoryDevices([device()])))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'not-subscribed' })
  })

  it('reports a subscription dropped during a test, and refuses it afterwards', async () => {
    const store = memoryDevices([device()])
    const test = post({ type: 'test', endpoint: ENDPOINT })
    expect((await handleReminder(test, deps(store, async () => Promise.reject(pushError(410))))).status).toBe(410)
    expect(store.rows.size).toBe(0)
    const res = await handleReminder(post(subscribeBody()), deps(store))
    expect(res.status).toBe(410)
    expect(await res.json()).toEqual({ error: 'gone' })
    const fresh = subscribeBody({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/fresh', keys: { p256dh: P256DH, auth: AUTH } } })
    expect((await handleReminder(post(fresh), deps(store))).status).toBe(200)
  })

  it('tells a device what the server knows about it, without giving any subscription away', async () => {
    const tick = { at: '2026-07-01T17:00:30.000Z', reason: 'done', sent: 3 }
    const decision = { at: '2026-07-01T17:00:30.000Z', reason: 'sent' }
    const store = memoryDevices([device({ progress: progress({ done: 3 }), sentDay: '2026-07-01', lastDecision: decision }), tablet({ time: '08:00' })])
    store.state.tick = tick
    const res = await handleReminder(post({ type: 'status', endpoint: ENDPOINT }), deps(store))
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      ok: true,
      status: {
        subscribed: true,
        time: '19:00',
        timeZone: TZ,
        serverClock: { day: '2026-07-01', time: '19:10' },
        sentDay: '2026-07-01',
        progress: progress({ done: 3 }),
        lastTick: { at: tick.at, reason: 'done' },
        lastDecision: decision,
        dropped: false,
        delivery: null,
        testPending: false,
      },
    })
    expect(text).not.toContain('fcm.googleapis.com')
    expect(await statusOf(await handleReminder(post({ type: 'status', endpoint: TABLET_ENDPOINT }), deps(store)))).toMatchObject({ subscribed: true, time: '08:00' })
  })

  it('tells that it does not know the device, and whether the push service dropped it', async () => {
    const none = await handleReminder(post({ type: 'status' }), deps(memoryDevices()))
    expect(await statusOf(none)).toEqual({
      subscribed: false,
      time: null,
      timeZone: null,
      serverClock: null,
      sentDay: null,
      progress: null,
      lastTick: null,
      lastDecision: null,
      dropped: false,
      delivery: null,
      testPending: false,
    })
    const store = memoryDevices()
    store.gone.add(ENDPOINT)
    expect(await statusOf(await handleReminder(post({ type: 'status', endpoint: ENDPOINT }), deps(store)))).toMatchObject({ subscribed: false, dropped: true })
  })
})

describe('api/reminder: cron tick', () => {
  const tickJson = async (store: DeviceStore, send: Sender = noop, now = SUMMER_1910, over: Partial<Deps> = {}) =>
    (await handleReminder(cron(), deps(store, send, now, over))).json()

  it('refuses a request without the cron secret, and does not count it as a tick', async () => {
    const store = memoryDevices([device()])
    expect((await handleReminder(cron('wrong'), deps(store))).status).toBe(401)
    expect((await handleReminder(new Request('https://somos.example/api/reminder'), deps(store))).status).toBe(401)
    expect(store.state.tick).toBeNull()
  })

  it('sends the reminder and remembers the day', async () => {
    const store = memoryDevices([device({ progress: progress({ day: '2026-06-30', activeToday: true }) })])
    const send = vi.fn<Sender>(async () => {})
    expect(await tickJson(store, send)).toEqual({ sent: 1, reason: 'done' })
    expect(send).toHaveBeenCalledWith(
      SUB.subscription,
      JSON.stringify({ title: '🔥 Séria 12 dní čaká na dnešok', body: 'Na zopakovanie: 17 kartičiek · stačí pár minút', url: '/', id: '2026-07-01T17:10:00.000Z' }),
      { ttl: 14_400, topic: 'reminder', urgency: 'high' },
    )
    expect(store.rows.get(PHONE)).toMatchObject({
      handledDay: '2026-07-01',
      sentDay: '2026-07-01',
      delivery: { kind: 'reminder', sentAt: '2026-07-01T17:10:00.000Z', receipts: false },
      lastDecision: { at: '2026-07-01T17:10:00.000Z', reason: 'sent' },
    })
    expect(store.state.tick).toEqual({ at: '2026-07-01T17:10:00.000Z', reason: 'done', sent: 1 })
    // Handled: the next tick has nothing to do for it.
    expect(await tickJson(store, send)).toEqual({ sent: 0, reason: 'nothing-due' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('reminds every device at its own time, in its own language', async () => {
    const store = memoryDevices([device(), tablet({ timeZone: 'America/New_York', language: 'en' }), device({ device: 'third-device', endpoint: 'https://fcm.googleapis.com/fcm/send/3', language: 'en', time: '19:05' })])
    const send = vi.fn<Sender>(async () => {})
    // 19:10 in Bratislava is 13:10 in New York.
    expect(await tickJson(store, send)).toEqual({ sent: 2, reason: 'done' })
    expect(send.mock.calls.map((c) => c[0].endpoint).sort()).toEqual([ENDPOINT, 'https://fcm.googleapis.com/fcm/send/3'].sort())
    const third = send.mock.calls.find((c) => c[0].endpoint.endsWith('/3'))!
    expect(JSON.parse(third[1])).toMatchObject({ body: 'Daily goal: 20 correct answers', lang: 'en' })
    expect(store.rows.get(TABLET)?.handledDay).toBeNull()

    expect(await tickJson(store, send, new Date('2026-07-01T23:10:00Z'))).toEqual({ sent: 1, reason: 'done' })
    expect(send.mock.calls.at(-1)?.[0].endpoint).toBe(TABLET_ENDPOINT)
  })

  it('counts the daily goal over all devices of an account', async () => {
    const store = memoryDevices([
      device({ userId: 'user-1', progress: progress({ day: '2026-06-30', activeToday: true }) }),
      tablet({ userId: 'user-1', time: '08:00', progress: progress({ done: 20, activeToday: true }) }),
      device({ device: 'someone-else', endpoint: 'https://fcm.googleapis.com/fcm/send/else', userId: 'user-2' }),
    ])
    const send = vi.fn<Sender>(async () => {})
    expect(await tickJson(store, send)).toEqual({ sent: 1, reason: 'done' })
    expect(send.mock.calls.map((c) => c[0].endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/else'])
    expect(store.rows.get(PHONE)).toMatchObject({ handledDay: '2026-07-01', sentDay: null, lastDecision: { reason: 'goal-met' } })
  })

  it('does not let a stranger’s practice keep a device without an account quiet', async () => {
    const store = memoryDevices([device(), tablet({ time: '08:00', progress: progress({ done: 20 }) })])
    const send = vi.fn<Sender>(async () => {})
    await tickJson(store, send)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('leaves the day open for the next tick after a failed send', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = memoryDevices([device()])
    expect(await tickJson(store, async () => Promise.reject(pushError(500)))).toEqual({ sent: 0, reason: 'done' })
    expect(store.rows.get(PHONE)).toMatchObject({ handledDay: null, lastDecision: { reason: 'failed' } })
    expect(await tickJson(store)).toEqual({ sent: 1, reason: 'done' })
  })

  it('forgets a device the push service will never take, but not on a refusal of our own key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const madeUp = memoryDevices([device()])
    await tickJson(madeUp, async () => Promise.reject(pushError(400)))
    expect(madeUp.rows.size).toBe(0)
    // 403: the VAPID key is wrong. Dropping every device for it would lose them all.
    const ours = memoryDevices([device()])
    await tickJson(ours, async () => Promise.reject(pushError(403)))
    expect(ours.rows.size).toBe(1)
  })

  it('forgets only the device the push service no longer knows', async () => {
    const store = memoryDevices([device(), tablet({ timeZone: TZ })])
    const send: Sender = async (subscription) => {
      if (subscription.endpoint === ENDPOINT) throw pushError(410)
    }
    expect(await tickJson(store, send)).toEqual({ sent: 1, reason: 'done' })
    expect([...store.rows.keys()]).toEqual([TABLET])
    expect(store.gone.has(ENDPOINT)).toBe(true)
  })

  it('sends a test asked for later at the next tick, whatever the hour', async () => {
    const MORNING = new Date('2026-07-01T06:00:00Z')
    const store = memoryDevices([device()])
    const send = vi.fn<Sender>(async () => {})
    expect((await handleReminder(post({ type: 'test-later', endpoint: TABLET_ENDPOINT }), deps(store, send, MORNING))).status).toBe(409)
    expect((await handleReminder(post({ type: 'test-later', endpoint: ENDPOINT }), deps(store, send, MORNING))).status).toBe(200)
    expect(send).not.toHaveBeenCalled()
    expect(await statusOf(await handleReminder(post({ type: 'status', endpoint: ENDPOINT }), deps(store, send, MORNING)))).toMatchObject({ testPending: true })

    // The tick sends it, and still decides about the reminder itself.
    expect(await tickJson(store, send, MORNING)).toEqual({ sent: 0, reason: 'done' })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1]).toContain('Skúšobná notifikácia')
    expect(send.mock.calls[0][2]).toMatchObject({ topic: 'test' })
    expect(store.rows.get(PHONE)).toMatchObject({ testLater: false, delivery: { kind: 'test', sentAt: '2026-07-01T06:00:00.000Z' }, lastDecision: { reason: 'too-early' } })

    // Once: the next tick has nothing left to send.
    expect(await tickJson(store, send, MORNING)).toEqual({ sent: 0, reason: 'nothing-due' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('stops when its time is up and leaves the rest to the next tick', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => device({ device: `device-number-${i}`, endpoint: `https://fcm.googleapis.com/fcm/send/${i}` }))
    const store = memoryDevices(rows)
    // The start, the page's check and the first device's; every later check is past the budget.
    const times = [0, 0, 0]
    const clock = () => times.shift() ?? TICK_BUDGET_MS + 1
    const send = vi.fn<Sender>(async () => {})
    expect(await tickJson(store, send, SUMMER_1910, { clock })).toEqual({ sent: 1, reason: 'partial' })
    expect(rows.filter((r) => store.rows.get(r.device)?.handledDay === null)).toHaveLength(2)
    expect(await tickJson(store, send)).toEqual({ sent: 2, reason: 'done' })
  })

  it('takes page after page while devices are due', async () => {
    const store = memoryDevices(Array.from({ length: TICK_LIMIT + 3 }, (_, i) => device({ device: `device-number-${String(i).padStart(4, '0')}`, endpoint: `https://fcm.googleapis.com/fcm/send/${i}` })))
    const due = vi.spyOn(store, 'due')
    expect(await tickJson(store)).toEqual({ sent: TICK_LIMIT + 3, reason: 'done' })
    expect(due).toHaveBeenCalledTimes(2)
  })

  it('does not go round in circles on devices whose send keeps failing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rows = Array.from({ length: TICK_LIMIT + 2 }, (_, i) => device({ device: `device-number-${String(i).padStart(4, '0')}`, endpoint: `https://fcm.googleapis.com/fcm/send/${i}` }))
    const store = memoryDevices(rows)
    const send = vi.fn<Sender>(async () => Promise.reject(pushError(500)))
    expect(await tickJson(store, send)).toEqual({ sent: 0, reason: 'done' })
    // Every device once, the first page and the two after it: then only devices already tried come back.
    expect(send).toHaveBeenCalledTimes(TICK_LIMIT + 2)
  })

  it('tries the devices it looked at longest ago first', async () => {
    const store = memoryDevices([
      device({ device: 'a-failed-just-now', endpoint: 'https://fcm.googleapis.com/fcm/send/a', lastDecision: { at: '2026-07-01T17:00:00.000Z', reason: 'failed' } }),
      device({ device: 'b-never-looked-at', endpoint: 'https://fcm.googleapis.com/fcm/send/b' }),
    ])
    expect((await store.due(SUMMER_1910, 10)).map((r) => r.device)).toEqual(['b-never-looked-at', 'a-failed-just-now'])
  })

  it('keeps going when one device fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = memoryDevices([device(), tablet({ timeZone: TZ })])
    const update = store.update
    store.update = async (id, fields) => {
      if (id === PHONE) throw new Error('database hiccup')
      return update(id, fields)
    }
    expect(await tickJson(store)).toEqual({ sent: 1, reason: 'done' })
  })

  it('cleans up once a day, at the first tick after 03:00 UTC', async () => {
    const store = memoryDevices()
    await tickJson(store, noop, new Date('2026-07-01T02:45:00Z'))
    await tickJson(store, noop, new Date('2026-07-01T03:00:00Z'))
    await tickJson(store, noop, new Date('2026-07-01T03:15:00Z'))
    expect(store.state.cleanups).toBe(1)
  })
})

describe('api/reminder: did the device get it', () => {
  const SENT_AT = '2026-07-01T17:10:00.000Z'
  const LATER = new Date('2026-07-01T17:10:04Z')

  it('notes that the device can confirm, once its app says so', async () => {
    const store = memoryDevices()
    await handleReminder(post(subscribeBody({ receipts: true })), deps(store))
    await handleReminder(cron(), deps(store))
    expect(store.rows.get(PHONE)?.delivery).toEqual({ kind: 'reminder', sentAt: SENT_AT, receipts: true })
  })

  it('takes the device’s word that it showed the message, or why it could not', async () => {
    const store = memoryDevices([device()])
    await handleReminder(cron(), deps(store))
    await handleReminder(post({ type: 'received', endpoint: ENDPOINT, id: SENT_AT, shown: true }), deps(store, noop, LATER))
    expect(store.rows.get(PHONE)?.delivery).toEqual({ kind: 'reminder', sentAt: SENT_AT, receipts: false, receivedAt: '2026-07-01T17:10:04.000Z', shown: true })

    await handleReminder(post({ type: 'received', endpoint: ENDPOINT, id: SENT_AT, shown: false, error: 'NotAllowedError: no permission' }), deps(store, noop, LATER))
    expect(store.rows.get(PHONE)?.delivery).toMatchObject({ shown: false, error: 'NotAllowedError: no permission' })
  })

  it('ignores a receipt from another device, or for another message', async () => {
    const store = memoryDevices([device(), tablet({ time: '08:00' })])
    await handleReminder(cron(), deps(store))
    await handleReminder(post({ type: 'received', endpoint: TABLET_ENDPOINT, id: SENT_AT, shown: true }), deps(store, noop, LATER))
    await handleReminder(post({ type: 'received', endpoint: ENDPOINT, id: '2026-06-30T17:00:00.000Z', shown: true }), deps(store, noop, LATER))
    const res = await handleReminder(post({ type: 'received', endpoint: ENDPOINT, id: SENT_AT }), deps(store, noop, LATER))
    expect(res.status).toBe(400)
    expect(store.rows.get(PHONE)?.delivery).toEqual({ kind: 'reminder', sentAt: SENT_AT, receipts: false })
    expect(store.rows.get(TABLET)?.delivery).toBeNull()
  })
})

// ---------- Supabase ----------

const SENT = '2026-07-01T17:00:00.000Z'

describe('supabaseStore', () => {
  const URL_ = 'https://project.supabase.co/'
  const ROW = {
    device: PHONE,
    user_id: 'user-1',
    endpoint: ENDPOINT,
    p256dh: P256DH,
    auth: AUTH,
    time: '19:00',
    time_zone: TZ,
    language: 'en',
    receipts: true,
    progress: progress(),
    handled_day: '2026-06-30',
    sent_day: '2026-06-30',
    delivery: { kind: 'reminder', sentAt: SENT, receipts: true },
    last_decision: { at: SENT, reason: 'sent' },
    test_at: null,
    test_later: false,
    created_at: '2026-06-01T00:00:00+00:00',
    seen_at: '2026-07-01T10:00:00+00:00',
  }
  function fakeFetch(answer: (url: string, init: RequestInit) => Response = () => Response.json([])) {
    const calls: { url: string; method: string; headers: Headers; body: unknown }[] = []
    const impl = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input)
      calls.push({ url, method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : undefined })
      return answer(url, init)
    })
    return { impl: impl as unknown as typeof fetch, calls }
  }

  it('reads a device by its endpoint, with the key in apikey only for a new secret key', async () => {
    const { impl, calls } = fakeFetch(() => Response.json([ROW]))
    const row = await supabaseStore(URL_, 'sb_secret_abc', impl).byEndpoint(ENDPOINT)
    expect(calls[0].url).toBe(`https://project.supabase.co/rest/v1/push_devices?endpoint=eq.${encodeURIComponent(ENDPOINT)}&select=*`)
    expect(calls[0].headers.get('apikey')).toBe('sb_secret_abc')
    expect(calls[0].headers.has('authorization')).toBe(false)
    expect(row).toEqual({
      device: PHONE,
      userId: 'user-1',
      endpoint: ENDPOINT,
      p256dh: P256DH,
      auth: AUTH,
      time: '19:00',
      timeZone: TZ,
      language: 'en',
      receipts: true,
      progress: progress(),
      handledDay: '2026-06-30',
      sentDay: '2026-06-30',
      delivery: { kind: 'reminder', sentAt: SENT, receipts: true },
      lastDecision: { at: SENT, reason: 'sent' },
      testAt: null,
      testLater: false,
      seenAt: '2026-07-01T10:00:00+00:00',
    })
  })

  it('sends a legacy service role key as the bearer too', async () => {
    const { impl, calls } = fakeFetch()
    await supabaseStore(URL_, 'eyJlegacy', impl).byDevice(PHONE)
    expect(calls[0].headers.get('authorization')).toBe('Bearer eyJlegacy')
    expect(calls[0].url).toContain(`push_devices?device=eq.${PHONE}`)
  })

  it('treats stored JSON that no longer validates as missing', () => {
    expect(toDeviceRow({ ...ROW, progress: { day: 'x' }, delivery: 'nonsense', last_decision: 3 })).toMatchObject({ progress: null, delivery: null, lastDecision: null })
    expect(toDeviceRow({ ...ROW, endpoint: undefined })).toBeNull()
    expect(fromDeviceRow({ timeZone: TZ, handledDay: null, testLater: true })).toEqual({ time_zone: TZ, handled_day: null, test_later: true })
  })

  it('saves a device after freeing its endpoint from another row', async () => {
    const { impl, calls } = fakeFetch(() => new Response(null, { status: 201 }))
    const row = toDeviceRow(ROW)!
    await supabaseStore(URL_, 'sb_secret_abc', impl).save(row)
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: `https://project.supabase.co/rest/v1/push_devices?endpoint=eq.${encodeURIComponent(ENDPOINT)}&device=neq.${PHONE}` })
    expect(calls[1]).toMatchObject({ method: 'POST', url: 'https://project.supabase.co/rest/v1/push_devices' })
    expect(calls[1].headers.get('prefer')).toBe('resolution=merge-duplicates,return=minimal')
    expect(calls[1].body).toMatchObject({ device: PHONE, user_id: 'user-1', time_zone: TZ, seen_at: ROW.seen_at })
  })

  it('updates only the fields given', async () => {
    const { impl, calls } = fakeFetch(() => new Response(null, { status: 204 }))
    const store = supabaseStore(URL_, 'sb_secret_abc', impl)
    await store.update(PHONE, { testLater: true })
    expect(calls[0]).toMatchObject({ method: 'PATCH', url: `https://project.supabase.co/rest/v1/push_devices?device=eq.${PHONE}`, body: { test_later: true } })
    await store.update(PHONE, {})
    expect(calls).toHaveLength(1)
  })

  it('asks Postgres which devices are due, and takes what it returns', async () => {
    const { impl, calls } = fakeFetch(() => Response.json([ROW, { nonsense: true }]))
    const rows = await supabaseStore(URL_, 'sb_secret_abc', impl).due(SUMMER_1910, 500)
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://project.supabase.co/rest/v1/rpc/reminders_due', body: { p_now: '2026-07-01T17:10:00.000Z', p_limit: 500 } })
    expect(rows.map((r) => r.device)).toEqual([PHONE])
  })

  it('reads the reports of the accounts’ devices', async () => {
    const { impl, calls } = fakeFetch(() => Response.json([{ device: TABLET, user_id: 'user-1', progress: progress() }, { device: 'x', user_id: 'user-1', progress: { day: 'bad' } }]))
    const store = supabaseStore(URL_, 'sb_secret_abc', impl)
    expect(await store.reportsOf(['user-1', 'user-2'])).toEqual([{ device: TABLET, userId: 'user-1', progress: progress() }])
    // The ids in the body: hundreds of them would make the URL too long.
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://project.supabase.co/rest/v1/rpc/push_reports', body: { p_users: ['user-1', 'user-2'] } })
    expect(await store.reportsOf([])).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('counts the devices from the Content-Range header', async () => {
    const { impl, calls } = fakeFetch(() => new Response(null, { status: 200, headers: { 'Content-Range': '0-24/1234' } }))
    expect(await supabaseStore(URL_, 'sb_secret_abc', impl).count()).toBe(1234)
    expect(calls[0]).toMatchObject({ method: 'HEAD' })
    expect(calls[0].headers.get('prefer')).toBe('count=exact')
    const empty = fakeFetch(() => new Response(null, { status: 200, headers: { 'Content-Range': '*/0' } }))
    expect(await supabaseStore(URL_, 'sb_secret_abc', empty.impl).count()).toBe(0)
  })

  it('keeps gone endpoints, ticks and the per-IP limit', async () => {
    const { impl, calls } = fakeFetch((url) => {
      if (url.includes('push_gone?')) return Response.json([{ endpoint: ENDPOINT }])
      if (url.includes('push_ticks?')) return Response.json([{ at: SENT, reason: 'done' }])
      if (url.includes('push_rate_hit')) return Response.json(false)
      return new Response(null, { status: 201 })
    })
    const store = supabaseStore(URL_, 'sb_secret_abc', impl)
    expect(await store.isGone(ENDPOINT)).toBe(true)
    await store.markGone(ENDPOINT)
    expect(calls[1]).toMatchObject({ method: 'POST', body: { endpoint: ENDPOINT } })
    expect(calls[1].headers.get('prefer')).toBe('resolution=ignore-duplicates,return=minimal')
    expect(await store.lastTick()).toEqual({ at: SENT, reason: 'done' })
    await store.recordTick({ at: SENT, reason: 'done', sent: 2 })
    expect(calls[3].body).toEqual({ id: 1, at: SENT, reason: 'done', sent: 2 })
    expect(await store.rateHit('hash', 20)).toBe(false)
    expect(calls[4].body).toEqual({ p_key: 'hash', p_limit: 20 })
    await store.cleanup()
    expect(calls[5].url).toBe('https://project.supabase.co/rest/v1/rpc/push_cleanup')
  })

  it('claims a test in one conditional update', async () => {
    const answers = [Response.json([{ device: PHONE }]), Response.json([])]
    const { impl, calls } = fakeFetch(() => answers.shift()!)
    const store = supabaseStore(URL_, 'sb_secret_abc', impl)
    expect(await store.claimTest(PHONE, SUMMER_1910)).toBe(true)
    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      url: `https://project.supabase.co/rest/v1/push_devices?device=eq.${PHONE}&or=(test_at.is.null,test_at.lt.${encodeURIComponent('2026-07-01T17:09:00.000Z')})&select=device`,
      body: { test_at: '2026-07-01T17:10:00.000Z' },
    })
    expect(calls[0].headers.get('prefer')).toBe('return=representation')
    expect(await store.claimTest(PHONE, SUMMER_1910)).toBe(false)
  })

  it('throws with the message PostgREST gives', async () => {
    const { impl } = fakeFetch(() => Response.json({ message: 'permission denied for table push_devices' }, { status: 401 }))
    await expect(supabaseStore(URL_, 'sb_secret_abc', impl).byDevice(PHONE)).rejects.toThrow('Supabase push_devices failed: permission denied for table push_devices')
  })
})


describe('supabaseUser', () => {
  it('tells the account of a token, or null when it cannot', async () => {
    const answers = [Response.json({ id: 'user-1' }), new Response(null, { status: 401 })]
    const impl = vi.fn(async () => answers.shift() ?? Promise.reject(new TypeError('network')))
    const userOf = supabaseUser('https://project.supabase.co', 'sb_secret_abc', impl as unknown as typeof fetch)
    expect(await userOf('token')).toBe('user-1')
    const [url, init] = impl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://project.supabase.co/auth/v1/user')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token')
    expect(await userOf('expired')).toBeNull()
    expect(await userOf('offline')).toBeNull()
  })
})

describe('ipKey', () => {
  it('hashes the first forwarded address, and never keeps the address', () => {
    const request = (headers: Record<string, string>) => new Request('https://somos.example/api/reminder', { headers })
    const key = ipKey(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), 'secret')
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(key).not.toContain('203')
    expect(ipKey(request({ 'x-forwarded-for': '203.0.113.7' }), 'secret')).toBe(key)
    expect(ipKey(request({ 'x-real-ip': '203.0.113.7' }), 'secret')).toBe(key)
    expect(ipKey(request({ 'x-forwarded-for': '198.51.100.1' }), 'secret')).not.toBe(key)
    // Keyed: without the server's secret the hash of every address cannot be tried.
    expect(ipKey(request({ 'x-forwarded-for': '203.0.113.7' }), 'other')).not.toBe(key)
  })
})

describe('ipNetwork', () => {
  it('counts an IPv6 address by its /64 and leaves IPv4 as it is', () => {
    expect(ipNetwork('203.0.113.7')).toBe('203.0.113.7')
    expect(ipNetwork('2001:db8:85a3:0042:1000:8a2e:0370:7334')).toBe('2001:db8:85a3:42::/64')
    expect(ipNetwork('2001:DB8:85A3:42:ffff::1')).toBe('2001:db8:85a3:42::/64')
    expect(ipNetwork('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(ipNetwork('::1')).toBe('0:0:0:0::/64')
  })
})

describe('depsFromEnv', () => {
  const base = { VAPID_PRIVATE_KEY: 'priv', CRON_SECRET: 'secret' }

  it('takes the Supabase project from its own variables or the app’s', () => {
    expect(depsFromEnv({ ...base, SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' })?.cronSecret).toBe('secret')
    expect(depsFromEnv({ ...base, VITE_SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SECRET_KEY: 'k' })).toBeDefined()
  })

  it('returns undefined if anything is missing, Upstash alone included', () => {
    expect(depsFromEnv({ ...base, SUPABASE_URL: 'https://p.supabase.co' })).toBeUndefined()
    expect(depsFromEnv({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' })).toBeUndefined()
    expect(depsFromEnv({ ...base, KV_REST_API_URL: 'https://url', KV_REST_API_TOKEN: 'tok' })).toBeUndefined()
  })
})

describe('VAPID public key', () => {
  it('is the same in the app and on the server', async () => {
    const app = await readFile(new URL('../src/lib/reminder.ts', import.meta.url), 'utf8')
    expect(app).toContain(`export const VAPID_PUBLIC_KEY = '${VAPID_PUBLIC_KEY}'`)
  })
})
