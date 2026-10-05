import { useEffect, useRef } from 'react'

// Paging through a list one detail at a time (the words of a list, the topics): a swipe and
// the arrow keys turn the page here, the ‹ n / N › buttons are components/Pager.

export type TurnDirection = 'next' | 'prev'

const SWIPE_MIN_PX = 60

/**
 * Inside a bar that scrolls sideways (the tense tabs of a verb): a horizontal drag there
 * scrolls the bar and must not turn the page, also once the bar has reached its end.
 */
function inSidewaysScroller(target: Element): boolean {
  for (let el: Element | null = target; el && el.tagName !== 'MAIN'; el = el.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(el).overflowX)) return true
  }
  return false
}

/** Turns the page on a horizontal swipe and on the arrow keys. The page itself needs `touch-pan-y`. */
export function usePageTurn(turn: (dir: TurnDirection) => void): void {
  // Listened for on the window, not on the page's own element: a short page ends mid-screen
  // and the empty space below it has to swipe too. The header, the tab bar and bars that
  // scroll sideways are left out.
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null)
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const turnsPage = e.target instanceof Element && e.target.closest('main') !== null && !inSidewaysScroller(e.target)
      // The finger that just came down (changedTouches), whatever else is resting on the screen.
      const touch = e.changedTouches[0]
      touchStart.current = turnsPage ? { id: touch.identifier, x: touch.clientX, y: touch.clientY } : null
    }
    // A sideways drag is ours. Left to Chrome, a quick one starts a fling that scrolls nothing
    // and swallows the tap that follows it within the next second.
    const onTouchMove = (e: TouchEvent) => {
      const start = touchStart.current
      const touch = start && [...e.changedTouches].find((t) => t.identifier === start.id)
      if (!start || !touch || !e.cancelable) return
      if (Math.abs(touch.clientX - start.x) > Math.abs(touch.clientY - start.y)) e.preventDefault()
    }
    const onTouchEnd = (e: TouchEvent) => {
      const start = touchStart.current
      const touch = start && [...e.changedTouches].find((t) => t.identifier === start.id)
      if (!start || !touch) return
      touchStart.current = null
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      // Only a clearly horizontal swipe counts; right-to-left = next.
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return
      turn(dx < 0 ? 'next' : 'prev')
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') turn('next')
      if (e.key === 'ArrowLeft') turn('prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}

/** The slide-in of a page that was turned to. */
export const slideClass = (dir: TurnDirection | undefined) => (dir === 'next' ? 'animate-slide-next' : dir === 'prev' ? 'animate-slide-prev' : '')
