import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import type { Activity } from '../../lib/stats'
import { DayColumns } from '../stats/DayColumns'

/**
 * Right answers per day (what the daily goal counts), last 7 days, with today's value on its column. The whole card opens the
 * overview (/stats): longer periods, the streaks and what was practised.
 */
export function WeekChart({ activity, goal }: { activity: Activity; goal: number }) {
  const dictionary = useT()
  const text = dictionary.home
  const { week, weekTotal, weekAccuracy } = activity
  const goalDays = week.filter((d) => d.correct >= goal).length

  return (
    <section aria-labelledby="week-heading">
      <SectionTitle id="week-heading">{text.week}</SectionTitle>
      <Link
        to="/stats"
        aria-label={`${dictionary.stats.open}: ${text.answers(weekTotal)}`}
        className="block rounded-card border border-line bg-surface p-4 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
      >
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="min-w-0 flex-1">
            {weekTotal === 0 ? (
              text.noActivity
            ) : (
              <>
                <span className="font-semibold text-ink">{text.answers(weekTotal)}</span>
                {weekAccuracy !== null && <> · {text.percentCorrect(Math.round(weekAccuracy * 100))}</>}
              </>
            )}
          </span>
          <span className="flex shrink-0 items-center font-medium">
            {dictionary.stats.open}
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
          </span>
        </p>
        {weekTotal > 0 && (
          <>
            {/* Legend for the dashed line (a label inside the plot collides with tall columns). */}
            <p className="mt-1 mb-4 flex items-center gap-2 text-xs text-ink-muted">
              <span aria-hidden className="w-5 border-t border-dashed border-ink-muted" />
              {text.goalLegend(goal, goalDays)}
            </p>
            <DayColumns days={week} goal={goal} selected={week.length - 1} label={text.byDay} />
          </>
        )}
      </Link>
    </section>
  )
}
