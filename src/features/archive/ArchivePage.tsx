import { Layers, Plus, Search, Settings } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Chip } from '../../components/Chip'
import { SearchField } from '../../components/SearchField'
import { Segmented } from '../../components/Segmented'
import { topics, wordById } from '../../data'
import type { Word } from '../../data/types'
import { useCustomWords, useSavedItems } from '../../lib/archive'
import type { CustomWord } from '../../lib/db'
import { useReviewOverview } from '../../lib/srs'
import { fold } from '../../lib/text'
import { useUpdateParams, useUrlParam, useUrlQuery } from '../../lib/useUrlQuery'
import { WordRow } from '../search/WordRow'
import { CustomWordRow } from './CustomWordRow'
import { EmptyState } from './EmptyState'

type Tab = 'saved' | 'mine'

const matches = (text: string[], query: string) => !query || fold(text.join(' ')).includes(query)

export function ArchivePage() {
  const [tabParam] = useUrlParam('tab')
  const tab: Tab = tabParam === 'mine' ? 'mine' : 'saved'
  const [query, setQuery] = useUrlQuery()
  const [topicParam, setTopicParam] = useUrlParam('topic')
  const updateParams = useUpdateParams()

  const savedItems = useSavedItems()
  const customWords = useCustomWords()
  const review = useReviewOverview()

  const savedWords = useMemo(
    () => (savedItems ?? []).flatMap((item) => (item.itemType === 'word' ? (wordById.get(item.itemId) ?? []) : [])),
    [savedItems],
  )

  // Only offer topics that actually occur in the current tab.
  const topicIdsInTab = new Set(
    tab === 'saved' ? savedWords.flatMap((w) => w.topics) : (customWords ?? []).flatMap((c) => (c.topic ? [c.topic] : [])),
  )
  const tabTopics = topics.filter((t) => topicIdsInTab.has(t.id))
  const topic = topicParam && topicIdsInTab.has(topicParam) ? topicParam : null

  const q = fold(query.trim())
  const visibleSaved = savedWords.filter((w: Word) => (!topic || w.topics.includes(topic)) && matches([w.es, ...w.sk], q))
  const visibleCustom = (customWords ?? []).filter(
    (c: CustomWord) => (!topic || c.topic === topic) && matches([c.es, c.sk, c.note ?? ''], q),
  )

  const loading = savedItems === undefined || customWords === undefined
  const tabCount = tab === 'saved' ? savedWords.length : (customWords ?? []).length
  const visibleCount = tab === 'saved' ? visibleSaved.length : visibleCustom.length

  const switchTab = (next: Tab) => updateParams({ tab: next === 'saved' ? null : next, topic: null })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Archív</h1>
        <Link
          to="/archive/settings"
          aria-label="Nastavenia"
          title="Nastavenia"
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
        >
          <Settings size={22} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      {review && review.dueToday > 0 && (
        <Link
          to="/review"
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brick px-5 font-semibold text-on-accent transition duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          <Layers size={18} strokeWidth={1.75} aria-hidden />
          Zopakovať dnes ({review.dueToday})
        </Link>
      )}

      <Segmented
        mode="tabs"
        label="Archív"
        idPrefix="archive-tab"
        panelId="archive-panel"
        value={tab}
        onChange={switchTab}
        options={[
          { id: 'saved', label: `Uložené${savedItems ? ` (${savedWords.length})` : ''}` },
          { id: 'mine', label: `Moje slová${customWords ? ` (${customWords.length})` : ''}` },
        ]}
      />

      <div role="tabpanel" id="archive-panel" aria-labelledby={`archive-tab-${tab}`} className="space-y-4">
        {!loading && tabCount === 0 && tab === 'saved' && (
          <EmptyState
            title="Zatiaľ nič uložené"
            text="Na detaile slova ťukni na hviezdičku a slovo sa objaví tu. Neskôr si ich budeš môcť zopakovať."
            action={
              <Link
                to="/search"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-5 font-semibold transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
              >
                <Search size={18} strokeWidth={1.75} aria-hidden />
                Hľadať slová
              </Link>
            }
          />
        )}
        {!loading && tabCount === 0 && tab === 'mine' && (
          <EmptyState
            title="Zatiaľ žiadne vlastné slová"
            text="Počul si niekde slovo, ktoré v slovníku nie je? Pridaj si ho aj s prekladom a poznámkou."
            action={
              <Link
                to="/archive/new"
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brick px-5 font-semibold text-on-accent transition duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
              >
                <Plus size={18} strokeWidth={1.75} aria-hidden />
                Pridať slovo
              </Link>
            }
          />
        )}

        {tabCount > 0 && (
          <>
            <SearchField value={query} onChange={setQuery} label="Hľadať v archíve" placeholder="Hľadať v archíve" />

            {tabTopics.length > 1 && (
              <div role="group" aria-label="Téma" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                <Chip selected={topic === null} onClick={() => setTopicParam(null)}>
                  Všetky témy
                </Chip>
                {tabTopics.map((t) => (
                  <Chip key={t.id} selected={topic === t.id} onClick={() => setTopicParam(t.id)}>
                    {t.sk}
                  </Chip>
                ))}
              </div>
            )}

            {visibleCount === 0 ? (
              <p className="rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-muted">
                Nič nezodpovedá hľadaniu.
              </p>
            ) : tab === 'saved' ? (
              <ul className="divide-y divide-line">
                {visibleSaved.map((word) => (
                  <WordRow key={word.id} word={word} />
                ))}
              </ul>
            ) : (
              // Bottom padding keeps the last row clear of the floating "+" button.
              <ul className="divide-y divide-line pb-16">
                {visibleCustom.map((word) => (
                  <CustomWordRow key={word.id} word={word} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {tab === 'mine' && tabCount > 0 && (
        // Floating "+" above the tab bar, aligned to the 480px column.
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10">
          <div className="mx-auto flex max-w-[480px] justify-end px-4">
            <Link
              to="/archive/new"
              aria-label="Pridať slovo"
              title="Pridať slovo"
              className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-brick text-on-accent shadow-lg transition duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:scale-95"
            >
              <Plus size={26} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
