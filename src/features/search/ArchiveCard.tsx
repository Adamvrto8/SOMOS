import { Bookmark, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { useCustomWords, useSavedItems } from '../../lib/archive'

/** Hľadať, above the topics: Archív, the learner's own dictionary (⭐ saved, Moje slová, Chyby). */
export function ArchiveCard() {
  const text = useT().search
  const saved = useSavedItems()?.filter((i) => i.itemType === 'word' || i.itemType === 'sentence').length
  const mine = useCustomWords()?.length

  return (
    <Link
      to="/archive"
      className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:bg-surface-2"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brick">
        <Bookmark size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{text.archive}</span>
        <span className="block text-sm text-ink-muted">{saved !== undefined && mine !== undefined ? text.archiveCounts(saved, mine) : ' '}</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
    </Link>
  )
}
