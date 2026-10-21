import { useMemo } from 'react'
import { useT } from '../../i18n'
import { useDailyGoal } from '../../lib/dailyGoal'
import { computeHistory, useAttempts } from '../../lib/stats'
import { HistoryFigures } from '../stats/HistoryFigures'
import { SettingsPart } from './SettingsSubpage'

/** Profil: the learner's streak and totals. Kept on the device, so there with or without an account. */
export function ProfileStats() {
  const text = useT().settings
  const goal = useDailyGoal()
  const attempts = useAttempts()
  const history = useMemo(() => (attempts ? computeHistory(attempts, new Date(), goal) : undefined), [attempts, goal])
  if (!history) return null
  return (
    <SettingsPart id="profile-stats" title={text.stats}>
      <HistoryFigures history={history} />
    </SettingsPart>
  )
}
