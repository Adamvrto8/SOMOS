import { useSyncExternalStore } from 'react'
import type { ExerciseType } from './lesson'

// The skill groups of Cvičiť: what an exercise trains. A filter over the exercises, not a lock or a course.
// docs/skill-groups-spec.md

export type Skill = 'vocabulary' | 'grammar' | 'writing' | 'listening'
export const SKILLS: readonly Skill[] = ['vocabulary', 'grammar', 'writing', 'listening']

/** The group of every exercise type. A Record, so a new ExerciseType does not compile until it has one. */
export const SKILL_OF: Record<ExerciseType, Skill> = {
  vocab: 'vocabulary',
  matching: 'vocabulary',
  cloze: 'vocabulary',
  conjugation: 'grammar',
  choice: 'grammar',
  findmistake: 'grammar',
  truefalse: 'grammar',
  builder: 'writing',
  translation: 'writing',
  dictation: 'listening',
  speaking: 'listening',
}

export const typesOfSkill = (skill: Skill): ExerciseType[] =>
  (Object.keys(SKILL_OF) as ExerciseType[]).filter((type) => SKILL_OF[type] === skill)

export const isSkill = (value: unknown): value is Skill => (SKILLS as readonly unknown[]).includes(value)

/** The skill of an attempt's exercise; undefined for reviews ("review") and unknown values from old data. */
export const skillOfExercise = (exercise: string): Skill | undefined =>
  Object.hasOwn(SKILL_OF, exercise) ? SKILL_OF[exercise as ExerciseType] : undefined

// The group picked in Cvičiť, per device only (not synced, not in the backup).
export type SkillFilter = Skill | 'all'
const STORAGE_KEY = 'somos-practice-skill'
const listeners = new Set<() => void>()

function read(): SkillFilter {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isSkill(value) ? value : 'all'
  } catch {
    return 'all'
  }
}

export function setPracticeSkill(skill: SkillFilter): void {
  try {
    if (skill === 'all') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, skill)
  } catch {
    // Without storage the pick lasts until the page is left.
  }
  current = skill
  for (const listener of listeners) listener()
}

let current: SkillFilter | undefined
const snapshot = (): SkillFilter => (current ??= read())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const usePracticeSkill = (): SkillFilter => useSyncExternalStore(subscribe, snapshot, () => 'all')
