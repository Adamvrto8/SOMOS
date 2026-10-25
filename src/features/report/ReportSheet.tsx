import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { buildReport, markReported, REPORT_REASONS, sendReport, type ReportReason, type ReportSubject } from '../../lib/contentReport'

interface ReportSheetProps {
  subject: ReportSubject
  /** The learner's wrong answer in a lesson: offers "Moja odpoveď mala byť uznaná". */
  answer: string | null
  onClose: (sent: boolean) => void
}

/** How long the thanks stay before the sheet closes by itself. */
const THANKS_MS = 1200

/** "Čo je zle?": a reason, an optional note, Odoslať. A failure keeps both for another try. */
export function ReportSheet({ subject, answer, onClose }: ReportSheetProps) {
  const text = useT().report
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'too-many'>('idle')
  const reasons = REPORT_REASONS.filter((r) => r !== 'answer' || answer)
  const closeLater = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(closeLater.current), [])

  const send = async () => {
    if (!reason) return
    setState('sending')
    const result = await sendReport(buildReport(subject, reason, note, answer))
    if (result !== 'sent') return setState(result)
    markReported(subject.target)
    setState('sent')
    closeLater.current = window.setTimeout(() => onClose(true), THANKS_MS)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end">
      {/* The dimmed page behind: a tap there cancels (Zrušiť below does the same for keyboards and screen readers). */}
      <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 bg-ink/30" onClick={() => onClose(state === 'sent')} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="relative mx-auto w-full max-w-[480px] animate-sheet-up rounded-t-3xl border-t border-line bg-surface px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.08)]"
      >
        {state === 'sent' ? (
          <p id="report-title" role="status" className="py-6 text-center text-lg font-semibold">
            {text.thanks}
          </p>
        ) : (
          <>
            <h2 id="report-title" className="text-lg font-semibold">
              {text.title}
            </h2>
            <p lang="es" className="mt-0.5 truncate text-sm text-ink-muted">
              {subject.shown.es}
            </p>
            <fieldset className="mt-3">
              <legend className="sr-only">{text.title}</legend>
              {reasons.map((r) => (
                <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                  <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-5 shrink-0 accent-brick" />
                  <span>{text.reasons[r]}</span>
                </label>
              ))}
            </fieldset>
            <label htmlFor="report-note" className="mt-3 block px-1 text-sm text-ink-muted">
              {text.noteLabel}
            </label>
            <textarea
              id="report-note"
              value={note}
              maxLength={500}
              rows={2}
              placeholder={text.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-brick"
            />
            {(state === 'failed' || state === 'too-many') && (
              <p role="alert" className="mt-1 px-1 text-sm text-error">
                {state === 'failed' ? text.failed : text.tooMany}
              </p>
            )}
            <p className="mt-1 px-1 text-xs text-ink-muted">{text.privacy}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => onClose(false)}>
                {text.cancel}
              </Button>
              <Button onClick={() => void send()} disabled={!reason || state === 'sending'}>
                {state === 'sending' ? text.sending : text.send}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
