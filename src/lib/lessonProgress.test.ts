import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getFirstUnpassedLesson,
  getLessonRecord,
  isLessonUnlocked,
  lessonKey,
  passThreshold,
  progressionGroup,
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

  it('distinguishes progression groups by level', () => {
    expect(progressionGroup('all', 'A1')).toBe('all:A1')
    expect(progressionGroup('all', 'A2')).toBe('all:A2')
    expect(progressionGroup('all', undefined)).toBe('all:all')
    expect(progressionGroup('all', 'all')).toBe('all:all')

    // Passing Lesson 1 in A1 does not unlock Lesson 2 in A2
    recordLessonAttempt('vocab', progressionGroup('all', 'A1'), 1, 9, 10)
    expect(isLessonUnlocked('vocab', progressionGroup('all', 'A1'), 2)).toBe(true)
    expect(isLessonUnlocked('vocab', progressionGroup('all', 'A2'), 2)).toBe(false)
    expect(isLessonUnlocked('vocab', progressionGroup('all', 'all'), 2)).toBe(false)
  })

  it('passes a small lesson (topic with fewer than LESSON_SIZE tasks) at 80 %', () => {
    expect(recordLessonAttempt('cloze', 'food:B1', 1, 1, 2).passed).toBe(false)
    expect(recordLessonAttempt('cloze', 'food:B1', 1, 2, 2).passed).toBe(true)
    expect(getLessonRecord('cloze', 'food:B1', 1)).toMatchObject({ bestScore: 2, total: 2, passed: true })
  })

  it('ignores invalid attempts', () => {
    expect(recordLessonAttempt('cloze', 'basics', 1, 0, 0).passed).toBe(false)
    expect(recordLessonAttempt('cloze', 'basics', 1, 11, 10).passed).toBe(false)
    expect(getLessonRecord('cloze', 'basics', 1)).toBeUndefined()
  })

  it('keeps a passed lesson passed after a worse attempt', () => {
    recordLessonAttempt('cloze', 'basics', 1, 9, 10)
    const worse = recordLessonAttempt('cloze', 'basics', 1, 3, 10)
    expect(worse.passed).toBe(false)
    expect(worse.bestScore).toBe(9)
    expect(isLessonUnlocked('cloze', 'basics', 2)).toBe(true)
  })

  it('unlocks only the lesson right after the passed one', () => {
    recordLessonAttempt('cloze', 'basics', 1, 10, 10)
    expect(isLessonUnlocked('cloze', 'basics', 2)).toBe(true)
    expect(isLessonUnlocked('cloze', 'basics', 3)).toBe(false)
    // Failing lesson 2 does not unlock lesson 3.
    recordLessonAttempt('cloze', 'basics', 2, 7, 10)
    expect(isLessonUnlocked('cloze', 'basics', 3)).toBe(false)
  })

  it('drops malformed records from storage on load', async () => {
    storage.set(
      'somos-lesson-progression-v2',
      JSON.stringify({
        'cloze:basics:1': { bestScore: 7, total: 1, passed: true },
        'cloze:basics:2': { bestScore: 9, total: 10, passed: true },
        'cloze:basics:3': { bestScore: 'x', total: 10, passed: true },
      }),
    )
    vi.resetModules()
    const fresh = await import('./lessonProgress')
    expect(fresh.getLessonRecord('cloze', 'basics', 1)).toBeUndefined()
    expect(fresh.getLessonRecord('cloze', 'basics', 2)?.passed).toBe(true)
    expect(fresh.getLessonRecord('cloze', 'basics', 3)).toBeUndefined()
    expect(Object.keys(JSON.parse(storage.get('somos-lesson-progression-v2')!) as object)).toEqual(['cloze:basics:2'])
  })

  it('does not read progress written by the buggy v1 build', async () => {
    storage.set('somos-lesson-progression', JSON.stringify({ 'cloze:basics:1': { bestScore: 10, total: 10, passed: true } }))
    vi.resetModules()
    const fresh = await import('./lessonProgress')
    expect(fresh.isLessonUnlocked('cloze', 'basics', 2)).toBe(false)
  })
})
