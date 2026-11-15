import { ChartNoAxesColumnIncreasing } from 'lucide-react'
import { useMemo } from 'react'
import { useT } from '../../i18n'
import { useDailyGoal } from '../../lib/dailyGoal'
import { computeHistory, useAttempts } from '../../lib/stats'
import { SettingsGroup, SettingsRow } from './SettingsList'

/**
 * Profil: the learner's numbers as one row (streak · answers · right) that opens the whole overview.
 * Kept on the device, so there with or without an account.
 */
export function ProfileStats() {
  const dictionary = useT()
  const text = dictionary.settings
  const goal = useDailyGoal()
  const attempts = useAttempts()
  const history = useMemo(() => (attempts ? computeHistory(attempts, new Date(), goal) : undefined), [attempts, goal])
  if (!history) return null
  const percent = history.total ? Math.round((history.correct / history.total) * 100) : undefined
  return (
    <SettingsGroup id="profile-stats" title={text.stats}>
      <SettingsRow
        to="/profile/stats"
        icon={ChartNoAxesColumnIncreasing}
        title={dictionary.stats.title}
        detail={text.statsLine(history.streak.days, history.total, percent)}
      />
    </SettingsGroup>
  )
}
