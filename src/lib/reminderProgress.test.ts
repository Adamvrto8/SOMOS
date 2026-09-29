import { describe, expect, it } from 'vitest'
import { buildProgress } from './reminderProgress'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('buildProgress', () => {
  const now = at(2026, 9, 29, 18)

  it('counts today’s answers and the running streak', () => {
    const attempts = [at(2026, 9, 27, 9), at(2026, 9, 28, 9), at(2026, 9, 29, 8), at(2026, 9, 29, 9)].map((d) => d.getTime())
    expect(buildProgress(attempts, [], 20, now)).toEqual({
      day: '2026-09-29',
      done: 2,
      goal: 20,
      dueToday: 0,
      dueTomorrow: 0,
      streakDays: 3,
      activeToday: true,
    })
  })

  it('keeps yesterday’s streak alive before today’s first answer', () => {
    expect(buildProgress([at(2026, 9, 28, 9).getTime()], [], 30, now)).toMatchObject({ done: 0, goal: 30, streakDays: 1, activeToday: false })
  })

  it('counts cards due by the end of today and by the end of tomorrow', () => {
    const due = [at(2026, 9, 20), at(2026, 9, 29, 23), at(2026, 9, 30, 8), at(2026, 10, 1, 8)]
    expect(buildProgress([], due, 20, now)).toMatchObject({ dueToday: 2, dueTomorrow: 3 })
  })
})
