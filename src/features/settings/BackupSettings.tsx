import { Download, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { downloadBackup, importBackup, parseBackup } from '../../lib/backup'
import { SettingsHint, SettingsSubpage } from './SettingsSubpage'

interface Status {
  tone: 'ok' | 'error'
  text: string
}

/** Nastavenia → Záloha: everything of this device to a file, and back. */
export function BackupSettings() {
  const text = useT().settings.backup
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  const exportData = async () => {
    try {
      await downloadBackup()
      setStatus({ tone: 'ok', text: text.downloaded })
    } catch {
      setStatus({ tone: 'error', text: text.downloadFailed })
    }
  }

  const importFile = async (file: File) => {
    setBusy(true)
    try {
      const parsed = parseBackup(await file.text())
      if (!parsed.ok) return setStatus({ tone: 'error', text: parsed.error })
      setStatus({ tone: 'ok', text: text.restored(await importBackup(parsed.backup, parsed.skipped)) })
    } catch {
      setStatus({ tone: 'error', text: text.restoreFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSubpage title={text.title}>
      <SettingsHint>{text.intro}</SettingsHint>

      <div className="grid gap-3">
        <Button variant="secondary" icon={Download} onClick={() => void exportData()}>
          {text.download}
        </Button>
        <Button variant="secondary" icon={Upload} disabled={busy} onClick={() => fileRef.current?.click()}>
          {text.restore}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = '' // allows picking the same file again
            if (file) void importFile(file)
          }}
        />
      </div>

      <p role="status" className={`px-1 text-sm ${status?.tone === 'error' ? 'text-error' : 'text-leaf'}`}>
        {status?.text}
      </p>
    </SettingsSubpage>
  )
}

/** Developer tools: whether the browser may clear this device's data when space runs out. */
export function StorageInfo() {
  const text = useT().settings.backup
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null))
  }, [])

  if (persisted === null) return null
  return <p className="px-1 text-sm text-ink-muted">{persisted ? text.persisted : text.notPersisted}</p>
}
