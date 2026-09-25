import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'danger-solid'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brick text-on-accent hover:brightness-110',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  danger: 'border border-error/40 bg-surface text-error hover:bg-error/10',
  'danger-solid': 'bg-error text-on-accent',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: LucideIcon
}

export function Button({ variant = 'primary', icon: Icon, className = '', type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {Icon && <Icon size={18} strokeWidth={1.75} aria-hidden />}
      {children}
    </button>
  )
}
