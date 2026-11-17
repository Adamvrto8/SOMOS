import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { useOnboarding } from '../../lib/onboarding'
import { acceptTour, declineTour, shouldOfferTour } from '../../lib/tour'

/** On the first Domov after the welcome and the first lesson: take the tour or not, asked once. */
export function TourOffer({ onStart }: { onStart: () => void }) {
  const text = useT().tour
  const onboarding = useOnboarding()
  if (!shouldOfferTour(onboarding)) return null

  return (
    <section aria-labelledby="tour-offer-heading" className="mt-5 rounded-card border border-line bg-surface p-5 motion-safe:animate-fade-in">
      <h2 id="tour-offer-heading" className="font-serif text-xl font-semibold tracking-tight">
        {text.offerTitle}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{text.offerHint}</p>
      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => {
            acceptTour()
            onStart()
          }}
          className="flex-1"
        >
          {text.offerYes}
        </Button>
        <Button variant="secondary" onClick={declineTour} className="flex-1">
          {text.offerNo}
        </Button>
      </div>
    </section>
  )
}
