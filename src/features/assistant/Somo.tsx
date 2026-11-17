import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useT } from '../../i18n'
import { describePage } from '../../lib/assistant/page'
import { AssistantChat } from './AssistantChat'
import { isSomoOpen, useSomoAvailable, useSomoHidden } from './somoVisibility'

/** SOMO over the screen the learner is on: the page stays underneath, ✕, Escape, a tap outside or Back closes it. */
function SomoSheet({ page, onClose }: { page: string; onClose: () => void }) {
  const text = useT().assistant
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
    // The page underneath does not scroll along with the conversation.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label={text.title} className="fixed inset-0 z-30">
      {/* A tap outside closes it; keyboard users have Escape and ✕. */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40 motion-safe:animate-fade-in" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[92dvh] max-w-[480px] animate-sheet-up flex-col rounded-t-3xl border-t border-line bg-bg px-4 shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.35)] sm:border-x">
        <header className="flex shrink-0 items-center justify-between pt-3">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">{text.title}</h2>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label={text.close}
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
          >
            <X size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </header>
        <AssistantChat page={page} />
      </div>
    </div>
  )
}

/**
 * The "SOMO" pill above the tab bar on every screen of the app layout (lessons, tests, review and duels have no tab bar
 * and so no pill) and the sheet it opens. Opening pushes the same address with `somo` in its state, so Android's Back
 * closes the sheet, and a link in an answer leaves it for that page.
 */
export function Somo() {
  const text = useT().assistant
  const available = useSomoAvailable()
  const hidden = useSomoHidden()
  const location = useLocation()
  const navigate = useNavigate()
  const open = isSomoOpen(location.state)

  if (!available) return null

  const { pathname, search, hash } = location
  const state = (typeof location.state === 'object' && location.state) || {}
  const openSheet = () => navigate({ pathname, search, hash }, { state: { ...state, somo: true }, preventScrollReset: true })
  const close = () => {
    // Opened in this session: step back. Opened from a reloaded or shared entry: just drop the flag.
    if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1)
    else navigate({ pathname, search, hash }, { replace: true, state: { ...state, somo: undefined }, preventScrollReset: true })
  }

  if (open) return <SomoSheet page={describePage(pathname, search)} onClose={close} />
  if (hidden) return null
  return (
    // Hidden while the phone keyboard is open, like the tab bar under it.
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 keyboard:hidden">
      <div className="mx-auto flex max-w-[480px] justify-end px-4">
        <button
          type="button"
          onClick={openSheet}
          aria-label={text.open}
          className="pointer-events-auto h-11 rounded-full bg-brick px-5 text-sm font-semibold tracking-[0.08em] text-on-accent shadow-[0_6px_20px_-6px_var(--brick)] transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick motion-safe:animate-fade-in"
        >
          SOMO
        </button>
      </div>
    </div>
  )
}
