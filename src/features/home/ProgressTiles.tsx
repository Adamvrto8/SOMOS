import { CircleCheck, Flame } from 'lucide-react'
import type { Activity } from '../../lib/stats'
import { pluralSk } from '../../lib/text'

interface ProgressTilesProps {
  activity: Activity
  goal: number
}

/** Streak + daily goal side by side (stat tiles; figures in the UI sans, not the serif). */
export function ProgressTiles({ activity, goal }: ProgressTilesProps) {
  const { days, activeToday } = activity.streak
  const done = Math.min(activity.today, goal)
  const reached = activity.today >= goal

  return (
    <div className="grid grid-cols-2 gap-3">
      <section aria-label="Séria" className="rounded-card border border-line bg-surface p-4">
        <span
          className={[
            'flex size-10 items-center justify-center rounded-xl transition-shadow duration-300',
            activeToday ? 'bg-amber/20 text-amber shadow-[0_0_20px_var(--amber)]' : 'bg-surface-2 text-ink-muted',
          ].join(' ')}
        >
          <Flame size={22} strokeWidth={1.75} className={activeToday ? 'fill-amber' : ''} aria-hidden />
        </span>
        <p className="mt-3 text-3xl font-semibold">{days}</p>
        <p className="text-sm">{pluralSk(days, ['deň', 'dni', 'dní'])} v rade</p>
        <p className="mt-1 text-xs text-ink-muted">
          {activeToday ? 'Dnes splnené' : days > 0 ? 'Precvič si dnes, nech séria pokračuje' : 'Začni sériu ešte dnes'}
        </p>
      </section>

      <section aria-label="Denný cieľ" className="rounded-card border border-line bg-surface p-4">
        <GoalRing value={done} max={goal} />
        <p className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-semibold">{activity.today}</span>
          <span className="text-sm text-ink-muted">/ {goal}</span>
        </p>
        <p className="text-sm">denný cieľ</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
          {reached ? (
            <>
              <CircleCheck size={14} strokeWidth={2} className="text-leaf" aria-hidden />
              Splnený
            </>
          ) : (
            `Ešte ${goal - activity.today} ${pluralSk(goal - activity.today, ['odpoveď', 'odpovede', 'odpovedí'])}`
          )}
        </p>
      </section>
    </div>
  )
}

/** Meter: brick fill on a lighter track of the same hue. */
function GoalRing({ value, max }: { value: number; max: number }) {
  const r = 16
  const circumference = 2 * Math.PI * r
  const ratio = max ? value / max : 0
  return (
    <svg
      viewBox="0 0 40 40"
      className="size-10 -rotate-90"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Denný cieľ: ${value} z ${max}`}
    >
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" className="stroke-brick/15" />
      {ratio > 0 && (
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          className="stroke-brick transition-[stroke-dasharray] duration-500"
        />
      )}
    </svg>
  )
}
