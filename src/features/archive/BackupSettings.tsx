import { Download, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { downloadBackup, importBackup, parseBackup, type ImportResult } from '../../lib/backup'

interface Status {
  tone: 'ok' | 'error'
  text: string
}

function describeImport(r: ImportResult): string {
  const parts = [`uložené: ${r.savedItems}`, `vlastné slová: ${r.customWords}`]
  if (r.reviewCards) parts.push(`karty na opakovanie: ${r.reviewCards}`)
  if (r.attempts) parts.push(`nové výsledky cvičení: ${r.attempts}`)
  if (r.mistakes) parts.push(`chyby: ${r.mistakes}`)
  if (r.lessons) parts.push(`lekcie: ${r.lessons}`)
  const skipped = r.skipped ? ` Preskočené neplatné záznamy: ${r.skipped}.` : ''
  const settings = r.settings ? ' Obnovené sú aj nastavenia.' : ''
  const reminder = r.reminderOff ? ' Pripomienku treba na tomto zariadení zapnúť znova.' : ''
  return `Obnovené – ${parts.join(', ')}.${skipped}${settings}${reminder}`
}

export function BackupSettings() {
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
      setStatus({ tone: 'ok', text: 'Záloha je stiahnutá (priečinok Stiahnuté).' })
    } catch {
      setStatus({ tone: 'error', text: 'Zálohu sa nepodarilo vytvoriť.' })
    }
  }

  const importFile = async (file: File) => {
    setBusy(true)
    try {
      const parsed = parseBackup(await file.text())
      if (!parsed.ok) return setStatus({ tone: 'error', text: parsed.error })
      setStatus({ tone: 'ok', text: describeImport(await importBackup(parsed.backup, parsed.skipped)) })
    } catch {
      setStatus({ tone: 'error', text: 'Zálohu sa nepodarilo obnoviť.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="backup-heading">
      <SectionTitle id="backup-heading">Záloha</SectionTitle>
      <p className="text-sm leading-relaxed text-ink-muted">
        Uložené a vlastné slová, postup v lekciách aj nastavenia sú len v tomto zariadení. Občas si stiahni zálohu, napríklad na
        Google Drive, aby si o ne neprišiel pri výmene telefónu.
      </p>
      {persisted !== null && (
        <p className="mt-2 text-sm text-ink-muted">
          {persisted
            ? 'Úložisko je trvalé, prehliadač dáta sám nezmaže.'
            : 'Prehliadač môže dáta pri nedostatku miesta zmazať – záloha sa oplatí.'}
        </p>
      )}

      <div className="mt-4 grid gap-3">
        <Button variant="secondary" icon={Download} onClick={() => void exportData()}>
          Stiahnuť zálohu
        </Button>
        <Button variant="secondary" icon={Upload} disabled={busy} onClick={() => fileRef.current?.click()}>
          Obnoviť zo zálohy
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
