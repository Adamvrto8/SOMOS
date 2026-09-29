import { ArrowRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useReviewOverview } from '../../lib/srs'
import { pluralSk } from '../../lib/text'

const SECONDS_PER_CARD = 25

const ROUND_LINK =
  'flex size-16 shrink-0 items-center justify-center rounded-full transition duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'
// (No button when nothing is due: the header's search button is the way to find words to save.)

/** The Home hero: "Na zopakovanie dnes" with one big serif number and a round go button. */
export function ReviewCard() {
  const overview = useReviewOverview()
  if (!overview) return <div className="h-44" aria-hidden />

  const { dueToday, dueWords, dueSentences, total } = overview
  const minutes = Math.max(1, Math.round((dueToday * SECONDS_PER_CARD) / 60))
  const parts = [
    dueWords > 0 && `${dueWords} ${pluralSk(dueWords, ['slovo', 'slová', 'slov'])}`,
    dueSentences > 0 && `${dueSentences} ${pluralSk(dueSentences, ['veta', 'vety', 'viet'])}`,
    `asi ${minutes} min`,
  ].filter(Boolean)

  return (
    <section aria-labelledby="due-heading">
      <h2 id="due-heading" className="text-sm text-ink-muted">
        Na zopakovanie dnes
      </h2>
      <div className="mt-2 flex items-center justify-between gap-4">
        <p
          className={[
            'font-serif text-[7.5rem] leading-[0.8] font-light tracking-tighter tabular-nums',
            dueToday > 0 ? 'text-ink' : 'text-ink-muted/50',
          ].join(' ')}
        >
          {dueToday}
        </p>
        {dueToday > 0 && (
          <Link
            to="/review"
            aria-label={`Zopakovať ${dueToday}`}
            className={`${ROUND_LINK} bg-brick text-on-accent shadow-[0_6px_20px_-6px_var(--brick)] hover:brightness-110`}
          >
            <ArrowRight size={26} strokeWidth={1.75} aria-hidden />
          </Link>
        )}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-muted">
        {dueToday > 0 ? (
          parts.join(' · ')
        ) : total > 0 ? (
          <>
            <CircleCheck size={16} strokeWidth={1.75} className="shrink-0 text-leaf" aria-hidden />
            Všetko zopakované · v archíve {total} {pluralSk(total, ['položka', 'položky', 'položiek'])}
          </>
        ) : (
          'Ulož si slová hviezdičkou – budú sa ti tu vracať na zopakovanie.'
        )}
      </p>
    </section>
  )
}
