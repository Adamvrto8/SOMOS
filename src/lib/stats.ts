import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, dayKey, startOfDay } from './dates'
import { db, type Attempt } from './db'

export interface DayStat {
  key: string // "2026-09-25"
  date: Date
  count: number
  correct: number
}

export interface Streak {
  days: number
  activeToday: boolean // false = the streak is still alive but needs activity today
}

export interface Activity {
  today: number // answers + reviews today (the daily goal counts these)
  streak: Streak
  week: DayStat[] // last 7 days, oldest first, today last
  weekTotal: number
  weekAccuracy: number | null // 0–1, null without answers
}

/** Consecutive active days ending today, or yesterday if today has no activity yet. */
export function computeStreak(activeDays: Set<string>, now: Date): Streak {
  const activeToday = activeDays.has(dayKey(now))
  let day = activeToday ? now : addDays(now, -1)
  let days = 0
  while (activeDays.has(dayKey(day))) {
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

export function computeActivity(allTimestamps: number[], recent: Pick<Attempt, 'at' | 'correct'>[], now: Date): Activity {
  const week = summarizeWeek(recent, now)
  const weekTotal = week.reduce((n, d) => n + d.count, 0)
  const weekCorrect = week.reduce((n, d) => n + d.correct, 0)
  return {
    today: week[6].count,
    streak: computeStreak(new Set(allTimestamps.map((t) => dayKey(new Date(t)))), now),
    week,
    weekTotal,
    weekAccuracy: weekTotal ? weekCorrect / weekTotal : null,
  }
}

/** Live activity from the attempts table (exercise answers and SRS reviews). */
export function useActivity(): Activity | undefined {
  return useLiveQuery(async () => {
    const now = new Date()
    const since = startOfDay(addDays(now, -6)).getTime()
    const [allTimestamps, recent] = await Promise.all([
      db.attempts.orderBy('at').keys() as Promise<number[]>,
      db.attempts.where('at').aboveOrEqual(since).toArray(),
    ])
    return computeActivity(allTimestamps, recent, now)
  }, [])
}
