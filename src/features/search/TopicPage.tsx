import { useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { NotFound } from '../../components/NotFound'
import { TopicIcon } from '../../components/TopicIcon'
import { topicById } from '../../data'
import { useT } from '../../i18n'
import { useSavedWordIds } from '../../lib/archive'
import { topicName } from '../../lib/localized'
import { wordsInTopic } from '../../lib/search'
import { WordRow } from './WordRow'

export function TopicPage() {
  const { id = '' } = useParams()
  const topic = topicById.get(id)
  const savedIds = useSavedWordIds()
  const text = useT().search
  if (!topic) return <NotFound title={text.topicNotFound} />

  const list = wordsInTopic(topic.id)
  const listIds = list.map((w) => w.id)

  return (
    <div>
      <BackButton fallback="/search" />
      <header className="mt-2 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-brick">
          <TopicIcon name={topic.icon} size={26} />
        </span>
        <div className="min-w-0">
          <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight">{topicName(topic)}</h1>
          <p lang="es" className="font-serif text-ink-muted">
            {topic.es}
          </p>
        </div>
      </header>

      <p className="mt-6 text-sm text-ink-muted">
        {text.words(list.length)}
      </p>
      <ul className="mt-1 divide-y divide-line">
        {list.map((word) => (
          <WordRow key={word.id} word={word} saved={savedIds.has(word.id)} list={listIds} />
        ))}
      </ul>
    </div>
  )
}
