import { describe, expect, it } from 'vitest'
import { lessonRows, parseReportError, percent, type UsageReport } from './usageReport'

const report: UsageReport = {
  since: '2026-09-26',
  devices: 12,
  active: [{ day: '2026-10-24', devices: 5 }],
  returning: { new: 8, nextDay: 3, weekOld: 4, withinWeek: 2 },
  welcome: { welcome: 8, motivation: 7, done: 5 },
  lessons: [
    { by: 'type', key: 'cloze', started: 10, finished: 6, quit: 2, usualStop: 3 },
    { by: 'type', key: 'builder', started: 20, finished: 15, quit: 5, usualStop: null },
    { by: 'level', key: 'A1', started: 30, finished: 21, quit: 7, usualStop: 4 },
  ],
  screens: { search: 9, duel: 1 },
}

describe('usage report', () => {
  it('lists the lesson rows of one kind, most started first', () => {
    expect(lessonRows(report, 'type').map((r) => r.key)).toEqual(['builder', 'cloze'])
    expect(lessonRows(report, 'level').map((r) => r.key)).toEqual(['A1'])
  })

  it('rounds percentages and has none of nothing', () => {
    expect(percent(2, 3)).toBe(67)
    expect(percent(0, 0)).toBeNull()
  })

  it('tells a refused account from a failed request', () => {
    expect(parseReportError({ message: 'forbidden' })).toBe('forbidden')
    expect(parseReportError({ message: 'Failed to fetch' })).toBe('offline')
    expect(parseReportError({})).toBe('offline')
  })
})
