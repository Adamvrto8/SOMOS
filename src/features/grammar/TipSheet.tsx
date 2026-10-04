import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useT } from '../../i18n'

interface TipSheetProps {
  label: string // the tip's title, for screen readers
  onClose: () => void
  children: ReactNode
}

/** A grammar tip over the lesson: a full-screen page with ✕. The lesson underneath stays as it is. */
export function TipSheet({ label, onClose, children }: TipSheetProps) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const text = useT().grammar

  useEffect(() => {
    closeButton.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="animate-sheet-up fixed inset-0 z-30 overflow-y-auto bg-bg">
      <div className="mx-auto min-h-full max-w-[480px] sm:border-x sm:border-line">
        <header className="sticky top-0 z-10 box-content flex h-14 items-center justify-end bg-bg px-2 pt-[env(safe-area-inset-top)]">
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label={text.close}
            className="flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
          >
            <X size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </header>
        <div className="px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}
