import { Volume2 } from 'lucide-react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import { setPreferredVoice, speak, ttsSupported, useVoices } from '../../lib/tts'

const SAMPLE = '¡Hola! ¿Cómo estás?'

export function VoiceSettings() {
  const { voices, preferredURI } = useVoices()
  const selected = voices.some((v) => v.voiceURI === preferredURI) ? preferredURI : null
  const auto = voices[0]
  const text = useT().settings.voice

  return (
    <section aria-labelledby="voice-heading">
      <SectionTitle id="voice-heading">{text.title}</SectionTitle>

      {!ttsSupported ? (
        <p className="text-sm text-ink-muted">{text.unsupported}</p>
      ) : voices.length === 0 ? (
        <NoVoiceHelp />
      ) : (
        <fieldset className="divide-y divide-line rounded-card border border-line bg-surface">
          <legend className="sr-only">{text.legend}</legend>
          <VoiceOption
            checked={selected === null}
            onSelect={() => setPreferredVoice(null)}
            title={text.auto}
            detail={auto ? `${auto.name} · ${auto.lang}` : ''}
          />
          {voices.map((voice) => (
            <VoiceOption
              key={voice.voiceURI}
              checked={selected === voice.voiceURI}
              onSelect={() => setPreferredVoice(voice.voiceURI)}
              title={voice.name}
              detail={`${voice.lang} · ${voice.localService ? text.offline : text.online}`}
            />
          ))}
        </fieldset>
      )}

      {ttsSupported && (
        <Button variant="secondary" icon={Volume2} onClick={() => speak(SAMPLE)} className="mt-3 w-full">
          {text.tryIt}
        </Button>
      )}
    </section>
  )
}

interface VoiceOptionProps {
  checked: boolean
  onSelect: () => void
  title: string
  detail: string
}

function VoiceOption({ checked, onSelect, title, detail }: VoiceOptionProps) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
      <input type="radio" name="voice" checked={checked} onChange={onSelect} className="size-5 shrink-0 accent-brick" />
      <span className="min-w-0">
        <span className="block leading-snug">{title}</span>
        {detail && <span className="block text-sm text-ink-muted">{detail}</span>}
      </span>
    </label>
  )
}

function NoVoiceHelp() {
  const text = useT().settings.voice
  return (
    <div className="rounded-card bg-surface-2 p-4 text-sm leading-relaxed">
      <p className="font-medium">{text.none}</p>
      <p className="mt-2 text-ink-muted">{text.installIntro}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-muted">
        {text.installSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}
