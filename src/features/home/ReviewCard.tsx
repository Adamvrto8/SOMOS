import { ArrowRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { useReviewOverview } from '../../lib/srs'
import type { ContinueLesson } from './continueLesson'

const SECONDS_PER_CARD = 25

const ROUND_LINK =
  'flex size-16 shrink-0 items-center justify-center rounded-full bg-brick text-on-accent shadow-[0_6px_20px_-6px_var(--brick)] transition duration-150 hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

/**
 * The Home hero, one big serif number and a round go button: reviews due today, or, with
 * nothing to review, the lesson to continue.
 */
export function ReviewCard({ next }: { next: ContinueLesson }) {
  const text = useT().home
  const overview = useReviewOverview()
  if (!overview) return <div className="h-44" aria-hidden />

  const { dueToday, dueWords, dueSentences, total } = overview
  const reviewing = dueToday > 0
  const minutes = Math.max(1, Math.round((dueToday * SECONDS_PER_CARD) / 60))
  const parts = [
    dueWords > 0 && text.words(dueWords),
    dueSentences > 0 && text.sentences(dueSentences),
    text.minutes(minutes),
  ].filter(Boolean)

  return (
    <section aria-labelledby="due-heading">
      <h2 id="due-heading" className="text-sm text-ink-muted">
        {reviewing ? text.dueToday : next.started ? text.continueLesson : text.firstLesson}
      </h2>
      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="font-serif text-[7.5rem] leading-[0.8] font-light tracking-tighter tabular-nums">
          {reviewing ? dueToday : next.lesson}
        </p>
        <Link
          to={reviewing ? '/review' : next.href}
          aria-label={reviewing ? text.reviewAria(dueToday) : text.lessonAria(next.lesson, next.label)}
          className={ROUND_LINK}
        >
          <ArrowRight size={26} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
      <p className="mt-4 text-sm text-ink-muted">{reviewing ? parts.join(' · ') : text.lessonLine(next.lesson, next.label)}</p>
      {!reviewing && total > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
          <CircleCheck size={16} strokeWidth={1.75} className="shrink-0 text-leaf" aria-hidden />
          {text.reviewDone}
        </p>
      )}
    </section>
  )
}
