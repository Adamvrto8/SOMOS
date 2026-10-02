// The phone keyboard. index.html asks Chrome on Android to shrink the page when the keyboard opens
// (viewport meta: interactive-widget=resizes-content) instead of laying the keyboard over it. Bars
// fixed to the bottom of the screen then ride on top of the keyboard and drop back when it closes.
//
// What should not ride on the keyboard (the tab bar) hides while it is open: <html data-keyboard>,
// the `keyboard:` variant in index.css.

/** A keyboard takes far more of the screen than a browser toolbar sliding in (about 56px). */
const MIN_KEYBOARD_HEIGHT = 150

/** The page is clearly shorter than it has been at this width, and something is being typed into. */
export function isKeyboardOpen(height: number, tallest: number, typing: boolean): boolean {
  return typing && tallest - height >= MIN_KEYBOARD_HEIGHT
}

const isTyping = () => {
  const el = document.activeElement
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'button', 'range'].includes(el.type))
}

/** Keeps <html data-keyboard> in step with the keyboard. Called once at start. */
export function watchKeyboard(): void {
  let width = window.innerWidth
  let tallest = window.innerHeight

  const update = () => {
    // Rotated (or a desktop window resized sideways): heights before that say nothing any more.
    if (window.innerWidth !== width) {
      width = window.innerWidth
      tallest = window.innerHeight
    }
    tallest = Math.max(tallest, window.innerHeight)
    document.documentElement.toggleAttribute('data-keyboard', isKeyboardOpen(window.innerHeight, tallest, isTyping()))
  }

  window.addEventListener('resize', update)
  document.addEventListener('focusin', update)
  document.addEventListener('focusout', update)
}
