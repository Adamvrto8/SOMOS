import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, dayKey, startOfDay } from './dates'
import { db, type Attempt } from './db'

export interface DayStat {
  key: string // "2026-09-25"
  date: Date
  count: number
  correct: number
}

/** Days in a row on which the daily goal was reached. A few answers under the goal do not carry it. */
export interface Streak {
  days: number
  activeToday: boolean // today's goal is reached; false = the streak is still alive but needs today's goal
}

export interface Activity {
  today: number // answers + reviews today (the daily goal counts these)
  streak: Streak
  week: DayStat[] // last 7 days, oldest first, today last
  weekTotal: number
  weekAccuracy: number | null // 0–1, null without answers
}

/**
 * The days that count for the streak: those whose answers and reviews reached the goal.
 * Judged by the goal as it is now, so changing the goal re-reads the past days too.
 */
export function goalDays(timestamps: number[], goal: number): Set<string> {
  const counts = new Map<string, number>()
  for (const t of timestamps) {
    const key = dayKey(new Date(t))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const needed = Math.max(1, goal)
  return new Set([...counts].filter(([, count]) => count >= needed).map(([key]) => key))
}

/** Consecutive counted days ending today, or yesterday while today's goal is still open. */
export function computeStreak(countedDays: Set<string>, now: Date): Streak {
  const activeToday = countedDays.has(dayKey(now))
  let day = activeToday ? now : addDays(now, -1)
  let days = 0
  while (countedDays.has(dayKey(day))) {
    days++
    day = addDays(day, -1)
  }
  return { days, activeToday }
}

export function summarizeWeek(recent: Pick<Attempt, 'at' | 'correct'>[], now: Date): DayStat[] {
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(addDays(now, i - 6))
    return { key: dayKey(date), date, count: 0, correct: 0 }
  })
  const byKey = new Map(week.map((d) => [d.key, d]))
  for (const a of recent) {
    const day = byKey.get(dayKey(new Date(a.at)))
    if (!day) continue
    day.count++
    if (a.correct) day.correct++
  }
  return week
}

export function computeActivity(allTimestamps: number[], recent: Pick<Attempt, 'at' | 'correct'>[], now: Date, goal: number): Activity {
  const week = summarizeWeek(recent, now)
  const weekTotal = week.reduce((n, d) => n + d.count, 0)
  const weekCorrect = week.reduce((n, d) => n + d.correct, 0)
  return {
    today: week[6].count,
    streak: computeStreak(goalDays(allTimestamps, goal), now),
    week,
    weekTotal,
    weekAccuracy: weekTotal ? weekCorrect / weekTotal : null,
  }
}

/** Live activity from the attempts table (exercise answers and SRS reviews), the streak by the daily goal. */
export function useActivity(goal: number): Activity | undefined {
  return useLiveQuery(async () => {
    const now = new Date()
    const since = startOfDay(addDays(now, -6)).getTime()
    const [allTimestamps, recent] = await Promise.all([
      db.attempts.orderBy('at').keys() as Promise<number[]>,
      db.attempts.where('at').aboveOrEqual(since).toArray(),
    ])
    return computeActivity(allTimestamps, recent, now, goal)
  }, [goal])
}
