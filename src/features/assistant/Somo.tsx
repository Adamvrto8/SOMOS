import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useT } from '../../i18n'
import { describePage } from '../../lib/assistant/page'
import { AssistantChat } from './AssistantChat'
import { isSomoOpen, useSomoAvailable, useSomoHidden } from './somoVisibility'

const OPEN_MS = 420
const CLOSE_MS = 320
const OPEN_EASING = 'cubic-bezier(0.2, 0.9, 0.25, 1)'
const CLOSE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'
/** rounded-t-3xl */
const PANEL_RADIUS = 24

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Where the pill sits inside the panel: the clip that makes the panel look like the pill. */
function bubbleOf(panel: HTMLElement, pill: HTMLElement | null) {
  const box = panel.getBoundingClientRect()
  const rect = pill?.getBoundingClientRect()
  // No pill on screen (the keyboard hides it): a pill-sized bubble at its usual corner.
  const width = rect?.width || 96
  const height = rect?.height || 44
  const left = rect && rect.width ? rect.left - box.left : box.width - 16 - width
  const top = rect && rect.height ? rect.top - box.top : box.height - 16 - height
  const clip = `inset(${top}px ${box.width - left - width}px ${box.height - top - height}px ${left}px round ${height / 2}px)`
  return { clip, left, top, width, height }
}

const FULL = `inset(0px 0px 0px 0px round ${PANEL_RADIUS}px ${PANEL_RADIUS}px 0px 0px)`

interface SomoSheetProps {
  page: string
  closing: boolean
  pill: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onClosed: () => void
}

/**
 * SOMO over the screen the learner is on, under the app header: it grows out of the pill and shrinks back into it.
 * ✕, Escape, a tap outside or Back closes it.
 */
function SomoSheet({ page, closing, pill, onClose, onClosed }: SomoSheetProps) {
  const text = useT().assistant
  const panel = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  // The latest callback, without restarting the animation when it changes.
  const closedRef = useRef(onClosed)
  useLayoutEffect(() => {
    closedRef.current = onClosed
  })

  useEffect(() => {
    // The page underneath does not scroll along with the conversation.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  // Open: from the pill to the whole panel. Closing: the same way back, then the sheet is gone.
  useLayoutEffect(() => {
    const el = panel.current
    if (!el || !bubble.current || !label.current || !content.current || !backdrop.current) return
    const still = reducedMotion() || typeof el.animate !== 'function'
    if (still) {
      if (closing) closedRef.current()
      else closeButton.current?.focus()
      return
    }

    const shape = bubbleOf(el, pill.current)
    Object.assign(label.current.style, { left: `${shape.left}px`, top: `${shape.top}px`, width: `${shape.width}px`, height: `${shape.height}px` })

    const duration = closing ? CLOSE_MS : OPEN_MS
    const easing = closing ? CLOSE_EASING : OPEN_EASING
    // Closing plays the opening backwards: the frames reversed, their offsets mirrored.
    const backwards = (frames: Keyframe[]) =>
      [...frames].reverse().map((frame) => (frame.offset == null ? frame : { ...frame, offset: 1 - frame.offset }))
    const run = (target: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions = {}) =>
      target.animate(closing ? backwards(frames) : frames, { duration, easing, fill: 'both', ...options })

    const animations = [
      run(el, [{ clipPath: shape.clip }, { clipPath: FULL }]),
      // The pill's colour gives way to the sheet early on the way out, and comes back late on the way in.
      run(bubble.current, [{ opacity: 1 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], { easing: 'linear' }),
      run(content.current, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 0, offset: 0.3 }, { opacity: 1, transform: 'none' }], {
        easing: 'linear',
      }),
      run(backdrop.current, [{ opacity: 0 }, { opacity: 1 }], { easing: 'linear' }),
    ]
    let cancelled = false
    void animations[0].finished.then(
      () => {
        if (cancelled) return
        if (closing) closedRef.current()
        else closeButton.current?.focus({ preventScroll: true })
      },
      () => {},
    )
    return () => {
      cancelled = true
      animations.forEach((animation) => animation.cancel())
    }
  }, [closing, pill])

  useEffect(() => {
    if (closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, closing])

  // Under the app header (h-14 + safe area), with a little air so the logo stays clear.
  const top = 'top-[calc(3.5rem+0.5rem+env(safe-area-inset-top))]'
  return (
    <div role="dialog" aria-modal="true" aria-label={text.title} className={`fixed inset-x-0 bottom-0 z-30 ${top} ${closing ? 'pointer-events-none' : ''}`}>
      {/* A tap outside closes it; keyboard users have Escape and ✕. The header above stays clear. */}
      <div
        ref={backdrop}
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-x-0 bottom-0 top-[calc(3.5rem+1px+env(safe-area-inset-top))] bg-ink/40"
      />
      <div
        ref={panel}
        className="absolute inset-0 mx-auto flex max-w-[480px] flex-col rounded-t-3xl border-t border-line bg-bg px-4 shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.35)] sm:border-x"
      >
        <div ref={content} className="flex min-h-0 flex-1 flex-col">
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
        {/* The pill the sheet grows out of: its colour and its name, faded away as the sheet opens. */}
        <div ref={bubble} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brick opacity-0">
          <span
            ref={label}
            className="absolute flex items-center justify-center text-sm font-semibold tracking-[0.08em] text-on-accent"
          >
            SOMO
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * The "SOMO" pill above the tab bar on every screen of the app layout (lessons, tests, review and duels have no tab bar
 * and so no pill) and the sheet it opens. Opening pushes the same address with `somo` in its state, so Android's Back
 * closes the sheet, and a link in an answer leaves it for that page. The sheet stays a moment after the state is gone,
 * to shrink back into the pill.
 */
export function Somo() {
  const text = useT().assistant
  const available = useSomoAvailable()
  const hidden = useSomoHidden()
  const location = useLocation()
  const navigate = useNavigate()
  const open = isSomoOpen(location.state)
  const [shown, setShown] = useState(open)
  const pill = useRef<HTMLButtonElement>(null)
  if (open && !shown) setShown(true)

  if (!available) return null

  const { pathname, search, hash } = location
  const state = (typeof location.state === 'object' && location.state) || {}
  const openSheet = () => navigate({ pathname, search, hash }, { state: { ...state, somo: true }, preventScrollReset: true })
  const close = () => {
    // Opened in this session: step back. Opened from a reloaded or shared entry: just drop the flag.
    if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1)
    else navigate({ pathname, search, hash }, { replace: true, state: { ...state, somo: undefined }, preventScrollReset: true })
  }
  const closed = () => {
    setShown(false)
    pill.current?.focus({ preventScroll: true })
  }

  return (
    <>
      {/* Hidden while the phone keyboard is open, like the tab bar under it; under the sheet while it is open. */}
      {!hidden && (
        <div inert={shown} className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 keyboard:hidden">
          <div className="mx-auto flex max-w-[480px] justify-end px-4">
            <button
              ref={pill}
              type="button"
              onClick={openSheet}
              aria-label={text.open}
              className="pointer-events-auto h-11 rounded-full bg-brick px-5 text-sm font-semibold tracking-[0.08em] text-on-accent shadow-[0_6px_20px_-6px_var(--brick)] transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick motion-safe:animate-fade-in"
            >
              SOMO
            </button>
          </div>
        </div>
      )}
      {shown && <SomoSheet page={describePage(pathname, search)} closing={!open} pill={pill} onClose={close} onClosed={closed} />}
    </>
  )
}
