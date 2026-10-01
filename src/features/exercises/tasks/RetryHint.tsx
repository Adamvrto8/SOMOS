import { CircleX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '../../../components/Button'
import type { Grade } from '../../../lib/lesson'

interface RetryHintProps {
  grade: Grade
  onCheck: () => void
  onGiveUp: () => void
}

/**
 * A wrong try the learner may still fix: for a sentence, their own words with the wrong ones
 * in red, the ones that do not belong struck through and a gap where a word is missing.
 * The correct words are not given away.
 *
 * The way on is here too, right under the field: the phone keyboard, open for the fix, covers
 * the bar at the bottom of the screen.
 */
export function RetryHint({ grade, onCheck, onGiveUp }: RetryHintProps) {
  const ref = useRef<HTMLDivElement>(null)
  const diff = grade.diff
  const has = (state: 'wrong' | 'extra' | 'missing') => diff?.some((p) => p.state === state)
  const notes = [
    has('wrong') && 'Červené slovo je zle.',
    has('extra') && 'Prečiarknuté slovo je navyše.',
    has('missing') && 'Na prázdnom mieste chýba slovo.',
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
                <span className="rounded-md bg-error/20 px-1 font-semibold text-error">{part.text}</span>
              ) : part.state === 'extra' ? (
                <s className="text-error decoration-2">{part.text}</s>
              ) : (
                part.text
              )}
            </span>
          ))}
        </p>
      )}
      {notes.length > 0 && <p className="mt-1 text-sm text-ink-muted">{notes.join(' ')}</p>}
      <div className="mt-3 flex gap-2">
        {/* Called without the click event: the lesson's check takes an optional answer as its argument. */}
        <Button variant="secondary" onClick={() => onGiveUp()}>
          Vzdať sa
        </Button>
        {/* preventDefault keeps the focus (and the keyboard) in the answer field. */}
        <Button onPointerDown={(e) => e.preventDefault()} onClick={() => onCheck()} className="flex-1">
          Skontrolovať
        </Button>
      </div>
    </div>
  )
}
