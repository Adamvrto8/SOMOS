import { BellOff, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Tapestry } from '../../components/Tapestry'
import { useT } from '../../i18n'
import { useDailyGoal } from '../../lib/dailyGoal'
import { useLessonProgression } from '../../lib/lessonProgress'
import { useMistakes } from '../../lib/mistakes'
import { useReminderProblem } from '../../lib/reminder'
import { useActivity } from '../../lib/stats'
import { continueLesson } from './continueLesson'
import { ProgressTiles } from './ProgressTiles'
import { ReviewCard } from './ReviewCard'
import { WeekChart } from './WeekChart'
import { WordOfDayCard } from './WordOfDayCard'

export function HomePage() {
  const goal = useDailyGoal()
  const activity = useActivity(goal)
  const mistakes = useMistakes()
  const reminderProblem = useReminderProblem()
  const next = continueLesson(useLessonProgression())
  const text = useT()
  const today = new Date().toLocaleDateString(text.dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      {/* Character moment: the tapestry behind greeting and hero, fading into the page. */}
      <div className="relative -mx-4 -mt-6 overflow-hidden px-4 pt-8 pb-2">
        <Tapestry className="opacity-25 dark:opacity-15" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-bg/40 via-bg/75 to-bg" aria-hidden />
        <div className="relative">
          <header>
            <h1 lang="es" className="font-serif text-4xl font-semibold tracking-tight">
              ¡Hola!
            </h1>
            <p className="mt-1 text-ink-muted first-letter:uppercase">{today}</p>
          </header>
          <div className="mt-7">
            <ReviewCard next={next} />
          </div>
        </div>
      </div>

      {/* A reminder that stopped is silent: without this nobody would notice. */}
      {reminderProblem && (
        <Link
          to="/archive/settings"
          className="flex items-center gap-3 rounded-card border border-error/40 bg-error/10 px-5 py-4 transition-colors duration-150 hover:border-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          <BellOff size={20} strokeWidth={1.75} className="shrink-0 text-error" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{text.reminder.notWorking}</span>
            <span className="block text-sm text-ink-muted">{reminderProblem}</span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
        </Link>
      )}

      {activity && <ProgressTiles activity={activity} goal={goal} practiceHref={next.href} />}

      <WordOfDayCard />

      {mistakes && mistakes.length > 0 && (
        <Link
          to="/practice/lesson?mistakes=1"
          className="flex items-center gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{text.home.practiceMistakes}</span>
            <span className="block text-sm text-ink-muted">
              {text.home.mistakesWaiting(mistakes.length)}
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
        </Link>
      )}

      {activity && <WeekChart activity={activity} goal={goal} />}
    </div>
  )
}
