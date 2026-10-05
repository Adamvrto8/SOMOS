import { expect, test } from '@playwright/test'

test('a starred word carries its star in Archív → Uložené', async ({ page }) => {
  await page.goto('/word/casa')
  await page.getByRole('button', { name: 'Uložiť do archívu' }).tap()

  await page.goto('/archive')
  const row = page.locator('a[href="/word/casa"]')
  await expect(row).toBeVisible()
  await expect(row.getByRole('img', { name: 'Uložené' })).toBeVisible()
})
