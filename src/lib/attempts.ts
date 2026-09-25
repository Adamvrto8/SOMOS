import { db } from './db'
import type { ExerciseType } from './lesson'

/** Stores one answered task; feeds the stats and review features (phase 5). */
export async function recordAttempt(exercise: ExerciseType, itemId: string, correct: boolean): Promise<void> {
  await db.attempts.add({ exercise, itemId, correct, at: Date.now() })
}
