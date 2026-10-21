import { Volume2 } from 'lucide-react'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { setPreferredVoice, speak, ttsSupported, useVoices } from '../../lib/tts'
import { ChoiceList } from './ChoiceList'
import { SettingsHint, SettingsSubpage } from './SettingsSubpage'

const SAMPLE = '¡Hola! ¿Cómo estás?'
/** The choice that leaves the voice to the app: the best Mexican one there is. */
const AUTO = 'auto'

/** Nastavenia → Výslovnosť: which Spanish voice of the phone reads the words. */
export function VoiceSettings() {
  const { voices, preferredURI } = useVoices()
  const selected = voices.some((v) => v.voiceURI === preferredURI) && preferredURI ? preferredURI : AUTO
  const auto = voices[0]
  const text = useT().settings.voice

  return (
    <SettingsSubpage title={text.title}>
      {!ttsSupported ? (
        <SettingsHint>{text.unsupported}</SettingsHint>
      ) : voices.length === 0 ? (
        <NoVoiceHelp />
      ) : (
        <ChoiceList
          name="voice"
          legend={text.legend}
          value={selected}
          onChange={(uri) => setPreferredVoice(uri === AUTO ? null : uri)}
          options={[
            { id: AUTO, label: text.auto, detail: auto ? `${auto.name} · ${auto.lang}` : undefined },
            ...voices.map((voice) => ({
              id: voice.voiceURI,
              label: voice.name,
              detail: `${voice.lang} · ${voice.localService ? text.offline : text.online}`,
            })),
          ]}
        />
      )}

      {ttsSupported && (
        <Button variant="secondary" icon={Volume2} onClick={() => speak(SAMPLE)} className="w-full">
          {text.tryIt}
        </Button>
      )}
    </SettingsSubpage>
  )
}

function NoVoiceHelp() {
  const text = useT().settings.voice
  return (
    <div className="rounded-card border border-line bg-surface p-4 text-sm leading-relaxed">
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
