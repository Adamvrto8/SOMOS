import { useLiveQuery } from 'dexie-react-hooks'
import { Languages, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Segmented } from '../../components/Segmented'
import { SpeakButton } from '../../components/SpeakButton'
import {
  cachedTranslation,
  guessLang,
  MAX_TRANSLATE_CHARS,
  TRANSLATE_ERRORS,
  TranslateFailure,
  translateOnline,
  type Lang,
  type TranslateError,
} from '../../lib/translate'
import type { CustomWordPrefill } from '../archive/CustomWordPage'

const DIRECTIONS: { id: Lang; label: string }[] = [
  { id: 'sk', label: 'SK → ES' },
  { id: 'es', label: 'ES → SK' },
]

/** DeepL lookup for a query the dictionary doesn't cover. Remount it (key) when the query changes. */
export function OnlineTranslate({ query }: { query: string }) {
  const navigate = useNavigate()
  const text = query.trim()
  const [from, setFrom] = useState<Lang>(() => guessLang(text))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<TranslateError>()
  // Shows a cached translation right away, and the new one as soon as it is stored.
  // undefined = still reading IndexedDB, null = not translated yet.
  const result = useLiveQuery(async () => (await cachedTranslation(text, from)) ?? null, [text, from])
  const tooLong = text.length > MAX_TRANSLATE_CHARS

  const run = async () => {
    setBusy(true)
    setError(undefined)
    try {
      await translateOnline(text, from)
    } catch (e) {
      setError(e instanceof TranslateFailure ? e.code : 'failed')
    } finally {
      setBusy(false)
    }
  }

  const es = result ? (from === 'sk' ? result.translation : result.text) : ''
  const sk = result ? (from === 'sk' ? result.text : result.translation) : ''
  const addToMine = () => {
    const prefill: CustomWordPrefill = { es, sk }
    void navigate('/archive/new', { state: { prefill } })
  }

  return (
    <section aria-labelledby="online-heading" className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="online-heading" className="font-semibold">
          Preložiť online
        </h2>
        <span className="text-xs text-ink-muted">DeepL · potrebuje internet</span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Pre slová a vety, ktoré v slovníku nie sú.</p>

      <div className="mt-3">
        <Segmented
          mode="radio"
          label="Smer prekladu"
          idPrefix="direction"
          options={DIRECTIONS}
          value={from}
          onChange={(value) => {
            setFrom(value)
            setError(undefined)
          }}
        />
      </div>

      {result ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p lang="es" className="font-serif text-2xl font-semibold break-words">
                {es}
              </p>
              <p className="mt-0.5 text-ink-muted break-words">{sk}</p>
            </div>
            <SpeakButton text={es} />
          </div>
          <p className="text-xs text-ink-muted">Strojový preklad, nemusí byť mexický ani presný.</p>
          <Button variant="secondary" icon={Plus} className="w-full" onClick={addToMine}>
            Pridať do Moje slová
          </Button>
        </div>
      ) : (
        <Button icon={Languages} className="mt-3 w-full" onClick={run} disabled={busy || tooLong || result === undefined}>
          {busy ? 'Prekladám…' : 'Preložiť'}
        </Button>
      )}

      {tooLong && <p className="mt-2 text-sm text-ink-muted">Najviac {MAX_TRANSLATE_CHARS} znakov.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {TRANSLATE_ERRORS[error]}
        </p>
      )}
    </section>
  )
}
