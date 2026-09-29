// Storage and progression tracking for numbered lessons.
// Rules:
// - A lesson is passed when score >= passThreshold(total) (at least 8/10 or 80%).
// - Lesson 1 is always unlocked.
// - Lesson N is unlocked only if Lesson N-1 is passed.
// - The app remembers the last played topic/tense and returns to the first unpassed lesson.
// Only LessonPage records attempts, and only for a full run of a numbered lesson
// (not for "repeat mistakes" runs), so `total` is the lesson's real size — lessons
// of small topics have fewer than LESSON_SIZE tasks.

import { useSyncExternalStore } from 'react'
import type { ExerciseType } from './lesson'

export interface LessonRecord {
  bestScore: number
  total: number
  passed: boolean
  passedAt?: number
}

export type LessonProgressionMap = Record<string, LessonRecord>

// v2: the v1 keys hold records written by a bug that passed lesson N+1 with lesson N's
// answers, and "topic:level" groups stored as topics. They are left in place, unread.
const STORAGE_KEY = 'somos-lesson-progression-v2'
const ACTIVE_KEY = 'somos-lesson-active-v2'

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

function isValidRecord(val: unknown): val is LessonRecord {
  if (!val || typeof val !== 'object') return false
  const { bestScore, total, passed } = val as Partial<LessonRecord>
  return (
    typeof bestScore === 'number' &&
    typeof total === 'number' &&
    typeof passed === 'boolean' &&
    Number.isInteger(total) &&
    total >= 1 &&
    bestScore >= 0 &&
    bestScore <= total
  )
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
        if (isValidRecord(val)) cleaned[key] = val
        else dirty = true
      }
      if (dirty) safeSetItem(STORAGE_KEY, JSON.stringify(cleaned))
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
  return map[lessonKey(type, group, lessonNumber - 1)]?.passed === true
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

/** Stores the result of one full run of a numbered lesson (`total` = its task count). */
export function recordLessonAttempt(
  type: ExerciseType,
  group: string,
  lessonNumber: number,
  score: number,
  total: number,
): RecordAttemptResult {
  if (!Number.isInteger(total) || total < 1 || score < 0 || score > total) {
    return { passed: false, newlyPassed: false, bestScore: 0 }
  }
  const key = lessonKey(type, group, lessonNumber)
  const current = progressionMap[key]
  const passed = score >= passThreshold(total)
  // min: a lesson shrinks only when the dataset changes.
  const bestScore = Math.min(total, Math.max(current?.bestScore ?? 0, score))
  const wasPassed = current?.passed === true
  const newlyPassed = !wasPassed && passed

  saveMap({
    ...progressionMap,
    [key]: {
      bestScore,
      total,
      passed: wasPassed || passed,
      passedAt: newlyPassed ? Date.now() : current?.passedAt,
    },
  })

  return { passed, newlyPassed, bestScore }
}

// ---------- active lesson memory ----------

export interface ActiveLessonInfo {
  group: string // topic id or tense (not the progression group), or 'all'
  lesson: number
  level?: string // undefined = all levels
  at?: number // when it was last played (missing in entries saved before 2026-09-30)
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

/** Remembers the numbered lesson being played, for Cvičiť (topic/tense) and Home ("Pokračovať"). */
export function rememberActiveLesson(type: ExerciseType, group: string, lesson: number, level?: string): void {
  activeStore = {
    ...activeStore,
    [type]: { group, lesson, level, at: Date.now() },
  }
  safeSetItem(ACTIVE_KEY, JSON.stringify(activeStore))
}

/** The most recently played numbered lesson across all exercise types. */
export function getLastActiveLesson(): (ActiveLessonInfo & { type: ExerciseType }) | undefined {
  let last: (ActiveLessonInfo & { type: ExerciseType }) | undefined
  for (const [type, entry] of Object.entries(activeStore) as [ExerciseType, ActiveLessonInfo | undefined][]) {
    if (!entry || typeof entry.group !== 'string' || typeof entry.lesson !== 'number') continue
    if (!last || (entry.at ?? 0) > (last.at ?? 0)) last = { ...entry, type }
  }
  return last
}

export function getActiveLesson(type: ExerciseType, fallbackGroup: string): ActiveLessonInfo {
  const entry = activeStore[type]
  if (entry && typeof entry.group === 'string' && typeof entry.lesson === 'number') {
    return entry
  }
  return { group: fallbackGroup, lesson: 1 }
}
