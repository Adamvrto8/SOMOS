import { Blocks, BookOpen, Headphones, Languages, ListChecks, Mic, PencilLine, Repeat2, type LucideIcon } from 'lucide-react'
import { topicById } from '../../data'
import type { Level } from '../../data/types'
import { t } from '../../i18n'
import { TABLE_TENSES, TENSE_LABELS, type TableTense } from '../../lib/conjugate'
import type { ExerciseType, LessonFilter } from '../../lib/lesson'
import { topicName } from '../../lib/localized'
import { speechSupported } from '../../lib/speech'

export interface ExerciseInfo {
  readonly type: ExerciseType
  readonly label: string
  readonly description: string
  readonly instruction: string // shown above each task
  readonly icon: LucideIcon
  /** Why the exercise can't be used in this browser; the card is then disabled. */
  readonly unavailable?: string
}

/** Names and instructions come from the dictionary when they are read, so they follow the language. */
const exercise = (type: ExerciseType, icon: LucideIcon, available = true): ExerciseInfo => ({
  type,
  icon,
  get label() {
    return t().exercise.types[type].label
  },
  get description() {
    return t().exercise.types[type].description
  },
  get instruction() {
    return t().exercise.types[type].instruction
  },
  get unavailable() {
    return available ? undefined : t().exercise.noSpeech
  },
})

export const EXERCISES: ExerciseInfo[] = [
  exercise('cloze', PencilLine),
  exercise('choice', ListChecks),
  exercise('vocab', BookOpen),
  exercise('conjugation', Repeat2),
  exercise('builder', Blocks),
  exercise('translation', Languages),
  exercise('dictation', Headphones),
  exercise('speaking', Mic, speechSupported),
]

export const exerciseInfo = (type: ExerciseType) => EXERCISES.find((e) => e.type === type)!

export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2']

// ---------- filter <-> URL (?type=&topic=&level=&tense=) ----------

export function filterFromParams(params: URLSearchParams): LessonFilter {
  const type = EXERCISES.find((e) => e.type === params.get('type'))?.type ?? 'cloze'
  const topic = params.get('topic')
  const level = params.get('level') as Level | null
  const tense = params.get('tense') as TableTense | 'all' | null
  return {
    type,
    // Conjugation drills are filtered by tense; the other exercises by topic.
    topic: type !== 'conjugation' && topic && (topic === 'all' || topicById.has(topic)) ? topic : undefined,
    tense: type === 'conjugation' && tense && (tense === 'all' || TABLE_TENSES.includes(tense as TableTense)) ? tense : undefined,
    level: level && LEVELS.includes(level) ? level : undefined,
  }
}

/** Whether `group` is a valid topic (or tense, for conjugation) of the exercise type. */
export function isLessonGroup(type: ExerciseType, group: string): boolean {
  if (group === 'all') return true
  return type === 'conjugation' ? TABLE_TENSES.includes(group as TableTense) : topicById.has(group)
}

/**
 * What a filter picks, in words: "Doplňovačka · Jedlo a pitie · A1".
 * Without a level the label ends after the topic, unless `allLevels` names that case.
 */
export function filterLabel(filter: LessonFilter, allLevels?: string): string {
  return [exerciseInfo(filter.type).label, selectionLabel(filter, allLevels)].filter(Boolean).join(' · ')
}

/** The topic (or tense) and level a filter picks: "Jedlo a pitie · A1". */
export function selectionLabel(filter: LessonFilter, allLevels?: string): string {
  const byTense = filter.type === 'conjugation'
  const group = (byTense ? filter.tense : filter.topic) ?? 'all'
  const topic = topicById.get(group)
  const groupLabel =
    group === 'all'
      ? byTense
        ? t().exercise.allTenses
        : t().exercise.allTopics
      : byTense
        ? TENSE_LABELS[group as TableTense]
        : topic
          ? topicName(topic)
          : group
  return [groupLabel, filter.level ?? allLevels].filter(Boolean).join(' · ')
}

export function filterToParams(filter: LessonFilter): URLSearchParams {
  const params = new URLSearchParams({ type: filter.type })
  if (filter.topic) params.set('topic', filter.topic)
  if (filter.level) params.set('level', filter.level)
  if (filter.tense) params.set('tense', filter.tense)
  return params
}
