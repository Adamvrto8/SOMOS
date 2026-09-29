import { getDailyGoal } from './dailyGoal'
import { addDays, dayKey, endOfDay } from './dates'
import { db } from './db'
import { cardOf } from './srs'
import { computeStreak } from './stats'

// What the phone tells api/reminder.ts about today, so the reminder only goes out while the daily
// goal is not met and can say what is waiting. Keep in sync with ReminderProgress in api/reminder.ts.
export interface ReminderProgress {
  day: string // local day key, "2026-09-29"
  done: number // answers + reviews today (what the daily goal counts)
  goal: number
  dueToday: number // review cards due by the end of today
  dueTomorrow: number // … by the end of tomorrow (for a reminder before the app is opened again)
  streakDays: number
  activeToday: boolean
}

export function buildProgress(attemptTimestamps: number[], dueDates: Date[], goal: number, now: Date): ReminderProgress {
  const today = dayKey(now)
  const activeDays = new Set(attemptTimestamps.map((t) => dayKey(new Date(t))))
  const streak = computeStreak(activeDays, now)
  const endToday = endOfDay(now).getTime()
  const endTomorrow = endOfDay(addDays(now, 1)).getTime()
  return {
    day: today,
    done: attemptTimestamps.filter((t) => dayKey(new Date(t)) === today).length,
    goal,
    dueToday: dueDates.filter((d) => d.getTime() <= endToday).length,
    dueTomorrow: dueDates.filter((d) => d.getTime() <= endTomorrow).length,
    streakDays: streak.days,
    activeToday: streak.activeToday,
  }
}

export async function loadProgress(now = new Date()): Promise<ReminderProgress> {
  const [timestamps, cards] = await Promise.all([db.attempts.orderBy('at').keys() as Promise<number[]>, db.reviewCards.toArray()])
  return buildProgress(
    timestamps,
    cards.map((c) => cardOf(c).due),
    getDailyGoal(),
    now,
  )
}
