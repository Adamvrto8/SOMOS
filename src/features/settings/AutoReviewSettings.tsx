import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { useT } from '../../i18n'
import { AUTO_REVIEW_LIMITS, setAutoReview, useAutoReviewSettings, type AutoReviewLimit, type AutoReviewSettings as Settings } from '../../lib/autoReview'
import { reportProgress } from '../../lib/reminder'

/** Nastavenia: practised words in review, and how many a day. */
export function AutoReviewSettings() {
  const settings = useAutoReviewSettings()
  const text = useT().settings.autoReview
  const update = (next: Settings) => {
    setAutoReview(next)
    reportProgress() // the reminder text counts due cards
  }

  return (
    <section aria-labelledby="auto-review-heading">
      <SectionTitle id="auto-review-heading">{text.title}</SectionTitle>
      <div className="rounded-card border border-line bg-surface">
        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block leading-snug">{text.toggle}</span>
            <span className="block text-sm text-ink-muted">{text.toggleHint}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.enabled}
            onChange={(e) => update({ ...settings, enabled: e.target.checked })}
            className="size-6 shrink-0 accent-brick"
          />
        </label>
      </div>

      {settings.enabled && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-medium">{text.limit}</p>
          <Segmented
            mode="radio"
            label={text.limitLabel}
            idPrefix="auto-review"
            value={String(settings.limit)}
            onChange={(v) => update({ ...settings, limit: Number(v) as AutoReviewLimit })}
            options={AUTO_REVIEW_LIMITS.map((n) => ({ id: String(n), label: String(n) }))}
          />
          <p className="mt-2 text-sm text-ink-muted">{text.limitHint}</p>
        </div>
      )}
    </section>
  )
}
