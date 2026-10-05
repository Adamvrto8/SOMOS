import { useLocation, useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { NotFound } from '../../components/NotFound'
import { Pager } from '../../components/Pager'
import { TopicIcon } from '../../components/TopicIcon'
import { topicById, topics } from '../../data'
import { useT } from '../../i18n'
import { useSavedWordIds } from '../../lib/archive'
import { topicName } from '../../lib/localized'
import { slideClass, usePageTurn, type TurnDirection } from '../../lib/pageTurn'
import { wordsInTopic } from '../../lib/search'
import { WordRow } from './WordRow'

/** The direction of the swipe that led here, for the slide-in. */
function readDirection(state: unknown): TurnDirection | undefined {
  const dir = typeof state === 'object' && state !== null && 'dir' in state ? state.dir : undefined
  return dir === 'next' || dir === 'prev' ? dir : undefined
}

/** The words of a topic. It swipes — or pages with ‹ › and the arrow keys — to the neighbouring topics. */
export function TopicPage() {
  const { id = '' } = useParams()
  const topic = topicById.get(id)
  const savedIds = useSavedWordIds()
  const text = useT().search
  const location = useLocation()
  const navigate = useNavigate()
  const index = topics.findIndex((t) => t.id === id)

  // Replace, so paging through topics doesn't pile up history entries before the list of topics.
  const go = (dir: TurnDirection) => {
    const target = topics[index + (dir === 'next' ? 1 : -1)]
    if (index < 0 || !target) return
    void navigate(`/topic/${target.id}`, { replace: true, state: { dir } })
  }
  usePageTurn(go)

  if (!topic) return <NotFound title={text.topicNotFound} />

  const list = wordsInTopic(topic.id)
  const listIds = list.map((w) => w.id)

  return (
    // pan-y: the list still scrolls vertically, horizontal swipes are ours.
    <div className="touch-pan-y">
      <div className="flex items-center justify-between">
        <BackButton fallback="/search" />
        <Pager label={text.topics} previous={text.previousTopic} next={text.nextTopic} index={index} total={topics.length} onTurn={go} />
      </div>
      <div key={topic.id} className={slideClass(readDirection(location.state))}>
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

        <p className="mt-6 text-sm text-ink-muted">{text.words(list.length)}</p>
        <ul className="mt-1 divide-y divide-line">
          {list.map((word) => (
            <WordRow key={word.id} word={word} saved={savedIds.has(word.id)} list={listIds} />
          ))}
        </ul>
      </div>
    </div>
  )
}
