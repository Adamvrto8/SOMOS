import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { articleFor } from '../../lib/grammar'
import { wordOfDay } from '../../lib/wordOfDay'

export function WordOfDayCard() {
  const word = wordOfDay()
  const article = articleFor(word)
  const example = word.examples[0]

  return (
    <section aria-labelledby="wod-heading">
      <SectionTitle id="wod-heading">Slovo dňa</SectionTitle>
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p lang="es" className="font-serif text-3xl font-semibold tracking-tight">
              {article && <span className="text-xl font-normal text-ink-muted">{article} </span>}
              {word.es}
            </p>
            <p className="mt-0.5 text-ink-muted">{word.sk.join(', ')}</p>
          </div>
          <SpeakButton text={article ? `${article} ${word.es}` : word.es} size="lg" />
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <p lang="es" className="font-serif text-lg leading-snug">
            {example.es}
          </p>
          <p className="text-sm text-ink-muted">{example.sk}</p>
        </div>
        <Link
          to={`/word/${word.id}`}
          className="mt-3 inline-flex h-11 items-center gap-1 text-sm font-semibold text-brick underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brick"
        >
          Detail slova
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
