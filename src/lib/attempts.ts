import { celebrateGoal } from './celebration'
import { getDailyGoal } from './dailyGoal'
import { startOfDay } from './dates'
import { db } from './db'
import type { ExerciseType } from './lesson'
import { playSound } from './sound'
import { computeStreak, goalDays, loadCountedTimestamps } from './stats'

/** What produced an attempt: a lesson exercise or a spaced-repetition review. */
export type AttemptSource = ExerciseType | 'review'

/** The reached goal is celebrated after the sound of the answer or of the finished lesson, not on top of it (seconds). */
const GOAL_DELAY = 0.9

/** Stores one answered task or review; feeds the stats and, when it was right, the daily goal and the streak. */
export async function recordAttempt(source: AttemptSource, itemId: string, correct: boolean): Promise<void> {
  const at = Date.now()
  await db.attempts.add({ exercise: source, itemId, correct, at })
  // The daily goal counts right answers. The one that completes it is celebrated, and only that one:
  // a wrong answer leaves the count where it was.
  if (!correct) return
  const goal = getDailyGoal()
  const today = await db.attempts
    .where('at')
    .aboveOrEqual(startOfDay(new Date(at)).getTime())
    .filter((a) => a.correct)
    .count()
  if (today !== goal) return
  playSound('goal', GOAL_DELAY)
  const streakDays = computeStreak(goalDays(await loadCountedTimestamps(), goal), new Date(at)).days
  setTimeout(() => celebrateGoal({ goal, streakDays, at }), GOAL_DELAY * 1000)
}

/** How often each item of an exercise type was answered, so lessons can prefer fresh ones. */
export async function loadSeenCounts(exercise: ExerciseType): Promise<Map<string, number>> {
  const attempts = await db.attempts.where('exercise').equals(exercise).toArray()
  const seen = new Map<string, number>()
  for (const a of attempts) seen.set(a.itemId, (seen.get(a.itemId) ?? 0) + 1)
  return seen
}
