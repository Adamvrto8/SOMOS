import { BackButton } from '../../components/BackButton'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { setThemePref, useThemePref } from '../../lib/theme'
import { BackupSettings } from './BackupSettings'
import { VoiceSettings } from './VoiceSettings'

export function SettingsPage() {
  const themePref = useThemePref()

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

      <VoiceSettings />
      <BackupSettings />
    </div>
  )
}
