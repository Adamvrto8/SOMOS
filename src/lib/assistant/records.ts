import { wordById } from '../../data'
import { dayKey } from '../dates'
import { db, type CustomWord, type DiaryNote, type Mistake, type SavedItem } from '../db'
import { byNewest } from '../diary'
import { getProgressionSnapshot, type LessonProgressionMap } from '../lessonProgress'
import { getTestResults, type TestResultsMap } from '../testProgress'
import { clip, describeItem, exerciseLabel } from './learner'

// The learner's own records for the assistant's get_my_records tool: the details behind the profile's summary lines.

export type RecordKind = 'mistakes' | 'diary' | 'tests' | 'lessons' | 'saved' | 'custom'
export const RECORD_KINDS: RecordKind[] = ['mistakes', 'diary', 'tests', 'lessons', 'saved', 'custom']

export interface RecordsInput {
  mistakes: Mistake[]
  diary: DiaryNote[]
  tests: TestResultsMap
  lessons: LessonProgressionMap
  saved: SavedItem[]
  custom: CustomWord[]
}

const date = (ms: number | undefined) => (ms ? dayKey(new Date(ms)) : undefined)

/** Newest first, at most `limit`. */
export function recordsOf(kind: RecordKind, input: RecordsInput, limit: number): Record<string, unknown>[] {
  switch (kind) {
    case 'mistakes':
      return [...input.mistakes]
        .sort((a, b) => b.lastWrongAt - a.lastWrongAt)
        .slice(0, limit)
        .map((m) => ({ item: describeItem(m.itemId), exercise: exerciseLabel(m.exercise), wrongCount: m.wrongCount, lastWrong: date(m.lastWrongAt) }))
    case 'diary':
      return [...input.diary]
        .sort(byNewest)
        .slice(0, limit)
        .map((e) => ({ date: e.date, ...(e.title.trim() ? { title: e.title.trim() } : {}), text: clip(e.text, 600) }))
    case 'tests':
      return Object.entries(input.tests)
        .sort(([, a], [, b]) => b.lastAt - a.lastAt)
        .slice(0, limit)
        .map(([key, r]) => ({ test: key, passed: r.passed, best: `${r.bestScore}/${r.total}`, attempts: r.attempts, last: date(r.lastAt) }))
    case 'lessons':
      return Object.entries(input.lessons)
        .filter(([, r]) => r.passed)
        .sort(([, a], [, b]) => (b.passedAt ?? 0) - (a.passedAt ?? 0))
        .slice(0, limit)
        .map(([key, r]) => ({ lesson: key, best: `${r.bestScore}/${r.total}`, passed: date(r.passedAt) }))
    case 'saved':
      return [...input.saved]
        .sort((a, b) => b.savedAt - a.savedAt)
        .slice(0, limit)
        .map((s) => ({ type: s.itemType, item: s.itemType === 'sentence' ? describeItem(s.itemId) : (wordById.get(s.itemId)?.es ?? s.itemId) }))
    case 'custom':
      return [...input.custom]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map((w) => ({ es: w.es, sk: w.sk, ...(w.note ? { note: w.note } : {}) }))
  }
}

/** Reads only the table the kind needs; the rest stays empty. */
export async function loadRecordsInput(kind: RecordKind): Promise<RecordsInput> {
  const input: RecordsInput = { mistakes: [], diary: [], tests: {}, lessons: {}, saved: [], custom: [] }
  if (kind === 'mistakes') input.mistakes = await db.mistakes.toArray()
  if (kind === 'diary') input.diary = await db.diaryNotes.toArray()
  if (kind === 'tests') input.tests = getTestResults()
  if (kind === 'lessons') input.lessons = getProgressionSnapshot()
  if (kind === 'saved') input.saved = await db.savedItems.toArray()
  if (kind === 'custom') input.custom = await db.customWords.toArray()
  return input
}
