import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

// theme.ts reads window.matchMedia when it loads; parsing a file needs none of it.
vi.mock('./theme', () => ({ getLook: vi.fn(), getThemePref: vi.fn(), setLook: vi.fn(), setThemePref: vi.fn() }))

const { parseBackup } = await import('./backup')

describe('parseBackup: diary', () => {
  it('turns days of older apps (two fields, one text) into notes keyed by the date and counts broken ones', () => {
    const file = JSON.stringify({
      app: 'somos',
      version: 1,
      diary: [
        { date: '2026-11-06', learned: 'pretérito', es: 'Ayer fui al cine.', createdAt: 1, updatedAt: 2 },
        { date: '2026-11-07', text: 'ser a estar', createdAt: 3, updatedAt: 4 },
        { id: 'n-1', date: '2026-11-07', title: 'Hola', text: 'Hola = ahoj', createdAt: 5, updatedAt: 6 },
        { date: 'zle' },
      ],
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.diary).toEqual([
      { id: '2026-11-06', date: '2026-11-06', title: '', text: 'pretérito\n\nAyer fui al cine.', createdAt: 1, updatedAt: 2 },
      { id: '2026-11-07', date: '2026-11-07', title: '', text: 'ser a estar', createdAt: 3, updatedAt: 4 },
      { id: 'n-1', date: '2026-11-07', title: 'Hola', text: 'Hola = ahoj', createdAt: 5, updatedAt: 6 },
    ])
    expect(result.skipped).toBe(1)
  })
})
