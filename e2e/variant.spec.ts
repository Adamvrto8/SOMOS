import { expect, test } from '@playwright/test'

test('Spanish from Spain: vosotros row, perfecto, Spain words; Mexican stays the default', async ({ page }) => {
  // Mexican by default: no vosotros, carro stays.
  await page.goto('/word/tener')
  await expect(page.getByRole('tabpanel')).not.toContainText('vosotros')
  await page.goto('/word/carro')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('carro')

  // The setting reloads the app into the other Spanish.
  await page.goto('/profile/variant')
  await page.getByRole('radio', { name: 'Zo Španielska' }).tap()
  await page.waitForLoadState('load')
  await expect(page.getByRole('radio', { name: 'Zo Španielska' })).toBeChecked()

  await page.goto('/word/tener')
  await expect(page.getByRole('tabpanel')).toContainText('tenéis')
  await page.getByRole('tab', { name: 'perfecto', exact: true }).tap()
  await expect(page.getByRole('tabpanel')).toContainText('habéis tenido')
  await page.getByRole('tab', { name: 'imperativo', exact: true }).tap()
  await expect(page.getByRole('tabpanel')).toContainText('tened')
  await expect(page.getByRole('tabpanel')).toContainText('no tengáis')

  await page.goto('/word/carro')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('coche')

  // Spain's own verb is there, with its forms; the Mexican one is gone.
  await page.goto('/word/conducir')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('conducir')
  await expect(page.getByRole('tabpanel')).toContainText('conduzco')
  await page.goto('/word/manejar')
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('manejar')
})
