import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { checkDiary } from '../../lib/diaryCheck'

interface DiaryCheckProps {
  text: string // the Spanish field, a moment after typing stopped
  customEs: readonly string[] // the learner's own words (Moje slová)
}

/** The Spanish text again, unknown words underlined; a tap says why and offers the word it may be. */
export function DiaryCheck({ text, customEs }: DiaryCheckProps) {
  const dictionary = useT()
  const t = dictionary.diary
  const segments = useMemo(() => checkDiary(text, customEs), [text, customEs])
  const [picked, setPicked] = useState<{ word: string; suggestions: string[] } | null>(null)
  // A pick that is no longer in the text (edited away) is not explained any more.
  const shown = picked && segments.some((s) => 'word' in s && !s.known && s.text === picked.word) ? picked : null

  return (
    <section aria-labelledby="diary-check" className="space-y-2">
      <h2 id="diary-check" className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
        {t.check}
      </h2>
      {text.trim() ? (
        <>
          <p lang="es" className="rounded-card border border-line bg-surface p-4 font-serif text-lg leading-relaxed whitespace-pre-wrap">
            {segments.map((s, i) => {
              if (!('word' in s)) return s.text
              if (!s.known)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPicked({ word: s.text, suggestions: s.suggestions })}
                    className="rounded-sm underline decoration-amber decoration-wavy decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-brick"
                  >
                    {s.text}
                  </button>
                )
              if (s.href)
                return (
                  <Link key={i} to={s.href} className="rounded-sm hover:text-brick focus-visible:outline-2 focus-visible:outline-brick">
                    {s.text}
                  </Link>
                )
              return s.text
            })}
          </p>
          <div role="status" className="text-sm text-ink-muted">
            {shown ? (
              <>
                {t.unknown(shown.word)}
                {shown.suggestions.length > 0 && (
                  <>
                    {' '}
                    <span lang="es" className="font-medium text-ink">
                      {t.maybe(shown.suggestions.join(', '))}
                    </span>
                  </>
                )}
              </>
            ) : (
              t.checkHint
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-muted">{t.checkEmpty}</p>
      )}
    </section>
  )
}
