import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SearchField } from '../../components/SearchField'
import { Tapestry } from '../../components/Tapestry'
import { useDailyGoal } from '../../lib/dailyGoal'
import { useActivity } from '../../lib/stats'
import { ProgressTiles } from './ProgressTiles'
import { ReviewCard } from './ReviewCard'
import { WeekChart } from './WeekChart'
import { WordOfDayCard } from './WordOfDayCard'

export function HomePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const activity = useActivity()
  const goal = useDailyGoal()
  const today = new Date().toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      {/* Character moment: the tapestry header, fading into the page. */}
      <header className="relative -mx-4 -mt-6 overflow-hidden px-4 pt-8 pb-6">
        <Tapestry className="opacity-25 dark:opacity-15" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-bg/40 via-bg/70 to-bg" aria-hidden />
        <div className="relative">
          <h1 lang="es" className="font-serif text-4xl font-semibold tracking-tight">
            ¡Hola!
          </h1>
          <p className="mt-1 text-ink-muted first-letter:uppercase">{today}</p>
        </div>
      </header>

      <ReviewCard />

      {activity && <ProgressTiles activity={activity} goal={goal} />}

      <SearchField
        value={query}
        onChange={setQuery}
        onSubmit={(q) => q.trim() && void navigate(`/search?q=${encodeURIComponent(q.trim())}`)}
        label="Hľadať slovo"
        placeholder="Hľadať slovo…"
      />

      <WordOfDayCard />

      {activity && <WeekChart activity={activity} />}
    </div>
  )
}
