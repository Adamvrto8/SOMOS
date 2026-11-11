import { BookOpen, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router'
import { Badge } from '../../components/Badge'
import { Chip } from '../../components/Chip'
import { SearchField } from '../../components/SearchField'
import { SectionTitle } from '../../components/SectionTitle'
import { tips } from '../../data'
import type { Tip } from '../../data/types'
import { useT } from '../../i18n'
import { useSavedWordIds } from '../../lib/archive'
import { localizedTip } from '../../lib/localized'
import { searchWords, type SearchFilter } from '../../lib/search'
import { searchTipTitles } from '../../lib/tipSearch'
import { useUrlParam, useUrlQuery } from '../../lib/useUrlQuery'
import { OnlineTranslate } from './OnlineTranslate'
import { TopicGrid } from './TopicGrid'
import { WordRow } from './WordRow'

const FILTERS: SearchFilter[] = ['all', 'verb', 'noun', 'phrase']

const isFilter = (value: string | null): value is SearchFilter => FILTERS.some((f) => f === value)

/** "ser estar" in Hľadať: the grammar tips with those words in their title, under the words. */
function TipHits({ found }: { found: Tip[] }) {
  const text = useT().search
  return (
    <section aria-labelledby="search-tips-heading">
      <SectionTitle id="search-tips-heading">{text.grammar}</SectionTitle>
      <ul className="space-y-2">
        {found.map((tip) => (
          <li key={tip.id}>
            <Link
              to={`/practice/grammar/${tip.id}`}
              className="flex min-h-12 items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
            >
              <BookOpen size={18} strokeWidth={1.75} className="shrink-0 text-brick" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{localizedTip(tip).title}</span>
              <Badge>{tip.level}</Badge>
              <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SearchPage() {
  const [query, setQuery] = useUrlQuery()
  const [filterParam, setFilterParam] = useUrlParam('f')
  const filter: SearchFilter = isFilter(filterParam) ? filterParam : 'all'
  const savedIds = useSavedWordIds()
  const location = useLocation()
  const text = useT().search

  const hits = useMemo(() => searchWords(query, filter), [query, filter])
  const hitIds = useMemo(() => hits.map((h) => h.word.id), [hits])
  const showTopics = query.trim() === '' && filter === 'all'
  // Tips only with "Všetko": the chips narrow the words to a part of speech.
  const tipHits = useMemo(() => (filter === 'all' ? searchTipTitles(tips, query) : []), [query, filter])

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>

      <SearchField
        value={query}
        onChange={setQuery}
        label={text.fieldLabel}
        placeholder={text.placeholder}
        // Only from the Home search button: the tab itself keeps the keyboard closed.
        autoFocus={(location.state as { focus?: boolean } | null)?.focus === true}
      />

      <div role="group" aria-label={text.filterLabel} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilterParam(f === 'all' ? null : f)}>
            {text.filters[f]}
          </Chip>
        ))}
      </div>

      {showTopics ? (
        <div className="pt-2">
          <TopicGrid />
        </div>
      ) : (
        <>
          <p aria-live="polite" className="sr-only">
            {text.results(hits.length)}
          </p>
          {hits.length > 0 ? (
            <ul className="divide-y divide-line">
              {hits.map((hit) => (
                <WordRow key={hit.word.id} word={hit.word} matchedForm={hit.matchedForm} otherForm={hit.otherForm} saved={savedIds.has(hit.word.id)} list={hitIds} />
              ))}
            </ul>
          ) : (
            tipHits.length === 0 && (
              <div className="rounded-card border border-dashed border-line p-6 text-center">
                <p className="font-medium">{text.nothing(query.trim())}</p>
                <p className="mt-1 text-sm text-ink-muted">{text.nothingHint}</p>
              </div>
            )
          )}
          {tipHits.length > 0 && <TipHits found={tipHits} />}
          {query.trim() !== '' && <OnlineTranslate key={query.trim()} query={query} />}
        </>
      )}
    </div>
  )
}
