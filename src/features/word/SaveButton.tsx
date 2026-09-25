import { Star } from 'lucide-react'
import { useState } from 'react'
import { toggleSaved, useIsSaved, type StarType } from '../../lib/archive'

interface SaveButtonProps {
  type: StarType
  id: string
  // lg: round icon button (word detail); md: plain icon (lists); pill: labelled (exercise feedback)
  size?: 'lg' | 'md' | 'pill'
}

/** ⭐ toggle: saves a word or sentence to the archive (and to spaced repetition). */
export function SaveButton({ type, id, size = 'lg' }: SaveButtonProps) {
  const saved = useIsSaved(type, id)
  const [popping, setPopping] = useState(false)

  const toggle = async () => {
    const nowSaved = await toggleSaved(type, id)
    setPopping(nowSaved)
  }

  const label = saved ? 'Odstrániť z archívu' : 'Uložiť do archívu'

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={saved === undefined}
      aria-pressed={saved ?? false}
      aria-label={label}
      title={label}
      className={[
        'flex shrink-0 items-center justify-center rounded-full transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
        size === 'lg' && `size-12 bg-surface-2 hover:bg-line ${saved ? 'text-amber' : 'text-ink-muted'}`,
        size === 'md' && `size-11 hover:bg-surface-2 ${saved ? 'text-amber' : 'text-ink-muted'}`,
        size === 'pill' && 'h-11 gap-1.5 border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-2',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Star
        size={size === 'lg' ? 24 : size === 'md' ? 20 : 18}
        strokeWidth={1.75}
        className={[saved ? 'fill-amber text-amber' : size === 'pill' ? 'text-ink-muted' : '', popping ? 'animate-pop' : ''].join(' ')}
        onAnimationEnd={() => setPopping(false)}
        aria-hidden
      />
      {size === 'pill' && (saved ? 'Uložené' : 'Uložiť')}
    </button>
  )
}
