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
  delivery: null,
  testPending: false,
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

  it('says whether the phone got the last message', () => {
    const sent = { kind: 'reminder' as const, sentAt: at(19, 0), receipts: true }
    expect(texts(status({ delivery: { ...sent, receivedAt: at(19, 0), shown: true } }))).toContain('Pripomienka z 19:00: telefón ju zobrazil o 19:00.')
    expect(problems(status({ delivery: { ...sent, receivedAt: at(19, 1), shown: false, error: 'TypeError: no permission' } }))).toEqual([
      'Pripomienka z 19:00: telefón ju prijal o 19:01, ale Android ju nezobrazil (TypeError: no permission).',
    ])
    // Nearly two hours without a word from a phone that can confirm.
    expect(problems(status({ delivery: sent }))).toEqual([
      'Pripomienka z 19:00: telefón ju neprijal. Android zrejme nepúšťa Chrome na pozadí: v Nastaveniach Androidu → Aplikácie → Chrome a SOMOS povoľ automatické spustenie a batériu nastav na „Bez obmedzení“.',
    ])
    // Just sent: give it a moment. From yesterday: with its day.
    expect(texts(status({ delivery: { kind: 'test', sentAt: at(20, 48), receipts: true } }))).toContain(
      'Skúšobná notifikácia z 20:48: odoslaná, čaká sa na potvrdenie z telefónu.',
    )
    const yesterday = new Date(2026, 8, 30, 19, 0).toISOString()
    expect(texts(status({ delivery: { ...sent, sentAt: yesterday, receivedAt: yesterday, shown: true } }))).toContain(
      'Pripomienka z 30. 9. 19:00: telefón ju zobrazil o 19:00.',
    )
  })

  it('claims nothing about a phone whose app cannot confirm yet', () => {
    const lines = describeStatus(status({ delivery: { kind: 'reminder', sentAt: at(19, 0), receipts: false } }), NOW)
    expect(lines.filter((line) => line.tone === 'problem')).toEqual([])
    expect(lines.map((line) => line.text)).toContain('Pripomienka z 19:00: odoslaná. Tento telefón ešte nevie potvrdiť prijatie, otvor aplikáciu.')
  })

  it('says that a test is waiting for the next check', () => {
    expect(texts(status({ testPending: true }))).toContain(
      'Skúšobná notifikácia odíde pri najbližšej kontrole (do 15 minút). Zavri aplikáciu, zamkni telefón a počkaj.',
    )
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
