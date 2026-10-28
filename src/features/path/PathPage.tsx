import { Award, BookOpen, Check, ChevronDown, Lock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { grammarLabel, nextStep, stepHref, unitTitle, usePathState, type StepState, type UnitState } from '../../lib/path'
import { testHref } from '../tests/testTitle'

const TILE = 'rounded-card border border-line bg-surface'
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

/** ✓ done, the number of the unit to do, a lock for the ones after it. */
function UnitMark({ state, current }: { state: UnitState; current: boolean }) {
  if (state.done)
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf/15 text-leaf">
        <Check size={18} strokeWidth={2.5} aria-hidden />
      </span>
    )
  if (!state.unlocked)
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
        <Lock size={16} strokeWidth={1.75} aria-hidden />
      </span>
    )
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${current ? 'bg-brick text-on-accent' : 'bg-surface-2'}`}
    >
      {state.number}
    </span>
  )
}

function StepRow({ unit, step, next }: { unit: UnitState; step: StepState; next: boolean }) {
  const text = useT().path
  const mark = step.done ? (
    <Check size={16} strokeWidth={2.5} className="text-leaf" aria-hidden />
  ) : step.unlocked ? (
    <span className={`size-2.5 rounded-full ${next ? 'bg-brick' : 'border border-ink-muted'}`} aria-hidden />
  ) : (
    <Lock size={14} strokeWidth={1.75} className="text-ink-muted" aria-hidden />
  )
  const body = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center">{mark}</span>
      <span className={`min-w-0 flex-1 ${next ? 'font-semibold' : ''}`}>{text.steps[step.id]}</span>
    </>
  )
  return (
    <li className="flex items-center gap-2">
      {step.unlocked ? (
        <Link to={stepHref(unit.unit, step.id)} className={`flex min-h-11 flex-1 items-center gap-3 rounded-xl px-2 hover:bg-surface-2 ${FOCUS}`}>
          {body}
        </Link>
      ) : (
        <span aria-disabled="true" className="flex min-h-11 flex-1 items-center gap-3 px-2 text-ink-muted">
          {body}
        </span>
      )}
      {step.id === 'grammar' && (
        <Link
          to={`/practice/grammar/${unit.unit.grammar}`}
          className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-brick hover:bg-surface-2 ${FOCUS}`}
        >
          <BookOpen size={16} strokeWidth={1.75} aria-hidden />
          {text.tip}
        </Link>
      )}
    </li>
  )
}

function UnitCard({ state, current, open, onToggle }: { state: UnitState; current: boolean; open: boolean; onToggle: () => void }) {
  const text = useT().path
  const next = current ? nextStep([state]) : undefined
  const head = (
    <>
      <UnitMark state={state} current={current} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{unitTitle(state.unit)}</span>
        <span className="block truncate text-sm text-ink-muted">{state.unlocked ? grammarLabel(state.unit) : text.locked}</span>
      </span>
    </>
  )
  return (
    <li className={`${TILE} ${current ? 'border-brick/50' : ''}`}>
      {state.unlocked ? (
        <button type="button" onClick={onToggle} aria-expanded={open} className={`flex w-full items-center gap-3 rounded-card p-3 text-left ${FOCUS}`}>
          {head}
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            className={`shrink-0 text-ink-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      ) : (
        <div aria-disabled="true" className="flex items-center gap-3 p-3 opacity-60">
          {head}
        </div>
      )}
      {open && state.unlocked && (
        <div className="border-t border-line px-2 pt-1 pb-2">
          <ol>
            {state.steps.map((step, i) => (
              <StepRow key={step.id} unit={state} step={step} next={next?.index === i} />
            ))}
          </ol>
          {!state.done && <p className="px-2 pt-1 text-xs text-ink-muted">{text.testOpen}</p>}
        </div>
      )}
    </li>
  )
}

/** Cesta: the units of the path level by level, the level and unit to do opened on its steps. */
export function PathPage() {
  const text = useT().path
  const states = usePathState()
  const next = nextStep(states)?.unit.unit
  const current = next?.id
  // Opened or closed by hand; the current unit and its level are open until they are closed.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [levelToggled, setLevelToggled] = useState<Record<string, boolean>>({})
  const levels = [...new Set(states.map((s) => s.unit.level))]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>
        <p className="mt-1 text-ink-muted">{text.intro}</p>
      </header>

      {levels.map((level) => {
        const units = states.filter((s) => s.unit.level === level)
        const done = units.filter((s) => s.done).length
        const levelOpen = levelToggled[level] ?? level === (next?.level ?? levels[levels.length - 1])
        return (
          <section key={level} aria-labelledby={`path-${level}`}>
            <h2>
              <button
                type="button"
                id={`path-${level}`}
                onClick={() => setLevelToggled({ ...levelToggled, [level]: !levelOpen })}
                aria-expanded={levelOpen}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl text-left text-xs font-semibold tracking-widest text-ink-muted uppercase ${FOCUS}`}
              >
                {text.levelProgress(level, done, units.length)}
                <ChevronDown
                  size={18}
                  strokeWidth={1.75}
                  className={`shrink-0 transition-transform duration-150 ${levelOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
            </h2>
            <div
              role="progressbar"
              aria-labelledby={`path-${level}`}
              aria-valuemin={0}
              aria-valuemax={units.length}
              aria-valuenow={done}
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
            >
              <div className="h-full rounded-full bg-brick" style={{ width: `${(done / units.length) * 100}%` }} />
            </div>
            {levelOpen && (
              <ol className="mt-4 space-y-2">
                {units.map((state) => {
                  const id = state.unit.id
                  const open = toggled[id] ?? id === current
                  return <UnitCard key={id} state={state} current={id === current} open={open} onToggle={() => setToggled({ ...toggled, [id]: !open })} />
                })}
                <li>
                  <Link
                    to={testHref({ level })}
                    className={`${TILE} flex items-center gap-3 p-3 transition-colors duration-150 hover:border-ink-muted ${FOCUS}`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-brick">
                      <Award size={18} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{text.exam(level)}</span>
                      <span className="block text-sm text-ink-muted">{text.examHint}</span>
                    </span>
                  </Link>
                </li>
              </ol>
            )}
          </section>
        )
      })}

      {!current && <p className="text-center text-ink-muted">{text.walked}</p>}
    </div>
  )
}
