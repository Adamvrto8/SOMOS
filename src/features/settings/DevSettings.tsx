import { Bug, PowerOff, Sun } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { celebrateGoal } from '../../lib/celebration'
import { useDailyGoal } from '../../lib/dailyGoal'
import { setDevMode } from '../../lib/devMode'
import { errorReportsOn, reportError } from '../../lib/errorReports'
import { reminderSupport } from '../../lib/reminder'
import { playSound } from '../../lib/sound'
import { StorageInfo } from './BackupSettings'
import { ReminderDevTools } from './ReminderSettings'
import { SettingsHint, SettingsPart, SettingsSubpage } from './SettingsSubpage'

/** Streaks to try the sun with, one after another: one digit and more, figures that hang below the line and ones that do not. */
const SAMPLE_STREAKS = [7, 1, 16, 47, 128]

/** Nastavenia → Nástroje pre vývoj (developer mode only): they show things, nothing is counted or saved. */
export function DevSettings() {
  const dictionary = useT()
  const text = dictionary.settings.dev
  const goal = useDailyGoal()
  const navigate = useNavigate()
  const shown = useRef(0)
  const [testErrorSent, setTestErrorSent] = useState(false)

  // Proves the whole way to Sentry on a phone, where /dev/crash does not exist.
  const sendTestError = () => {
    reportError(new Error(`Test error from Nástroje pre vývoj (${__APP_VERSION__})`))
    setTestErrorSent(true)
  }

  // As recordAttempt does it for the answer that completes the goal, without the answer.
  const showSun = () => {
    playSound('goal')
    celebrateGoal({ goal, streakDays: SAMPLE_STREAKS[shown.current++ % SAMPLE_STREAKS.length], at: Date.now() })
  }

  const turnOff = () => {
    setDevMode(false)
    void navigate('/profile', { replace: true })
  }

  return (
    <SettingsSubpage title={text.title}>
      <SettingsPart id="dev-sun" title={text.sun}>
        <Button variant="secondary" icon={Sun} onClick={showSun} className="w-full">
          {text.showSun}
        </Button>
        <SettingsHint>{text.showSunHint}</SettingsHint>
      </SettingsPart>

      {/* On the dev server there is no reminder server: the reminder page already says so. */}
      {reminderSupport() !== 'unavailable' && (
        <SettingsPart id="dev-reminder" title={dictionary.reminder.title}>
          <ReminderDevTools />
        </SettingsPart>
      )}

      <SettingsPart id="dev-storage" title={text.storage}>
        <StorageInfo />
      </SettingsPart>

      <SettingsPart id="dev-errors" title={text.errorReports}>
        {errorReportsOn() ? (
          <>
            <Button variant="secondary" icon={Bug} onClick={sendTestError} className="w-full">
              {text.sendTestError}
            </Button>
            {testErrorSent && <SettingsHint>{text.testErrorSent}</SettingsHint>}
          </>
        ) : (
          <SettingsHint>{text.errorReportsOff}</SettingsHint>
        )}
      </SettingsPart>

      <SettingsPart id="dev-build" title={text.build}>
        <dl className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface text-sm">
          {[
            [text.commit, __APP_VERSION__],
            [text.builtAt, new Date(__BUILD_TIME__).toLocaleString(dictionary.dateLocale)],
            [text.mode, import.meta.env.DEV ? text.modeDev : text.modeProd],
          ].map(([term, value]) => (
            <div key={term} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
              <dt className="text-ink-muted">{term}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </SettingsPart>

      <div>
        <Button variant="secondary" icon={PowerOff} onClick={turnOff} className="w-full">
          {text.turnOff}
        </Button>
        <SettingsHint>{text.turnOffHint}</SettingsHint>
      </div>
    </SettingsSubpage>
  )
}
