import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface Choice<T extends string> {
  id: T
  label: ReactNode
  detail?: ReactNode
}

interface ChoiceListProps<T extends string> {
  name: string // groups the radios
  legend: string // read out, not shown: the page title already says it
  options: Choice<T>[]
  value: T
  onChange: (value: T) => void
}

interface SwitchRowProps {
  label: string
  detail?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** An on / off setting as a row of a card, with a switch at the right edge. */
export function SwitchRow({ label, detail, checked, disabled, onChange }: SwitchRowProps) {
  return (
    <label
      className={`relative flex min-h-14 items-center gap-3 px-4 py-2.5 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-brick ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block leading-snug">{label}</span>
        {detail && <span className="block text-sm text-ink-muted">{detail}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        // Invisible over the whole row: a tap anywhere on it is a tap on the switch.
        className="peer absolute inset-0 size-full cursor-[inherit] appearance-none opacity-0"
      />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-ink-muted/35 transition-colors duration-150 peer-checked:bg-brick peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform after:duration-150 peer-checked:after:translate-x-5"
      />
    </label>
  )
}

/** A setting's options as rows of one card, the picked one with ✓ (native radios: arrows, screen readers). */
export function ChoiceList<T extends string>({ name, legend, options, value, onChange }: ChoiceListProps<T>) {
  return (
    <fieldset className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const checked = option.id === value
        return (
          <label
            key={option.id}
            className="relative flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2/60 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-brick active:bg-surface-2"
          >
            {/* Invisible over the whole row, as with the switch. */}
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(option.id)}
              className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
            />
            <span className="min-w-0 flex-1">
              <span className={`block leading-snug ${checked ? 'font-medium' : ''}`}>{option.label}</span>
              {option.detail && <span className="block text-sm text-ink-muted">{option.detail}</span>}
            </span>
            <Check size={20} strokeWidth={2.25} className={`shrink-0 text-brick ${checked ? '' : 'invisible'}`} aria-hidden />
          </label>
        )
      })}
    </fieldset>
  )
}
