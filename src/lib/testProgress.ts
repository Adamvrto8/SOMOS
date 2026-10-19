// Results of the tests (src/lib/tests.ts), by test key ("food:A1", "A1"), in localStorage like the
// numbered lessons' progress, and in the JSON backup. A test is passed at 80 % (passThreshold).

import { useSyncExternalStore } from 'react'
import { passThreshold } from './lessonProgress'

export interface TestRecord {
  bestScore: number
  total: number
  passed: boolean
  passedAt?: number
  attempts: number
  lastAt: number
}

export type TestResultsMap = Record<string, TestRecord>

const STORAGE_KEY = 'somos-tests-v1'

function load(): TestResultsMap {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return raw ? parseTestResults(JSON.parse(raw)).records : {}
  } catch {
    return {}
  }
}

let results: TestResultsMap = load()
const listeners = new Set<() => void>()

function save(next: TestResultsMap) {
  results = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quota or blocked storage: the results stay for this session.
  }
  listeners.forEach((notify) => notify())
}

function isValidRecord(val: unknown): val is TestRecord {
  if (!val || typeof val !== 'object') return false
  const { bestScore, total, passed, passedAt, attempts, lastAt } = val as Partial<TestRecord>
  return (
    typeof bestScore === 'number' &&
    typeof total === 'number' &&
    Number.isInteger(total) &&
    total >= 1 &&
    bestScore >= 0 &&
    bestScore <= total &&
    typeof passed === 'boolean' &&
    (passedAt === undefined || typeof passedAt === 'number') &&
    typeof attempts === 'number' &&
    typeof lastAt === 'number'
  )
}

/** The valid records in data from outside (localStorage, a backup file). */
export function parseTestResults(data: unknown): { records: TestResultsMap; skipped: number } {
  const records: TestResultsMap = {}
  let skipped = 0
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (isValidRecord(val)) records[key] = val
      else skipped++
    }
  }
  return { records, skipped }
}

export const getTestResults = (): TestResultsMap => results

export function subscribeTestResults(notify: () => void): () => void {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useTestResults(): TestResultsMap {
  return useSyncExternalStore(subscribeTestResults, getTestResults)
}

export interface TestOutcome {
  passed: boolean
  newlyPassed: boolean
}

/**
 * Stores a finished test. `newAttempt` false = the same attempt again with a higher score
 * ("Moja odpoveď bola tiež správna" on the result screen).
 */
export function recordTestResult(key: string, score: number, total: number, newAttempt = true, now = Date.now()): TestOutcome {
  if (!Number.isInteger(total) || total < 1 || score < 0 || score > total) return { passed: false, newlyPassed: false }
  const current = results[key]
  const passed = score >= passThreshold(total)
  const wasPassed = current?.passed === true
  save({
    ...results,
    [key]: {
      bestScore: Math.min(total, Math.max(current?.bestScore ?? 0, score)),
      total,
      passed: wasPassed || passed,
      passedAt: wasPassed ? current?.passedAt : passed ? now : undefined,
      attempts: (current?.attempts ?? 0) + (newAttempt || !current ? 1 : 0),
      lastAt: now,
    },
  })
  return { passed, newlyPassed: passed && !wasPassed }
}

/** Restores a backup's results; where this device has the test too, the better record stays. */
export function mergeTestResults(incoming: TestResultsMap): number {
  const isBetter = (a: TestRecord, b: TestRecord) => (a.passed !== b.passed ? a.passed : a.bestScore / a.total > b.bestScore / b.total)
  const next = { ...results }
  let taken = 0
  for (const [key, record] of Object.entries(incoming)) {
    if (next[key] && !isBetter(record, next[key])) continue
    next[key] = record
    taken++
  }
  if (taken) save(next)
  return taken
}

export function resetTestResultsForTesting(): void {
  save({})
}
