import { afterEach, describe, expect, it } from 'vitest'
import { celebrateGoal, dismissCelebration, getCelebration } from './celebration'

afterEach(dismissCelebration)

describe('the celebration of a reached daily goal', () => {
  it('is there from the announcement until it is dismissed', () => {
    expect(getCelebration()).toBeNull()
    celebrateGoal({ goal: 20, streakDays: 7, at: 1 })
    expect(getCelebration()).toEqual({ goal: 20, streakDays: 7, at: 1 })
    dismissCelebration()
    expect(getCelebration()).toBeNull()
  })

  it('is replaced by a later one', () => {
    celebrateGoal({ goal: 10, streakDays: 1, at: 1 })
    celebrateGoal({ goal: 20, streakDays: 1, at: 2 })
    expect(getCelebration()).toMatchObject({ goal: 20, at: 2 })
  })
})
