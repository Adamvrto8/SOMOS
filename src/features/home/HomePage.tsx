import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Tapestry } from '../../components/Tapestry'
import { useDailyGoal } from '../../lib/dailyGoal'
import { useMistakes } from '../../lib/mistakes'
import { useActivity } from '../../lib/stats'
import { pluralSk } from '../../lib/text'
import { ProgressTiles } from './ProgressTiles'
import { ReviewCard } from './ReviewCard'
import { WeekChart } from './WeekChart'
import { WordOfDayCard } from './WordOfDayCard'

export function HomePage() {
  const activity = useActivity()
  const goal = useDailyGoal()
  const mistakes = useMistakes()

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Domov</h1>
      {/* Character moment: the tapestry behind the hero, fading into the page. */}
      <div className="relative -mx-4 -mt-6 overflow-hidden px-4 pt-6 pb-2">
        <Tapestry className="opacity-20 dark:opacity-10" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-bg/50 via-bg/80 to-bg" aria-hidden />
        <div className="relative">
          <ReviewCard />
        </div>
      </div>

      {activity && <ProgressTiles activity={activity} goal={goal} />}

      <WordOfDayCard />

      {mistakes && mistakes.length > 0 && (
        <Link
          to="/practice/lesson?mistakes=1"
          className="flex items-center gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Precvičiť chyby</span>
            <span className="block text-sm text-ink-muted">
              {mistakes.length} {pluralSk(mistakes.length, ['úloha čaká', 'úlohy čakajú', 'úloh čaká'])}
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
        </Link>
      )}

      {activity && <WeekChart activity={activity} />}
    </div>
  )
}
