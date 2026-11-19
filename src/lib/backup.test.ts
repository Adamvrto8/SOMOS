import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

// theme.ts reads window.matchMedia when it loads; parsing a file needs none of it.
vi.mock('./theme', () => ({ getLook: vi.fn(), getThemePref: vi.fn(), setLook: vi.fn(), setThemePref: vi.fn() }))

const { parseBackup } = await import('./backup')

describe('parseBackup: diary', () => {
  it('turns entries of an older app (two fields) into one text and counts broken ones', () => {
    const file = JSON.stringify({
      app: 'somos',
      version: 1,
      diary: [
        { date: '2026-11-06', learned: 'pretérito', es: 'Ayer fui al cine.', createdAt: 1, updatedAt: 2 },
        { date: '2026-11-07', text: 'ser a estar', createdAt: 3, updatedAt: 4 },
        { date: 'zle' },
      ],
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.diary).toEqual([
      { date: '2026-11-06', text: 'pretérito\n\nAyer fui al cine.', createdAt: 1, updatedAt: 2 },
      { date: '2026-11-07', text: 'ser a estar', createdAt: 3, updatedAt: 4 },
    ])
    expect(result.skipped).toBe(1)
  })
})
