import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { getOnboarding, updateOnboarding } from '../../lib/onboarding'
import { firstUnit, isLevelOfferLesson, levelOffer, stepHref, unitSteps, type StepId } from '../../lib/path'
import type { PathUnit } from '../../lib/pathUnits'

/**
 * Over the result of the path's first lesson: all right offers the level above, a weak start the one below
 * (docs/guided-path-spec.md §10c). Decided once, when the result opens; from then on it is never offered again.
 */
export function LevelOffer({ unit, step, firstRound, score, total }: { unit: PathUnit; step: StepId; firstRound: boolean; score: number; total: number }) {
  const text = useT().path
  const navigate = useNavigate()
  const [decided] = useState(() => {
    const onboarding = getOnboarding()
    return isLevelOfferLesson(unit, step, onboarding) ? { offer: levelOffer(unit, step, onboarding, firstRound, score, total) } : undefined
  })
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (decided) updateOnboarding({ levelOffered: true })
  }, [decided])

  const offer = decided?.offer
  if (!offer || !open) return null

  const accept = () => {
    updateOnboarding({ level: offer.level })
    const start = firstUnit()
    if (start) void navigate(stepHref(start, unitSteps(start)[0]), { replace: true })
  }

  const Icon = offer.direction === 'up' ? ArrowUp : ArrowDown
  return (
    <section aria-labelledby="level-offer" className="mb-6 rounded-card border border-brick/40 bg-brick/10 p-5">
      <div className="flex items-start gap-3">
        <Icon size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brick" aria-hidden />
        <div className="min-w-0">
          <h2 id="level-offer" className="font-semibold">
            {offer.direction === 'up' ? text.offerUp(offer.level) : text.offerDown(offer.level)}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{offer.direction === 'up' ? text.offerUpHint : text.offerDownHint}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <Button onClick={accept}>{text.offerYes(offer.level)}</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {text.offerStay(unit.level)}
        </Button>
      </div>
    </section>
  )
}
