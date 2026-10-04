import { useT } from '../../../i18n'
interface ChoiceOptionsProps {
  options: string[]
  selected: string
  onSelect: (option: string) => void
  correctAnswer?: string // set once graded
}

export function ChoiceOptions({ options, selected, onSelect, correctAnswer }: ChoiceOptionsProps) {
  const text = useT().lesson.task
  const graded = correctAnswer !== undefined

  return (
    <div role="radiogroup" aria-label={text.options} className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const isSelected = option === selected
        const style = !graded
          ? isSelected
            ? 'border-brick bg-brick/10 ring-1 ring-brick'
            : 'border-line bg-surface hover:border-ink-muted'
          : option === correctAnswer
            ? 'border-leaf bg-leaf/15'
            : isSelected
              ? 'border-error bg-error/10'
              : 'border-line bg-surface opacity-60'
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={graded}
            onClick={() => onSelect(option)}
            lang="es"
            className={`h-14 rounded-2xl border-2 px-3 font-serif text-xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick ${style}`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
