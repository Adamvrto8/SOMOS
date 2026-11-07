import { expect, test } from '@playwright/test'

test('Spanish from Spain: vosotros row, perfecto, Spain words; Mexican stays the default', async ({ page }) => {
  // Mexican by default: no vosotros, carro stays.
  await page.goto('/word/tener')
  await expect(page.getByRole('tabpanel')).not.toContainText('vosotros')
  await page.goto('/word/carro')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('carro')
  // A tip ends with how Mexico uses the point.
  await page.goto('/practice/grammar/hay-estar')
  await expect(page.getByRole('complementary', { name: 'V Mexiku' })).toBeVisible()
  await expect(page.getByText('Hay un Oxxo en la esquina.')).toBeVisible()

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

  // Tips speak of Spain: its own examples and its own note.
  await page.goto('/practice/grammar/hay-estar')
  await expect(page.getByText('Hay un súper en la esquina.')).toBeVisible()
  await expect(page.getByText('Hay un Oxxo en la esquina.')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'V Španielsku' })).toBeVisible()

  // The Mexican word still finds Spain's.
  await page.goto('/search')
  await page.getByRole('searchbox').fill('carro')
  await expect(page.getByRole('link', { name: /coche/ }).first()).toContainText('v Mexiku „carro“')
})

test.describe('a new device', () => {
  // No welcome done yet (the other tests start with it done, playwright.config.ts).
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the welcome asks which Spanish: Spain reloads into it', async ({ page }) => {
    await page.goto('/welcome')
    const spain = page.getByRole('radiogroup', { name: 'Akú španielčinu sa učíš?' }).getByRole('radio', { name: 'Zo Španielska' })
    await expect(page.getByRole('radio', { name: 'Mexická' })).toBeChecked()
    await spain.tap()
    await page.waitForLoadState('load')
    await expect(spain).toBeChecked()
    await expect(page.getByText('Španielčina, ako sa hovorí v Španielsku')).toBeVisible()
    // The tense tips list vosotros in Spain.
    await page.goto('/practice/grammar/presente')
    await expect(page.getByText('hablamos, habláis, hablan')).toBeVisible()
  })
})
