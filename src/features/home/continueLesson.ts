import { topicById } from '../../data'
import type { Level } from '../../data/types'
import { t } from '../../i18n'
import { TENSE_LABELS, type TableTense } from '../../lib/conjugate'
import { getNumberedLessonCount, type LessonFilter } from '../../lib/lesson'
import { getFirstUnpassedLesson, getLastActiveLesson, progressionGroup, type LessonProgressionMap } from '../../lib/lessonProgress'
import { exerciseInfo, filterToParams, isLessonGroup, LEVELS } from '../exercises/exercises'

export interface ContinueLesson {
  href: string
  lesson: number
  label: string // "Doplňovačka · Jedlo a pitie · A1"
  started: boolean // false = nothing played yet, this is the suggested first lesson
}

/**
 * Where to pick up: the first unpassed lesson of the most recently played exercise, topic and
 * level. Before any lesson has been played: vocabulary, all topics, A1.
 */
export function continueLesson(progression: LessonProgressionMap): ContinueLesson {
  const last = getLastActiveLesson()
  const type = last?.type ?? 'vocab'
  const group = last && isLessonGroup(type, last.group) ? last.group : 'all'
  const level = last ? (LEVELS.find((l) => l === last.level) as Level | undefined) : 'A1'

  const filter: LessonFilter =
    type === 'conjugation' ? { type, tense: group as TableTense | 'all', level } : { type, topic: group, level }
  const total = getNumberedLessonCount(filter)
  const lesson = total > 0 ? getFirstUnpassedLesson(type, progressionGroup(group, level), total, progression) : 1

  const groupLabel =
    group === 'all'
      ? type === 'conjugation'
        ? t().exercise.allTenses
        : t().exercise.allTopics
      : type === 'conjugation'
        ? TENSE_LABELS[group as TableTense]
        : (topicById.get(group)?.sk ?? group)

  return {
    href: `/practice/lesson?${filterToParams(filter)}&lesson=${lesson}`,
    lesson,
    label: [exerciseInfo(type).label, groupLabel, level].filter(Boolean).join(' · '),
    started: last !== undefined,
  }
}
