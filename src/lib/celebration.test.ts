import { afterEach, describe, expect, it } from 'vitest'
import { celebrateGoal, celebrationOver, dismissCelebration, expectCelebration, getCelebration } from './celebration'

afterEach(dismissCelebration)

describe('the celebration of a reached daily goal', () => {
  it('is there from the announcement until it is dismissed', () => {
    expect(getCelebration()).toBeNull()
    celebrateGoal({ goal: 20, streakDays: 7, at: 1 })
    expect(getCelebration()).toEqual({ goal: 20, streakDays: 7, at: 1 })
    dismissCelebration()
    expect(getCelebration()).toBeNull()
  })

  it('holds back whoever waits for it, from the moment it is expected until it is dismissed', async () => {
    let moved = false
    const settled = () => new Promise((resolve) => setTimeout(resolve))

    // Nothing on its way: no waiting.
    await celebrationOver()

    expectCelebration()
    void celebrationOver().then(() => (moved = true))
    await settled()
    expect(moved).toBe(false)

    celebrateGoal({ goal: 20, streakDays: 7, at: 1 })
    await settled()
    expect(moved).toBe(false)

    dismissCelebration()
    await settled()
    expect(moved).toBe(true)
  })

  it('is replaced by a later one', () => {
    celebrateGoal({ goal: 10, streakDays: 1, at: 1 })
    celebrateGoal({ goal: 20, streakDays: 1, at: 2 })
    expect(getCelebration()).toMatchObject({ goal: 20, at: 2 })
  })
})
