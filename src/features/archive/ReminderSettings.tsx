import { BellRing, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import {
  disableReminder,
  enableReminder,
  fetchReminderStatus,
  ReminderFailure,
  reminderSupport,
  sendTestLater,
  sendTestReminder,
  setReminderTime,
  useReminderProblem,
  useReminderSettings,
} from '../../lib/reminder'
import { describeStatus, type StatusLine } from '../../lib/reminderStatus'

type Status = { tone: 'ok' | 'error'; text: string; detail?: string } | null

const LINE_TONE: Record<StatusLine['tone'], string> = { ok: 'text-leaf', info: 'text-ink-muted', problem: 'text-error' }

export function ReminderSettings() {
  const settings = useReminderSettings()
  const text = useT().reminder
  const support = reminderSupport()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  // Local draft, so typing a time on a keyboard is not reset mid-way.
  const [time, setTime] = useState(settings.time)
  const problem = useReminderProblem()
  // What the server knows: a reminder that stopped is otherwise invisible. null = not asked yet.
  const [server, setServer] = useState<StatusLine[] | 'unreachable' | null>(null)

  const refreshServer = () =>
    fetchReminderStatus().then(
      (s) => setServer(describeStatus(s, new Date())),
      () => setServer('unreachable'),
    )

  useEffect(() => {
    if (settings.enabled && support !== 'unavailable') void refreshServer()
  }, [settings.enabled, support])

  async function run(action: () => Promise<void>, doneText?: string) {
    setBusy(true)
    setStatus(null)
    try {
      await action()
      if (doneText) setStatus({ tone: 'ok', text: doneText })
    } catch (error) {
      const failure = error instanceof ReminderFailure ? error : new ReminderFailure('failed', String(error))
      setStatus({ tone: 'error', text: text.errors[failure.code], detail: failure.detail })
    } finally {
      setBusy(false)
      if (support !== 'unavailable') void refreshServer()
    }
  }

  return (
    <section aria-labelledby="reminder-heading">
      <SectionTitle id="reminder-heading">{text.title}</SectionTitle>

      <div className="divide-y divide-line rounded-card border border-line bg-surface">
        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block leading-snug">{text.toggle}</span>
            <span className="block text-sm text-ink-muted">{text.toggleHint}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.enabled}
            // Turning off always works; turning on needs a device that supports it.
            disabled={busy || (!settings.enabled && support !== 'ok')}
            onChange={(e) => {
              const on = e.target.checked
              void run(() => (on ? enableReminder(time) : disableReminder()))
            }}
            className="size-6 shrink-0 accent-brick"
          />
        </label>

        {settings.enabled && (
          <label className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
            <span>{text.time}</span>
            <input
              type="time"
              value={time}
              onChange={(e) => {
                const next = e.target.value
                setTime(next)
                if (next) void run(() => setReminderTime(next))
              }}
              className="h-11 rounded-xl border border-line bg-surface-2 px-3 tabular-nums"
            />
          </label>
        )}
      </div>

      {support !== 'ok' && <p className="mt-2 text-sm text-ink-muted">{text.errors[support]}</p>}
      {problem && (
        <p role="alert" className="mt-2 text-sm text-error">
          {problem}
        </p>
      )}
      {status && (
        <p role="status" className={`mt-2 text-sm ${status.tone === 'error' ? 'text-error' : 'text-leaf'}`}>
          {status.text}
          {status.detail && <span className="mt-0.5 block break-words text-xs text-ink-muted">{status.detail}</span>}
        </p>
      )}

      {settings.enabled && (
        <Button
          variant="secondary"
          icon={BellRing}
          disabled={busy}
          onClick={() => void run(sendTestReminder, text.testSent)}
          className="mt-3 w-full"
        >
          {text.sendTest}
        </Button>
      )}
      {/* The real conditions: the test above arrives while the app is open, the reminder has to wake a sleeping phone. */}
      {settings.enabled && (
        <Button variant="secondary" icon={Clock} disabled={busy} onClick={() => void run(sendTestLater, text.testLaterSet)} className="mt-2 w-full">
          {text.sendTestLater}
        </Button>
      )}

      {settings.enabled && server && (
        <div className="mt-3 rounded-card border border-line bg-surface px-4 py-3">
          <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{text.statusTitle}</p>
          {server === 'unreachable' ? (
            <p className="mt-1.5 text-sm text-error">{text.unreachable}</p>
          ) : (
            <ul className="mt-1.5 space-y-1 text-sm">
              {server.map((line) => (
                <li key={line.text} className={LINE_TONE[line.tone]}>
                  {line.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
