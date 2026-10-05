import { describe, expect, it } from 'vitest'
import { buildProgress } from './reminderProgress'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('buildProgress', () => {
  const now = at(2026, 9, 29, 18)

  it('counts today’s answers and the running streak of days that reached the goal', () => {
    const attempts = [27, 28, 29].flatMap((day) => [at(2026, 9, day, 8), at(2026, 9, day, 9)]).map((d) => d.getTime())
    expect(buildProgress(attempts, { today: 0, tomorrow: 0 }, 2, now)).toEqual({
      day: '2026-09-29',
      done: 2,
      goal: 2,
      dueToday: 0,
      dueTomorrow: 0,
      streakDays: 3,
      activeToday: true,
    })
  })

  it('keeps yesterday’s streak alive until today’s goal is reached', () => {
    const yesterday = [at(2026, 9, 28, 9), at(2026, 9, 28, 10)].map((d) => d.getTime())
    expect(buildProgress(yesterday, { today: 0, tomorrow: 0 }, 2, now)).toMatchObject({ done: 0, streakDays: 1, activeToday: false })
    const started = [...yesterday, at(2026, 9, 29, 9).getTime()]
    expect(buildProgress(started, { today: 0, tomorrow: 0 }, 2, now)).toMatchObject({ done: 1, streakDays: 1, activeToday: false })
  })

  it('has no streak when yesterday stayed under the goal', () => {
    expect(buildProgress([at(2026, 9, 28, 9).getTime()], { today: 0, tomorrow: 0 }, 30, now)).toMatchObject({ done: 0, goal: 30, streakDays: 0, activeToday: false })
  })

  it('passes the due counts through', () => {
    expect(buildProgress([], { today: 2, tomorrow: 3 }, 20, now)).toMatchObject({ dueToday: 2, dueTomorrow: 3 })
  })
})
