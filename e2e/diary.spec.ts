// e2e/diary.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { button } from './helpers.ts'

const learned = (page: Page) => page.getByLabel('Čo som sa dnes naučil')
const spanish = (page: Page) => page.getByLabel('Po španielsky')
const today = (page: Page) => page.getByRole('link', { name: /^Dnes/ })

test('a diary day: kept after a reload, listed, removed when both fields are cleared', async ({ page }) => {
  await page.goto('/diary')
  await expect(page.getByText('Zatiaľ nemáš žiadny zápis.')).toBeVisible()
  await today(page).tap()
  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)

  await learned(page).fill('el pretérito de ir')
  await spanish(page).fill('Hoy fui al mercado con mi hermana.')
  await expect(page.getByText('Uložené')).toBeVisible()
  await page.reload()
  await expect(spanish(page)).toHaveValue('Hoy fui al mercado con mi hermana.')
  await expect(learned(page)).toHaveValue('el pretérito de ir')

  await page.goto('/diary')
  await expect(today(page)).toContainText('Hoy fui al mercado con mi hermana.')

  // Typed and left at once: the last text is still saved.
  await today(page).tap()
  await learned(page).fill('')
  await spanish(page).fill('')
  await button(page, 'Späť').tap()
  await expect(page).toHaveURL(/\/diary$/)
  await expect(today(page)).toContainText('Dnes ešte nič')
  await expect(page.getByText('Zatiaľ nemáš žiadny zápis.')).toBeVisible()
})

test('the check underlines an unknown word with a suggestion; a verb form opens its verb', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  await spanish(page).fill('Manana tengo clase con Ana.')
  const check = page.getByRole('region', { name: 'Kontrola' })
  await check.getByRole('button', { name: 'Manana' }).tap()
  await expect(check.getByRole('status')).toContainText('„Manana“ nepoznám.')
  await expect(check.getByRole('status')).toContainText('Možno: mañana')
  // A name and known words are not marked.
  await expect(check.getByRole('button')).toHaveCount(1)
  await check.getByRole('link', { name: 'tengo' }).tap()
  await expect(page).toHaveURL(/\/word\/tener$/)
})

test('a wrong or future date goes back to the diary', async ({ page }) => {
  await page.goto('/diary/2026-13-45')
  await expect(page).toHaveURL(/\/diary$/)
  await page.goto('/diary/2999-01-01')
  await expect(page).toHaveURL(/\/diary$/)
})
