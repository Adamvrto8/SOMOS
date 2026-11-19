// e2e/diary.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { button } from './helpers.ts'

const title = (page: Page) => page.getByLabel('Nadpis')
const body = (page: Page) => page.getByLabel('Čo si chceš zapamätať?')
const save = (page: Page) => page.getByRole('button', { name: 'Uložiť', exact: true })
const newNote = (page: Page) => page.getByRole('link', { name: 'Nová poznámka' })
const todays = (page: Page) => page.getByRole('region', { name: 'Dnes' })

test('a new note: "Uložiť" closes it into the list under today, it reopens and stays after a reload', async ({ page }) => {
  await page.goto('/diary')
  await expect(page.getByText('Zatiaľ nemáš žiadnu poznámku.')).toBeVisible()
  await newNote(page).tap()
  await expect(page).toHaveURL(/\/diary\/new$/)
  await expect(body(page)).toBeFocused()

  await title(page).fill('Pretérito de ir')
  await body(page).fill('fui, fuiste, fue\nHoy fui al mercado.')
  // At once, well before the 800 ms of the typing pause: the button stores it.
  await save(page).tap()
  await expect(page).toHaveURL(/\/diary$/)
  const first = todays(page).getByRole('link', { name: /^Pretérito de ir/ })
  await expect(first).toContainText('fui, fuiste, fue Hoy fui al mercado.')

  // A second note the same day, without a title, left by Späť: saved too, listed first.
  await newNote(page).tap()
  await body(page).fill('Hoy comí tacos.\nCon Ana.')
  await button(page, 'Späť').tap()
  await expect(page).toHaveURL(/\/diary$/)
  const links = todays(page).getByRole('link')
  await expect(links).toHaveCount(2)
  await expect(links.first()).toContainText('Hoy comí tacos.')
  await expect(links.first()).toContainText('Con Ana.')

  await first.tap()
  await expect(title(page)).toHaveValue('Pretérito de ir')
  await page.reload()
  await expect(title(page)).toHaveValue('Pretérito de ir')
  await expect(body(page)).toHaveValue('fui, fuiste, fue\nHoy fui al mercado.')
  await expect(page.getByText('Uložené', { exact: true })).toBeVisible()
})

test('a new note left empty adds nothing; a note cleared and left is gone', async ({ page }) => {
  await page.goto('/diary')
  await newNote(page).tap()
  await button(page, 'Späť').tap()
  await expect(page.getByText('Zatiaľ nemáš žiadnu poznámku.')).toBeVisible()

  await newNote(page).tap()
  await body(page).fill('Hola')
  await save(page).tap()
  await todays(page).getByRole('link', { name: /^Hola/ }).tap()
  await body(page).fill('')
  await button(page, 'Späť').tap()
  await expect(page.getByText('Zatiaľ nemáš žiadnu poznámku.')).toBeVisible()
})

test('"Vymazať poznámku" asks first, then removes the note', async ({ page }) => {
  await page.goto('/diary')
  await newNote(page).tap()
  await title(page).fill('ser a estar')
  await save(page).tap()
  await todays(page).getByRole('link', { name: /^ser a estar/ }).tap()

  await page.getByRole('button', { name: 'Vymazať poznámku' }).tap()
  const confirm = page.getByRole('group', { name: 'Naozaj vymazať túto poznámku?' })
  await confirm.getByRole('button', { name: 'Nechať' }).tap()
  await expect(confirm).toHaveCount(0)
  await page.getByRole('button', { name: 'Vymazať poznámku' }).tap()
  await confirm.getByRole('button', { name: 'Vymazať' }).tap()
  await expect(page).toHaveURL(/\/diary$/)
  await expect(page.getByText('Zatiaľ nemáš žiadnu poznámku.')).toBeVisible()
})

test('a note that does not exist goes back to the diary', async ({ page }) => {
  await page.goto('/diary/n-nothing')
  await expect(page).toHaveURL(/\/diary$/)
})

test('the Domov card: a hint and "Napísať", then ✓ and today’s newest note', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Denník' })
  await expect(card).toContainText('Zapíš si, čo si chceš zapamätať')
  await card.getByRole('link', { name: 'Napísať' }).tap()
  await expect(page).toHaveURL(/\/diary\/new$/)
  await body(page).fill('ser vs estar\nestar = kde a ako')
  await save(page).tap()
  await expect(page).toHaveURL(/\/diary$/)

  await page.goto('/')
  await expect(card).toContainText('ser vs estar')
  await expect(card).not.toContainText('estar = kde a ako')
  await expect(card.getByRole('link', { name: 'Napísať' })).toBeVisible()
  await card.getByRole('link', { name: 'Všetky poznámky' }).tap()
  await expect(page).toHaveURL(/\/diary$/)
})

test('the app going to the background saves what was typed at once', async ({ page }) => {
  await page.goto('/diary/new')
  await body(page).fill('Hoy fui al parque.')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  // Well before the 800 ms of the typing pause: only the background save can have stored it.
  await page.waitForTimeout(250)
  const stored = await page.evaluate(
    () =>
      new Promise<string | undefined>((resolve) => {
        const open = indexedDB.open('somos')
        open.onsuccess = () => {
          const rows = open.result.transaction('diaryNotes').objectStore('diaryNotes').getAll()
          rows.onsuccess = () => resolve((rows.result as { text: string }[])[0]?.text)
        }
      }),
  )
  expect(stored).toBe('Hoy fui al parque.')
})
