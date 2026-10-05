import { describe, expect, it } from 'vitest'
import { parseSettingsBackup } from './settingsBackup'

describe('parseSettingsBackup', () => {
  it('reads the settings of a backup', () => {
    const settings = { theme: 'dark', dailyGoal: 50, autoReview: { enabled: false, limit: 10 }, reminder: { enabled: true, time: '07:30' } }
    expect(parseSettingsBackup(settings)).toEqual(settings)
  })

  it('carries the language, and drops one it does not know', () => {
    expect(parseSettingsBackup({ language: 'en' }).language).toBe('en')
    expect(parseSettingsBackup({ language: 'de' }).language).toBeUndefined()
  })

  it('carries the style, and drops one it does not know', () => {
    expect(parseSettingsBackup({ look: 'talavera' }).look).toBe('talavera')
    expect(parseSettingsBackup({ look: 'classic' }).look).toBe('classic')
    expect(parseSettingsBackup({ look: 'neon' }).look).toBeUndefined()
  })

  it('has nothing for a backup made before settings were part of it', () => {
    expect(parseSettingsBackup(undefined)).toEqual({})
    expect(parseSettingsBackup('dark')).toEqual({})
    expect(parseSettingsBackup([])).toEqual({})
  })

  it('drops a setting it does not know and keeps the rest', () => {
    const parsed = parseSettingsBackup({
      theme: 'pink',
      dailyGoal: 25, // not one of the goals on offer
      autoReview: { enabled: true, limit: 20 },
      reminder: { enabled: true, time: '25:00' },
      voice: 'Google español',
    })
    expect(parsed).toEqual({ autoReview: { enabled: true, limit: 20 } })
    expect(parseSettingsBackup({ theme: 'system', autoReview: { enabled: 'yes', limit: 20 }, reminder: { time: '19:00' } })).toEqual({ theme: 'system' })
  })
})
