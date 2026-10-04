import { Download, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import { downloadBackup, importBackup, parseBackup } from '../../lib/backup'

interface Status {
  tone: 'ok' | 'error'
  text: string
}

export function BackupSettings() {
  const text = useT().settings.backup
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null))
  }, [])

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
    <section aria-labelledby="backup-heading">
      <SectionTitle id="backup-heading">{text.title}</SectionTitle>
      <p className="text-sm leading-relaxed text-ink-muted">
        {text.intro}
      </p>
      {persisted !== null && (
        <p className="mt-2 text-sm text-ink-muted">
          {persisted ? text.persisted : text.notPersisted}
        </p>
      )}

      <div className="mt-4 grid gap-3">
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

      <p role="status" className={`mt-3 text-sm ${status?.tone === 'error' ? 'text-error' : 'text-leaf'}`}>
        {status?.text}
      </p>
    </section>
  )
}
