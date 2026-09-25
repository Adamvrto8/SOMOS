import { Volume2 } from 'lucide-react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { setPreferredVoice, speak, ttsSupported, useVoices } from '../../lib/tts'

const SAMPLE = '¡Hola! ¿Cómo estás?'

export function VoiceSettings() {
  const { voices, preferredURI } = useVoices()
  const selected = voices.some((v) => v.voiceURI === preferredURI) ? preferredURI : null
  const auto = voices[0]

  return (
    <section aria-labelledby="voice-heading">
      <SectionTitle id="voice-heading">Výslovnosť</SectionTitle>

      {!ttsSupported ? (
        <p className="text-sm text-ink-muted">Tento prehliadač výslovnosť nepodporuje. Skús Chrome.</p>
      ) : voices.length === 0 ? (
        <NoVoiceHelp />
      ) : (
        <fieldset className="divide-y divide-line rounded-card border border-line bg-surface">
          <legend className="sr-only">Hlas</legend>
          <VoiceOption
            checked={selected === null}
            onSelect={() => setPreferredVoice(null)}
            title="Automaticky"
            detail={auto ? `${auto.name} · ${auto.lang}` : ''}
          />
          {voices.map((voice) => (
            <VoiceOption
              key={voice.voiceURI}
              checked={selected === voice.voiceURI}
              onSelect={() => setPreferredVoice(voice.voiceURI)}
              title={voice.name}
              detail={`${voice.lang} · ${voice.localService ? 'funguje offline' : 'potrebuje internet'}`}
            />
          ))}
        </fieldset>
      )}

      {ttsSupported && (
        <Button variant="secondary" icon={Volume2} onClick={() => speak(SAMPLE)} className="mt-3 w-full">
          Vyskúšať hlas
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
  return (
    <div className="rounded-card bg-surface-2 p-4 text-sm leading-relaxed">
      <p className="font-medium">V zariadení sme nenašli španielsky hlas.</p>
      <p className="mt-2 text-ink-muted">Na Androide ho doinštaluješ takto:</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-muted">
        <li>Nastavenia → vyhľadaj „Prevod textu na reč“.</li>
        <li>Pri nástroji Google ťukni na ozubené koliesko → Inštalovať hlasové údaje.</li>
        <li>Stiahni Español (Estados Unidos), prípadne México, ak je v ponuke.</li>
        <li>Zatvor a znova otvor SOMOS.</li>
      </ol>
    </div>
  )
}
