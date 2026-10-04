import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { button } from './helpers.ts'

test('a backup carries the settings to another device', async ({ page }) => {
  const settings = { theme: 'dark', dailyGoal: 50, autoReview: { enabled: false, limit: 10 }, reminder: { enabled: true, time: '07:30' } }
  const backup = {
    app: 'somos',
    version: 1,
    exportedAt: '2026-10-02T10:00:00.000Z',
    customWords: [],
    savedItems: [],
    reviewCards: [],
    attempts: [],
    mistakes: [],
    lessons: {},
    settings,
  }

  await page.goto('/archive/settings')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.locator('input[type=file]').setInputFiles({ name: 'somos-zaloha.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })

  const result = page.getByRole('status').filter({ hasText: 'Obnovené' })
  await expect(result).toContainText('Obnovené sú aj nastavenia.')
  // Notifications have to be allowed on each device: only the reminder's time comes over.
  await expect(result).toContainText('Pripomienku treba na tomto zariadení zapnúť znova.')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // The next backup from this device holds what now applies here.
  const [download] = await Promise.all([page.waitForEvent('download'), button(page, 'Stiahnuť zálohu').tap()])
  const saved = JSON.parse(readFileSync(await download.path(), 'utf8')) as { settings: unknown }
  // The backup had no language (made before there were two): this device keeps its own.
  expect(saved.settings).toEqual({ ...settings, reminder: { enabled: false, time: '07:30' }, language: 'sk' })
})
