import { Volume2 } from 'lucide-react'
import { useT } from '../i18n'
import { speak, ttsSupported } from '../lib/tts'

interface SpeakButtonProps {
  text: string
  size?: 'sm' | 'md' | 'lg'
}

export function SpeakButton({ text: spoken, size = 'md' }: SpeakButtonProps) {
  const text = useT().common
  if (!ttsSupported) return null

  return (
    <button
      type="button"
      onClick={() => speak(spoken)}
      aria-label={`${text.playPronunciation}: ${spoken}`}
      title={text.playPronunciation}
      className={[
        'flex shrink-0 items-center justify-center rounded-full transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
        size === 'lg'
          ? 'size-12 bg-surface-2 text-brick hover:bg-line active:scale-95'
          : size === 'sm'
            ? 'size-7 text-ink-muted hover:text-brick active:scale-95'
            : 'size-11 text-ink-muted hover:text-brick',
      ].join(' ')}
    >
      <Volume2 size={size === 'lg' ? 24 : size === 'sm' ? 14 : 18} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
