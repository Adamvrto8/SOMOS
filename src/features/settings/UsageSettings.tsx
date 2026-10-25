import { Link } from 'react-router'
import { useT } from '../../i18n'
import { setUsageOn, useUsageOn } from '../../lib/usage'
import { SwitchRow } from './ChoiceList'
import { SettingsHint, SettingsSubpage } from './SettingsSubpage'

/** Profil → Anonymné štatistiky: on by default; off forgets this device's id and its unsent events. */
export function UsageSettings() {
  const text = useT().settings.usage
  const on = useUsageOn()
  return (
    <SettingsSubpage title={text.title}>
      <div>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <SwitchRow label={text.toggle} detail={text.toggleHint} checked={on} onChange={setUsageOn} />
        </div>
        <SettingsHint>
          {text.about}{' '}
          <Link to="/privacy" className="text-brick underline underline-offset-2">
            {text.privacy}
          </Link>
        </SettingsHint>
      </div>
    </SettingsSubpage>
  )
}
