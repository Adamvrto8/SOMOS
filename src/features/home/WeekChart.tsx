import { useState } from 'react'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import type { Activity } from '../../lib/stats'

const CHART_HEIGHT = 96 // tallest column
const PLOT_HEIGHT = CHART_HEIGHT + 20 // room for the value label on the cap


/**
 * Answers per day, last 7 days: one series, one hue (brick), thin columns from a
 * hairline baseline, the daily goal as a dashed reference line. The selected day
 * (today by default, tap to change) carries the only value label; every column is
 * a button whose label reads the full value.
 */
export function WeekChart({ activity, goal }: { activity: Activity; goal: number }) {
  const dictionary = useT()
  const text = dictionary.home
  const fullDate = (date: Date) => date.toLocaleDateString(dictionary.dateLocale, { weekday: 'long', day: 'numeric', month: 'numeric' })
  const { week, weekTotal, weekAccuracy } = activity
  const [selected, setSelected] = useState(week.length - 1)
  const max = Math.max(...week.map((d) => d.count), goal, 1)
  const goalTop = PLOT_HEIGHT - Math.round((goal / max) * CHART_HEIGHT)
  const goalDays = week.filter((d) => d.count >= goal).length

  return (
    <section aria-labelledby="week-heading">
      <SectionTitle id="week-heading">{text.week}</SectionTitle>
      <div className="rounded-card border border-line bg-surface p-4">
        {weekTotal === 0 ? (
          <p className="text-sm text-ink-muted">{text.noActivity}</p>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-ink">{text.answers(weekTotal)}</span>
              {weekAccuracy !== null && <> · {text.percentCorrect(Math.round(weekAccuracy * 100))}</>}
            </p>
            {/* Legend for the dashed line (a label inside the plot collides with tall columns). */}
            <p className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
              <span aria-hidden className="w-5 border-t border-dashed border-ink-muted" />
              {text.goalLegend(goal, goalDays)}
            </p>

            <div role="group" aria-label={text.byDay} className="relative mt-4 grid grid-cols-7 gap-1">
              {/* One continuous hairline baseline under all columns. */}
              <span aria-hidden className="absolute inset-x-0 h-px bg-line" style={{ top: PLOT_HEIGHT }} />
              {/* Daily goal: dashed reference line. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-muted/60"
                style={{ top: goalTop }}
              />
              {week.map((day, i) => {
                const height = day.count ? Math.max(4, Math.round((day.count / max) * CHART_HEIGHT)) : 0
                const isSelected = i === selected
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={isSelected}
                    aria-label={`${fullDate(day.date)}: ${text.answers(day.count)}, ${text.correct(day.correct)}`}
                    className="flex flex-col items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
                  >
                    <span className="flex w-full flex-col items-center justify-end" style={{ height: PLOT_HEIGHT }}>
                      {/* Value on the cap of the selected column only. */}
                      <span aria-hidden className={`mb-1 text-xs font-semibold ${isSelected ? 'text-ink' : 'invisible'}`}>
                        {day.count}
                      </span>
                      <span
                        className={`w-5 rounded-t-[4px] transition-opacity duration-150 ${isSelected ? 'bg-brick' : 'bg-brick/45'}`}
                        style={{ height }}
                      />
                    </span>
                    <span className={`mt-1.5 text-xs ${isSelected ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
                      {i === week.length - 1 ? text.today : text.weekdays[day.date.getDay()]}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-ink-muted" aria-hidden>
              {fullDate(week[selected].date)}: {text.answers(week[selected].count)}
              {week[selected].count > 0 && `, ${text.correct(week[selected].correct)}`}
            </p>
          </>
        )}
      </div>
    </section>
  )
}
