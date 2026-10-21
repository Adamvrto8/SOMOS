import { CircleUser, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import { accountsAvailable, deleteAccount, signOut, useAccount } from '../../lib/account'
import { syncNow, useSyncStatus, type SyncStatus } from '../../lib/sync/scheduler'

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

function StatusLine({ status }: { status: SyncStatus }) {
  const text = useT().account.status
  const ago = useAgo(status.lastSyncedAt)
  const line =
    status.state === 'syncing'
      ? text.syncing
      : status.state === 'offline'
        ? text.offline
        : status.state === 'error'
          ? text.error
          : ago
            ? text.synced(ago)
            : text.waiting
  return (
    <p role="status" className={`text-sm ${status.state === 'error' ? 'text-error' : 'text-ink-muted'}`}>
      {line}
    </p>
  )
}

/** Starts the app afresh once the account's data has left the device. */
const restart = () => window.location.assign('/')

/** Nastavenia → Účet: sign in, or the account with its sync state, sign-out and deletion. */
export function AccountSection() {
  const text = useT().account
  const account = useAccount()
  const status = useSyncStatus()
  const [confirm, setConfirm] = useState<'pending' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!accountsAvailable) return null

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
    <section aria-labelledby="account-heading">
      <SectionTitle id="account-heading">{text.title}</SectionTitle>
      <div className="rounded-card border border-line bg-surface p-4">
        {!account ? (
          <>
            <p className="text-ink-muted">{text.why}</p>
            <Link
              to="/archive/account"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brick px-5 font-semibold text-on-accent transition duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
            >
              <CircleUser size={18} strokeWidth={1.75} aria-hidden />
              {text.signIn}
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brick">
                <CircleUser size={22} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{account.email}</p>
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
            </div>

            {confirm === 'pending' ? (
              <div className="mt-4 rounded-xl border border-amber/40 bg-amber/10 p-3">
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
              <div className="mt-4 rounded-xl border border-error/30 bg-error/10 p-3">
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
              <div className="mt-4 grid gap-2">
                <Button variant="secondary" icon={LogOut} disabled={busy} onClick={() => void leave(false)}>
                  {text.signOut}
                </Button>
                <p className="text-center text-xs text-ink-muted">{text.signOutHint}</p>
                <Button variant="danger" icon={Trash2} disabled={busy} onClick={() => setConfirm('delete')} className="mt-2">
                  {text.delete}
                </Button>
              </div>
            )}
            {failed && (
              <p role="alert" className="mt-3 text-sm text-error">
                {text.failed}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
