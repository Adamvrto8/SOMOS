import { Layers, Settings } from 'lucide-react'
import { Link } from 'react-router'
import { Segmented } from '../../components/Segmented'
import { useCustomWords, useSavedItems } from '../../lib/archive'
import { useMistakes } from '../../lib/mistakes'
import { useReviewOverview } from '../../lib/srs'
import { useUpdateParams, useUrlParam } from '../../lib/useUrlQuery'
import { CustomTab } from './CustomTab'
import { MistakesTab } from './MistakesTab'
import { SavedTab } from './SavedTab'

type Tab = 'saved' | 'mine' | 'mistakes'

const count = (items: unknown[] | undefined) => (items ? ` (${items.length})` : '')

export function ArchivePage() {
  const [tabParam] = useUrlParam('tab')
  const tab: Tab = tabParam === 'mine' || tabParam === 'mistakes' ? tabParam : 'saved'
  const updateParams = useUpdateParams()

  const savedItems = useSavedItems()
  const customWords = useCustomWords()
  const mistakes = useMistakes()
  const review = useReviewOverview()

  const starred = savedItems?.filter((i) => i.itemType === 'word' || i.itemType === 'sentence')
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
          { id: 'saved', label: `Uložené${count(starred)}` },
          { id: 'mine', label: `Moje slová${count(customWords)}` },
          { id: 'mistakes', label: `Chyby${count(mistakes)}` },
        ]}
      />

      <div role="tabpanel" id="archive-panel" aria-labelledby={`archive-tab-${tab}`} className="space-y-4">
        {tab === 'saved' && starred && <SavedTab items={starred} />}
        {tab === 'mine' && customWords && <CustomTab words={customWords} />}
        {tab === 'mistakes' && mistakes && <MistakesTab mistakes={mistakes} />}
      </div>
    </div>
  )
}
