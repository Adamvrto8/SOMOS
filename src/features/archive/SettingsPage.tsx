import { BackButton } from '../../components/BackButton'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { GOAL_OPTIONS, setDailyGoal, useDailyGoal } from '../../lib/dailyGoal'
import { reportProgress } from '../../lib/reminder'
import { setThemePref, useThemePref } from '../../lib/theme'
import { AutoReviewSettings } from './AutoReviewSettings'
import { BackupSettings } from './BackupSettings'
import { ReminderSettings } from './ReminderSettings'
import { VoiceSettings } from './VoiceSettings'

export function SettingsPage() {
  const themePref = useThemePref()
  const dailyGoal = useDailyGoal()

  return (
    <div className="space-y-8">
      <div>
        <BackButton fallback="/archive" />
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Nastavenia</h1>
      </div>

      <section aria-labelledby="theme-heading">
        <SectionTitle id="theme-heading">Vzhľad</SectionTitle>
        <Segmented
          mode="radio"
          label="Téma"
          idPrefix="theme"
          value={themePref}
          onChange={setThemePref}
          options={[
            { id: 'system', label: 'Podľa systému' },
            { id: 'light', label: 'Svetlá' },
            { id: 'dark', label: 'Tmavá' },
          ]}
        />
      </section>

      <section aria-labelledby="goal-heading">
        <SectionTitle id="goal-heading">Denný cieľ</SectionTitle>
        <Segmented
          mode="radio"
          label="Denný cieľ"
          idPrefix="goal"
          value={String(dailyGoal)}
          onChange={(v) => {
            setDailyGoal(Number(v))
            reportProgress()
          }}
          options={GOAL_OPTIONS.map((n) => ({ id: String(n), label: String(n) }))}
        />
        <p className="mt-2 text-sm text-ink-muted">Počet odpovedí za deň – v lekciách aj pri opakovaní.</p>
      </section>

      <AutoReviewSettings />
      <ReminderSettings />
      <VoiceSettings />
      <BackupSettings />

      <p className="text-center text-xs text-ink-muted tabular-nums">
        Verzia {__APP_VERSION__} · {new Date(__BUILD_TIME__).toLocaleDateString('sk-SK')}
      </p>
    </div>
  )
}
