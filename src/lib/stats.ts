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
  /** Streak freezes held now (ochrana série): a missed day uses one up instead of ending the streak. */
  freezes: number
  /** The days of the current streak that a freeze kept, oldest first; they do not add to `days`. */
  frozenDays: string[]
  /** Today's goal completed a week in a row, which earned a freeze. */
  freezeEarnedToday: boolean
}

/** A learner starts with one freeze, earns one for every 7 days in a row with the goal reached, holds 2 at most. */
export const FREEZE_START = 1
export const FREEZE_EVERY = 7
export const FREEZE_MAX = 2

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

/**
 * The streak, replayed day by day from the first counted day, with its freezes: a day with the goal reached
 * adds one, a missed day uses a freeze while there is one (the streak goes on without growing) and ends the
 * streak otherwise. Today counts once its goal is reached; while it is open, the streak is still alive.
 * Everything follows from the answers, so a backup, a sync or a changed goal give the same streak.
 */
function replayStreak(countedDays: Set<string>, now: Date): { streak: Streak; longest: number } {
  const todayKey = dayKey(now)
  let run = 0
  let longest = 0
  let inARow = 0 // goal days since the last freeze was earned (a frozen day neither adds nor breaks)
  let freezes = FREEZE_START
  let frozenDays: string[] = []
  let freezeEarnedToday = false

  const reached = (key: string) => {
    run++
    longest = Math.max(longest, run)
    if (++inARow === FREEZE_EVERY) {
      inARow = 0
      if (freezes < FREEZE_MAX) {
        freezes++
        if (key === todayKey) freezeEarnedToday = true
      }
    }
  }

  const first = [...countedDays].sort()[0]
  if (first !== undefined) {
    // Keys are YYYY-MM-DD, so they compare as dates.
    for (let day = new Date(`${first}T12:00:00`); dayKey(day) < todayKey; day = addDays(day, 1)) {
      const key = dayKey(day)
      if (countedDays.has(key)) reached(key)
      else if (run > 0 && freezes > 0) {
        freezes--
        frozenDays.push(key)
      } else {
        run = 0
        inARow = 0
        frozenDays = []
      }
    }
  }
  const activeToday = countedDays.has(todayKey)
  if (activeToday) reached(todayKey)
  return { streak: { days: run, activeToday, freezes, frozenDays, freezeEarnedToday }, longest }
}

/** Consecutive counted days ending today, or yesterday while today's goal is still open; freezes bridge missed days. */
export function computeStreak(countedDays: Set<string>, now: Date): Streak {
  return replayStreak(countedDays, now).streak
}

/** The longest streak there has ever been, freezes included as in computeStreak. */
export function longestStreak(countedDays: Set<string>, now: Date = new Date()): number {
  return replayStreak(countedDays, now).longest
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
    longestStreak: longestStreak(counted, now),
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
