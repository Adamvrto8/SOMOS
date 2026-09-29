import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getProgressionSnapshot,
  recordLessonAttempt,
  rememberActiveLesson,
  resetProgressionForTesting,
} from '../../lib/lessonProgress'
import { continueLesson } from './continueLesson'

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

describe('continueLesson', () => {
  beforeEach(() => {
    storage.clear()
    resetProgressionForTesting()
  })

  it('suggests vocabulary A1, lesson 1 before anything was played', () => {
    const next = continueLesson(getProgressionSnapshot())
    expect(next).toMatchObject({ lesson: 1, started: false, label: 'Slovná zásoba · Všetky témy · A1' })
    expect(next.href).toBe('/practice/lesson?type=vocab&topic=all&level=A1&lesson=1')
  })

  it('continues the most recent exercise at its first unpassed lesson', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 30, 9))
    rememberActiveLesson('vocab', 'all', 3, 'A1')
    vi.setSystemTime(new Date(2026, 8, 30, 10))
    rememberActiveLesson('cloze', 'food', 1, 'A1')
    vi.useRealTimers()
    recordLessonAttempt('cloze', 'food:A1', 1, 10, 10)
    const next = continueLesson(getProgressionSnapshot())
    expect(next).toMatchObject({ lesson: 2, started: true, label: 'Doplňovačka · Jedlo a pitie · A1' })
    expect(next.href).toBe('/practice/lesson?type=cloze&topic=food&level=A1&lesson=2')
  })

  it('keeps "all levels" when the last lesson had no level', () => {
    rememberActiveLesson('conjugation', 'preterito', 1)
    expect(continueLesson(getProgressionSnapshot())).toMatchObject({ lesson: 1, label: 'Časovanie · pretérito' })
  })
})
