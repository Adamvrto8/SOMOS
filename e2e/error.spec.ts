import { expect, test } from '@playwright/test'
import { button } from './helpers.ts'

// A screen that crashes leaves the error screen, not a white page (/dev/crash exists only on the dev server).
test('a crash shows the error screen, whose buttons get the app back', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/dev/crash')
  await expect(page.getByRole('heading', { name: 'Niečo sa pokazilo' })).toBeVisible()
  await page.getByText('Podrobnosti chyby').tap()
  await expect(page.getByText('Test crash')).toBeVisible()

  await button(page, 'Obnoviť').tap()
  await expect(page.getByRole('heading', { name: 'Niečo sa pokazilo' })).toBeVisible()

  await button(page, 'Domov').tap()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('navigation', { name: 'Hlavná navigácia' })).toBeVisible()
  expect(errors).toEqual([])
})
