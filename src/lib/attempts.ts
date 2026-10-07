import { getDailyGoal } from './dailyGoal'
import { startOfDay } from './dates'
import { db } from './db'
import type { ExerciseType } from './lesson'
import { playSound } from './sound'

/** What produced an attempt: a lesson exercise or a spaced-repetition review. */
export type AttemptSource = ExerciseType | 'review'

/** After the sound of the answer or of the finished lesson, not on top of it. */
const GOAL_SOUND_DELAY = 0.9

/** Stores one answered task or review; feeds the streak, daily goal and stats. */
export async function recordAttempt(source: AttemptSource, itemId: string, correct: boolean): Promise<void> {
  const at = Date.now()
  await db.attempts.add({ exercise: source, itemId, correct, at })
  // The answer that completes the daily goal is celebrated, and only that one.
  const today = await db.attempts.where('at').aboveOrEqual(startOfDay(new Date(at)).getTime()).count()
  if (today === getDailyGoal()) playSound('goal', GOAL_SOUND_DELAY)
}

/** How often each item of an exercise type was answered, so lessons can prefer fresh ones. */
export async function loadSeenCounts(exercise: ExerciseType): Promise<Map<string, number>> {
  const attempts = await db.attempts.where('exercise').equals(exercise).toArray()
  const seen = new Map<string, number>()
  for (const a of attempts) seen.set(a.itemId, (seen.get(a.itemId) ?? 0) + 1)
  return seen
}
