// Storage and progression tracking for numbered lessons.
// Rules:
// - A lesson is passed when score >= passThreshold(total) (at least 8/10 or 80%).
// - Lesson 1 is always unlocked.
// - Lesson N is unlocked only if Lesson N-1 is passed.
// - The app remembers the active lesson and returns to the first unpassed one.

import { useSyncExternalStore } from 'react'
import { LESSON_SIZE, type ExerciseType } from './lesson'

export interface LessonRecord {
  bestScore: number
  total: number
  passed: boolean
  passedAt?: number
}

export type LessonProgressionMap = Record<string, LessonRecord>

const STORAGE_KEY = 'somos-lesson-progression'
const ACTIVE_KEY = 'somos-lesson-active'

export function passThreshold(total: number): number {
  return Math.max(1, Math.ceil(total * 0.8))
}

export function progressionGroup(group: string, level?: string): string {
  return level && level !== 'all' ? `${group}:${level}` : `${group}:all`
}

export function lessonKey(type: ExerciseType, group: string, lessonNumber: number): string {
  return `${type}:${group}:${lessonNumber}`
}

function safeGetItem(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // Ignore quota/access errors
  }
}

function loadMap(): LessonProgressionMap {
  try {
    const raw = safeGetItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const cleaned: LessonProgressionMap = {}
      let dirty = false
      for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        if (
          val &&
          typeof val === 'object' &&
          'bestScore' in val &&
          'total' in val &&
          typeof (val as LessonRecord).bestScore === 'number' &&
          typeof (val as LessonRecord).total === 'number' &&
          (val as LessonRecord).total >= LESSON_SIZE &&
          (val as LessonRecord).bestScore <= (val as LessonRecord).total
        ) {
          cleaned[key] = val as LessonRecord
        } else {
          dirty = true
        }
      }
      if (dirty) {
        safeSetItem(STORAGE_KEY, JSON.stringify(cleaned))
      }
      return cleaned
    }
  } catch {
    // Missing or invalid JSON
  }
  return {}
}

let progressionMap: LessonProgressionMap = loadMap()
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((notify) => notify())
}

function saveMap(next: LessonProgressionMap) {
  progressionMap = next
  safeSetItem(STORAGE_KEY, JSON.stringify(next))
  notifyListeners()
}

export function resetProgressionForTesting(): void {
  progressionMap = {}
  activeStore = {}
  safeSetItem(STORAGE_KEY, '{}')
  safeSetItem(ACTIVE_KEY, '{}')
  notifyListeners()
}

export function subscribeProgression(notify: () => void): () => void {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function getProgressionSnapshot(): LessonProgressionMap {
  return progressionMap
}

export function useLessonProgression(): LessonProgressionMap {
  return useSyncExternalStore(subscribeProgression, getProgressionSnapshot)
}

export function getLessonRecord(
  type: ExerciseType,
  group: string,
  lessonNumber: number,
  map: LessonProgressionMap = progressionMap,
): LessonRecord | undefined {
  return map[lessonKey(type, group, lessonNumber)]
}

export function isLessonUnlocked(
  type: ExerciseType,
  group: string,
  lessonNumber: number,
  map: LessonProgressionMap = progressionMap,
): boolean {
  if (lessonNumber <= 1) return true
  const prevRecord = map[lessonKey(type, group, lessonNumber - 1)]
  return (
    prevRecord !== undefined &&
    prevRecord.passed === true &&
    prevRecord.total >= LESSON_SIZE &&
    prevRecord.bestScore >= passThreshold(prevRecord.total)
  )
}

export function getFirstUnpassedLesson(
  type: ExerciseType,
  group: string,
  totalLessons: number,
  map: LessonProgressionMap = progressionMap,
): number {
  if (totalLessons <= 1) return 1
  for (let i = 1; i <= totalLessons; i++) {
    const record = map[lessonKey(type, group, i)]
    if (!record || !record.passed) {
      return i
    }
  }
  // All passed: return 1 (or allow replaying any)
  return 1
}

export interface RecordAttemptResult {
  passed: boolean
  newlyPassed: boolean
  bestScore: number
}

export function recordLessonAttempt(
  type: ExerciseType,
  group: string,
  lessonNumber: number,
  score: number,
  total: number,
): RecordAttemptResult {
  if (total < LESSON_SIZE) {
    return { passed: false, newlyPassed: false, bestScore: 0 }
  }
  const key = lessonKey(type, group, lessonNumber)
  const current = progressionMap[key]
  const threshold = passThreshold(total)
  const passed = score >= threshold
  const bestScore = Math.max(current?.bestScore ?? 0, score)
  const wasPassed = current?.passed === true
  const nowPassed = bestScore >= threshold
  const newlyPassed = !wasPassed && nowPassed

  const updated: LessonRecord = {
    bestScore,
    total,
    passed: nowPassed,
    passedAt: newlyPassed ? Date.now() : current?.passedAt,
  }

  saveMap({
    ...progressionMap,
    [key]: updated,
  })

  // Update active tracking
  saveActiveLesson(type, group, nowPassed ? lessonNumber + 1 : lessonNumber)

  return {
    passed,
    newlyPassed,
    bestScore,
  }
}

// ---------- active lesson memory ----------

export interface ActiveLessonInfo {
  group: string
  lesson: number
}

type ActiveLessonsStore = Partial<Record<ExerciseType, ActiveLessonInfo>>

function loadActiveStore(): ActiveLessonsStore {
  try {
    const raw = safeGetItem(ACTIVE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) return parsed as ActiveLessonsStore
  } catch {
    // Ignore
  }
  return {}
}

let activeStore = loadActiveStore()
const activeListeners = new Set<() => void>()

function saveActiveLesson(type: ExerciseType, group: string, lesson: number) {
  activeStore = {
    ...activeStore,
    [type]: { group, lesson },
  }
  safeSetItem(ACTIVE_KEY, JSON.stringify(activeStore))
  activeListeners.forEach((notify) => notify())
}

export function getActiveLesson(type: ExerciseType, fallbackGroup: string): ActiveLessonInfo {
  const entry = activeStore[type]
  if (entry && entry.group && typeof entry.lesson === 'number') {
    return entry
  }
  return { group: fallbackGroup, lesson: 1 }
}

export function useActiveLesson(type: ExerciseType, fallbackGroup: string): ActiveLessonInfo {
  return useSyncExternalStore(
    (notify) => {
      activeListeners.add(notify)
      return () => {
        activeListeners.delete(notify)
      }
    },
    () => getActiveLesson(type, fallbackGroup),
  )
}
