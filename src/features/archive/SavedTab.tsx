import { Search } from 'lucide-react'
import { Link } from 'react-router'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { sentenceById, wordById } from '../../data'
import type { Sentence, Word } from '../../data/types'
import { useT } from '../../i18n'
import type { SavedItem } from '../../lib/db'
import { WordRow } from '../search/WordRow'
import { SaveButton } from '../word/SaveButton'
import { ArchiveFilters, NoMatches } from './ArchiveFilters'
import { EmptyState } from './EmptyState'
import { useArchiveFilter } from './useArchiveFilter'

/** ⭐ items: dictionary words and sentences starred in exercises (newest first). */
export function SavedTab({ items }: { items: SavedItem[] }) {
  const words = items.flatMap((i): Word[] => {
    const word = i.itemType === 'word' ? wordById.get(i.itemId) : undefined
    return word ? [word] : []
  })
  const sentences = items.flatMap((i): Sentence[] => {
    const sentence = i.itemType === 'sentence' ? sentenceById.get(i.itemId) : undefined
    return sentence ? [sentence] : []
  })
  const filter = useArchiveFilter(new Set([...words, ...sentences].flatMap((x) => x.topics)))
  const text = useT().archive

  if (words.length + sentences.length === 0) {
    return (
      <EmptyState
        title={text.savedEmptyTitle}
        text={text.savedEmptyText}
        action={
          <Link
            to="/search"
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-5 font-semibold transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
          >
            <Search size={18} strokeWidth={1.75} aria-hidden />
            {text.searchWords}
          </Link>
        }
      />
    )
  }

  const inTopic = (x: { topics: string[] }) => !filter.topic || x.topics.includes(filter.topic)
  const visibleWords = words.filter((w) => inTopic(w) && filter.matches([w.es, ...w.sk]))
  const visibleSentences = sentences.filter((s) => inTopic(s) && filter.matches([s.es, s.sk]))
  const wordIds = visibleWords.map((w) => w.id)

  return (
    <>
      <ArchiveFilters filter={filter} />
      {visibleWords.length + visibleSentences.length === 0 && <NoMatches />}

      {visibleWords.length > 0 && (
        <section aria-labelledby="saved-words-heading">
          {visibleSentences.length > 0 && <SectionTitle id="saved-words-heading">{text.words}</SectionTitle>}
          <ul aria-labelledby="saved-words-heading" className="divide-y divide-line">
            {visibleWords.map((word) => (
              <WordRow key={word.id} word={word} list={wordIds} />
            ))}
          </ul>
        </section>
      )}

      {visibleSentences.length > 0 && (
        <section aria-labelledby="saved-sentences-heading">
          <SectionTitle id="saved-sentences-heading">{text.sentences}</SectionTitle>
          <ul className="divide-y divide-line">
            {visibleSentences.map((s) => (
              <li key={s.id} className="flex items-start gap-1 py-3">
                <div className="min-w-0 flex-1 pt-1">
                  <p lang="es" className="font-serif text-lg leading-snug">
                    {s.es}
                  </p>
                  <p className="text-sm text-ink-muted">{s.sk}</p>
                </div>
                <SpeakButton text={s.es} />
                <SaveButton type="sentence" id={s.id} size="md" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
