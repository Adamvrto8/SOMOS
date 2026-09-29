import { Blocks, BookOpen, Languages, ListChecks, PencilLine, Repeat2, type LucideIcon } from 'lucide-react'
import { topicById } from '../../data'
import type { Level } from '../../data/types'
import { TABLE_TENSES, type TableTense } from '../../lib/conjugate'
import type { ExerciseType, LessonFilter } from '../../lib/lesson'

export interface ExerciseInfo {
  type: ExerciseType
  label: string
  description: string
  instruction: string // shown above each task
  icon: LucideIcon
}

export const EXERCISES: ExerciseInfo[] = [
  {
    type: 'cloze',
    label: 'Doplňovačka',
    description: 'Doplň chýbajúce slovo v správnom tvare.',
    instruction: 'Doplň slovo',
    icon: PencilLine,
  },
  {
    type: 'choice',
    label: 'Výber z možností',
    description: 'Vyber správne slovo alebo tvar.',
    instruction: 'Vyber správnu možnosť',
    icon: ListChecks,
  },
  {
    type: 'vocab',
    label: 'Slovná zásoba',
    description: 'Prelož slovenské alebo španielske slovo.',
    instruction: 'Prelož slovo',
    icon: BookOpen,
  },
  {
    type: 'conjugation',
    label: 'Časovanie',
    description: 'tener · yo · pretérito → tuve',
    instruction: 'Vyčasuj sloveso',
    icon: Repeat2,
  },
  {
    type: 'builder',
    label: 'Skladanie viet',
    description: 'Poskladaj vetu zo zamiešaných slov.',
    instruction: 'Poskladaj vetu',
    icon: Blocks,
  },
  {
    type: 'translation',
    label: 'Preklad viet',
    description: 'Prelož vetu zo slovenčiny do španielčiny.',
    instruction: 'Prelož do španielčiny',
    icon: Languages,
  },
]

export const exerciseInfo = (type: ExerciseType) => EXERCISES.find((e) => e.type === type)!

export const LEVELS: Level[] = ['A1', 'A2', 'B1']

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

export function filterToParams(filter: LessonFilter): URLSearchParams {
  const params = new URLSearchParams({ type: filter.type })
  if (filter.topic) params.set('topic', filter.topic)
  if (filter.level) params.set('level', filter.level)
  if (filter.tense) params.set('tense', filter.tense)
  return params
}
