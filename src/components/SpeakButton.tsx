import { Volume2 } from 'lucide-react'
import { speak, ttsSupported } from '../lib/tts'

interface SpeakButtonProps {
  text: string
  size?: 'md' | 'lg'
}

export function SpeakButton({ text, size = 'md' }: SpeakButtonProps) {
  if (!ttsSupported) return null

  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={`Prehrať výslovnosť: ${text}`}
      title="Prehrať výslovnosť"
      className={[
        'flex shrink-0 items-center justify-center rounded-full transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
        size === 'lg'
          ? 'size-12 bg-surface-2 text-brick hover:bg-line active:scale-95'
          : 'size-11 text-ink-muted hover:text-brick',
      ].join(' ')}
    >
      <Volume2 size={size === 'lg' ? 24 : 18} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
