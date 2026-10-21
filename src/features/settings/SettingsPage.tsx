import { AudioLines, Bell, DatabaseBackup, Languages, Palette, Repeat, ShieldCheck, Target, Volume2, Wrench } from 'lucide-react'
import { useRef, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { dictionaries, useT } from '../../i18n'
import { useAutoReviewSettings } from '../../lib/autoReview'
import { useDailyGoal } from '../../lib/dailyGoal'
import { DEV_MODE_TAPS, setDevMode, useDevMode } from '../../lib/devMode'
import { useLanguage } from '../../lib/language'
import { useReminderSettings } from '../../lib/reminder'
import { useSoundSet } from '../../lib/sound'
import { useLook, useThemePref } from '../../lib/theme'
import { ttsSupported, useVoices } from '../../lib/tts'
import { AccountRow } from '../account/AccountSettings'
import { SettingsGroup, SettingsRow } from './SettingsList'

/** The name of the voice that speaks now; none when the phone has no Spanish one. */
function useVoiceName(): string | undefined {
  const { voices, preferredURI } = useVoices()
  const text = useT().settings.voice
  if (!ttsSupported || voices.length === 0) return undefined
  return voices.find((v) => v.voiceURI === preferredURI)?.name ?? text.auto
}

/** Taps on the version line that start the countdown toward developer mode, as in Android. */
const COUNTDOWN_FROM = 3

/** Nastavenia: every setting as a row with what is set now; each one opens its own page. */
export function SettingsPage() {
  const dictionary = useT()
  const text = dictionary.settings
  const goal = useDailyGoal()
  const autoReview = useAutoReviewSettings()
  const reminder = useReminderSettings()
  const language = useLanguage()
  const themePref = useThemePref()
  const look = useLook()
  const soundSet = useSoundSet()
  const voice = useVoiceName()
  const devMode = useDevMode()

  return (
    <div className="space-y-6">
      <div>
        <BackButton fallback="/archive" />
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>
      </div>

      <AccountRow />

      <SettingsGroup id="settings-learning" title={text.groups.learning}>
        <SettingsRow to="/archive/settings/goal" icon={Target} title={text.dailyGoal} value={String(goal)} />
        <SettingsRow
          to="/archive/settings/review"
          icon={Repeat}
          title={text.autoReview.row}
          value={autoReview.enabled ? text.perDay(autoReview.limit) : text.off}
        />
        <SettingsRow to="/archive/settings/reminder" icon={Bell} title={dictionary.reminder.row} value={reminder.enabled ? reminder.time : text.off} />
      </SettingsGroup>

      <SettingsGroup id="settings-app" title={text.groups.app}>
        <SettingsRow to="/archive/settings/language" icon={Languages} title={text.language} value={dictionaries[language].languageName} />
        <SettingsRow to="/archive/settings/look" icon={Palette} title={text.appearance} value={themePref === 'system' ? text.lookOptions[look] : `${text.lookOptions[look]} · ${text.themeOptions[themePref]}`} />
        <SettingsRow to="/archive/settings/sound" icon={Volume2} title={text.sound} value={text.soundOptions[soundSet]} />
        <SettingsRow to="/archive/settings/voice" icon={AudioLines} title={text.voice.title} value={voice} />
      </SettingsGroup>

      <SettingsGroup id="settings-data" title={text.groups.data}>
        <SettingsRow to="/archive/settings/backup" icon={DatabaseBackup} title={text.backup.title} />
        <SettingsRow to="/privacy" icon={ShieldCheck} title={text.privacy} />
      </SettingsGroup>

      {devMode && (
        <SettingsGroup id="settings-dev" title={text.groups.dev}>
          <SettingsRow to="/archive/settings/dev" icon={Wrench} title={text.dev.title} value={__APP_VERSION__} />
        </SettingsGroup>
      )}

      <VersionLine />
    </div>
  )
}

/** "SOMOS · verzia 672d509"; seven taps on it switch on developer mode. */
function VersionLine() {
  const text = useT().settings
  const devMode = useDevMode()
  const taps = useRef(0)
  const [note, setNote] = useState<string | null>(null)

  const tap = () => {
    if (devMode) return setNote(text.devModeOn)
    taps.current++
    const left = DEV_MODE_TAPS - taps.current
    if (left <= 0) {
      setDevMode(true)
      setNote(text.devModeOn)
    } else if (taps.current >= COUNTDOWN_FROM) {
      setNote(text.devTapsLeft(left))
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={tap}
        className="min-h-11 rounded-full px-4 text-xs text-ink-muted tabular-nums focus-visible:outline-2 focus-visible:outline-brick"
      >
        SOMOS · {text.version.toLowerCase()} {__APP_VERSION__}
      </button>
      <p role="status" className="min-h-5 text-xs text-ink-muted">
        {note}
      </p>
    </div>
  )
}
