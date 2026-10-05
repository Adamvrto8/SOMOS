import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { BackButton } from '../../components/BackButton'
import { Chip } from '../../components/Chip'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import { useDailyGoal } from '../../lib/dailyGoal'
import { byExercise, computeHistory, summarizeDays, useAttempts } from '../../lib/stats'
import { DayColumns } from './DayColumns'

const RANGES = [7, 30, 90] as const
type Range = (typeof RANGES)[number]

/**
 * The overview behind the week chart on Domov: the streaks and totals since the first answer,
 * the answers per day over a longer period, and what was practised in it.
 */
export function StatsPage() {
  const dictionary = useT()
  const text = dictionary.stats
  const home = dictionary.home
  const goal = useDailyGoal()
  const attempts = useAttempts()
  const [range, setRange] = useState<Range>(30)
  // The picked day by its key, so it survives a change of the period; none = today.
  const [pickedKey, setPickedKey] = useState<string | null>(null)

  const view = useMemo(() => {
    if (!attempts) return undefined
    const now = new Date()
    const days = summarizeDays(attempts, now, range)
    const since = days[0].date.getTime()
    return { history: computeHistory(attempts, now, goal), days, split: byExercise(attempts.filter((a) => a.at >= since)) }
  }, [attempts, range, goal])

  if (!view) return <BackButton fallback="/" />
  const { history, days, split } = view

  const picked = days.findIndex((d) => d.key === pickedKey)
  const selected = picked >= 0 ? picked : days.length - 1
  const day = days[selected]
  const select = (index: number) => setPickedKey(days[index].key)

  const count = (n: number) => n.toLocaleString(dictionary.dateLocale)
  const percent = (correct: number, total: number) => text.percent(Math.round((correct / total) * 100))
  const fullDate = (date: Date) => date.toLocaleDateString(dictionary.dateLocale, { weekday: 'long', day: 'numeric', month: 'numeric' })
  const periodTotal = days.reduce((n, d) => n + d.count, 0)
  const periodCorrect = days.reduce((n, d) => n + d.correct, 0)
  const metDays = days.filter((d) => d.count >= goal).length
  const mostPractised = Math.max(...split.map((s) => s.count), 1)
  const exerciseName = (exercise: string) =>
    exercise === 'review' ? text.review : (dictionary.exercise.types[exercise as keyof typeof dictionary.exercise.types]?.label ?? exercise)

  return (
    <div>
      <BackButton fallback="/" />
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>

      <dl className="mt-6 grid grid-cols-2 border-y border-line">
        <Figure value={count(history.streak.days)} caption={home.streakDays(history.streak.days)} className="border-r border-b" />
        <Figure value={count(history.longestStreak)} caption={text.longestStreak(history.longestStreak)} className="border-b pl-4" />
        <Figure
          value={count(history.total)}
          caption={text.answersInTotal(history.total)}
          note={history.firstDay ? text.since(history.firstDay.toLocaleDateString(dictionary.dateLocale)) : undefined}
          className="border-r"
        />
        <Figure value={history.total ? percent(history.correct, history.total) : '–'} caption={text.correctAnswers} className="pl-4" />
      </dl>

      <section aria-labelledby="history-heading" className="mt-8">
        <SectionTitle id="history-heading">{text.history}</SectionTitle>
        <div role="group" aria-label={text.period} className="flex gap-2">
          {RANGES.map((r) => (
            <Chip key={r} selected={r === range} onClick={() => setRange(r)}>
              {text.days(r)}
            </Chip>
          ))}
        </div>

        <div className="mt-3 rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink">{home.answers(periodTotal)}</span>
            {periodTotal > 0 && <> · {home.percentCorrect(Math.round((periodCorrect / periodTotal) * 100))}</>}
            {periodTotal > 0 && <> · {text.perDay(Math.round(periodTotal / days.length))}</>}
          </p>
          {/* Legend for the dashed line. */}
          <p className="mt-1 mb-4 flex items-center gap-2 text-xs text-ink-muted">
            <span aria-hidden className="w-5 border-t border-dashed border-ink-muted" />
            {text.goalLegend(goal, metDays, days.length)}
          </p>

          <DayColumns days={days} goal={goal} selected={selected} onSelect={select} label={text.byDay(days.length)} />

          {/* The picked day in words, and a way to it that needs no aim: 90 columns are 3 px each. */}
          <div className="mt-3 flex items-center border-t border-line pt-2">
            <StepButton label={text.previousDay} disabled={selected === 0} onClick={() => select(selected - 1)}>
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
            </StepButton>
            <p aria-live="polite" className="min-w-0 flex-1 text-center text-sm">
              <span className="block font-medium first-letter:uppercase">
                {selected === days.length - 1 ? home.today : fullDate(day.date)}
                {day.count >= goal && <span className="font-normal text-leaf"> · {text.goalMet}</span>}
              </span>
              <span className="block text-ink-muted">
                {home.answers(day.count)}
                {day.count > 0 && `, ${home.correct(day.correct)}`}
              </span>
            </p>
            <StepButton label={text.nextDay} disabled={selected === days.length - 1} onClick={() => select(selected + 1)}>
              <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
            </StepButton>
          </div>
        </div>
      </section>

      <section aria-labelledby="exercises-heading" className="mt-8">
        <SectionTitle id="exercises-heading">{text.byExercise(days.length)}</SectionTitle>
        {split.length === 0 ? (
          <p className="text-sm text-ink-muted">{text.nothing}</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
            {split.map((s) => (
              <li key={s.exercise} className="py-3">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{exerciseName(s.exercise)}</span>
                  <span className="shrink-0 text-sm text-ink-muted tabular-nums">
                    {count(s.count)} · {home.percentCorrect(Math.round((s.correct / s.count) * 100))}
                  </span>
                </p>
                {/* Length = share of the answers; the numbers above carry the exact values. */}
                <div aria-hidden className="mt-2 h-1.5 rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brick" style={{ width: `${Math.max(2, (s.count / mostPractised) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

interface FigureProps {
  value: string
  caption: string
  note?: string
  className: string
}

/** One number that answers a question by itself. */
function Figure({ value, caption, note, className }: FigureProps) {
  return (
    <div className={`flex flex-col-reverse justify-end border-line py-4 ${className}`}>
      <dt className="mt-1 text-sm text-ink-muted">
        {caption}
        {note && <span className="block text-xs">{note}</span>}
      </dt>
      <dd className="font-serif text-4xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

interface StepButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

function StepButton({ label, disabled, onClick, children }: StepButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-30"
    >
      {children}
    </button>
  )
}
