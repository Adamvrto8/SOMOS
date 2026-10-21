import { BellRing, Clock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/Button'
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
  useReminderElsewhere,
  useReminderProblem,
  useReminderSettings,
} from '../../lib/reminder'
import { describeStatus, type StatusLine } from '../../lib/reminderStatus'
import { SwitchRow } from './ChoiceList'
import { SettingsHint, SettingsSubpage } from './SettingsSubpage'

type Status = { tone: 'ok' | 'error'; text: string; detail?: string } | null

const LINE_TONE: Record<StatusLine['tone'], string> = { ok: 'text-leaf', info: 'text-ink-muted', problem: 'text-error' }

/** Runs a reminder action: busy while it runs, then what came of it. `after` runs either way. */
function useReminderAction(after?: () => void) {
  const text = useT().reminder
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

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
      after?.()
    }
  }
  return { busy, status, run }
}

function StatusMessage({ status }: { status: Status }) {
  if (!status) return null
  return (
    <p role="status" className={`mt-2 px-1 text-sm ${status.tone === 'error' ? 'text-error' : 'text-leaf'}`}>
      {status.text}
      {status.detail && <span className="mt-0.5 block break-words text-xs text-ink-muted">{status.detail}</span>}
    </p>
  )
}

/** Nastavenia → Pripomienka cvičenia: on or off, and when. */
export function ReminderSettings() {
  const settings = useReminderSettings()
  const text = useT().reminder
  const support = reminderSupport()
  const { busy, status, run } = useReminderAction()
  // Local draft, so typing a time on a keyboard is not reset mid-way.
  const [time, setTime] = useState(settings.time)
  const problem = useReminderProblem()
  const elsewhere = useReminderElsewhere()

  return (
    <SettingsSubpage title={text.title}>
      <div>
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          <SwitchRow
            label={text.toggle}
            detail={text.toggleHint}
            checked={settings.enabled}
            // Turning off always works; turning on needs a device that supports it.
            disabled={busy || (!settings.enabled && support !== 'ok')}
            onChange={(on) => void run(() => (on ? enableReminder(time) : disableReminder()))}
          />
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

        {support !== 'ok' && <SettingsHint>{text.errors[support]}</SettingsHint>}
        {problem && (
          <p role="alert" className="mt-2 px-1 text-sm text-error">
            {problem}
          </p>
        )}
        <StatusMessage status={status} />
      </div>

      {elsewhere && (
        <Button icon={BellRing} disabled={busy} onClick={() => void run(() => enableReminder(settings.time), text.movedHere)} className="w-full">
          {text.moveHere}
        </Button>
      )}
    </SettingsSubpage>
  )
}

/** Developer tools: test notifications, now and with the phone asleep, and what the server knows. */
export function ReminderDevTools() {
  const settings = useReminderSettings()
  const text = useT().reminder
  const devText = useT().settings.dev
  const support = reminderSupport()
  // What the server knows: a reminder that stopped is otherwise invisible. null = not asked yet.
  const [server, setServer] = useState<StatusLine[] | 'unreachable' | null>(null)

  const refreshServer = useCallback(() => {
    if (support === 'unavailable') return
    fetchReminderStatus().then(
      (s) => setServer(describeStatus(s, new Date())),
      () => setServer('unreachable'),
    )
  }, [support])
  const { busy, status, run } = useReminderAction(refreshServer)

  useEffect(() => {
    if (settings.enabled) refreshServer()
  }, [settings.enabled, refreshServer])

  if (!settings.enabled) return <p className="px-1 text-sm text-ink-muted">{devText.reminderOff}</p>

  return (
    <div>
      <div className="grid gap-2">
        <Button variant="secondary" icon={BellRing} disabled={busy} onClick={() => void run(sendTestReminder, text.testSent)}>
          {text.sendTest}
        </Button>
        {/* The real conditions: the test above arrives while the app is open, the reminder has to wake a sleeping phone. */}
        <Button variant="secondary" icon={Clock} disabled={busy} onClick={() => void run(sendTestLater, text.testLaterSet)}>
          {text.sendTestLater}
        </Button>
      </div>
      <StatusMessage status={status} />

      {server && (
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
    </div>
  )
}
