import { useT } from '../../i18n'
import { AUTO_REVIEW_LIMITS, setAutoReview, useAutoReviewSettings, type AutoReviewLimit, type AutoReviewSettings as Settings } from '../../lib/autoReview'
import { reportProgress } from '../../lib/reminder'
import { ChoiceList, SwitchRow } from './ChoiceList'
import { SettingsHint, SettingsPart, SettingsSubpage } from './SettingsSubpage'

/** Nastavenia → Automatické opakovanie: practised words in review, and how many a day. */
export function AutoReviewSettings() {
  const settings = useAutoReviewSettings()
  const text = useT().settings.autoReview
  const update = (next: Settings) => {
    setAutoReview(next)
    reportProgress() // the reminder text counts due cards
  }

  return (
    <SettingsSubpage title={text.title}>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <SwitchRow label={text.toggle} detail={text.toggleHint} checked={settings.enabled} onChange={(enabled) => update({ ...settings, enabled })} />
      </div>

      {settings.enabled && (
        <SettingsPart id="auto-review-limit" title={text.limit}>
          <ChoiceList
            name="auto-review"
            legend={text.limitLabel}
            value={String(settings.limit)}
            onChange={(v) => update({ ...settings, limit: Number(v) as AutoReviewLimit })}
            options={AUTO_REVIEW_LIMITS.map((n) => ({ id: String(n), label: String(n) }))}
          />
          <SettingsHint>{text.limitHint}</SettingsHint>
        </SettingsPart>
      )}
    </SettingsSubpage>
  )
}
