// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it } from 'vitest'
import {
  composeMessage,
  decide,
  isProgress,
  isReminderSub,
  localClock,
  previousDay,
  todayView,
  type ReminderProgress,
  type ReminderSub,
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
    expect(composeMessage({ done: 0, goal: 20, due: 0, streak: 0 })).toEqual({ title: '¿Practicamos? 🇲🇽', body: 'Denný cieľ: 20 odpovedí' })
    expect(composeMessage({ done: 0, goal: 10, due: null, streak: 2 }).body).toBe('Denný cieľ: 10 odpovedí · stačí pár minút')
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
