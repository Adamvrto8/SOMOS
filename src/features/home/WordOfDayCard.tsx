import { Link } from 'react-router'
import { SpeakButton } from '../../components/SpeakButton'
import { useT } from '../../i18n'
import { articleFor } from '../../lib/grammar'
import { wordExamples, wordTranslations } from '../../lib/localized'
import { wordOfDay } from '../../lib/wordOfDay'

/** Compact word-of-the-day card; the whole card opens the word detail. */
export function WordOfDayCard() {
  const word = wordOfDay()
  const article = articleFor(word)
  const example = wordExamples(word)[0]
  const text = useT().home

  return (
    <section aria-labelledby="wod-heading" className="relative rounded-card border border-line bg-surface p-5 transition-colors duration-150 hover:border-ink-muted">
      <h2 id="wod-heading" className="text-xs font-semibold tracking-widest text-brick uppercase dark:text-amber">
        {text.wordOfDay}
      </h2>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Stretched link: the card is the tap target, the speaker sits above it. */}
          <Link
            to={`/word/${word.id}`}
            lang="es"
            className="font-serif text-3xl font-semibold tracking-tight after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brick"
          >
            {article && <span className="text-xl font-normal text-ink-muted">{article} </span>}
            {word.es}
          </Link>
          <p className="mt-0.5 text-ink-muted">{wordTranslations(word).join(', ')}</p>
        </div>
        <div className="relative">
          <SpeakButton text={article ? `${article} ${word.es}` : word.es} />
        </div>
      </div>
      <p lang="es" className="mt-3 border-t border-line pt-3 font-serif leading-snug">
        {example.es}
      </p>
      <p className="text-sm text-ink-muted">{example.text}</p>
    </section>
  )
}
