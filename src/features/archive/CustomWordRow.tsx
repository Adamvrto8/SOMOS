import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { topicById } from '../../data'
import type { CustomWord } from '../../lib/db'

interface CustomWordRowProps {
  word: CustomWord
}

export function CustomWordRow({ word }: CustomWordRowProps) {
  const topic = word.topic ? topicById.get(word.topic) : undefined

  return (
    <li>
      <Link
        to={`/archive/custom/${word.id}`}
        className="flex min-h-16 items-center gap-3 py-2.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <p lang="es" className="truncate font-serif text-lg font-semibold">
            {word.es}
          </p>
          <p className="truncate text-sm text-ink-muted">
            {word.sk}
            {topic && <span> · {topic.sk}</span>}
          </p>
        </div>
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
      </Link>
    </li>
  )
}
