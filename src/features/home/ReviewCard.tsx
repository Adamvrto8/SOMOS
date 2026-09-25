import { CircleCheck, Layers, Search } from 'lucide-react'
import { Link } from 'react-router'
import { useReviewOverview } from '../../lib/srs'
import { pluralSk } from '../../lib/text'

const LINK =
  'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

/** The Home call to action: "Na zopakovanie dnes: N". */
export function ReviewCard() {
  const overview = useReviewOverview()
  if (!overview) return <div className="h-40 rounded-card bg-surface-2" aria-hidden />

  if (overview.dueToday > 0) {
    return (
      <section aria-labelledby="due-heading" className="rounded-card bg-brick p-5 text-on-accent">
        <h2 id="due-heading" className="text-sm font-medium opacity-90">
          Na zopakovanie dnes
        </h2>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-5xl font-semibold">{overview.dueToday}</span>
          <span className="opacity-90">{pluralSk(overview.dueToday, ['slovo', 'slová', 'slov'])}</span>
        </p>
        <Link to="/review" className={`${LINK} mt-4 w-full bg-surface text-ink hover:bg-surface-2`}>
          <Layers size={18} strokeWidth={1.75} aria-hidden />
          Zopakovať
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby="due-heading" className="rounded-card border border-line bg-surface p-5">
      {overview.total > 0 ? (
        <>
          <h2 id="due-heading" className="flex items-center gap-2 font-semibold">
            <CircleCheck size={20} strokeWidth={1.75} className="text-leaf" aria-hidden />
            Všetko zopakované
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            V archíve máš {overview.total} {pluralSk(overview.total, ['slovo', 'slová', 'slov'])}. Ďalšie prídu na rad, keď ich
            začneš zabúdať.
          </p>
        </>
      ) : (
        <>
          <h2 id="due-heading" className="font-semibold">
            Zatiaľ nemáš čo opakovať
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Ulož si slová hviezdičkou alebo pridaj vlastné v Archíve – budú sa ti tu vracať na zopakovanie.
          </p>
          <Link to="/search" className={`${LINK} mt-4 border border-line bg-surface hover:bg-surface-2`}>
            <Search size={18} strokeWidth={1.75} aria-hidden />
            Hľadať slová
          </Link>
        </>
      )}
    </section>
  )
}
