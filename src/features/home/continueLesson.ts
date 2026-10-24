import type { Level } from '../../data/types'
import type { TableTense } from '../../lib/conjugate'
import { getNumberedLessonCount, type LessonFilter } from '../../lib/lesson'
import { getFirstUnpassedLesson, getLastActiveLesson, progressionGroup, type LessonProgressionMap } from '../../lib/lessonProgress'
import { startFilter } from '../../lib/onboarding'
import { filterLabel, filterToParams, isLessonGroup, LEVELS } from '../exercises/exercises'

export interface ContinueLesson {
  href: string
  lesson: number
  label: string // "Doplňovačka · Jedlo a pitie · A1"
  started: boolean // false = nothing played yet, this is the suggested first lesson
}

/**
 * Where to pick up: the first unpassed lesson of the most recently played exercise, topic and
 * level. Before any lesson has been played: vocabulary from the topic and level picked in the
 * welcome (src/lib/onboarding.ts), else all topics, A1.
 */
export function continueLesson(progression: LessonProgressionMap, start: LessonFilter = startFilter()): ContinueLesson {
  const last = getLastActiveLesson()
  let filter: LessonFilter = start
  if (last) {
    const { type } = last
    const group = isLessonGroup(type, last.group) ? last.group : 'all'
    const level = LEVELS.find((l) => l === last.level) as Level | undefined
    filter = type === 'conjugation' ? { type, tense: group as TableTense | 'all', level } : { type, topic: group, level }
  }
  const type = filter.type
  const group = (type === 'conjugation' ? filter.tense : filter.topic) ?? 'all'
  const level = filter.level
  const total = getNumberedLessonCount(filter)
  const lesson = total > 0 ? getFirstUnpassedLesson(type, progressionGroup(group, level), total, progression) : 1

  return {
    href: `/practice/lesson?${filterToParams(filter)}&lesson=${lesson}`,
    lesson,
    label: filterLabel(filter),
    started: last !== undefined,
  }
}
