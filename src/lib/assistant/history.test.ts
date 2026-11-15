import { afterEach, describe, expect, it } from 'vitest'
import { addTurn, clearTurns, getTurns } from './history'

describe('assistant history', () => {
  afterEach(clearTurns)

  it('keeps turns in order, as a new array each time', () => {
    const before = getTurns()
    addTurn({ question: 'a', answer: 'b' })
    addTurn({ question: 'c', answer: 'd', calls: 2 })
    expect(getTurns()).not.toBe(before)
    expect(getTurns().map((t) => t.question)).toEqual(['a', 'c'])
  })

  it('clears', () => {
    addTurn({ question: 'a', answer: 'b' })
    clearTurns()
    expect(getTurns()).toEqual([])
  })
})
