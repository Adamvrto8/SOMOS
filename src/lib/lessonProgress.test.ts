import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFirstUnpassedLesson,
  getLessonRecord,
  isLessonUnlocked,
  lessonKey,
  passThreshold,
  recordLessonAttempt,
  resetProgressionForTesting,
} from './lessonProgress'

const storage = new Map<string, string>()

// Mock localStorage for Node test runner
const mockStorage: Storage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() {
    return storage.size
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
})

describe('lessonProgress', () => {
  beforeEach(() => {
    storage.clear()
    resetProgressionForTesting()
  })

  it('calculates 80% pass threshold (at least 8/10)', () => {
    expect(passThreshold(10)).toBe(8)
    expect(passThreshold(9)).toBe(8)
    expect(passThreshold(8)).toBe(7)
    expect(passThreshold(5)).toBe(4)
  })

  it('creates stable lesson keys', () => {
    expect(lessonKey('cloze', 'basics', 1)).toBe('cloze:basics:1')
    expect(lessonKey('conjugation', 'presente', 3)).toBe('conjugation:presente:3')
  })

  it('keeps lesson 1 always unlocked and lesson 2 locked until lesson 1 passes', () => {
    expect(isLessonUnlocked('cloze', 'basics', 1)).toBe(true)
    expect(isLessonUnlocked('cloze', 'basics', 2)).toBe(false)

    // Score 7/10: does not pass (threshold is 8)
    const failResult = recordLessonAttempt('cloze', 'basics', 1, 7, 10)
    expect(failResult.passed).toBe(false)
    expect(failResult.newlyPassed).toBe(false)
    expect(isLessonUnlocked('cloze', 'basics', 2)).toBe(false)
    expect(getLessonRecord('cloze', 'basics', 1)?.passed).toBe(false)

    // Score 8/10: passes!
    const passResult = recordLessonAttempt('cloze', 'basics', 1, 8, 10)
    expect(passResult.passed).toBe(true)
    expect(passResult.newlyPassed).toBe(true)
    expect(isLessonUnlocked('cloze', 'basics', 2)).toBe(true)
    expect(isLessonUnlocked('cloze', 'basics', 3)).toBe(false)
  })

  it('determines the first unpassed lesson correctly', () => {
    expect(getFirstUnpassedLesson('cloze', 'basics', 3)).toBe(1)

    recordLessonAttempt('cloze', 'basics', 1, 9, 10)
    expect(getFirstUnpassedLesson('cloze', 'basics', 3)).toBe(2)

    recordLessonAttempt('cloze', 'basics', 2, 7, 10) // failed attempt
    expect(getFirstUnpassedLesson('cloze', 'basics', 3)).toBe(2)

    recordLessonAttempt('cloze', 'basics', 2, 10, 10) // passed
    expect(getFirstUnpassedLesson('cloze', 'basics', 3)).toBe(3)
  })
})
