import { Star } from 'lucide-react'
import { useState } from 'react'
import { toggleSavedWord, useIsSaved } from '../../lib/archive'

interface SaveButtonProps {
  wordId: string
}

export function SaveButton({ wordId }: SaveButtonProps) {
  const saved = useIsSaved(wordId)
  const [popping, setPopping] = useState(false)

  const toggle = async () => {
    const nowSaved = await toggleSavedWord(wordId)
    setPopping(nowSaved)
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={saved === undefined}
      aria-pressed={saved ?? false}
      aria-label={saved ? 'Odstrániť z archívu' : 'Uložiť do archívu'}
      title={saved ? 'Odstrániť z archívu' : 'Uložiť do archívu'}
      className={[
        'flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 transition-colors duration-150',
        'hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
        saved ? 'text-amber' : 'text-ink-muted',
      ].join(' ')}
    >
      <Star
        size={24}
        strokeWidth={1.75}
        className={[saved ? 'fill-amber' : '', popping ? 'animate-pop' : ''].join(' ')}
        onAnimationEnd={() => setPopping(false)}
        aria-hidden
      />
    </button>
  )
}
