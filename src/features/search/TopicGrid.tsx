import { Link } from 'react-router'
import { SectionTitle } from '../../components/SectionTitle'
import { TopicIcon } from '../../components/TopicIcon'
import { topics } from '../../data'
import { useT } from '../../i18n'
import { topicName } from '../../lib/localized'
import { wordsInTopic } from '../../lib/search'

export function TopicGrid() {
  const text = useT().search
  return (
    <section aria-labelledby="topics-heading">
      <SectionTitle id="topics-heading">{text.topics}</SectionTitle>
      <ul className="grid grid-cols-2 gap-3">
        {topics.map((topic) => {
          const count = wordsInTopic(topic.id).length
          return (
            <li key={topic.id}>
              <Link
                to={`/topic/${topic.id}`}
                className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:bg-surface-2"
              >
                <span className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-brick">
                    <TopicIcon name={topic.icon} size={20} />
                  </span>
                  <span className="text-xs text-ink-muted">
                    {text.words(count)}
                  </span>
                </span>
                <span>
                  <span className="block leading-snug font-medium">{topicName(topic)}</span>
                  <span lang="es" className="block font-serif text-sm text-ink-muted">
                    {topic.es}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
