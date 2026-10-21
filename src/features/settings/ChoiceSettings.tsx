import { dictionaries, useT } from '../../i18n'
import { GOAL_OPTIONS, setDailyGoal, useDailyGoal } from '../../lib/dailyGoal'
import { LANGUAGES, setLanguage, useLanguage } from '../../lib/language'
import { LOOKS } from '../../lib/look'
import { reportProgress } from '../../lib/reminder'
import { playSound, setSoundSet, SOUND_SETS, useSoundSet } from '../../lib/sound'
import { setLook, setThemePref, useLook, useThemePref, type ThemePref } from '../../lib/theme'
import { ChoiceList } from './ChoiceList'
import { SettingsHint, SettingsPart, SettingsSubpage } from './SettingsSubpage'

// The settings that are one pick from a few options, each on its own page.

const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark']

export function GoalSettings() {
  const text = useT().settings
  const goal = useDailyGoal()
  return (
    <SettingsSubpage title={text.dailyGoal}>
      <div>
        <ChoiceList
          name="goal"
          legend={text.dailyGoal}
          value={String(goal)}
          onChange={(v) => {
            setDailyGoal(Number(v))
            reportProgress() // the reminder skips a day whose goal is met
          }}
          options={GOAL_OPTIONS.map((n) => ({ id: String(n), label: text.goalOption(n) }))}
        />
        <SettingsHint>{text.dailyGoalHint}</SettingsHint>
      </div>
    </SettingsSubpage>
  )
}

export function LanguageSettings() {
  const text = useT().settings
  const language = useLanguage()
  return (
    <SettingsSubpage title={text.language}>
      <ChoiceList
        name="language"
        legend={text.language}
        value={language}
        onChange={setLanguage}
        // Each language under its own name, whatever the current one is.
        options={LANGUAGES.map((id) => ({ id, label: dictionaries[id].languageName }))}
      />
    </SettingsSubpage>
  )
}

export function LookSettings() {
  const text = useT().settings
  const themePref = useThemePref()
  const look = useLook()
  return (
    <SettingsSubpage title={text.appearance}>
      <SettingsPart id="theme-heading" title={text.theme}>
        <ChoiceList
          name="theme"
          legend={text.theme}
          value={themePref}
          onChange={setThemePref}
          options={THEME_PREFS.map((id) => ({ id, label: text.themeOptions[id] }))}
        />
      </SettingsPart>
      {/* The style is its own choice: each one has a light and a dark side. */}
      <SettingsPart id="look-heading" title={text.look}>
        <ChoiceList
          name="look"
          legend={text.look}
          value={look}
          onChange={setLook}
          options={LOOKS.map((id) => ({ id, label: text.lookOptions[id] }))}
        />
      </SettingsPart>
    </SettingsSubpage>
  )
}

export function SoundSettings() {
  const text = useT().settings
  const soundSet = useSoundSet()
  return (
    <SettingsSubpage title={text.sound}>
      <div>
        <ChoiceList
          name="sound"
          legend={text.sound}
          value={soundSet}
          onChange={(set) => {
            setSoundSet(set)
            // Hear what was chosen.
            playSound('correct', 0, set)
          }}
          options={SOUND_SETS.map((id) => ({ id, label: text.soundOptions[id] }))}
        />
        <SettingsHint>{text.soundHint}</SettingsHint>
      </div>
    </SettingsSubpage>
  )
}
