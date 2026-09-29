import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { Chip } from '../../components/Chip'
import { SearchField } from '../../components/SearchField'
import { useSavedWordIds } from '../../lib/archive'
import { searchWords, type SearchFilter } from '../../lib/search'
import { pluralSk } from '../../lib/text'
import { useUrlParam, useUrlQuery } from '../../lib/useUrlQuery'
import { OnlineTranslate } from './OnlineTranslate'
import { TopicGrid } from './TopicGrid'
import { WordRow } from './WordRow'

const FILTERS: { id: SearchFilter; label: string }[] = [
  { id: 'all', label: 'Všetko' },
  { id: 'verb', label: 'Slovesá' },
  { id: 'noun', label: 'Podstatné mená' },
  { id: 'phrase', label: 'Frázy' },
]

const isFilter = (value: string | null): value is SearchFilter => FILTERS.some((f) => f.id === value)

export function SearchPage() {
  const [query, setQuery] = useUrlQuery()
  const [filterParam, setFilterParam] = useUrlParam('f')
  const filter: SearchFilter = isFilter(filterParam) ? filterParam : 'all'
  const savedIds = useSavedWordIds()
  const location = useLocation()

  const hits = useMemo(() => searchWords(query, filter), [query, filter])
  const hitIds = useMemo(() => hits.map((h) => h.word.id), [hits])
  const showTopics = query.trim() === '' && filter === 'all'

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Hľadať</h1>

      <SearchField
        value={query}
        onChange={setQuery}
        label="Hľadať slovo"
        placeholder="napr. casa, dom, tengo"
        // Only from the Home search button: the tab itself keeps the keyboard closed.
        autoFocus={(location.state as { focus?: boolean } | null)?.focus === true}
      />

      <div role="group" aria-label="Filter" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => setFilterParam(f.id === 'all' ? null : f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {showTopics ? (
        <TopicGrid />
      ) : (
        <>
          <p aria-live="polite" className="sr-only">
            {hits.length} {pluralSk(hits.length, ['výsledok', 'výsledky', 'výsledkov'])}
          </p>
          {hits.length > 0 ? (
            <ul className="divide-y divide-line">
              {hits.map((hit) => (
                <WordRow key={hit.word.id} word={hit.word} matchedForm={hit.matchedForm} saved={savedIds.has(hit.word.id)} list={hitIds} />
              ))}
            </ul>
          ) : (
            <div className="rounded-card border border-dashed border-line p-6 text-center">
              <p className="font-medium">Nenašli sme nič pre „{query.trim()}“.</p>
              <p className="mt-1 text-sm text-ink-muted">Skús iný tvar slova alebo slovenský výraz.</p>
            </div>
          )}
          {query.trim() !== '' && <OnlineTranslate key={query.trim()} query={query} />}
        </>
      )}
    </div>
  )
}
