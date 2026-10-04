import { t } from '../i18n'
import { addDays, dayKey } from './dates'
import type { ReminderProgress } from './reminderProgress'

// "Stav pripomienky" in Nastavenia: what the server knows, in plain Slovak. A reminder that
// silently stops is otherwise invisible: nothing arrives, and nothing says why.

/** What api/reminder.ts answers to `status`. Keep in sync with ReminderStatus there. */
export interface ReminderStatus {
  subscribed: boolean // the server has a device to remind
  thisDevice: boolean // … and it is the one asking
  time: string | null
  timeZone: string | null
  serverClock: { day: string; time: string } | null
  sentDay: string | null // day of the last reminder sent
  progress: ReminderProgress | null
  lastTick: { at: string; reason: string } | null // the timer's last call and what the server decided
  dropped: boolean // no device because the push service dropped its subscription
}

export interface StatusLine {
  text: string
  tone: 'ok' | 'info' | 'problem'
}

/** The timer calls every 15 minutes; three missed calls mean it stopped. */
const STALE_MS = 45 * 60_000

const clock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

export function describeStatus(status: ReminderStatus, now: Date): StatusLine[] {
  const text = t().reminder.status
  const shortDay = (day: string) => text.shortDay(Number(day.slice(8, 10)), Number(day.slice(5, 7)))
  const today = dayKey(now)
  const lines: StatusLine[] = []

  if (status.thisDevice) lines.push({ tone: 'ok', text: text.thisDevice(status.time) })
  else if (status.subscribed) lines.push({ tone: 'problem', text: text.otherDevice })
  else if (status.dropped) lines.push({ tone: 'problem', text: text.dropped })
  else lines.push({ tone: 'problem', text: text.none })

  if (!status.lastTick) lines.push({ tone: 'info', text: text.noTick })
  else {
    const at = new Date(status.lastTick.at)
    const sameDay = dayKey(at) === today
    if (now.getTime() - at.getTime() > STALE_MS) {
      lines.push({ tone: 'problem', text: text.stale(sameDay ? clock(at) : `${shortDay(dayKey(at))} ${clock(at)}`) })
    } else {
      lines.push({ tone: 'info', text: text.lastCheck(clock(at), text.reasons[status.lastTick.reason] ?? status.lastTick.reason) })
    }
  }

  if (!status.sentDay) lines.push({ tone: 'info', text: text.neverSent })
  else if (status.sentDay === today) lines.push({ tone: 'info', text: text.sentToday })
  else if (status.sentDay === dayKey(addDays(now, -1))) lines.push({ tone: 'info', text: text.sentYesterday })
  else lines.push({ tone: 'info', text: text.sentOn(shortDay(status.sentDay)) })

  if (status.progress?.day === today) lines.push({ tone: 'info', text: text.today(status.progress.done, status.progress.goal) })
  return lines
}
