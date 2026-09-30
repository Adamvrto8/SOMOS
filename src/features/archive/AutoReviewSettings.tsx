import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { AUTO_REVIEW_LIMITS, setAutoReview, useAutoReviewSettings, type AutoReviewLimit, type AutoReviewSettings as Settings } from '../../lib/autoReview'
import { reportProgress } from '../../lib/reminder'

/** Nastavenia: practised words in review, and how many a day. */
export function AutoReviewSettings() {
  const settings = useAutoReviewSettings()
  const update = (next: Settings) => {
    setAutoReview(next)
    reportProgress() // the reminder text counts due cards
  }

  return (
    <section aria-labelledby="auto-review-heading">
      <SectionTitle id="auto-review-heading">Automatické opakovanie</SectionTitle>
      <div className="rounded-card border border-line bg-surface">
        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block leading-snug">Opakovať precvičené slová</span>
            <span className="block text-sm text-ink-muted">Slová zo Slovnej zásoby a Časovania sa vrátia na zopakovanie.</span>
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
          <p className="mb-2 text-sm font-medium">Najviac za deň</p>
          <Segmented
            mode="radio"
            label="Najviac precvičených slov za deň"
            idPrefix="auto-review"
            value={String(settings.limit)}
            onChange={(v) => update({ ...settings, limit: Number(v) as AutoReviewLimit })}
            options={AUTO_REVIEW_LIMITS.map((n) => ({ id: String(n), label: String(n) }))}
          />
          <p className="mt-2 text-sm text-ink-muted">Tvoje ⭐ a vlastné slová prídu na rad vždy, limit platí len pre precvičené slová.</p>
        </div>
      )}
    </section>
  )
}
