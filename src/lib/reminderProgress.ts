import { getDailyGoal } from './dailyGoal'
import { dayKey } from './dates'
import { db } from './db'
import { loadDueCounts } from './srs'
import { computeStreak, goalDays } from './stats'

// What the phone tells api/reminder.ts about today, so the reminder only goes out while the daily
// goal is not met and can say what is waiting. Keep in sync with ReminderProgress in api/reminder.ts.
export interface ReminderProgress {
  day: string // local day key, "2026-09-29"
  done: number // answers + reviews today (what the daily goal counts)
  goal: number
  dueToday: number // review cards due by the end of today
  dueTomorrow: number // … by the end of tomorrow (for a reminder before the app is opened again)
  streakDays: number // days in a row with the goal reached
  activeToday: boolean // today's goal is reached
}

export function buildProgress(attemptTimestamps: number[], due: { today: number; tomorrow: number }, goal: number, now: Date): ReminderProgress {
  const today = dayKey(now)
  const streak = computeStreak(goalDays(attemptTimestamps, goal), now)
  return {
    day: today,
    done: attemptTimestamps.filter((t) => dayKey(new Date(t)) === today).length,
    goal,
    dueToday: due.today,
    dueTomorrow: due.tomorrow,
    streakDays: streak.days,
    activeToday: streak.activeToday,
  }
}

export async function loadProgress(now = new Date()): Promise<ReminderProgress> {
  // Same due counts as Domov: the daily limit for practised words applies.
  const [timestamps, due] = await Promise.all([db.attempts.orderBy('at').keys() as Promise<number[]>, loadDueCounts(now)])
  return buildProgress(timestamps, due, getDailyGoal(), now)
}
