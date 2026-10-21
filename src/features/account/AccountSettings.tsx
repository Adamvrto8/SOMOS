import { CircleUser, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { accountsAvailable, deleteAccount, signOut, useAccount } from '../../lib/account'
import { syncNow, useSyncStatus, type SyncStatus } from '../../lib/sync/scheduler'
import { SettingsGroup, SettingsRow } from '../settings/SettingsList'

/** "pred 3 min", from the time of the last good round. */
function useAgo(at: number | undefined): string | undefined {
  const text = useT().account
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (at === undefined) return undefined
  const minutes = Math.floor((now - at) / 60_000)
  if (minutes < 1) return text.justNow
  return minutes < 60 ? text.minutesAgo(minutes) : text.hoursAgo(Math.floor(minutes / 60))
}

/** "Synchronizované pred 3 min", or what keeps it from that. */
function useStatusText(status: SyncStatus): string {
  const text = useT().account.status
  const ago = useAgo(status.lastSyncedAt)
  return status.state === 'syncing'
    ? text.syncing
    : status.state === 'offline'
      ? text.offline
      : status.state === 'error'
        ? text.error
        : ago
          ? text.synced(ago)
          : text.waiting
}

function StatusLine({ status }: { status: SyncStatus }) {
  const line = useStatusText(status)
  return (
    <p role="status" className={`text-sm ${status.state === 'error' ? 'text-error' : 'text-ink-muted'}`}>
      {line}
    </p>
  )
}

/** The top of Profil: sign in, or the signed-in e-mail with how it syncs (no page of its own). */
export function AccountRow() {
  const text = useT().account
  const account = useAccount()
  const status = useSyncStatus()
  if (!accountsAvailable) return null
  return (
    <SettingsGroup id="account-heading">
      {account ? (
        <li className="flex min-h-13 items-center gap-3 py-2 pr-2 pl-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brick">
            <CircleUser size={18} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate leading-snug">{account.email}</p>
            <StatusLine status={status} />
          </div>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={status.state === 'syncing'}
            aria-label={text.syncNow}
            title={text.syncNow}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-50"
          >
            <RefreshCw size={18} strokeWidth={1.75} className={status.state === 'syncing' ? 'animate-spin' : ''} aria-hidden />
          </button>
        </li>
      ) : (
        <SettingsRow to="/profile/sign-in" icon={CircleUser} title={text.signIn} detail={text.rowHint} />
      )}
    </SettingsGroup>
  )
}

/** Starts the app afresh once the account's data has left the device. */
const restart = () => window.location.assign('/')

/** The bottom of Profil, signed in: sign out, and (as Google Play asks of an app with accounts) delete the account. */
export function AccountActions() {
  const text = useT().account
  const account = useAccount()
  const [confirm, setConfirm] = useState<'pending' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!accountsAvailable || !account) return null

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setFailed(false)
    try {
      await action()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const leave = (force: boolean) =>
    run(async () => {
      if ((await signOut({ force })) === 'pending') setConfirm('pending')
      else restart()
    })

  return (
    <section aria-label={text.title}>
      {confirm === 'pending' ? (
        <div className="rounded-card border border-amber/40 bg-amber/10 p-4">
          <p className="font-medium">{text.pendingTitle}</p>
          <p className="mt-1 text-sm text-ink-muted">{text.pendingHint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              {text.wait}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void leave(true)}>
              {text.signOutAnyway}
            </Button>
          </div>
        </div>
      ) : confirm === 'delete' ? (
        <div className="rounded-card border border-error/30 bg-error/10 p-4">
          <p className="font-medium">{text.deleteTitle}</p>
          <p className="mt-1 text-sm text-ink-muted">{text.deleteHint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              {text.cancel}
            </Button>
            <Button variant="danger-solid" disabled={busy} onClick={() => void run(async () => (await deleteAccount(), restart()))}>
              {text.deleteConfirm}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button variant="secondary" icon={LogOut} disabled={busy} onClick={() => void leave(false)}>
            {text.signOut}
          </Button>
          <p className="text-center text-xs text-ink-muted">{text.signOutHint}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm('delete')}
            className="mx-auto mt-1 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-error transition-colors duration-150 hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-50"
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            {text.delete}
          </button>
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-sm text-error">
          {text.failed}
        </p>
      )}
    </section>
  )
}
