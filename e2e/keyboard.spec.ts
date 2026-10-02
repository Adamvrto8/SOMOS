import { expect, test } from '@playwright/test'
import { KEYBOARD_OPEN, SCREEN } from './helpers.ts'

test('the tab bar gives way to the keyboard instead of riding on it', async ({ page }) => {
  await page.goto('/search')
  const tabs = page.getByRole('navigation', { name: 'Hlavná navigácia' })
  const search = page.getByRole('searchbox')
  await search.focus()
  await expect(tabs).toBeVisible()

  await page.setViewportSize(KEYBOARD_OPEN)
  await expect(tabs).toBeHidden()
  await page.setViewportSize(SCREEN)
  await expect(tabs).toBeVisible()

  // A window that is just short, with nothing being typed, is not a keyboard.
  await search.blur()
  await page.setViewportSize(KEYBOARD_OPEN)
  await expect(tabs).toBeVisible()
})
