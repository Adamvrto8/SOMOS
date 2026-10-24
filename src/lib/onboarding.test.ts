import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { continueLesson } from '../features/home/continueLesson'
import { getNumberedLessonCount } from './lesson'
import { getProgressionSnapshot, resetProgressionForTesting } from './lessonProgress'
import {
  finishOnboarding,
  forgetOnboardingForTesting,
  getOnboarding,
  MOTIVATIONS,
  shouldOnboard,
  START_LEVELS,
  startFilter,
  updateOnboarding,
} from './onboarding'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: () => null,
    length: 0,
  },
  writable: true,
})

const none = () => Promise.resolve(false)
const some = () => Promise.resolve(true)

describe('who sees the welcome', () => {
  beforeEach(() => {
    storage.clear()
    forgetOnboardingForTesting()
  })

  it('a new device does, until the welcome is finished', async () => {
    expect(await shouldOnboard(none)).toBe(true)
    updateOnboarding({ motivation: 'travel' })
    expect(await shouldOnboard(none)).toBe(true) // halfway through it comes back where it was
    finishOnboarding()
    expect(await shouldOnboard(none)).toBe(false)
  })

  it('a device with progress from before the welcome does not, and is marked as done', async () => {
    expect(await shouldOnboard(some)).toBe(false)
    expect(getOnboarding()?.done).toBe(true)
    expect(await shouldOnboard(none)).toBe(false)
  })

  it('history no longer counts once the welcome has started', async () => {
    updateOnboarding({ level: 'A2' })
    expect(await shouldOnboard(some)).toBe(true)
  })
})

describe('the first lessons', () => {
  beforeEach(() => {
    storage.clear()
    forgetOnboardingForTesting()
    resetProgressionForTesting()
  })

  it('come from all topics at A1 without answers', () => {
    expect(startFilter(null)).toEqual({ type: 'vocab', topic: 'all', level: 'A1' })
  })

  it('come from the topic of the motivation at the chosen level, or all topics when it has nothing there', () => {
    for (const { id, topic } of MOTIVATIONS) {
      for (const level of START_LEVELS) {
        const filter = startFilter({ done: true, motivation: id, level })
        const own = getNumberedLessonCount({ type: 'vocab', topic, level }) > 0
        expect(filter).toEqual({ type: 'vocab', topic: own ? topic : 'all', level })
        expect(getNumberedLessonCount(filter)).toBeGreaterThan(0)
      }
    }
  })

  it('are where Domov leads before any lesson was played', () => {
    const next = continueLesson(getProgressionSnapshot(), startFilter({ done: true, motivation: 'travel', level: 'A1' }))
    expect(next.href).toBe('/practice/lesson?type=vocab&topic=travel&level=A1&lesson=1')
    expect(next.started).toBe(false)
  })
})
