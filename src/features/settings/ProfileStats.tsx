import { useMemo } from 'react'
import { useT } from '../../i18n'
import { useDailyGoal } from '../../lib/dailyGoal'
import { computeHistory, useActivity, useAttempts } from '../../lib/stats'
import { WeekChart } from '../home/WeekChart'
import { HistoryFigures } from '../stats/HistoryFigures'
import { SettingsPart } from './SettingsSubpage'

/** Profil: the learner's streak and totals, and the week that opens the whole overview. Kept on the device, so there with or without an account. */
export function ProfileStats() {
  const text = useT().settings
  const goal = useDailyGoal()
  const attempts = useAttempts()
  const activity = useActivity(goal)
  const history = useMemo(() => (attempts ? computeHistory(attempts, new Date(), goal) : undefined), [attempts, goal])
  if (!history || !activity) return null
  return (
    <SettingsPart id="profile-stats" title={text.stats}>
      <HistoryFigures history={history} />
      <div className="mt-5">
        <WeekChart activity={activity} goal={goal} />
      </div>
    </SettingsPart>
  )
}
