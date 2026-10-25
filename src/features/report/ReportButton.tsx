import { Flag } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../i18n'
import { reportedToday, type ReportSubject } from '../../lib/contentReport'
import { ReportSheet } from './ReportSheet'

interface ReportButtonProps {
  subject: ReportSubject
  /** The learner's wrong answer in a lesson (see ReportSheet). */
  answer?: string | null
  /** icon: round, next to ⭐ in the feedback sheet; text: a quiet line at the end of Detail slova. */
  variant?: 'icon' | 'text'
}

/** Nahlásiť chybu: opens the report sheet; the flag is filled once this device reported the target today. */
export function ReportButton({ subject, answer = null, variant = 'icon' }: ReportButtonProps) {
  const text = useT().report
  const [open, setOpen] = useState(false)
  const [reported, setReported] = useState(() => reportedToday(subject.target))
  const label = reported ? text.reported : text.button
  const flag = <Flag size={variant === 'icon' ? 18 : 16} strokeWidth={1.75} className={reported ? 'fill-current text-brick' : ''} aria-hidden />

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          {flag}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brick"
        >
          {flag}
          {label}
        </button>
      )}
      {open && (
        <ReportSheet
          subject={subject}
          answer={answer}
          onClose={(sent) => {
            setOpen(false)
            if (sent) setReported(true)
          }}
        />
      )}
    </>
  )
}
