import { describe, expect, it } from 'vitest'
import { describeStatus, type ReminderStatus } from './reminderStatus'

const NOW = new Date(2026, 9, 1, 20, 50) // local time, like the phone
const at = (hours: number, minutes: number) => new Date(2026, 9, 1, hours, minutes).toISOString()

const status = (over: Partial<ReminderStatus> = {}): ReminderStatus => ({
  subscribed: true,
  thisDevice: true,
  time: '19:00',
  timeZone: 'Europe/Bratislava',
  serverClock: { day: '2026-10-01', time: '20:50' },
  sentDay: '2026-09-30',
  progress: { day: '2026-10-01', done: 3, goal: 50, dueToday: 20, dueTomorrow: 20, streakDays: 6, activeToday: true },
  lastTick: { at: at(20, 45), reason: 'too-late' },
  dropped: false,
  ...over,
})

const texts = (s: ReminderStatus) => describeStatus(s, NOW).map((line) => line.text)
const problems = (s: ReminderStatus) => describeStatus(s, NOW).filter((line) => line.tone === 'problem').map((line) => line.text)

describe('describeStatus', () => {
  it('says that everything is in place', () => {
    expect(texts(status())).toEqual([
      'Server pozná tento telefón, pripomienka o 19:00.',
      'Posledná kontrola o 20:45: už je po čase.',
      'Naposledy poslaná včera.',
      'Dnes podľa servera: 3/50.',
    ])
    expect(problems(status())).toEqual([])
  })

  it('points at a server that has no device', () => {
    const none = status({ subscribed: false, thisDevice: false, time: null, timeZone: null, serverClock: null, lastTick: { at: at(20, 45), reason: 'no-subscription' } })
    expect(problems(none)).toEqual(['Server nepozná žiadny telefón. Pošli skúšobnú notifikáciu, tým sa prihlási znova.'])
    expect(problems({ ...none, dropped: true })).toEqual([
      'Server nepozná žiadny telefón: prihlásenie na notifikácie zaniklo. Pošli skúšobnú notifikáciu, tým sa obnoví.',
    ])
    expect(texts(none)).toContain('Posledná kontrola o 20:45: žiadne zariadenie.')
  })

  it('points at reminders going to another device', () => {
    expect(problems(status({ thisDevice: false }))).toEqual(['Pripomienky chodia na iné zariadenie. Pošli skúšobnú notifikáciu, tým sa prepnú sem.'])
  })

  it('points at a timer that stopped calling', () => {
    expect(problems(status({ lastTick: { at: at(18, 0), reason: 'too-early' } }))).toEqual(['Časovač sa neozval od 18:00.'])
    const lastMonth = new Date(2026, 8, 29, 18, 0).toISOString()
    expect(problems(status({ lastTick: { at: lastMonth, reason: 'too-early' } }))).toEqual(['Časovač sa neozval od 29. 9. 18:00.'])
    expect(texts(status({ lastTick: null }))).toContain('Server ešte nedostal signál z časovača.')
  })

  it('names the days and skips an old progress report', () => {
    expect(texts(status({ sentDay: '2026-10-01' }))).toContain('Naposledy poslaná dnes.')
    expect(texts(status({ sentDay: '2026-09-12' }))).toContain('Naposledy poslaná 12. 9.')
    expect(texts(status({ sentDay: null }))).toContain('Zatiaľ nebola poslaná žiadna.')
    const old = status()
    old.progress = { ...old.progress!, day: '2026-09-30' }
    expect(texts(old).some((t) => t.startsWith('Dnes podľa servera'))).toBe(false)
  })
})
