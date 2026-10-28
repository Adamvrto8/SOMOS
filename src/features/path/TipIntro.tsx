import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { tipById } from '../../data'
import { useT } from '../../i18n'
import { localizedTip } from '../../lib/localized'
import type { PathUnit } from '../../lib/pathUnits'
import { TipContent } from '../grammar/TipContent'

/**
 * The tip of a unit's grammar point, read before its grammar step (docs/guided-path-spec.md §2):
 * the whole tip, the unit's own rules marked, then "Rozumiem, začať".
 */
export function TipIntro({ unit, onDone }: { unit: PathUnit; onDone: () => void }) {
  const text = useT().path
  const navigate = useNavigate()
  const tip = tipById.get(unit.grammar)
  if (!tip) return null
  const rules = localizedTip(tip).rules.filter((r) => unit.rules?.includes(r.id))

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{text.tipLabel}</p>
      {rules.length > 0 && <p className="mt-1 font-medium text-brick">{text.tipToday(rules.map((r) => r.title).join(', '))}</p>}
      <div className="mt-4">
        <TipContent tip={tip} focus={unit.rules} onOpenTip={(id) => void navigate(`/practice/grammar/${id}`)} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto flex max-w-[480px] border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <Button onClick={onDone} className="flex-1">
            {text.tipStart}
          </Button>
        </div>
      </div>
    </div>
  )
}
