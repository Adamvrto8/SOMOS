import { ArrowRight, Check } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { grammarLabel, nextStep, stepHref, unitTitle, type UnitState } from '../../lib/path'
import { unitMaterial } from '../../lib/pathUnits'

/**
 * The end of a unit, on the result of its passed test: a short celebration, what the unit brought
 * (words, the grammar point) and the way on to the next unit (docs/guided-path-spec.md §5).
 */
export function UnitDone({ unit, states }: { unit: UnitState; states: readonly UnitState[] }) {
  const text = useT().path
  const navigate = useNavigate()
  const next = nextStep(states)
  const words = unitMaterial(unit.unit).words.length

  return (
    <section aria-labelledby="unit-done" className="rounded-card border border-leaf/40 bg-leaf/10 px-5 pt-6 pb-5 text-center">
      <span className="mx-auto flex size-16 animate-sun-rise items-center justify-center rounded-full bg-leaf text-on-accent shadow-lg">
        <Check size={34} strokeWidth={2.5} aria-hidden />
      </span>
      <p lang="es" className="mt-3 animate-rise-in font-serif text-2xl font-semibold tracking-tight [animation-delay:200ms]">
        ¡Unidad completada!
      </p>
      <h2 id="unit-done" className="mt-0.5 animate-rise-in text-ink-muted [animation-delay:300ms]">
        {text.unitDone(unit.number)} · {unitTitle(unit.unit)}
      </h2>
      <ul className="mt-3 flex animate-rise-in flex-wrap justify-center gap-2 text-sm [animation-delay:400ms]">
        {words > 0 && <li className="rounded-full bg-surface px-3 py-1 font-medium">{text.unitWords(words)}</li>}
        <li className="rounded-full bg-surface px-3 py-1 font-medium">{grammarLabel(unit.unit)}</li>
      </ul>
      {next && next.unit !== unit && (
        <Button
          icon={ArrowRight}
          onClick={() =>
            void navigate(stepHref(next.unit.unit, next.step.id), {
              replace: true,
            })
          }
          className="mt-5 w-full"
        >
          {text.nextUnit(unitTitle(next.unit.unit))}
        </Button>
      )}
    </section>
  )
}
