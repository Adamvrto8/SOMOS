import { CircleX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Grade } from '../../../lib/lesson'

/**
 * A wrong try the learner may still fix: for a sentence, their own words with the wrong ones
 * underlined and a gap where a word is missing. The correct words are not given away.
 */
export function RetryHint({ grade }: { grade: Grade }) {
  const ref = useRef<HTMLDivElement>(null)
  const diff = grade.diff
  const notes = [
    diff?.some((p) => p.state === 'wrong') && 'Podčiarknuté slová sú zle.',
    diff?.some((p) => p.state === 'missing') && 'Na prázdnom mieste chýba slovo.',
    (diff ? diff.some((p) => p.accent) : grade.check?.meanings) && 'Skontroluj prízvuk.',
  ].filter(Boolean)

  // The phone keyboard stays open for the fix and may cover the hint.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' })
  }, [grade])

  return (
    <div ref={ref} role="status" className="mt-2 scroll-mb-24 rounded-2xl border border-error/40 bg-error/10 px-4 py-3">
      <p className="flex items-center gap-2 font-semibold text-error">
        <CircleX size={18} strokeWidth={2} className="shrink-0" aria-hidden />
        Ešte to nie je ono. Skús znova.
      </p>
      {diff && (
        <p className="mt-2 font-serif text-lg leading-relaxed">
          {diff.map((part, i) => (
            <span key={i}>
              {i > 0 && ' '}
              {part.state === 'missing' ? (
                <span role="img" aria-label="chýba slovo" className="inline-block w-7 border-b-2 border-error" />
              ) : part.state === 'wrong' ? (
                <span className="underline decoration-error decoration-wavy decoration-2 underline-offset-4">{part.text}</span>
              ) : (
                part.text
              )}
            </span>
          ))}
        </p>
      )}
      {notes.length > 0 && <p className="mt-1 text-sm text-ink-muted">{notes.join(' ')}</p>}
    </div>
  )
}
