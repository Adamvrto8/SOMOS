import { ArrowRight, ChevronRight, CircleCheck, Play, Route } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { useReviewOverview } from '../../lib/srs'
import type { ContinueLesson } from './continueLesson'

const SECONDS_PER_CARD = 25

const ROUND_LINK =
  'flex size-16 shrink-0 items-center justify-center rounded-full bg-brick text-on-accent shadow-[0_6px_20px_-6px_var(--brick)] transition duration-150 hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

/**
 * The Home hero, one big serif number and a round go button: reviews due today, or, with
 * nothing to review, the step of the path (the unit's number) or the lesson to continue.
 */
export function ReviewCard({ next }: { next: ContinueLesson }) {
  const dictionary = useT()
  const text = dictionary.home
  const pathText = dictionary.path
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
  const step = next.path && pathText.steps[next.path.step]
  const heading = next.path ? (next.started ? pathText.homeContinue : pathText.homeStart) : next.started ? text.continueLesson : text.firstLesson

  return (
    <section aria-labelledby="due-heading">
      <h2 id="due-heading" className="text-sm text-ink-muted">
        {reviewing ? text.dueToday : heading}
      </h2>
      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="font-serif text-[7.5rem] leading-[0.8] font-light tracking-tighter tabular-nums">
          {reviewing ? dueToday : next.lesson}
        </p>
        <Link
          to={reviewing ? '/review' : next.href}
          aria-label={reviewing ? text.reviewAria(dueToday) : step ? pathText.homeAria(next.lesson, step) : text.lessonAria(next.lesson, next.label)}
          className={ROUND_LINK}
        >
          <ArrowRight size={26} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
      <p className="mt-4 text-sm text-ink-muted">
        {reviewing
          ? parts.join(' · ')
          : next.path && step
            ? pathText.homeLine(next.lesson, next.label, step, next.path.stepNo, next.path.steps)
            : text.lessonLine(next.lesson, next.label)}
      </p>
      {!reviewing && total > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
          <CircleCheck size={16} strokeWidth={1.75} className="shrink-0 text-leaf" aria-hidden />
          {text.reviewDone}
        </p>
      )}
      {/* While flashcards lead, the next step stays one tap away, quietly. */}
      {reviewing && (
        <Link
          to={next.href}
          className="mt-5 flex items-center gap-3 rounded-card border border-line bg-surface/90 px-4 py-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:bg-surface-2"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
            {next.path ? <Route size={18} strokeWidth={1.75} aria-hidden /> : <Play size={18} strokeWidth={1.75} className="translate-x-px" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{next.path ? pathText.homeRow(next.label) : heading}</span>
            <span className="block truncate text-sm text-ink-muted">
              {next.path && step ? `${step} · ${pathText.stepOf(next.path.stepNo, next.path.steps)}` : text.lessonLine(next.lesson, next.label)}
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
        </Link>
      )}
    </section>
  )
}
