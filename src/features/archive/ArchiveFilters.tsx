import { Chip } from '../../components/Chip'
import { SearchField } from '../../components/SearchField'
import { useT } from '../../i18n'
import { topicName } from '../../lib/localized'
import type { ArchiveFilter } from './useArchiveFilter'

export function ArchiveFilters({ filter }: { filter: ArchiveFilter }) {
  const dictionary = useT()
  const text = dictionary.archive
  return (
    <>
      <SearchField value={filter.query} onChange={filter.setQuery} label={text.searchLabel} placeholder={text.searchLabel} />
      {filter.tabTopics.length > 1 && (
        <div role="group" aria-label={text.topic} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip selected={filter.topic === null} onClick={() => filter.setTopic(null)}>
            {dictionary.exercise.allTopics}
          </Chip>
          {filter.tabTopics.map((t) => (
            <Chip key={t.id} selected={filter.topic === t.id} onClick={() => filter.setTopic(t.id)}>
              {topicName(t)}
            </Chip>
          ))}
        </div>
      )}
    </>
  )
}

export function NoMatches() {
  const text = useT().archive
  return <p className="rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-muted">{text.noMatches}</p>
}
