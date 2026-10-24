import { describe, expect, it } from 'vitest'
import { createEmptyCard, Rating } from 'ts-fsrs'
import { addDays, dayKey } from './dates'
import { formatInterval, isDueToday, previewIntervals, scheduleNext } from './srs'
import { byExercise, computeActivity, computeHistory, computeStreak, countedTimestamps, goalDays, longestStreak, summarizeDays, summarizeWeek } from './stats'
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

  /** `n` days in a row ending with `last` (a YYYY-MM-DD key of September 2026). */
  const run = (lastDay: number, n: number) => Array.from({ length: n }, (_, i) => `2026-09-${String(lastDay - i).padStart(2, '0')}`)

  it('counts consecutive days ending today', () => {
    expect(computeStreak(days('2026-09-23', '2026-09-24', '2026-09-25'), now)).toMatchObject({ days: 3, activeToday: true, frozenDays: [] })
  })

  it('keeps yesterday’s streak alive until today ends', () => {
    expect(computeStreak(days('2026-09-23', '2026-09-24'), now)).toMatchObject({ days: 2, activeToday: false })
  })

  it('a missed day uses the freeze a learner starts with; the next missed day ends the streak', () => {
    // 24th missed: frozen, the streak goes on without growing.
    expect(computeStreak(days('2026-09-22', '2026-09-23'), now)).toMatchObject({ days: 2, freezes: 0, frozenDays: ['2026-09-24'] })
    // 23rd frozen, 24th missed with no freeze left.
    expect(computeStreak(days('2026-09-21', '2026-09-22'), now)).toMatchObject({ days: 0, frozenDays: [] })
    expect(computeStreak(days('2026-09-20', '2026-09-25'), now)).toMatchObject({ days: 1, activeToday: true })
  })

  it('a freeze is not spent while there is no streak, nor on today while it is open', () => {
    expect(computeStreak(days(), now)).toMatchObject({ days: 0, freezes: 1 })
    expect(computeStreak(days('2026-09-24'), now)).toMatchObject({ days: 1, freezes: 1, frozenDays: [] })
  })

  it('earns a freeze for every 7 days in a row, holding 2 at most', () => {
    expect(computeStreak(days(...run(24, 6)), now)).toMatchObject({ days: 6, freezes: 1 })
    expect(computeStreak(days(...run(24, 7)), now)).toMatchObject({ days: 7, freezes: 2, freezeEarnedToday: false })
    expect(computeStreak(days(...run(24, 20)), now)).toMatchObject({ days: 20, freezes: 2 })
    // Earned with today's goal: the celebration says so.
    expect(computeStreak(days(...run(25, 7)), now)).toMatchObject({ days: 7, freezes: 2, freezeEarnedToday: true })
  })

  it('two freezes carry two missed days; a frozen day neither adds to the week nor breaks it', () => {
    // 1st–14th reached (2 freezes held), 15th and 16th missed, 17th–20th reached.
    const streak = computeStreak(days(...run(14, 14), ...run(20, 4)), at(2026, 9, 20))
    expect(streak).toMatchObject({ days: 18, activeToday: true, freezes: 0, frozenDays: ['2026-09-15', '2026-09-16'] })
  })
})

describe('goalDays', () => {
  const answers = (day: number, count: number) => Array.from({ length: count }, (_, i) => at(2026, 9, day, 8 + i).getTime())

  it('counts the right answers only: a wrong one is practice, not progress', () => {
    const attempts = [
      { at: at(2026, 9, 23, 8).getTime(), correct: true },
      { at: at(2026, 9, 23, 9).getTime(), correct: false },
      { at: at(2026, 9, 23, 10).getTime(), correct: true },
    ]
    expect(countedTimestamps(attempts)).toEqual([at(2026, 9, 23, 8).getTime(), at(2026, 9, 23, 10).getTime()])
  })

  it('keeps only the days whose counted answers reach the daily goal', () => {
    const stamps = [...answers(23, 3), ...answers(24, 2), ...answers(25, 4)]
    expect(goalDays(stamps, 3)).toEqual(new Set(['2026-09-23', '2026-09-25']))
  })

  it('a day with a few answers does not carry the streak', () => {
    // Goal met for four days, then two days under it: the streak is over, whatever today brings.
    const stamps = [20, 21, 22, 23].flatMap((day) => answers(day, 5)).concat(answers(24, 3), answers(25, 1))
    // The 24th is frozen, the 25th has no freeze left.
    expect(computeStreak(goalDays(stamps, 5), at(2026, 9, 26))).toMatchObject({ days: 0, activeToday: false })
    expect(computeStreak(goalDays(stamps, 5), at(2026, 9, 24, 7))).toMatchObject({ days: 4, activeToday: false })
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
    const counted = countedTimestamps(attempts)
    const activity = computeActivity(counted, attempts, now, 1)
    // Two answers today, one of them right: the goal counts the right one.
    expect(activity.today).toBe(1)
    expect(activity.weekTotal).toBe(3)
    expect(activity.weekAccuracy).toBeCloseTo(2 / 3)
    expect(activity.streak).toMatchObject({ days: 1, activeToday: true })
    // The same answers under a goal of two: today does not count yet.
    expect(computeActivity(counted, attempts, now, 2).streak).toMatchObject({ days: 0, activeToday: false })
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

describe('history (the overview behind the week chart)', () => {
  const answers = (day: number, count: number, exercise = 'vocab', right = count) =>
    Array.from({ length: count }, (_, i) => ({ at: at(2026, 9, day, 8).getTime() + i * 60_000, correct: i < right, exercise }))

  it('buckets any number of days, oldest first, today last', () => {
    const now = at(2026, 9, 25, 18)
    const days = summarizeDays([...answers(25, 2), ...answers(1, 3), ...answers(-5, 9)], now, 30)
    expect(days).toHaveLength(30)
    expect(days[0].key).toBe('2026-08-27')
    expect(days[29]).toMatchObject({ key: '2026-09-25', count: 2 })
    expect(days.find((d) => d.key === '2026-09-01')).toMatchObject({ count: 3 })
    // The day before the window is left out.
    expect(days.reduce((n, d) => n + d.count, 0)).toBe(5)
  })

  it('finds the longest run of days that reached the goal', () => {
    expect(longestStreak(new Set())).toBe(0)
    expect(longestStreak(new Set(['2026-09-01']))).toBe(1)
    // Over a month end; one missed day is frozen, so both runs are one streak (3 + 2 days).
    expect(longestStreak(new Set(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-03', '2026-09-04']))).toBe(5)
    // Two missed days in a row: the freeze carries one, the second ends the streak.
    expect(longestStreak(new Set(['2026-08-30', '2026-08-31', '2026-09-03']))).toBe(2)
  })

  it('splits answers by exercise, most practised first', () => {
    const split = byExercise([...answers(24, 2, 'cloze', 1), ...answers(25, 5, 'vocab', 4), ...answers(25, 1, 'review')])
    expect(split).toEqual([
      { exercise: 'vocab', count: 5, correct: 4 },
      { exercise: 'cloze', count: 2, correct: 1 },
      { exercise: 'review', count: 1, correct: 1 },
    ])
  })

  it('sums up everything since the first answer', () => {
    const now = at(2026, 9, 25, 18)
    const all = [...answers(20, 3), ...answers(21, 3), ...answers(22, 1), ...answers(24, 4, 'cloze', 2), ...answers(25, 3)]
    expect(computeHistory(all, now, 3)).toMatchObject({
      total: 14,
      correct: 12,
      firstDay: at(2026, 9, 20, 8),
      // The 24th had four answers but only two right ones: under the goal of three, so it breaks the streak.
      streak: { days: 1, activeToday: true },
      longestStreak: 2,
    })
    expect(computeHistory([], now, 3)).toMatchObject({ total: 0, correct: 0, firstDay: null, longestStreak: 0 })
  })
})
