import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, dayKey, startOfDay } from './dates'
import { db, type Attempt } from './db'

export interface DayStat {
  key: string // "2026-09-25"
  date: Date
  count: number
  correct: number
}

/** Days in a row on which the daily goal was reached. A few right answers under the goal do not carry it. */
export interface Streak {
  days: number
  activeToday: boolean // today's goal is reached; false = the streak is still alive but needs today's goal
}

export interface Activity {
  today: number // right answers + reviews today (what the daily goal counts)
  streak: Streak
  week: DayStat[] // last 7 days, oldest first, today last
  weekTotal: number
  weekAccuracy: number | null // 0–1, null without answers
}

/**
 * What the daily goal counts: the answers and reviews that were right. A wrong answer or one
 * given up is practice, not progress; fixed later in the lesson, it counts then.
 */
export const countedTimestamps = (attempts: Pick<Attempt, 'at' | 'correct'>[]): number[] => attempts.filter((a) => a.correct).map((a) => a.at)

/** The counted answers of the whole history, oldest first. */
export const loadCountedTimestamps = () =>
  db.attempts
    .orderBy('at')
    .filter((a) => a.correct)
    .keys() as Promise<number[]>

/**
 * The days that count for the streak: those whose counted answers reached the goal.
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

/** The longest run of consecutive counted days there has ever been. */
export function longestStreak(countedDays: Set<string>): number {
  let longest = 0
  for (const key of countedDays) {
    const day = new Date(`${key}T12:00:00`)
    // Count each run once, from its first day.
    if (countedDays.has(dayKey(addDays(day, -1)))) continue
    let length = 1
    while (countedDays.has(dayKey(addDays(day, length)))) length++
    longest = Math.max(longest, length)
  }
  return longest
}

/** Answers per day for the last `days` days, oldest first, today last. */
export function summarizeDays(attempts: Pick<Attempt, 'at' | 'correct'>[], now: Date, days: number): DayStat[] {
  const stats = Array.from({ length: days }, (_, i) => {
    const date = startOfDay(addDays(now, i - (days - 1)))
    return { key: dayKey(date), date, count: 0, correct: 0 }
  })
  const byKey = new Map(stats.map((d) => [d.key, d]))
  for (const a of attempts) {
    const day = byKey.get(dayKey(new Date(a.at)))
    if (!day) continue
    day.count++
    if (a.correct) day.correct++
  }
  return stats
}

export const summarizeWeek = (recent: Pick<Attempt, 'at' | 'correct'>[], now: Date): DayStat[] => summarizeDays(recent, now, 7)

export interface ExerciseStat {
  exercise: string // an exercise type, or "review"
  count: number
  correct: number
}

/** Answers split by what was practised, most practised first. */
export function byExercise(attempts: Pick<Attempt, 'exercise' | 'correct'>[]): ExerciseStat[] {
  const stats = new Map<string, ExerciseStat>()
  for (const a of attempts) {
    const stat = stats.get(a.exercise) ?? { exercise: a.exercise, count: 0, correct: 0 }
    stat.count++
    if (a.correct) stat.correct++
    stats.set(a.exercise, stat)
  }
  return [...stats.values()].sort((a, b) => b.count - a.count)
}

/** Everything since the first answer, for the overview page. */
export interface History {
  total: number
  correct: number
  firstDay: Date | null // when the first answer was given
  streak: Streak
  longestStreak: number
}

export function computeHistory(all: Pick<Attempt, 'at' | 'correct'>[], now: Date, goal: number): History {
  const counted = goalDays(countedTimestamps(all), goal)
  return {
    total: all.length,
    correct: all.filter((a) => a.correct).length,
    firstDay: all.length ? new Date(Math.min(...all.map((a) => a.at))) : null,
    streak: computeStreak(counted, now),
    longestStreak: longestStreak(counted),
  }
}

export function computeActivity(counted: number[], recent: Pick<Attempt, 'at' | 'correct'>[], now: Date, goal: number): Activity {
  const week = summarizeWeek(recent, now)
  const weekTotal = week.reduce((n, d) => n + d.count, 0)
  const weekCorrect = week.reduce((n, d) => n + d.correct, 0)
  return {
    today: week[6].correct,
    streak: computeStreak(goalDays(counted, goal), now),
    week,
    weekTotal,
    weekAccuracy: weekTotal ? weekCorrect / weekTotal : null,
  }
}

/** Every attempt, live: the overview page computes its periods from them. */
export function useAttempts(): Attempt[] | undefined {
  return useLiveQuery(() => db.attempts.orderBy('at').toArray(), [])
}

/** Live activity from the attempts table (exercise answers and SRS reviews), the streak by the daily goal. */
export function useActivity(goal: number): Activity | undefined {
  return useLiveQuery(async () => {
    const now = new Date()
    const since = startOfDay(addDays(now, -6)).getTime()
    const [counted, recent] = await Promise.all([loadCountedTimestamps(), db.attempts.where('at').aboveOrEqual(since).toArray()])
    return computeActivity(counted, recent, now, goal)
  }, [goal])
}
