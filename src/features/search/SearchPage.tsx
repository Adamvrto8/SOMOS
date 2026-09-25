import { Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Chip } from '../../components/Chip'
import { searchWords, type SearchFilter } from '../../lib/search'
import { pluralSk } from '../../lib/text'
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
  const [params, setParams] = useSearchParams()
  // Local state keeps typing smooth; the URL mirrors it so "back" restores results.
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const urlQuery = params.get('q') ?? ''
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    // Cleared from outside (tapping the Hľadať tab again): reset the field too.
    if (urlQuery === '' && query !== '') setQuery('')
  }
  const filterParam = params.get('f')
  const filter: SearchFilter = isFilter(filterParam) ? filterParam : 'all'
  const inputRef = useRef<HTMLInputElement>(null)

  const hits = useMemo(() => searchWords(query, filter), [query, filter])
  const showTopics = query.trim() === '' && filter === 'all'

  const syncUrl = (q: string, f: SearchFilter) => {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (f !== 'all') next.set('f', f)
    setParams(next, { replace: true })
  }

  const changeQuery = (value: string) => {
    setQuery(value)
    syncUrl(value, filter)
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Hľadať</h1>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          inputRef.current?.blur() // closes the keyboard so results are visible
        }}
        className="relative"
      >
        <Search
          size={20}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          autoFocus={query === ''}
          placeholder="napr. casa, dom, tengo"
          aria-label="Hľadať slovo"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border border-line bg-surface pr-12 pl-12 text-base transition-colors duration-150 placeholder:text-ink-muted focus:border-brick focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              changeQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Vymazať"
            className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:text-ink"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </form>

      <div role="group" aria-label="Filter" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => syncUrl(query, f.id)}>
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
                <WordRow key={hit.word.id} word={hit.word} matchedForm={hit.matchedForm} />
              ))}
            </ul>
          ) : (
            <div className="rounded-card border border-dashed border-line p-6 text-center">
              <p className="font-medium">Nenašli sme nič pre „{query.trim()}“.</p>
              <p className="mt-1 text-sm text-ink-muted">Skús iný tvar slova alebo slovenský výraz.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
