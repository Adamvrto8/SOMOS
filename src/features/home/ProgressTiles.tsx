import { Flame } from 'lucide-react'
import type { Activity } from '../../lib/stats'
import { pluralSk } from '../../lib/text'

interface ProgressTilesProps {
  activity: Activity
  goal: number
}

/** Streak + daily goal: one strip between thin steel lines, halves split by a hairline. */
export function ProgressTiles({ activity, goal }: ProgressTilesProps) {
  const { days, activeToday } = activity.streak
  const left = Math.max(0, goal - activity.today)
  const ratio = goal ? Math.min(activity.today, goal) / goal : 0

  return (
    <div className="grid grid-cols-2 border-y border-line">
      <section aria-label="Séria" className="border-r border-line py-4 pr-4">
        <p className="flex items-center gap-2">
          <Flame
            size={24}
            strokeWidth={1.75}
            className={activeToday ? 'fill-amber/30 text-amber drop-shadow-[0_0_8px_var(--amber)]' : 'text-ink-muted'}
            aria-hidden
          />
          <span className={`font-serif text-4xl font-semibold tabular-nums ${activeToday ? 'dark:text-amber' : ''}`}>{days}</span>
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {pluralSk(days, ['deň', 'dni', 'dní'])} v rade
          {!activeToday && days > 0 && ' · precvič si dnes'}
        </p>
      </section>

      <section aria-label="Denný cieľ" className="py-4 pl-4">
        <p className="flex items-baseline gap-1">
          <span className="font-serif text-4xl font-semibold tabular-nums">{activity.today}</span>
          <span className="text-lg text-ink-muted">/ {goal}</span>
        </p>
        <div
          role="meter"
          aria-valuenow={Math.min(activity.today, goal)}
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-label={`Denný cieľ: ${activity.today} z ${goal}`}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-leaf/15"
        >
          <div className="h-full rounded-full bg-leaf transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className="mt-1.5 text-sm text-ink-muted">
          {left === 0 ? 'Denný cieľ splnený' : `denný cieľ · ešte ${left}`}
        </p>
      </section>
    </div>
  )
}
