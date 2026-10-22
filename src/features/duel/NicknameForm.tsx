import { useState } from 'react'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { DuelError, NICKNAME_MAX, validNickname } from '../../lib/duel/backend'

/** The name the opponent sees: asked once before the first duel, changed later on the Duel page. */
export function NicknameForm({ initial = '', onSave }: { initial?: string; onSave: (nickname: string) => Promise<void> }) {
  const text = useT().duel
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!validNickname(value)) return setError(text.errors.nickname)
    setBusy(true)
    setError(null)
    try {
      await onSave(value.trim())
    } catch (e) {
      setError(text.errors[e instanceof DuelError ? e.code : 'failed'])
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="rounded-card border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label className="block">
        <span className="font-medium">{text.nickname}</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={NICKNAME_MAX}
          autoComplete="nickname"
          className="mt-2 h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-lg focus-visible:outline-2 focus-visible:outline-brick"
        />
      </label>
      <p className="mt-2 text-sm text-ink-muted">{text.nicknameHint}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="mt-4 w-full">
        {text.save}
      </Button>
    </form>
  )
}
