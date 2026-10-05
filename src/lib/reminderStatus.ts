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
  delivery: Delivery | null
  testPending: boolean // a test notification waits for the timer's next call
}

/** The last message the server sent, and what the phone said about it. */
export interface Delivery {
  kind: 'reminder' | 'test'
  sentAt: string // ISO time
  receipts: boolean // the phone's app confirms what it gets: without it, silence means nothing
  receivedAt?: string
  shown?: boolean
  error?: string
}

export interface StatusLine {
  text: string
  tone: 'ok' | 'info' | 'problem'
}

/** The timer calls every 15 minutes; three missed calls mean it stopped. */
const STALE_MS = 45 * 60_000
/** A phone that is reachable confirms within seconds. */
const RECEIPT_MS = 5 * 60_000

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

  // Sent is not received: this is the line that tells where a missing notification got lost.
  const when = (iso: string) => {
    const date = new Date(iso)
    return dayKey(date) === today ? clock(date) : `${shortDay(dayKey(date))} ${clock(date)}`
  }
  const delivery = status.delivery
  if (delivery) {
    const what = text.delivery.kinds[delivery.kind]
    const sent = when(delivery.sentAt)
    if (delivery.receivedAt && delivery.shown) lines.push({ tone: 'ok', text: text.delivery.shown(what, sent, clock(new Date(delivery.receivedAt))) })
    else if (delivery.receivedAt) {
      lines.push({ tone: 'problem', text: text.delivery.notShown(what, sent, clock(new Date(delivery.receivedAt)), delivery.error ?? '?') })
    } else if (!delivery.receipts) lines.push({ tone: 'info', text: text.delivery.cannotConfirm(what, sent) })
    else if (now.getTime() - new Date(delivery.sentAt).getTime() < RECEIPT_MS) lines.push({ tone: 'info', text: text.delivery.waiting(what, sent) })
    else lines.push({ tone: 'problem', text: text.delivery.notReceived(what, sent) })
  }
  if (status.testPending) lines.push({ tone: 'info', text: text.testPending })
  return lines
}
