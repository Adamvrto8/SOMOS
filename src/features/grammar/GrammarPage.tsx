import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { tips } from '../../data'
import { useT } from '../../i18n'
import { localizedTip } from '../../lib/localized'

/** The grammar tips as a small handbook; the same tips open from a wrong answer in a lesson ("Prečo?"). */
export function GrammarPage() {
  const text = useT().grammar
  return (
    <div>
      <BackButton fallback="/practice" />
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-2 leading-relaxed text-ink-muted">
        {text.intro}
      </p>

      <ul className="mt-6 space-y-2">
        {tips.map(localizedTip).map((tip) => (
          <li key={tip.id}>
            <Link
              to={`/practice/grammar/${tip.id}`}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-xl leading-snug font-semibold">{tip.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-sm text-ink-muted">{tip.intro}</span>
              </span>
              <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
