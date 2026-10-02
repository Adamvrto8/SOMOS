import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import type { CustomWord } from '../../lib/db'
import { ArchiveFilters, NoMatches } from './ArchiveFilters'
import { CustomWordRow } from './CustomWordRow'
import { EmptyState } from './EmptyState'
import { useArchiveFilter } from './useArchiveFilter'

/** "Moje slová": the learner's own words, newest first, with a floating "+". */
export function CustomTab({ words }: { words: CustomWord[] }) {
  const filter = useArchiveFilter(new Set(words.flatMap((c) => (c.topic ? [c.topic] : []))))

  if (words.length === 0) {
    return (
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
    )
  }

  const visible = words.filter((c) => (!filter.topic || c.topic === filter.topic) && filter.matches([c.es, c.sk, c.note ?? '']))

  return (
    <>
      <ArchiveFilters filter={filter} />
      {visible.length === 0 ? (
        <NoMatches />
      ) : (
        // Bottom padding keeps the last row clear of the floating "+" button.
        <ul className="divide-y divide-line pb-16">
          {visible.map((word) => (
            <CustomWordRow key={word.id} word={word} />
          ))}
        </ul>
      )}

      {/* Floating "+" above the tab bar, aligned to the 480px column; gone with the tab bar while the keyboard is open. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 keyboard:hidden">
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
    </>
  )
}
