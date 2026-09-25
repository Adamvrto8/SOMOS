import type { Grade } from '../../../lib/lesson'

/** Visual state of a graded answer: green, amber (accent/typo) or red. */
export type Status = 'correct' | 'warn' | 'wrong'

export function statusOf(grade: Grade | null): Status | undefined {
  if (!grade) return undefined
  if (grade.verdict === 'correct') return 'correct'
  return grade.verdict === 'wrong' ? 'wrong' : 'warn'
}
