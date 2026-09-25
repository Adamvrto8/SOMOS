import { Info } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Badge } from '../../components/Badge'
import { NotFound } from '../../components/NotFound'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { topicById, verbById, wordById } from '../../data'
import { articleFor, GENDER_LABELS, POS_LABELS } from '../../lib/grammar'
import { ConjugationTable } from './ConjugationTable'

export function WordPage() {
  const { id = '' } = useParams()
  const word = wordById.get(id)
  if (!word) return <NotFound title="Slovo sa nenašlo" />

  const verb = word.verbId ? verbById.get(word.verbId) : undefined
  const estar = verbById.get('estar')
  const article = articleFor(word)
  const [primary, ...otherTranslations] = word.sk
  const wordTopics = word.topics.flatMap((t) => topicById.get(t) ?? [])

  return (
    <article className="space-y-8">
      <div>
        <BackButton fallback="/search" />

        <header className="mt-2">
          <div className="flex items-start justify-between gap-3">
            <h1 lang="es" className="min-w-0 font-serif text-5xl leading-tight font-semibold tracking-tight break-words">
              {article && <span className="text-3xl font-normal text-ink-muted">{article} </span>}
              {word.es}
            </h1>
            <div className="pt-1.5">
              <SpeakButton text={article ? `${article} ${word.es}` : word.es} size="lg" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{POS_LABELS[word.pos]}</Badge>
            {word.gender && <Badge>{GENDER_LABELS[word.gender]}</Badge>}
            {verb && !verb.regular && <Badge tone="amber">nepravidelné</Badge>}
            {verb?.reflexive && <Badge>zvratné</Badge>}
            <Badge>{word.level}</Badge>
          </div>

          <p className="mt-4 text-xl">
            {primary}
            {otherTranslations.length > 0 && <span className="text-ink-muted">, {otherTranslations.join(', ')}</span>}
          </p>

          {(word.plural || word.feminine) && (
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
              {word.plural && (
                <div className="flex gap-1.5">
                  <dt>množné číslo:</dt>
                  <dd lang="es" className="font-serif text-ink">
                    {word.plural}
                  </dd>
                </div>
              )}
              {word.feminine && (
                <div className="flex gap-1.5">
                  <dt>ženský tvar:</dt>
                  <dd lang="es" className="font-serif text-ink">
                    {word.feminine}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </header>
      </div>

      {word.note && (
        <aside aria-label="Poznámka" className="flex gap-3 rounded-card bg-surface-2 p-4 text-sm leading-relaxed">
          <Info size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brick" aria-hidden />
          <p>{word.note}</p>
        </aside>
      )}

      <section aria-labelledby="examples-heading">
        <SectionTitle id="examples-heading">Príklady</SectionTitle>
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {word.examples.map((example) => (
            <li key={example.es} className="flex items-start gap-1 py-3 pr-1 pl-4">
              <div className="min-w-0 flex-1 pt-1">
                <p lang="es" className="font-serif text-lg leading-snug">
                  {example.es}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">{example.sk}</p>
              </div>
              <SpeakButton text={example.es} />
            </li>
          ))}
        </ul>
      </section>

      {verb && estar && <ConjugationTable verb={verb} estar={estar} />}

      {wordTopics.length > 0 && (
        <section aria-labelledby="topics-heading">
          <SectionTitle id="topics-heading">Témy</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {wordTopics.map((topic) => (
              <li key={topic.id}>
                <Link
                  to={`/topic/${topic.id}`}
                  className="flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
                >
                  {topic.sk}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
