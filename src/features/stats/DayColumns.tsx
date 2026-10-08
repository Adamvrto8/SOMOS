import type { PointerEvent } from 'react'
import { useT } from '../../i18n'
import type { DayStat } from '../../lib/stats'

const CHART_HEIGHT = 96 // tallest column
const PLOT_HEIGHT = CHART_HEIGHT + 20 // room for the value label on the cap

interface DayColumnsProps {
  days: DayStat[] // oldest first, today last
  goal: number
  selected: number
  /** Without it the plot is a picture (Domov); with it a finger or the mouse picks the day under it. */
  onSelect?: (index: number) => void
  label: string
}

/**
 * Right answers per day, which is what the daily goal counts: one series, one hue (brick), thin
 * columns from a hairline baseline, the daily goal as a dashed reference line. A week has a label under every column and the value
 * on the cap of the selected one; longer periods get thinner columns and only their two ends named.
 */
export function DayColumns({ days, goal, selected, onSelect, label }: DayColumnsProps) {
  const dictionary = useT()
  const text = dictionary.home
  const week = days.length <= 7
  const max = Math.max(...days.map((d) => d.correct), goal, 1)
  const goalTop = PLOT_HEIGHT - Math.round((goal / max) * CHART_HEIGHT)
  const shortDate = (date: Date) => date.toLocaleDateString(dictionary.dateLocale, { day: 'numeric', month: 'numeric' })

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const index = Math.floor(((e.clientX - box.left) / box.width) * days.length)
    onSelect?.(Math.min(days.length - 1, Math.max(0, index)))
  }

  return (
    <div>
      <div
        role="img"
        aria-label={label}
        onPointerDown={onSelect && pick}
        onPointerMove={onSelect && pick}
        // pan-y: a vertical drag still scrolls the page, a sideways one walks through the days.
        className={`relative flex ${week ? 'gap-1' : days.length <= 31 ? 'gap-0.5' : 'gap-px'} ${onSelect ? 'touch-pan-y' : ''}`}
      >
        {/* One continuous hairline baseline under all columns. */}
        <span aria-hidden className="absolute inset-x-0 h-px bg-line" style={{ top: PLOT_HEIGHT }} />
        {/* Daily goal: dashed reference line. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-muted/60" style={{ top: goalTop }} />
        {days.map((day, i) => {
          const height = day.correct ? Math.max(4, Math.round((day.correct / max) * CHART_HEIGHT)) : 0
          const isSelected = i === selected
          return (
            <span
              key={day.key}
              aria-hidden
              className={`flex min-w-0 flex-1 flex-col items-center justify-end ${isSelected && onSelect ? 'bg-surface-2' : ''}`}
              style={{ height: PLOT_HEIGHT }}
            >
              {/* Value on the cap of the selected column; a thin column has no room for it. */}
              {week && <span className={`mb-1 text-xs font-semibold ${isSelected ? 'text-ink' : 'invisible'}`}>{day.correct}</span>}
              <span
                className={`${week ? 'w-5 rounded-t-[4px]' : 'w-full rounded-t-[2px]'} ${isSelected ? 'bg-brick' : 'bg-brick/45'}`}
                style={{ height }}
              />
            </span>
          )
        })}
      </div>

      {week ? (
        <div aria-hidden className="mt-1.5 flex gap-1">
          {days.map((day, i) => (
            <span key={day.key} className={`flex-1 text-center text-xs ${i === selected ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
              {i === days.length - 1 ? text.today : text.weekdays[day.date.getDay()]}
            </span>
          ))}
        </div>
      ) : (
        <div aria-hidden className="mt-1.5 flex justify-between text-xs text-ink-muted">
          <span>{shortDate(days[0].date)}</span>
          <span>{text.today}</span>
        </div>
      )}
    </div>
  )
}
