import { getDailyGoal } from './dailyGoal'
import { dayKey } from './dates'
import { loadDueCounts } from './srs'
import { computeStreak, goalDays, loadCountedTimestamps } from './stats'

// What the phone tells api/reminder.ts about today, so the reminder only goes out while the daily
// goal is not met and can say what is waiting. Keep in sync with ReminderProgress in api/reminder.ts.
export interface ReminderProgress {
  day: string // local day key, "2026-09-29"
  done: number // right answers + reviews today (what the daily goal counts)
  goal: number
  dueToday: number // review cards due by the end of today
  dueTomorrow: number // … by the end of tomorrow (for a reminder before the app is opened again)
  streakDays: number // days in a row with the goal reached
  activeToday: boolean // today's goal is reached
}

/** `counted`: when the answers that count for the goal were given (the right ones). */
export function buildProgress(counted: number[], due: { today: number; tomorrow: number }, goal: number, now: Date): ReminderProgress {
  const today = dayKey(now)
  const streak = computeStreak(goalDays(counted, goal), now)
  return {
    day: today,
    done: counted.filter((t) => dayKey(new Date(t)) === today).length,
    goal,
    dueToday: due.today,
    dueTomorrow: due.tomorrow,
    streakDays: streak.days,
    activeToday: streak.activeToday,
  }
}

export async function loadProgress(now = new Date()): Promise<ReminderProgress> {
  // Same due counts as Domov: the daily limit for practised words applies.
  const [counted, due] = await Promise.all([loadCountedTimestamps(), loadDueCounts(now)])
  return buildProgress(counted, due, getDailyGoal(), now)
}
