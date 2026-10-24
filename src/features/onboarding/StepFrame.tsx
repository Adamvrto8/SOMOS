import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../../i18n'

interface StepFrameProps {
  /** 1-based position among the question steps, for the progress bar. */
  position: number
  count: number
  onBack: () => void
  onSkip?: () => void
  title: string
  hint?: string
  children: ReactNode
  /** The buttons at the bottom, above the safe area. */
  footer: ReactNode
}

/** One step of the welcome: back, progress and skip on top, one question, the buttons at the bottom. */
export function StepFrame({ position, count, onBack, onSkip, title, hint, children, footer }: StepFrameProps) {
  const dictionary = useT()
  const text = dictionary.onboarding
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 box-content flex h-14 items-center gap-2 bg-bg px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onBack}
          aria-label={dictionary.common.back}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
        >
          <ArrowLeft size={22} strokeWidth={1.75} aria-hidden />
        </button>
        <div
          role="progressbar"
          aria-label={text.progress}
          aria-valuemin={0}
          aria-valuemax={count}
          aria-valuenow={position}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-brick transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(position / count) * 100}%` }} />
        </div>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="h-11 shrink-0 rounded-full px-3 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
          >
            {text.skip}
          </button>
        ) : (
          <span className="w-11 shrink-0" />
        )}
      </header>

      <main className="px-4 pt-6 pb-44">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        {hint && <p className="mt-2 text-ink-muted">{hint}</p>}
        <div className="mt-6">{children}</div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto flex max-w-[480px] flex-col gap-3 border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:border-x">
          {footer}
        </div>
      </div>
    </div>
  )
}
