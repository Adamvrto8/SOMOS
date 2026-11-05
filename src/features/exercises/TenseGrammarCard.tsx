import { BookOpen, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { tipById } from '../../data'
import { useT } from '../../i18n'
import { TENSE_LABELS, type TableTense } from '../../lib/conjugate'
import { localizedTip } from '../../lib/localized'
import { tipIdOfTense } from '../../lib/tips'
import { TipContent } from '../grammar/TipContent'
import { TipSheet } from '../grammar/TipSheet'

/** Above a tense's lessons: its grammar (what it is, when it is used, how it is formed), opened over the page. */
export function TenseGrammarCard({ tense }: { tense: TableTense }) {
  const text = useT().practice
  const location = useLocation()
  const navigate = useNavigate()
  const [openTip, setOpenTip] = useState<string | null>(null)
  const tip = tipById.get(tipIdOfTense(tense))
  if (!tip) return null

  // A history entry of its own, so the phone's back button closes the sheet, not the page (as "Prečo?" in a lesson).
  const sheetInHistory = (location.state as { tip?: true } | null)?.tip === true
  const shownTip = sheetInHistory && openTip ? tipById.get(openTip) : undefined
  const open = () => {
    setOpenTip(tip.id)
    void navigate({ search: location.search }, { state: { tip: true } })
  }
  const close = () => {
    setOpenTip(null)
    void navigate(-1)
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="mt-3 flex w-full items-center gap-3 rounded-card border border-line bg-surface p-3 text-left transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber/20 text-ink">
          <BookOpen size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{text.tenseGrammar(TENSE_LABELS[tense])}</span>
          <span className="block text-xs text-ink-muted">{text.tenseGrammarHint}</span>
        </span>
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
      </button>

      {shownTip && (
        <TipSheet key={shownTip.id} label={localizedTip(shownTip).title} onClose={close}>
          <TipContent tip={shownTip} onOpenTip={setOpenTip} />
        </TipSheet>
      )}
    </>
  )
}
