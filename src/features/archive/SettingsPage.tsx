import { BackButton } from '../../components/BackButton'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { dictionaries, useT } from '../../i18n'
import { GOAL_OPTIONS, setDailyGoal, useDailyGoal } from '../../lib/dailyGoal'
import { LANGUAGES, setLanguage, useLanguage } from '../../lib/language'
import { LOOKS } from '../../lib/look'
import { reportProgress } from '../../lib/reminder'
import { playSound, setSoundSet, SOUND_SETS, useSoundSet } from '../../lib/sound'
import { setLook, setThemePref, useLook, useThemePref } from '../../lib/theme'
import { AutoReviewSettings } from './AutoReviewSettings'
import { BackupSettings } from './BackupSettings'
import { ReminderSettings } from './ReminderSettings'
import { VoiceSettings } from './VoiceSettings'

export function SettingsPage() {
  const themePref = useThemePref()
  const look = useLook()
  const soundSet = useSoundSet()
  const dailyGoal = useDailyGoal()
  const language = useLanguage()
  const text = useT()

  return (
    <div className="space-y-8">
      <div>
        <BackButton fallback="/archive" />
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.settings.title}</h1>
      </div>

      <section aria-labelledby="language-heading">
        <SectionTitle id="language-heading">{text.settings.language}</SectionTitle>
        <Segmented
          mode="radio"
          label={text.settings.language}
          idPrefix="language"
          value={language}
          onChange={setLanguage}
          // Each language under its own name, whatever the current one is.
          options={LANGUAGES.map((id) => ({ id, label: dictionaries[id].languageName }))}
        />
      </section>

      <section aria-labelledby="theme-heading">
        <SectionTitle id="theme-heading">{text.settings.appearance}</SectionTitle>
        <Segmented
          mode="radio"
          label={text.settings.theme}
          idPrefix="theme"
          value={themePref}
          onChange={setThemePref}
          options={[
            { id: 'system', label: text.settings.themeOptions.system },
            { id: 'light', label: text.settings.themeOptions.light },
            { id: 'dark', label: text.settings.themeOptions.dark },
          ]}
        />
        {/* The style is its own choice: each one has a light and a dark side. */}
        <div className="mt-2">
          <Segmented
            mode="radio"
            label={text.settings.look}
            idPrefix="look"
            value={look}
            onChange={setLook}
            options={LOOKS.map((id) => ({ id, label: text.settings.lookOptions[id] }))}
          />
        </div>
      </section>

      <section aria-labelledby="goal-heading">
        <SectionTitle id="goal-heading">{text.settings.dailyGoal}</SectionTitle>
        <Segmented
          mode="radio"
          label={text.settings.dailyGoal}
          idPrefix="goal"
          value={String(dailyGoal)}
          onChange={(v) => {
            setDailyGoal(Number(v))
            reportProgress()
          }}
          options={GOAL_OPTIONS.map((n) => ({ id: String(n), label: String(n) }))}
        />
        <p className="mt-2 text-sm text-ink-muted">{text.settings.dailyGoalHint}</p>
      </section>

      <section aria-labelledby="sound-heading">
        <SectionTitle id="sound-heading">{text.settings.sound}</SectionTitle>
        <Segmented
          mode="radio"
          label={text.settings.sound}
          idPrefix="sound"
          value={soundSet}
          onChange={(set) => {
            setSoundSet(set)
            // Hear what was chosen.
            playSound('correct', 0, set)
          }}
          options={SOUND_SETS.map((id) => ({ id, label: text.settings.soundOptions[id] }))}
        />
        <p className="mt-2 text-sm text-ink-muted">{text.settings.soundHint}</p>
      </section>

      <AutoReviewSettings />
      <ReminderSettings />
      <VoiceSettings />
      <BackupSettings />

      <p className="text-center text-xs text-ink-muted tabular-nums">
        {text.settings.version} {__APP_VERSION__} · {new Date(__BUILD_TIME__).toLocaleDateString(text.dateLocale)}
      </p>
    </div>
  )
}
