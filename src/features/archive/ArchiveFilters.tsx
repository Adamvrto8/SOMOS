import { Chip } from '../../components/Chip'
import { SearchField } from '../../components/SearchField'
import type { ArchiveFilter } from './useArchiveFilter'

export function ArchiveFilters({ filter }: { filter: ArchiveFilter }) {
  return (
    <>
      <SearchField value={filter.query} onChange={filter.setQuery} label="Hľadať v archíve" placeholder="Hľadať v archíve" />
      {filter.tabTopics.length > 1 && (
        <div role="group" aria-label="Téma" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip selected={filter.topic === null} onClick={() => filter.setTopic(null)}>
            Všetky témy
          </Chip>
          {filter.tabTopics.map((t) => (
            <Chip key={t.id} selected={filter.topic === t.id} onClick={() => filter.setTopic(t.id)}>
              {t.sk}
            </Chip>
          ))}
        </div>
      )}
    </>
  )
}

export function NoMatches() {
  return <p className="rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-muted">Nič nezodpovedá hľadaniu.</p>
}
