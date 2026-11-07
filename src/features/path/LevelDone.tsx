import { ArrowRight, Award } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import type { Level } from '../../data/types'
import { useT } from '../../i18n'
import { levelSummary, nextStep, stepHref, unitTitle, type UnitState } from '../../lib/path'

/**
 * The end of a level, on the result of the test that closed it: a bigger celebration than a unit's,
 * what the level brought and the way on (docs/guided-path-spec.md §10c).
 */
export function LevelDone({ level, states }: { level: Level; states: readonly UnitState[] }) {
  const text = useT().path
  const navigate = useNavigate()
  const next = nextStep(states)
  const { units, words, grammar } = levelSummary(level)

  return (
    <section aria-labelledby="level-done" className="rounded-card border border-leaf/40 bg-leaf/10 px-5 pt-7 pb-5 text-center">
      <span className="mx-auto flex size-20 animate-sun-rise items-center justify-center rounded-full bg-leaf text-on-accent shadow-lg">
        <Award size={40} strokeWidth={1.75} aria-hidden />
      </span>
      <p lang="es" className="mt-4 animate-rise-in font-serif text-3xl font-semibold tracking-tight [animation-delay:200ms]">
        ¡Nivel {level} completado!
      </p>
      <h2 id="level-done" className="mt-1 animate-rise-in text-ink-muted [animation-delay:300ms]">
        {text.levelDoneLine(level)}
      </h2>
      <ul className="mt-3 flex animate-rise-in flex-wrap justify-center gap-2 text-sm [animation-delay:400ms]">
        <li className="rounded-full bg-surface px-3 py-1 font-medium">{text.levelUnits(units)}</li>
        {words > 0 && <li className="rounded-full bg-surface px-3 py-1 font-medium">{text.unitWords(words)}</li>}
        <li className="rounded-full bg-surface px-3 py-1 font-medium">{text.levelGrammar(grammar)}</li>
      </ul>
      {next ? (
        <Button icon={ArrowRight} onClick={() => void navigate(stepHref(next.unit.unit, next.step.id), { replace: true })} className="mt-5 w-full">
          {text.nextUnit(`${next.unit.unit.level} · ${unitTitle(next.unit.unit)}`)}
        </Button>
      ) : (
        <p className="mt-5 font-medium">{text.walked}</p>
      )}
    </section>
  )
}
