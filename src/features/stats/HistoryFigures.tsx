import { useT } from '../../i18n'
import type { History } from '../../lib/stats'

/** The four numbers of the whole history: streak, longest streak, answers in total and how many were right. */
export function HistoryFigures({ history, className = '' }: { history: History; className?: string }) {
  const dictionary = useT()
  const text = dictionary.stats
  const count = (n: number) => n.toLocaleString(dictionary.dateLocale)
  const percent = (correct: number, total: number) => text.percent(Math.round((correct / total) * 100))

  return (
    <dl className={`grid grid-cols-2 border-y border-line ${className}`}>
      <Figure value={count(history.streak.days)} caption={dictionary.home.streakDays(history.streak.days)} className="border-r border-b" />
      <Figure value={count(history.longestStreak)} caption={text.longestStreak(history.longestStreak)} className="border-b pl-4" />
      <Figure
        value={count(history.total)}
        caption={text.answersInTotal(history.total)}
        note={history.firstDay ? text.since(history.firstDay.toLocaleDateString(dictionary.dateLocale)) : undefined}
        className="border-r"
      />
      <Figure value={history.total ? percent(history.correct, history.total) : '–'} caption={text.correctAnswers} className="pl-4" />
    </dl>
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
