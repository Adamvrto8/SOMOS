import { Snowflake, X } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../i18n'
import { addDays, dayKey } from '../../lib/dates'
import type { Streak } from '../../lib/stats'

// The last frozen day the learner has closed the notice for. Per device: on another one it may show once more.
const SEEN_KEY = 'somos-freeze-seen'
/** An older freeze is not news any more (a new device replays the whole history). */
const RECENT_DAYS = 3

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

/** Domov, once a freeze kept the streak over a missed day: what happened and how many freezes are left. */
export function StreakSavedCard({ streak }: { streak: Streak }) {
  const dictionary = useT()
  const text = dictionary.home
  const [seen, setSeen] = useState(readSeen)
  const last = streak.frozenDays.at(-1)
  const now = new Date()
  // Keys are YYYY-MM-DD, so they compare as dates.
  if (!last || last < dayKey(addDays(now, -RECENT_DAYS)) || (seen !== null && seen >= last)) return null

  const when =
    last === dayKey(addDays(now, -1))
      ? text.yesterday
      : new Date(`${last}T12:00:00`).toLocaleDateString(dictionary.dateLocale, { weekday: 'long', day: 'numeric', month: 'numeric' })

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, last)
    } catch {
      // It shows again on the next visit; nothing else is lost.
    }
    setSeen(last)
  }

  return (
    <section aria-labelledby="streak-saved" className="flex items-start gap-3 rounded-card border border-line bg-surface py-4 pr-2 pl-5">
      <Snowflake size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brick" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 id="streak-saved" className="font-semibold">
          {text.streakSaved}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted first-letter:uppercase">{text.streakSavedBody(when, streak.freezes)}</p>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label={text.close}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
      >
        <X size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </section>
  )
}
