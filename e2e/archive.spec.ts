import { expect, test } from '@playwright/test'

test('a starred word carries its star in Archív → Uložené', async ({ page }) => {
  await page.goto('/word/casa')
  await page.getByRole('button', { name: 'Uložiť do archívu' }).first().tap()
  // The save is written to IndexedDB after the tap: leaving the page before it lands loses it.
  await expect(page.getByRole('button', { name: 'Odstrániť z archívu' }).first()).toBeVisible()

  await page.goto('/archive')
  const row = page.locator('a[href="/word/casa"]')
  await expect(row).toBeVisible()
  await expect(row.getByRole('img', { name: 'Uložené' })).toBeVisible()
})
