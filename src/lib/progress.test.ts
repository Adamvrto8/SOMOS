import { describe, expect, it } from 'vitest'
import { createEmptyCard, Rating } from 'ts-fsrs'
import { addDays, dayKey } from './dates'
import { formatInterval, isDueToday, previewIntervals, scheduleNext } from './srs'
import { computeActivity, computeStreak, goalDays, summarizeWeek } from './stats'
import { wordOfDay } from './wordOfDay'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('dates', () => {
  it('uses local calendar days', () => {
    expect(dayKey(at(2026, 9, 5, 23))).toBe('2026-09-05')
    expect(dayKey(addDays(at(2026, 3, 31), 1))).toBe('2026-04-01')
  })
})

describe('computeStreak', () => {
  const now = at(2026, 9, 25)
  const days = (...keys: string[]) => new Set(keys)

  it('counts consecutive days ending today', () => {
    expect(computeStreak(days('2026-09-23', '2026-09-24', '2026-09-25'), now)).toEqual({ days: 3, activeToday: true })
  })

  it('keeps yesterday’s streak alive until today ends', () => {
    expect(computeStreak(days('2026-09-23', '2026-09-24'), now)).toEqual({ days: 2, activeToday: false })
  })

  it('breaks on a missed day', () => {
    expect(computeStreak(days('2026-09-22', '2026-09-23'), now)).toEqual({ days: 0, activeToday: false })
    expect(computeStreak(days('2026-09-20', '2026-09-25'), now)).toEqual({ days: 1, activeToday: true })
  })
})

describe('goalDays', () => {
  const answers = (day: number, count: number) => Array.from({ length: count }, (_, i) => at(2026, 9, day, 8 + i).getTime())

  it('keeps only the days whose answers reach the daily goal', () => {
    const stamps = [...answers(23, 3), ...answers(24, 2), ...answers(25, 4)]
    expect(goalDays(stamps, 3)).toEqual(new Set(['2026-09-23', '2026-09-25']))
  })

  it('a day with a few answers does not carry the streak', () => {
    // Goal met for four days, then two days under it: the streak is over, whatever today brings.
    const stamps = [20, 21, 22, 23].flatMap((day) => answers(day, 5)).concat(answers(24, 3), answers(25, 1))
    expect(computeStreak(goalDays(stamps, 5), at(2026, 9, 26))).toEqual({ days: 0, activeToday: false })
    expect(computeStreak(goalDays(stamps, 5), at(2026, 9, 24, 7))).toEqual({ days: 4, activeToday: false })
  })
})

describe('summarizeWeek / computeActivity', () => {
  const now = at(2026, 9, 25, 18)
  const attempts = [
    { at: at(2026, 9, 25, 9).getTime(), correct: true },
    { at: at(2026, 9, 25, 10).getTime(), correct: false },
    { at: at(2026, 9, 19, 8).getTime(), correct: true }, // oldest day of the window
    { at: at(2026, 9, 18, 8).getTime(), correct: true }, // outside the window
  ]

  it('buckets the last 7 days, oldest first', () => {
    const week = summarizeWeek(attempts, now)
    expect(week.map((d) => d.key)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'])
    expect(week[0]).toMatchObject({ count: 1, correct: 1 })
    expect(week[6]).toMatchObject({ count: 2, correct: 1 })
  })

  it('derives today, totals and accuracy', () => {
    const activity = computeActivity(attempts.map((a) => a.at), attempts, now, 2)
    expect(activity.today).toBe(2)
    expect(activity.weekTotal).toBe(3)
    expect(activity.weekAccuracy).toBeCloseTo(2 / 3)
    expect(activity.streak).toEqual({ days: 1, activeToday: true })
    // The same two answers under a goal of three: today does not count yet.
    expect(computeActivity(attempts.map((a) => a.at), attempts, now, 3).streak).toEqual({ days: 0, activeToday: false })
  })

  it('has no accuracy without answers', () => {
    expect(computeActivity([], [], now, 20).weekAccuracy).toBeNull()
  })
})

describe('srs', () => {
  it('formats intervals in Slovak', () => {
    expect(formatInterval(20_000)).toBe('< 1 min')
    expect(formatInterval(10 * 60_000)).toBe('10 min')
    expect(formatInterval(3 * 3_600_000)).toBe('3 h')
    expect(formatInterval(86_400_000)).toBe('1 deň')
    expect(formatInterval(3 * 86_400_000)).toBe('3 dni')
    expect(formatInterval(12 * 86_400_000)).toBe('12 dní')
    expect(formatInterval(60 * 86_400_000)).toBe('2 mes.')
    expect(formatInterval(548 * 86_400_000)).toBe('1,5 r.')
  })

  it('makes a new card due today and schedules it by grade', () => {
    const now = at(2026, 9, 25, 10)
    const card = createEmptyCard(now)
    expect(isDueToday(card, now)).toBe(true)

    const again = scheduleNext(card, Rating.Again, now)
    const easy = scheduleNext(card, Rating.Easy, now)
    expect(again.due.getTime() - now.getTime()).toBeLessThan(10 * 60_000) // relearn within minutes
    expect(isDueToday(again, now)).toBe(true)
    expect(isDueToday(easy, now)).toBe(false) // days away
  })

  it('previews an interval label for every grade, growing with the grade', () => {
    const now = at(2026, 9, 25, 10)
    const labels = previewIntervals(createEmptyCard(now), now)
    expect(Object.keys(labels)).toHaveLength(4)
    expect(labels[Rating.Again]).toMatch(/min$/)
    expect(labels[Rating.Easy]).toMatch(/de[ňn]|dni|dní/)
  })
})

describe('wordOfDay', () => {
  it('is stable within a day and varies across days', () => {
    expect(wordOfDay(at(2026, 9, 25, 8)).id).toBe(wordOfDay(at(2026, 9, 25, 22)).id)
    const month = new Set(Array.from({ length: 30 }, (_, i) => wordOfDay(addDays(at(2026, 9, 1), i)).id))
    expect(month.size).toBeGreaterThan(15)
  })

  it('always has an example sentence', () => {
    for (let i = 0; i < 60; i++) expect(wordOfDay(addDays(at(2026, 1, 1), i)).examples.length).toBeGreaterThan(0)
  })
})
