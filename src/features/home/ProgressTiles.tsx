import { ChevronRight, CircleCheck, Flame } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import type { Activity } from '../../lib/stats'

/** From this hour on, a streak whose goal for today is still open is shown as at risk. */
const AT_RISK_HOUR = 18

interface ProgressTilesProps {
  activity: Activity
  goal: number
  practiceHref: string // where tapping the daily goal leads: the lesson to continue
}

/** Streak + daily goal: one strip between thin steel lines, halves split by a hairline. */
export function ProgressTiles({ activity, goal, practiceHref }: ProgressTilesProps) {
  const text = useT().home
  const { days, activeToday } = activity.streak
  const atRisk = !activeToday && days > 0 && new Date().getHours() >= AT_RISK_HOUR
  const left = Math.max(0, goal - activity.today)
  const reached = left === 0
  const ratio = goal ? Math.min(activity.today, goal) / goal : 0

  return (
    <div className="grid grid-cols-2 border-y border-line">
      <section aria-label={text.streak} className="border-r border-line py-4 pr-4">
        <p className="flex items-center gap-2">
          <Flame
            size={24}
            strokeWidth={1.75}
            className={
              activeToday
                ? 'fill-amber/30 text-amber drop-shadow-[0_0_8px_var(--amber)]'
                : atRisk
                  ? 'text-amber motion-safe:animate-pulse'
                  : 'text-ink-muted'
            }
            aria-hidden
          />
          <span
            className={[
              'font-serif text-4xl font-semibold tabular-nums',
              activeToday ? 'dark:text-amber' : atRisk ? 'text-brick dark:text-amber' : '',
            ].join(' ')}
          >
            {days}
          </span>
        </p>
        <p className="mt-1 text-sm text-ink-muted">{text.streakDays(days)}</p>
        {atRisk ? (
          <p className="mt-0.5 text-sm font-medium text-brick dark:text-amber">{text.atRisk}</p>
        ) : (
          // Also at 0 days: it says what a day needs to count.
          !activeToday && <p className="mt-0.5 text-sm text-ink-muted">{text.practiceToday}</p>
        )}
      </section>

      <Link
        to={practiceHref}
        aria-label={text.goalAria(activity.today, goal, reached)}
        className="group block py-4 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
      >
        <p className="flex items-baseline gap-1">
          <span className="font-serif text-4xl font-semibold tabular-nums">{activity.today}</span>
          <span className="text-lg text-ink-muted">/ {goal}</span>
          {reached && <CircleCheck size={22} strokeWidth={2} className="ml-auto animate-pop self-center text-leaf" aria-hidden />}
        </p>
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-leaf/15">
          <div className="h-full rounded-full bg-leaf transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className={`mt-1.5 flex items-center text-sm ${reached ? 'font-medium text-leaf' : 'text-ink-muted group-hover:text-ink'}`}>
          {reached ? text.goalReached : text.goalLeft(left)}
          <ChevronRight size={16} strokeWidth={1.75} className="ml-auto shrink-0 text-ink-muted" aria-hidden />
        </p>
      </Link>
    </div>
  )
}
