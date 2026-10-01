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

const REASONS: Record<string, string> = {
  sent: 'pripomienka poslaná',
  'already-sent': 'dnes už bola poslaná',
  'goal-met': 'denný cieľ je splnený',
  'too-early': 'ešte nie je čas',
  'too-late': 'už je po čase',
  'no-subscription': 'žiadne zariadenie',
  gone: 'prihlásenie telefónu zaniklo',
  failed: 'odoslanie zlyhalo',
}

/** The timer calls every 15 minutes; three missed calls mean it stopped. */
const STALE_MS = 45 * 60_000

const clock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
const shortDay = (day: string) => `${Number(day.slice(8, 10))}. ${Number(day.slice(5, 7))}.`

export function describeStatus(status: ReminderStatus, now: Date): StatusLine[] {
  const today = dayKey(now)
  const lines: StatusLine[] = []

  if (status.thisDevice) lines.push({ tone: 'ok', text: `Server pozná tento telefón, pripomienka o ${status.time}.` })
  else if (status.subscribed) lines.push({ tone: 'problem', text: 'Pripomienky chodia na iné zariadenie. Pošli skúšobnú notifikáciu, tým sa prepnú sem.' })
  else if (status.dropped) {
    lines.push({ tone: 'problem', text: 'Server nepozná žiadny telefón: prihlásenie na notifikácie zaniklo. Pošli skúšobnú notifikáciu, tým sa obnoví.' })
  } else lines.push({ tone: 'problem', text: 'Server nepozná žiadny telefón. Pošli skúšobnú notifikáciu, tým sa prihlási znova.' })

  if (!status.lastTick) lines.push({ tone: 'info', text: 'Server ešte nedostal signál z časovača.' })
  else {
    const at = new Date(status.lastTick.at)
    const sameDay = dayKey(at) === today
    if (now.getTime() - at.getTime() > STALE_MS) {
      lines.push({ tone: 'problem', text: `Časovač sa neozval od ${sameDay ? '' : `${shortDay(dayKey(at))} `}${clock(at)}.` })
    } else {
      lines.push({ tone: 'info', text: `Posledná kontrola o ${clock(at)}: ${REASONS[status.lastTick.reason] ?? status.lastTick.reason}.` })
    }
  }

  if (!status.sentDay) lines.push({ tone: 'info', text: 'Zatiaľ nebola poslaná žiadna.' })
  else {
    const day = status.sentDay === today ? 'dnes' : status.sentDay === dayKey(addDays(now, -1)) ? 'včera' : shortDay(status.sentDay)
    lines.push({ tone: 'info', text: `Naposledy poslaná ${day}${day.endsWith('.') ? '' : '.'}` })
  }

  if (status.progress?.day === today) lines.push({ tone: 'info', text: `Dnes podľa servera: ${status.progress.done}/${status.progress.goal}.` })
  return lines
}
