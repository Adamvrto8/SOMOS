import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Badge } from '../../components/Badge'
import { NotFound } from '../../components/NotFound'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { topicById, verbById, wordById } from '../../data'
import type { Word } from '../../data/types'
import { articleFor, GENDER_LABELS, POS_LABELS } from '../../lib/grammar'
import { ConjugationTable } from './ConjugationTable'
import { SaveButton } from './SaveButton'
import { readWordNav, type WordNavState } from './wordNav'

const SWIPE_MIN_PX = 60

/**
 * Word detail. Opened from a list (topic, search, archive), it swipes — or pages with
 * ‹ › and the arrow keys — to the neighbouring words; "back" still returns to the list.
 */
export function WordPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const nav = readWordNav(location.state)
  const list = nav?.wordList ?? []
  const index = list.indexOf(id)
  const prevId = index > 0 ? list[index - 1] : undefined
  const nextId = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined

  // Replace, so paging through words doesn't pile up history entries before the list.
  const go = (targetId: string | undefined, dir: 'next' | 'prev') => {
    if (!targetId) return
    const state: WordNavState = { wordList: list, dir }
    void navigate(`/word/${targetId}`, { replace: true, state })
  }

  // Listened for on the window, not on this page's own element: a short word ends mid-screen
  // and the empty space below it has to swipe too. The header and the tab bar are left out.
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null)
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const inPage = e.target instanceof Element && e.target.closest('main') !== null
      // The finger that just came down (changedTouches), whatever else is resting on the screen.
      const touch = e.changedTouches[0]
      touchStart.current = inPage ? { id: touch.identifier, x: touch.clientX, y: touch.clientY } : null
    }
    const onTouchEnd = (e: TouchEvent) => {
      const start = touchStart.current
      const touch = start && [...e.changedTouches].find((t) => t.identifier === start.id)
      if (!start || !touch) return
      touchStart.current = null
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      // Only a clearly horizontal swipe counts; right-to-left = next word.
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return
      if (dx < 0) go(nextId, 'next')
      else go(prevId, 'prev')
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') go(nextId, 'next')
      if (e.key === 'ArrowLeft') go(prevId, 'prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const word = wordById.get(id)
  if (!word) return <NotFound title="Slovo sa nenašlo" />

  return (
    // pan-y: the page still scrolls vertically, horizontal swipes are ours.
    <div className="touch-pan-y">
      <div className="flex items-center justify-between">
        <BackButton fallback="/search" />
        {index >= 0 && list.length > 1 && (
          <nav aria-label="Slová zo zoznamu" className="-mr-2 flex items-center">
            <PagerButton label="Predchádzajúce slovo" disabled={!prevId} onClick={() => go(prevId, 'prev')}>
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
            </PagerButton>
            <span className="min-w-12 text-center text-sm text-ink-muted tabular-nums">
              {index + 1} / {list.length}
            </span>
            <PagerButton label="Ďalšie slovo" disabled={!nextId} onClick={() => go(nextId, 'next')}>
              <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
            </PagerButton>
          </nav>
        )}
      </div>
      <div key={word.id} className={nav?.dir === 'next' ? 'animate-slide-next' : nav?.dir === 'prev' ? 'animate-slide-prev' : ''}>
        <WordDetail word={word} />
      </div>
    </div>
  )
}

interface PagerButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

function PagerButton({ label, disabled, onClick, children }: PagerButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function WordDetail({ word }: { word: Word }) {
  const verb = word.verbId ? verbById.get(word.verbId) : undefined
  const estar = verbById.get('estar')
  const article = articleFor(word)
  const [primary, ...otherTranslations] = word.sk
  const wordTopics = word.topics.flatMap((t) => topicById.get(t) ?? [])

  return (
    <article className="space-y-8">
      <header className="mt-2">
        <div className="flex items-start justify-between gap-3">
          <h1
            lang="es"
            className={[
              'min-w-0 font-serif leading-tight font-semibold tracking-tight hyphens-auto',
              // Long single words would not fit next to the two buttons at 375px.
              word.es.length > 9 && !word.es.includes(' ') ? 'text-4xl' : 'text-5xl',
            ].join(' ')}
          >
            {article && <span className="text-3xl font-normal text-ink-muted">{article} </span>}
            {word.es}
          </h1>
          <div className="flex gap-2 pt-1.5">
            <SaveButton type="word" id={word.id} />
            <SpeakButton text={article ? `${article} ${word.es}` : word.es} size="lg" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{POS_LABELS[word.pos]}</Badge>
          {word.gender && <Badge>{GENDER_LABELS[word.gender]}</Badge>}
          {verb && !verb.regular && <Badge tone="amber">nepravidelné</Badge>}
          {verb?.reflexive && <Badge>zvratné</Badge>}
          <Badge>{word.level}</Badge>
        </div>

        <p className="mt-4 text-xl">
          {primary}
          {otherTranslations.length > 0 && <span className="text-ink-muted">, {otherTranslations.join(', ')}</span>}
        </p>

        {(word.plural || word.feminine) && (
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
            {word.plural && (
              <div className="flex gap-1.5">
                <dt>množné číslo:</dt>
                <dd lang="es" className="font-serif text-ink">
                  {word.plural}
                </dd>
              </div>
            )}
            {word.feminine && (
              <div className="flex gap-1.5">
                <dt>ženský tvar:</dt>
                <dd lang="es" className="font-serif text-ink">
                  {word.feminine}
                </dd>
              </div>
            )}
          </dl>
        )}
      </header>

      {word.note && (
        <aside aria-label="Poznámka" className="flex gap-3 rounded-card bg-surface-2 p-4 text-sm leading-relaxed">
          <Info size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brick" aria-hidden />
          <p>{word.note}</p>
        </aside>
      )}

      <section aria-labelledby="examples-heading">
        <SectionTitle id="examples-heading">Príklady</SectionTitle>
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {word.examples.map((example) => (
            <li key={example.es} className="flex items-start gap-1 py-3 pr-1 pl-4">
              <div className="min-w-0 flex-1 pt-1">
                <p lang="es" className="font-serif text-lg leading-snug">
                  {example.es}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">{example.sk}</p>
              </div>
              <SpeakButton text={example.es} />
            </li>
          ))}
        </ul>
      </section>

      {verb && estar && <ConjugationTable verb={verb} estar={estar} />}

      {wordTopics.length > 0 && (
        <section aria-labelledby="topics-heading">
          <SectionTitle id="topics-heading">Témy</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {wordTopics.map((topic) => (
              <li key={topic.id}>
                <Link
                  to={`/topic/${topic.id}`}
                  className="flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
                >
                  {topic.sk}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
