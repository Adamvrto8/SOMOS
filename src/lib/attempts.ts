import { db } from './db'
import type { ExerciseType } from './lesson'

/** What produced an attempt: a lesson exercise or a spaced-repetition review. */
export type AttemptSource = ExerciseType | 'review'

/** Stores one answered task or review; feeds the streak, daily goal and stats. */
export async function recordAttempt(source: AttemptSource, itemId: string, correct: boolean): Promise<void> {
  await db.attempts.add({ exercise: source, itemId, correct, at: Date.now() })
}

/** How often each item of an exercise type was answered, so lessons can prefer fresh ones. */
export async function loadSeenCounts(exercise: ExerciseType): Promise<Map<string, number>> {
  const attempts = await db.attempts.where('exercise').equals(exercise).toArray()
  const seen = new Map<string, number>()
  for (const a of attempts) seen.set(a.itemId, (seen.get(a.itemId) ?? 0) + 1)
  return seen
}
