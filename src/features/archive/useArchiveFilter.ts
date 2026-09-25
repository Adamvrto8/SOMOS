import { topics } from '../../data'
import { fold } from '../../lib/text'
import { useUrlParam, useUrlQuery } from '../../lib/useUrlQuery'

/** Search text + topic chip shared by the archive tabs, both mirrored in the URL. */
export function useArchiveFilter(topicIdsInTab: Set<string>) {
  const [query, setQuery] = useUrlQuery()
  const [topicParam, setTopic] = useUrlParam('topic')
  // Only offer topics that actually occur in the tab.
  const tabTopics = topics.filter((t) => topicIdsInTab.has(t.id))
  const topic = topicParam && topicIdsInTab.has(topicParam) ? topicParam : null
  const folded = fold(query.trim())

  return {
    query,
    setQuery,
    topic,
    setTopic,
    tabTopics,
    /** True when the texts contain the search query (accent-insensitive). */
    matches: (texts: string[]) => !folded || fold(texts.join(' ')).includes(folded),
  }
}

export type ArchiveFilter = ReturnType<typeof useArchiveFilter>
