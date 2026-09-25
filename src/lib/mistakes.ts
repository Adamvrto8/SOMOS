import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Mistake } from './db'
import type { ExerciseType } from './lesson'

// Exercises answered wrong ("Chyby"): kept until the learner says they know them.

const key = (exercise: string, itemId: string): [string, string] => [exercise, itemId]

export async function recordMistake(exercise: ExerciseType, itemId: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.mistakes, async () => {
    const existing = await db.mistakes.get(key(exercise, itemId))
    await db.mistakes.put(
      existing
        ? { ...existing, lastWrongAt: now, wrongCount: existing.wrongCount + 1 }
        : { exercise, itemId, firstWrongAt: now, lastWrongAt: now, wrongCount: 1 },
    )
  })
}

export async function removeMistake(exercise: string, itemId: string): Promise<void> {
  await db.mistakes.delete(key(exercise, itemId))
}

export async function clearMistakes(): Promise<void> {
  await db.mistakes.clear()
}

export function loadMistakes(): Promise<Mistake[]> {
  return db.mistakes.toArray()
}

/** Newest first. */
export function useMistakes(): Mistake[] | undefined {
  return useLiveQuery(() => db.mistakes.orderBy('lastWrongAt').reverse().toArray(), [])
}
