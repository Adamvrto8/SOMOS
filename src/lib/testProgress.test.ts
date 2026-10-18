import { beforeEach, describe, expect, it } from 'vitest'
import { getTestResults, mergeTestResults, parseTestResults, recordTestResult, resetTestResultsForTesting } from './testProgress'

beforeEach(() => resetTestResultsForTesting())

describe('recordTestResult', () => {
  it('passes at 80 %', () => {
    expect(recordTestResult('food:A1', 11, 15)).toEqual({ passed: false, newlyPassed: false })
    expect(recordTestResult('food:A1', 12, 15)).toEqual({ passed: true, newlyPassed: true })
    expect(getTestResults()['food:A1']).toMatchObject({ bestScore: 12, total: 15, passed: true, attempts: 2 })
  })

  it('keeps the best score and the first pass', () => {
    recordTestResult('A1', 27, 30, true, 1000)
    recordTestResult('A1', 10, 30, true, 2000)
    expect(getTestResults().A1).toMatchObject({ bestScore: 27, passed: true, passedAt: 1000, attempts: 2, lastAt: 2000 })
  })

  it('raises the score of the same attempt without counting another one', () => {
    recordTestResult('food:A1', 11, 15)
    expect(recordTestResult('food:A1', 12, 15, false).newlyPassed).toBe(true)
    expect(getTestResults()['food:A1']).toMatchObject({ bestScore: 12, passed: true, attempts: 1 })
  })

  it('ignores impossible scores', () => {
    recordTestResult('food:A1', 16, 15)
    expect(getTestResults()).toEqual({})
  })
})

describe('backup', () => {
  it('skips invalid records', () => {
    const { records, skipped } = parseTestResults({ A1: { bestScore: 3, total: 30, passed: false, attempts: 1, lastAt: 1 }, A2: { bestScore: 'x' } })
    expect(Object.keys(records)).toEqual(['A1'])
    expect(skipped).toBe(1)
  })

  it('keeps the better record when merging', () => {
    recordTestResult('food:A1', 13, 15)
    recordTestResult('home:A1', 5, 15)
    const taken = mergeTestResults({
      'food:A1': { bestScore: 10, total: 15, passed: false, attempts: 3, lastAt: 1 },
      'home:A1': { bestScore: 14, total: 15, passed: true, passedAt: 1, attempts: 2, lastAt: 1 },
    })
    expect(taken).toBe(1)
    expect(getTestResults()['food:A1'].bestScore).toBe(13)
    expect(getTestResults()['home:A1'].bestScore).toBe(14)
  })
})
