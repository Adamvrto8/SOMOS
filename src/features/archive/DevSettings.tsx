import { Sun } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import { celebrateGoal } from '../../lib/celebration'
import { useDailyGoal } from '../../lib/dailyGoal'
import { playSound } from '../../lib/sound'

/** Streaks to try the sun with, one after another: one digit and more, figures that hang below the line and ones that do not. */
const SAMPLE_STREAKS = [7, 1, 16, 47, 128]

/** Nastavenia: tools for working on the app. They show things, nothing is counted or saved. */
export function DevSettings() {
  const text = useT().settings.dev
  const goal = useDailyGoal()
  const shown = useRef(0)

  // As recordAttempt does it for the answer that completes the goal, without the answer.
  const showSun = () => {
    playSound('goal')
    celebrateGoal({ goal, streakDays: SAMPLE_STREAKS[shown.current++ % SAMPLE_STREAKS.length], at: Date.now() })
  }

  return (
    <section aria-labelledby="dev-heading">
      <SectionTitle id="dev-heading">{text.title}</SectionTitle>
      <Button variant="secondary" icon={Sun} onClick={showSun} className="w-full">
        {text.showSun}
      </Button>
      <p className="mt-2 text-sm text-ink-muted">{text.showSunHint}</p>
    </section>
  )
}
